/** Literal, case-sensitive matches; adjacent/overlapping keywords share a range. */
export function keywordMatches(text: string, keywords: string[], wholeWord = true): [number, number][] {
    const word = new RegExp('[\\p{L}\\p{N}\\p{M}_]', 'u');
    const characterBefore = (offset: number) => Array.from(text.slice(Math.max(0, offset - 2), offset)).pop() || '';
    const matches: [number, number][] = [];
    for (const keyword of keywords) {
        if (!keyword) continue;
        let start = text.indexOf(keyword);
        while (start !== -1) {
            const end = start + keyword.length;
            if (!wholeWord || (!word.test(characterBefore(start)) && !word.test(String.fromCodePoint(text.codePointAt(end) || 32)))) matches.push([start, end]);
            start = text.indexOf(keyword, start + 1);
        }
    }
    matches.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const merged: [number, number][] = [];
    for (const match of matches) {
        const last = merged[merged.length - 1];
        if (last && match[0] <= last[1]) last[1] = Math.max(last[1], match[1]);
        else merged.push([...match] as [number, number]);
    }
    return merged;
}

/** Display-only highlighting. Native highlights never alter rendered Markdown. */
export default class KeywordHighlighter {
    private static serial = 0;
    private name = 'mm-keyword-' + ++KeywordHighlighter.serial;
    keywords: string[] = [];
    wholeWord = true;
    private timer?: ReturnType<typeof setTimeout>;
    private observer: MutationObserver;
    private style: HTMLStyleElement;
    private dirty = new Set<HTMLElement>();
    private cache = new WeakMap<HTMLElement, Range[]>();
    private marked = new Set<HTMLElement>();
    private disposed = false;
    private doc: Document;
    private registry: any;
    private Highlight: any;
    constructor(private map: any) {
        this.doc = map.appEl.ownerDocument;
        const win = this.doc.defaultView as any;
        this.registry = win.CSS?.highlights; this.Highlight = win.Highlight;
        this.style = this.doc.createElement('style');
        this.style.textContent = `::highlight(${this.name}) { background-color: #ffe36a; color: #202020; }`;
        this.doc.head.appendChild(this.style);
        this.observer = new win.MutationObserver((records: MutationRecord[]) => {
            if (!this.keywords.length) return;
            let changed = false;
            for (const record of records) {
                const element = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
                const content = element?.closest('.mm-node-content') as HTMLElement;
                if (content) { this.dirty.add(content); changed = true; }
            }
            if (changed) this.refresh();
        });
        this.observe();
    }
    private observe() { this.observer.observe(this.map.appEl, {subtree: true, childList: true, characterData: true}); }
    set(keywords: string[], wholeWord = this.wholeWord) {
        this.keywords = Array.from(new Set(keywords.map(value => value.trim()).filter(Boolean)));
        this.wholeWord = wholeWord; this.cache = new WeakMap();
        this.render();
    }
    refresh() {
        if (this.disposed || !this.keywords.length || this.timer !== undefined) return;
        this.timer = setTimeout(() => { this.timer = undefined; this.render(); }, 0);
    }
    private unmark(content: HTMLElement) {
        content.querySelectorAll('mark[data-mm-keyword="' + this.name + '"]').forEach(mark => {
            const parent = mark.parentNode;
            while (mark.firstChild) parent!.insertBefore(mark.firstChild, mark);
            mark.remove(); parent?.normalize();
        });
    }
    private ranges(content: HTMLElement) {
        const texts: Text[] = [], offsets: number[] = []; let text = '', previousBlock: Element;
        const walker = this.doc.createTreeWalker(content, 4);
        let item: Node;
        while (item = walker.nextNode()) {
            if ((item.parentElement?.closest('script, style, textarea, [aria-hidden="true"]'))) continue;
            const block = item.parentElement?.closest('p, div, li, td, th, pre, blockquote, h1, h2, h3, h4, h5, h6');
            if (previousBlock && block !== previousBlock) text += '\n';
            previousBlock = block;
            texts.push(item as Text); offsets.push(text.length); text += item.textContent;
        }
        return keywordMatches(text, this.keywords, this.wholeWord).map(([start, end]) => {
            let first = 0, last = texts.length - 1;
            while (first + 1 < texts.length && offsets[first + 1] <= start) first++;
            while (last > first && offsets[last] >= end) last--;
            const range = this.doc.createRange();
            range.setStart(texts[first], start - offsets[first]); range.setEnd(texts[last], end - offsets[last]);
            return range;
        });
    }
    private render() {
        if (this.disposed) return;
        clearTimeout(this.timer); this.timer = undefined;
        this.observer.disconnect();
        try {
            const native = this.registry && this.Highlight;
            const highlight = native ? new this.Highlight() : null;
            // Fallback marks are owned by this instance and never enter node data.
            if (!native) { this.marked.forEach(content => this.unmark(content)); this.marked.clear(); }
            if (this.keywords.length) this.map.traverseAll((node: any) => {
                const content = node.contentEl as HTMLElement;
                if (!node.isShow() || node.data.isEdit || !content?.isConnected) return;
                let ranges = native && !this.dirty.has(content) ? this.cache.get(content) : undefined;
                if (!ranges) { ranges = this.ranges(content); this.cache.set(content, ranges); }
                if (native) ranges.forEach(range => highlight.add(range));
                else if (ranges.length) {
                    // Split each text leaf separately to preserve links and inline formatting.
                    const fragments: {text: Text; start: number; end: number}[] = [];
                    ranges.forEach(range => {
                        const walker = this.doc.createTreeWalker(content, 4); let text: Node;
                        while (text = walker.nextNode()) if (range.intersectsNode(text)) fragments.push({text: text as Text,
                            start: text === range.startContainer ? range.startOffset : 0,
                            end: text === range.endContainer ? range.endOffset : text.textContent!.length});
                    });
                    fragments.reverse().forEach(({text, start, end}) => {
                        if (end <= start) return;
                        const selected = text.splitText(start); selected.splitText(end - start);
                        const mark = this.doc.createElement('mark'); mark.className = 'mm-keyword-highlight'; mark.dataset.mmKeyword = this.name;
                        selected.parentNode!.insertBefore(mark, selected); mark.appendChild(selected);
                    });
                    this.marked.add(content);
                }
            });
            if (native) { if (highlight.size) this.registry.set(this.name, highlight); else this.registry.delete(this.name); }
            this.dirty.clear();
        } finally { if (!this.disposed) this.observe(); }
    }
    destroy() {
        this.disposed = true; clearTimeout(this.timer); this.observer.disconnect();
        this.registry?.delete(this.name); this.marked.forEach(content => this.unmark(content));
        this.marked.clear(); this.dirty.clear(); this.style.remove();
    }
}
