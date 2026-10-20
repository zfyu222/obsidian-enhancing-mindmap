import MindMap from './mindmap/mindmap';
import { findPreset, effectiveNodeStyle, validPresetName, snapshotNodeStyle } from './nodeStyles';
import { renderPresetColorPicker, renderNodeBoxControls } from './StylePresetSettings';
import { editorSelection, applyEditorStyle } from './mindmap/text-format';
import { t } from './lang/helpers';

/** Per-map inspector. Text selection and node selection have separate formatting paths. */
export default class MindMapPanel {
    element: HTMLElement;
    private select: HTMLSelectElement;
    private status: HTMLElement;
    private heading: HTMLElement;
    private presetSection: HTMLElement;
    private fontSize: HTMLInputElement;
    private sizeTimer?: ReturnType<typeof setTimeout>;
    private sizeDraft?: {nodes: any[]; editor?: any; text?: {node: any; text: string; start: number; end: number}; value: number | null};
    private reset: HTMLButtonElement;
    private color: ReturnType<typeof renderPresetColorPicker>;
    private box: ReturnType<typeof renderNodeBoxControls>;
    private buttons: Record<string,HTMLButtonElement> = {};
    private textSelection?: {node: any; text: string; start: number; end: number};
    private pending = false;
    private savePreset: HTMLButtonElement;
    private presetForm: HTMLFormElement;
    private presetName: HTMLInputElement;
    private presetError: HTMLElement;
    private presetSubmit: HTMLButtonElement;
    private presetSource?: {node: any; style: ReturnType<typeof snapshotNodeStyle>};
    private savingPreset = false;
    private doc: Document;
    constructor(private map: MindMap, host: HTMLElement, manage: () => void, private mobile = false) {
        this.doc = host.ownerDocument;
        this.element = document.createElement('aside'); this.element.className = 'mm-side-panel';
        this.element.setAttribute('aria-label', t('Mind map panel')); host.appendChild(this.element);
        const title = document.createElement('h3'); title.textContent = t('Mind map panel'); this.element.appendChild(title);
        if (mobile) {
            this.element.classList.add('mm-mobile-panel'); this.element.hidden = true;
            const close = document.createElement('button'); close.type = 'button';
            close.className = 'mm-panel-close'; close.textContent = '×';
            close.setAttribute('aria-label', t('Close mind map panel'));
            close.addEventListener('click', () => { this.hide(); map.focusAfterHistory(); });
            this.element.insertBefore(close, title);
            map.appEl.addEventListener('click', this.canvasClick);
        }
        const section = document.createElement('section'); this.element.appendChild(section);
        this.heading = document.createElement('h4'); section.appendChild(this.heading);
        this.status = document.createElement('p'); this.status.className = 'mm-panel-status'; section.appendChild(this.status);
        this.color = renderPresetColorPicker(section, undefined, () => this.apply('color', this.color.value), false);
        const sizeRow = document.createElement('div'); sizeRow.className = 'mm-panel-size'; section.appendChild(sizeRow);
        const sizeLabel = document.createElement('label'); sizeLabel.textContent = t('Font size'); sizeRow.appendChild(sizeLabel);
        this.fontSize = document.createElement('input'); this.fontSize.type = 'number'; this.fontSize.min = '8'; this.fontSize.max = '72';
        this.fontSize.placeholder = t('Default'); this.fontSize.setAttribute('aria-label', t('Font size')); sizeLabel.appendChild(this.fontSize);
        this.fontSize.step = 'any';
        this.fontSize.addEventListener('input', this.scheduleFontSize);
        const toggles = document.createElement('div'); toggles.className = 'mm-panel-format-buttons'; section.appendChild(toggles);
        for (const [key, label, text] of [['bold','Bold','B'],['italic','Italic','I'],['underline','Underline','U'],['strike','Strikethrough','S']]) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
            button.setAttribute('aria-label', t(label as any)); button.title = t(label as any); button.dataset.format = key;
            button.addEventListener('mousedown', e => e.preventDefault()); button.addEventListener('click', () => this.apply(key));
            this.buttons[key] = button; toggles.appendChild(button);
        }
        this.box = renderNodeBoxControls(section, patch => {
            if (this.pending || this.textSelection || map.isComposing || !map.getSelectedNodes().length) return;
            this.cancelFontSize(); map.applyLocalNodeStyle(patch); this.update();
        });
        this.reset = document.createElement('button'); this.reset.type = 'button'; this.reset.textContent = t('Clear local node style');
        this.reset.addEventListener('click', () => { this.cancelFontSize(); map.applyLocalNodeStyle(); map.focusAfterHistory(); }); section.appendChild(this.reset);
        this.presetSection = document.createElement('section'); this.presetSection.className = 'mm-panel-presets'; this.element.appendChild(this.presetSection);
        const presetLabel = document.createElement('h4'); presetLabel.textContent = t('Node style preset'); this.presetSection.appendChild(presetLabel);
        this.select = document.createElement('select'); this.select.setAttribute('aria-label', t('Node style preset')); this.presetSection.appendChild(this.select);
        this.select.addEventListener('change', () => {
            if (this.textSelection || this.select.value === '__mixed__') return;
            this.cancelFontSize();
            map.applyStylePreset(this.select.value || undefined); map.focusAfterHistory();
        });
        this.savePreset = document.createElement('button'); this.savePreset.type = 'button'; this.savePreset.textContent = t('Save node style as preset');
        this.savePreset.addEventListener('mousedown', event => event.preventDefault());
        this.savePreset.addEventListener('click', () => {
            const nodes = map.getSelectedNodes();
            if (this.textSelection || nodes.length !== 1 || map.isComposing) return;
            const draft = this.sizeDraft; this.cancelFontSize();
            if (draft && this.sameSizeContext(draft)) this.apply('fontSize', draft.value, true);
            map.finishEditingForHistory();
            this.presetSource = {node: nodes[0], style: snapshotNodeStyle(nodes[0], map.setting.nodeStylePresets || [], map.setting.defaultNodeStyle)};
            this.presetForm.hidden = false; this.presetError.textContent = ''; this.presetName.value = ''; this.presetName.focus();
        });
        this.presetSection.appendChild(this.savePreset);
        this.presetForm = document.createElement('form'); this.presetForm.className = 'mm-panel-save-preset'; this.presetForm.hidden = true;
        const nameLabel = document.createElement('label'); nameLabel.textContent = t('Preset name'); this.presetForm.appendChild(nameLabel);
        this.presetName = document.createElement('input'); this.presetName.type = 'text'; this.presetName.maxLength = 80;
        this.presetName.setAttribute('aria-label', t('New preset name')); nameLabel.appendChild(this.presetName);
        this.presetError = document.createElement('p'); this.presetError.className = 'mm-preset-error'; this.presetError.setAttribute('role','alert'); this.presetForm.appendChild(this.presetError);
        this.presetSubmit = document.createElement('button'); this.presetSubmit.type = 'submit'; this.presetSubmit.textContent = t('Save preset'); this.presetForm.appendChild(this.presetSubmit);
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = t('Cancel saving preset');
        cancel.addEventListener('click', () => { this.presetForm.hidden = true; this.presetSource = undefined; map.focusAfterHistory(); }); this.presetForm.appendChild(cancel);
        this.presetForm.addEventListener('submit', event => { event.preventDefault(); void this.createPreset(); });
        this.presetSection.appendChild(this.presetForm);
        const settings = document.createElement('button'); settings.type = 'button'; settings.textContent = t('Manage style presets');
        settings.addEventListener('click', manage); this.presetSection.appendChild(settings);
        // Capture the range before a number input or native color picker takes focus.
        this.element.addEventListener('pointerdown', this.captureRange, true);
        this.doc.addEventListener('selectionchange', this.selectionChange);
        map.on('toolbarChange', this.update); map.on('mindMapChange', this.update); map.appEl.addEventListener('input', this.selectionChange);
        this.update();
    }
    private hide() { this.element.hidden = true; this.cancelFontSize(); }
    private canvasClick = (event: MouseEvent) => {
        if (Date.now() < this.map._suppressClickUntil || this.map.editNode?.data.isEdit) return;
        const target = event.target as HTMLElement;
        const element = target.closest?.('.mm-node');
        const node = element && this.map.getNodeById(element.getAttribute('data-id'));
        if (node && this.map.getSelectedNodes().includes(node) && !target.closest('a, .mm-node-menu, .mm-node-bar')) {
            this.element.hidden = false; this.update();
        } else if (!element) this.hide();
    };
    private cancelFontSize() {
        clearTimeout(this.sizeTimer); this.sizeTimer = undefined; this.sizeDraft = undefined;
    }
    private sameSizeContext(draft: NonNullable<MindMapPanel['sizeDraft']>) {
        const nodes = this.map.getSelectedNodes(), text = this.textSelection;
        const editor = this.map.editNode?.data.isEdit ? this.map.editNode : undefined;
        return !this.map.isComposing && editor === draft.editor && nodes.length === draft.nodes.length &&
            draft.nodes.every(node => nodes.includes(node) && this.map.getNodeById(node.getId()) === node) &&
            (!draft.text ? !text : !!text && text.node === draft.text.node && text.text === draft.text.text && text.start === draft.text.start && text.end === draft.text.end);
    }
    private scheduleFontSize = () => {
        this.cancelFontSize();
        if (this.pending || this.map.isComposing || this.fontSize.validity.badInput) return;
        const value = this.fontSize.value ? Number(this.fontSize.value) : null;
        if (value !== null && (!Number.isFinite(value) || value < 8 || value > 72)) return;
        const nodes = this.map.getSelectedNodes(); if (!nodes.length) return;
        this.sizeDraft = {nodes, editor: this.map.editNode?.data.isEdit ? this.map.editNode : undefined,
            text: this.textSelection ? {...this.textSelection} : undefined, value};
        this.sizeTimer = setTimeout(() => {
            const draft = this.sizeDraft; this.sizeTimer = undefined; this.sizeDraft = undefined;
            if (draft && this.sameSizeContext(draft)) this.apply('fontSize', draft.value, true);
        }, 500);
    };
    private async createPreset() {
        const source = this.presetSource, plugin = this.map.view?.plugin;
        if (!source || !plugin || this.savingPreset || this.map.isComposing) return;
        const name = this.presetName.value.trim();
        const presets = plugin.settings.nodeStylePresets || [];
        if (!validPresetName(name) || findPreset(presets, name)) { this.presetError.textContent = t('Invalid preset name'); return; }
        if (this.map.getNodeById(source.node.getId()) !== source.node) { this.presetForm.hidden = true; this.presetSource = undefined; return; }
        this.savingPreset = true; this.presetSubmit.disabled = true;
        plugin.settings.nodeStylePresets = [...presets, {name, ...source.style}];
        try {
            await plugin.saveSettings();
            // Bind the original node only if it is still the sole selected node.
            const selected = this.map.getSelectedNodes();
            if (this.map.getNodeById(source.node.getId()) === source.node && selected.length === 1 && selected[0] === source.node && !this.textSelection) {
                this.map.setting.nodeStylePresets = plugin.settings.nodeStylePresets;
                this.map.applyStylePreset(name); this.map.focusAfterHistory();
            }
            this.presetForm.hidden = true; this.presetSource = undefined;
        } catch (_) {
            plugin.settings.nodeStylePresets = presets;
            this.presetError.textContent = t('Unable to save presets');
        } finally { this.savingPreset = false; this.presetSubmit.disabled = false; this.update(); }
    }
    private captureRange = () => {
        const node = this.map.editNode || this.map.selectNode;
        if (!node?.data.isEdit) { this.textSelection = undefined; return; }
        const range = editorSelection(node.contentEl);
        if (range) this.textSelection = {node, ...range};
    };
    private selectionChange = () => {
        if (this.pending) return;
        const node = this.map.editNode || this.map.selectNode;
        if (!node?.data.isEdit || (this.textSelection && this.textSelection.node !== node)) this.textSelection = undefined;
        if (node?.data.isEdit) {
            const range = editorSelection(node.contentEl);
            if (range) this.textSelection = {node, ...range};
            else if (!this.element.contains(this.doc.activeElement)) this.textSelection = undefined;
        }
        this.update();
    };
    private apply(key: string, value?: any, keepSizeFocus = false) {
        if (this.pending || this.map.isComposing) return;
        const saved = this.textSelection;
        const focusSize = keepSizeFocus && this.doc.activeElement === this.fontSize;
        if (saved) {
            const style = key === 'color' ? (value || 'default') : key === 'fontSize' ? 'size:' + (value ?? 'default') : key;
            this.pending = true;
            const started = applyEditorStyle(this.map, saved.node, saved, style, () => { this.pending = false; this.selectionChange(); if (focusSize) this.fontSize.focus({preventScroll: true}); });
            if (!started) { this.pending = false; this.selectionChange(); }
        } else {
            const nodes = this.map.getSelectedNodes();
            if (!nodes.length) return;
            if (value === undefined) value = !nodes.every(node => !!(effectiveNodeStyle(node, this.map.setting.nodeStylePresets || [], this.map.setting.defaultNodeStyle) as any)[key]);
            this.map.applyLocalNodeStyle({[key]: value}); if (!keepSizeFocus) this.map.focusAfterHistory();
        }
        this.update();
    }
    update = () => {
        if (this.pending) return;
        const nodes = this.map.root ? this.map.getSelectedNodes() : [];
        if (this.mobile && !nodes.length) this.hide();
        const presets = this.map.setting.nodeStylePresets || [];
        if (this.textSelection && (!this.textSelection.node.data.isEdit || this.map.getNodeById(this.textSelection.node.getId()) !== this.textSelection.node)) this.textSelection = undefined;
        if (this.sizeDraft && !this.sameSizeContext(this.sizeDraft)) this.cancelFontSize();
        const saved = this.textSelection;
        const textMode = !!saved;
        const disabled = this.map.isComposing || (textMode ? false : !nodes.length);
        this.heading.textContent = t(textMode ? 'Selected text style' : 'Node style');
        this.status.textContent = textMode ? t('Only selected text is affected') : nodes.length ? t('Selected nodes') + ': ' + nodes.length : t('Select a node to style');
        this.presetSection.hidden = textMode; this.select.disabled = textMode || !nodes.length; this.reset.hidden = textMode; this.reset.disabled = disabled;
        this.savePreset.disabled = disabled || textMode || nodes.length !== 1 || !this.map.view?.plugin || this.savingPreset;
        this.savePreset.title = nodes.length !== 1 ? t('Select one node to save preset') : t('Save node style as preset');
        if (this.presetSource && (textMode || nodes.length !== 1 || nodes[0] !== this.presetSource.node)) {
            this.presetForm.hidden = true; this.presetSource = undefined;
        }
        this.color.setDisabled(disabled); this.fontSize.disabled = disabled;
        const styles = nodes.map(node => effectiveNodeStyle(node, presets, this.map.setting.defaultNodeStyle));
        const common = (key: string) => styles.length && styles.every(s => (s as any)[key] === (styles[0] as any)[key]) ? (styles[0] as any)[key] : undefined;
        this.box.element.hidden = textMode;
        this.box.setValue({shape: common('shape'), borderColor: common('borderColor'), borderWidth: common('borderWidth'), backgroundColor: common('backgroundColor')}, disabled || textMode);
        const sizes = nodes.map((node, index) => {
            const explicit = styles[index].fontSize;
            if (typeof explicit === 'number') return explicit;
            const computed = parseFloat(this.doc.defaultView?.getComputedStyle(node.contentEl).fontSize || '');
            return Number.isFinite(computed) && computed > 0 ? computed : (this.map.setting.fontSize || 16);
        });
        const sizeMixed = sizes.some(size => Math.abs(size - sizes[0]) > 0.01);
        const defaultSize = sizes.length && !sizeMixed ? Number(sizes[0].toFixed(2)).toString() : '';
        this.fontSize.placeholder = sizeMixed ? t('Mixed font sizes') : defaultSize ? `${t('Default')} (${defaultSize})` : t('Default');
        this.fontSize.title = sizeMixed ? t('Mixed font sizes') : defaultSize ? `${t('Current font size')}: ${defaultSize} px` : t('Font size');
        if (saved) {
            // Display inline span properties only; a node preset is never a text preset.
            const stack: string[] = [];
            const tags = /<span style="([^"<>]+)">|<\/span>/g;
            let match: RegExpExecArray;
            const before = saved.text.slice(0,saved.start);
            while (match = tags.exec(before)) { if (match[1]) stack.push(match[1]); else stack.pop(); }
            let color = '', size = '';
            stack.forEach(css => {
                const c = /(?:^|;)color:(#[0-9a-f]{6})(?:;|$)/i.exec(css);
                const n = /(?:^|;)font-size:([0-9]+(?:\.[0-9]+)?)px(?:;|$)/.exec(css);
                if (c) color = c[1]; if (n) size = n[1];
            });
            this.color.setValue(color);
            if (!this.sizeDraft && this.doc.activeElement !== this.fontSize) this.fontSize.value = size;
        } else {
            this.color.setValue(common('color'));
            if (!this.sizeDraft && this.doc.activeElement !== this.fontSize) this.fontSize.value = common('fontSize')?.toString() || '';
        }
        for (const key of Object.keys(this.buttons)) {
            const button = this.buttons[key]; button.disabled = disabled;
            let pressed = 'false';
            if (saved) {
                const before = saved.text.slice(0,saved.start), after = saved.text.slice(saved.end), selected = saved.text.slice(saved.start,saved.end);
                const markers: Record<string,string> = {bold:'**',italic:'*',strike:'~~',underline:'<u>'};
                const open = markers[key], close = key === 'underline' ? '</u>' : open;
                pressed = String((before.endsWith(open) && after.startsWith(close)) || (selected.startsWith(open) && selected.endsWith(close)));
            } else if (styles.length) pressed = styles.every(s => !!(s as any)[key]) ? 'true' : styles.some(s => !!(s as any)[key]) ? 'mixed' : 'false';
            button.setAttribute('aria-pressed', pressed);
        }
        const values = new Set(nodes.map(node => findPreset(presets,node.data.stylePreset)?.name || node.data.stylePreset || ''));
        const mixed = values.size > 1, value = values.values().next().value || '';
        this.select.textContent = '';
        const option = (value: string, text: string) => { const el=document.createElement('option'); el.value=value; el.textContent=text; this.select.appendChild(el); };
        option('',t('No preset')); presets.forEach(p=>option(p.name,p.name));
        if (mixed) option('__mixed__',t('Mixed presets')); else if (value && !findPreset(presets,value)) option(value,t('Missing preset')+': '+value);
        this.select.value = mixed ? '__mixed__' : value;
    };
    toggle() { this.element.hidden = !this.element.hidden; if (this.element.hidden) this.cancelFontSize(); }
    destroy() {
        this.cancelFontSize();
        this.map.appEl.removeEventListener('click', this.canvasClick);
        this.doc.removeEventListener('selectionchange', this.selectionChange);
        this.map.off('toolbarChange',this.update); this.map.off('mindMapChange',this.update); this.map.appEl.removeEventListener('input',this.selectionChange); this.element.remove();
    }
}
