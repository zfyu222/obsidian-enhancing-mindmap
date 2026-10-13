import { t } from '../lang/helpers';

export function formatSelection(text: string, start: number, end: number, style: string) {
    if (start < 0 || end > text.length || start >= end) return null;
    let before = text.slice(0, start), selected = text.slice(start, end), after = text.slice(end);
    const markers: Record<string, string> = { bold: '**', italic: '*', strike: '~~', highlight: '==' };
    const marker = markers[style];
    if (marker) {
        // Markdown emphasis cannot open/close against whitespace.
        const leading = /^\s*/.exec(selected)[0], trailing = /\s*$/.exec(selected)[0];
        if (leading.length === selected.length) return null;
        before += leading; after = trailing + after;
        selected = selected.slice(leading.length, selected.length - trailing.length);
        const italicOutside = ((/\*+$/.exec(before)?.[0].length || 0) % 2 === 1) && ((/^\*+/.exec(after)?.[0].length || 0) % 2 === 1);
        const italicInside = ((/^\*+/.exec(selected)?.[0].length || 0) % 2 === 1) && ((/\*+$/.exec(selected)?.[0].length || 0) % 2 === 1);
        if (before.endsWith(marker) && after.startsWith(marker) && (style !== 'italic' || italicOutside)) {
            before = before.slice(0, -marker.length); after = after.slice(marker.length);
        } else if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2 && (style !== 'italic' || italicInside)) {
            selected = selected.slice(marker.length, -marker.length);
        } else { before += marker; after = marker + after; }
    } else {
        if (style !== 'default' && !/^#[0-9a-f]{6}$/i.test(style)) return null;
        const opening = /<span style="color:\s*#[0-9a-f]{6}">$/i.exec(before);
        const full = /^<span style="color:\s*#[0-9a-f]{6}">([\s\S]*)<\/span>$/i.exec(selected);
        if (opening && after.startsWith('</span>')) {
            before = before.slice(0, -opening[0].length); after = after.slice(7);
        } else if (full) selected = full[1];
        if (style !== 'default') { before += `<span style="color:${style.toLowerCase()}">`; after = '</span>' + after; }
    }
    return { text: before + selected + after, start: before.length, end: before.length + selected.length };
}

// Render cloned prefixes to count hard line breaks in contenteditable DOM,
// including <br> and the <div> elements browsers insert while typing.
export function editorSelection(editor: HTMLElement) {
    const selection = editor.ownerDocument.defaultView?.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;
    const prefixLength = (container: Node, offset: number) => {
        const prefix = editor.ownerDocument.createRange(); prefix.selectNodeContents(editor); prefix.setEnd(container, offset);
        const clone = editor.ownerDocument.createElement('div');
        clone.style.cssText = 'position:fixed;left:-100000px;top:0;white-space:pre-wrap;opacity:0;pointer-events:none';
        clone.appendChild(prefix.cloneContents()); editor.ownerDocument.body.appendChild(clone);
        const length = clone.innerText.replace(/\r\n/g, '\n').length; clone.remove(); return length;
    };
    const text = editor.innerText.replace(/\r\n/g, '\n');
    const start = prefixLength(range.startContainer, range.startOffset), end = prefixLength(range.endContainer, range.endOffset);
    return start < end && end <= text.length ? { text, start, end } : null;
}

export function selectEditorOffsets(editor: HTMLElement, start: number, end: number) {
    const point = (offset: number): [Node, number] => {
        const walker = editor.ownerDocument.createTreeWalker(editor, 5); let node: Node;
        while (node = walker.nextNode()) {
            if (node.nodeType === 3) {
                if (offset <= node.textContent.length) return [node, offset];
                offset -= node.textContent.length;
            } else if ((node as HTMLElement).tagName === 'BR') {
                if (!offset) return [node.parentNode, Array.prototype.indexOf.call(node.parentNode.childNodes, node)];
                offset--;
            }
        }
        return [editor, editor.childNodes.length];
    };
    const range = editor.ownerDocument.createRange(); range.setStart(...point(start)); range.setEnd(...point(end));
    const selection = editor.ownerDocument.defaultView.getSelection(); selection.removeAllRanges(); selection.addRange(range);
}

export default class TextFormatMenu {
    element?: HTMLElement;
    private cleanup?: () => void;
    constructor(private map: any) {}
    close() { this.cleanup?.(); this.cleanup = undefined; this.element?.remove(); this.element = undefined; }
    show(event: MouseEvent): boolean {
        this.close();
        const node = this.map.editNode || this.map.selectNode;
        if (this.map.isComposing || !node?.data.isEdit || !node.contentEl.contains(event.target as Node)) return false;
        const saved = editorSelection(node.contentEl); if (!saved) return false;
        const doc: Document = node.contentEl.ownerDocument, menu = doc.createElement('div');
        menu.className = 'mm-text-format-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', t('Text format'));
        this.element = menu;
        const apply = (style: string) => {
            if (this.map.getNodeById(node.getId()) !== node || !node.data.isEdit || node.contentEl.innerText.replace(/\r\n/g, '\n') !== saved.text) { this.close(); return; }
            const result = formatSelection(saved.text, saved.start, saved.end, style); this.close();
            if (!result || result.text === saved.text) return;
            // Commit an existing draft before recording the formatting as its own undo step.
            this.map.finishEditingForHistory();
            this.map.execute('changeNodeText', { node, oldText: node.data.text, text: result.text.trim() });
            this.map.setSelectedNodes([node]);
            setTimeout(() => {
                if (this.map.getNodeById(node.getId()) !== node || this.map.selectNode !== node || node.data.text !== result.text.trim() || this.map.editNode?.data.isEdit) return;
                node.edit();
                const leading = result.text.length - result.text.replace(/^\s+/, '').length;
                selectEditorOffsets(node.contentEl, Math.max(0, result.start - leading), Math.min(node.data.text.length, result.end - leading));
                this.map.emit('toolbarChange');
            }, 0);
        };
        const button = (id: string, label: string, style: string, color?: string) => {
            const el = doc.createElement('button'); el.type = 'button'; el.textContent = label;
            el.dataset.format = id; el.setAttribute('role', 'menuitem');
            if (color) { el.style.setProperty('--mm-swatch', color); el.classList.add('mm-text-color'); }
            el.addEventListener('mousedown', e => e.preventDefault()); el.addEventListener('click', () => apply(style));
            menu.appendChild(el);
        };
        button('bold', t('Bold'), 'bold'); button('italic', t('Italic'), 'italic');
        button('strike', t('Strikethrough'), 'strike'); button('highlight', t('Highlight'), 'highlight');
        const separator = doc.createElement('div'); separator.className = 'mm-text-format-separator'; menu.appendChild(separator);
        [['Red', '#e53935'], ['Orange', '#fb8c00'], ['Yellow', '#fbc02d'], ['Green', '#43a047'], ['Blue', '#1e88e5'], ['Purple', '#8e24aa']].forEach(([label, color]) => button(color, t(label as any), color, color));
        button('default', t('Default text color'), 'default');
        const custom = doc.createElement('label'); custom.className = 'mm-text-custom-color'; custom.textContent = t('Custom text color');
        const picker = doc.createElement('input'); picker.type = 'color'; picker.value = '#1e88e5'; picker.setAttribute('aria-label', t('Custom text color'));
        picker.addEventListener('change', () => apply(picker.value)); custom.appendChild(picker); menu.appendChild(custom);
        doc.body.appendChild(menu);
        const bounds = menu.getBoundingClientRect();
        menu.style.left = Math.max(4, Math.min(event.clientX, doc.documentElement.clientWidth - bounds.width - 4)) + 'px';
        menu.style.top = Math.max(4, Math.min(event.clientY, doc.documentElement.clientHeight - bounds.height - 4)) + 'px';
        const outside = (e: MouseEvent) => { if (!menu.contains(e.target as Node)) this.close(); };
        const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); node.contentEl.focus(); } };
        const scroll = (e: Event) => { if (!menu.contains(e.target as Node)) this.close(); };
        doc.addEventListener('mousedown', outside, true); doc.addEventListener('keydown', escape, true);
        doc.addEventListener('scroll', scroll, true);
        this.cleanup = () => { doc.removeEventListener('mousedown', outside, true); doc.removeEventListener('keydown', escape, true); doc.removeEventListener('scroll', scroll, true); };
        return true;
    }
}
