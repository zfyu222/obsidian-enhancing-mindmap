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

/** Split overlaps deterministically: longest keyword wins, then insertion order. */
export function keywordSpans(text: string, keywords: string[], wholeWord = true) {
    const events: {position: number; hit: {start: number; end: number; keyword: string; order: number}; add: boolean}[] = [];
    keywords.forEach((keyword, order) => keywordMatches(text, [keyword], wholeWord).forEach(([start, end]) => {
        const hit = {start, end, keyword, order}; events.push({position: start, hit, add: true}, {position: end, hit, add: false});
    }));
    events.sort((a, b) => a.position - b.position);
    const active = new Set<typeof events[0]['hit']>(), spans: {start: number; end: number; keyword: string}[] = [];
    let previous = 0;
    for (let i = 0; i < events.length;) {
        const position = events[i].position;
        if (position > previous && active.size) {
            const winner = Array.from(active).sort((a, b) => b.keyword.length - a.keyword.length || a.order - b.order)[0];
            const last = spans[spans.length - 1];
            if (last && last.end === previous && last.keyword === winner.keyword) last.end = position;
            else spans.push({start: previous, end: position, keyword: winner.keyword});
        }
        while (i < events.length && events[i].position === position) { const event = events[i++]; event.add ? active.add(event.hit) : active.delete(event.hit); }
        previous = position;
    }
    return spans;
}
export function keywordTextColor(color: string) {
    const n = parseInt(color.slice(1), 16);
    return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 145 ? '#202020' : '#ffffff';
}
/** Display-only highlighting. Native highlights never alter rendered Markdown. */
export default class KeywordHighlighter {
    private static serial = 0;
    private name = 'mm-keyword-' + ++KeywordHighlighter.serial;
    keywords: string[] = [];
    private colors = new Map<string, string>();
    private registered = new Set<string>();
    wholeWord = true;
    private timer?: ReturnType<typeof setTimeout>;
    private observer: MutationObserver;
    private style: HTMLStyleElement;
    private dirty = new Set<HTMLElement>();
    private cache = new WeakMap<HTMLElement, {range: Range; keyword: string}[]>();
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
    color(keyword: string) { return this.colors.get(keyword) || '#ffe36a'; }
    setColor(keyword: string, color: string) {
        if (!this.keywords.includes(keyword) || !/^#[0-9a-f]{6}$/i.test(color)) return;
        this.colors.set(keyword, color.toLowerCase()); this.render(); this.map.emit?.('keywordHighlightsChange');
    }
    add(keyword: string) { this.set([...this.keywords, keyword]); }
    set(keywords: string[], wholeWord = this.wholeWord, colors?: string[]) {
        this.keywords = Array.from(new Set(keywords.map(value => value.trim()).filter(Boolean)));
        const palette = ['#ffe36a', '#8dd8ff', '#a8e6a1', '#ffb5ca', '#d1b3ff', '#ffc18a'];
        const next = new Map<string, string>();
        this.keywords.forEach((keyword, index) => {
            const saved = colors?.[index];
            next.set(keyword, saved && /^#[0-9a-f]{6}$/i.test(saved) ? saved : this.colors.get(keyword) || palette.find(color => !Array.from(next.values()).includes(color)) || palette[index % palette.length]);
        });
        this.colors = next;
        this.wholeWord = wholeWord; this.cache = new WeakMap();
        this.render(); this.map.emit?.('keywordHighlightsChange');
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
        return keywordSpans(text, this.keywords, this.wholeWord).map(({start, end, keyword}) => {
            let first = 0, last = texts.length - 1;
            while (first + 1 < texts.length && offsets[first + 1] <= start) first++;
            while (last > first && offsets[last] >= end) last--;
            const range = this.doc.createRange();
            range.setStart(texts[first], start - offsets[first]); range.setEnd(texts[last], end - offsets[last]);
            return {range, keyword};
        });
    }
    private render() {
        if (this.disposed) return;
        clearTimeout(this.timer); this.timer = undefined;
        this.observer.disconnect();
        try {
            const native = this.registry && this.Highlight;
            const groups = new Map<string, any>();
            this.registered.forEach(name => this.registry?.delete(name)); this.registered.clear();
            this.style.textContent = this.keywords.map((keyword, index) => `::highlight(${this.name}${index ? '-' + index : ''}) { background-color: ${this.color(keyword)}; color: ${keywordTextColor(this.color(keyword))}; }`).join('\n');
            if (native) this.keywords.forEach(keyword => groups.set(keyword, new this.Highlight()));
            // Fallback marks are owned by this instance and never enter node data.
            if (!native) { this.marked.forEach(content => this.unmark(content)); this.marked.clear(); }
            if (this.keywords.length) this.map.traverseAll((node: any) => {
                const content = node.contentEl as HTMLElement;
                if (!node.isShow() || node.data.isEdit || !content?.isConnected) return;
                let ranges = native && !this.dirty.has(content) ? this.cache.get(content) : undefined;
                if (!ranges) { ranges = this.ranges(content); this.cache.set(content, ranges); }
                if (native) ranges.forEach(({range, keyword}) => groups.get(keyword).add(range));
                else if (ranges.length) {
                    // Split each text leaf separately to preserve links and inline formatting.
                    const fragments: {text: Text; start: number; end: number; keyword: string}[] = [];
                    ranges.forEach(({range, keyword}) => {
                        const walker = this.doc.createTreeWalker(content, 4); let text: Node;
                        while (text = walker.nextNode()) if (range.intersectsNode(text)) fragments.push({text: text as Text,
                            start: text === range.startContainer ? range.startOffset : 0,
                            end: text === range.endContainer ? range.endOffset : text.textContent!.length, keyword});
                    });
                    fragments.reverse().forEach(({text, start, end, keyword}) => {
                        if (end <= start) return;
                        const selected = text.splitText(start); selected.splitText(end - start);
                        const mark = this.doc.createElement('mark'); mark.className = 'mm-keyword-highlight'; mark.dataset.mmKeyword = this.name;
                        mark.style.backgroundColor = this.color(keyword); mark.style.color = keywordTextColor(this.color(keyword));
                        selected.parentNode!.insertBefore(mark, selected); mark.appendChild(selected);
                    });
                    this.marked.add(content);
                }
            });
            if (native) this.keywords.forEach((keyword, index) => {
                const highlight = groups.get(keyword), name = this.name + (index ? '-' + index : '');
                if (highlight.size) { this.registry.set(name, highlight); this.registered.add(name); }
            });
            this.dirty.clear();
        } finally { if (!this.disposed) this.observe(); }
    }
    destroy() {
        this.disposed = true; clearTimeout(this.timer); this.observer.disconnect();
        this.registered.forEach(name => this.registry?.delete(name)); this.registered.clear(); this.marked.forEach(content => this.unmark(content));
        this.marked.clear(); this.dirty.clear(); this.style.remove();
    }
}
