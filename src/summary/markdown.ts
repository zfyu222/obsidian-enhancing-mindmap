import { readStyleMarker, styleMarker } from '../nodeStyles';
export interface SummaryData { id: string; memberIds: string[]; root: any }
const START = '<!-- mm:summaries:start {"version":1} -->';
const END = '<!-- mm:summaries:end -->';
export function extractSummaries(markdown: string) {
    let start = -1, offset = 0, fence = '';
    for (const line of markdown.split(/(?<=\n)/)) {
        const delimiter = /^\s*(`{3,}|~{3,})/.exec(line);
        if (delimiter) { if (!fence) fence = delimiter[1][0]; else if (delimiter[1][0] === fence) fence = ''; }
        if (!fence && line.startsWith('<!-- mm:summaries:start')) { start = offset; break; }
        offset += line.length;
    }
    if (start < 0) return { main: markdown, entries: [] as SummaryData[], preserved: '', error: '' };
    const raw = markdown.slice(start);
    const main = markdown.slice(0, start).trimEnd();
    const entries: SummaryData[] = [];
    try {
        if (!raw.startsWith(START) || !raw.trimEnd().endsWith(END) || raw.indexOf(END) !== raw.lastIndexOf(END)) throw Error('Unknown or malformed summary section');
        const body = raw.slice(START.length, raw.lastIndexOf(END));
        const chunks = body.split(/(?=^### .*<!-- mm:summary )/m);
        if (chunks.shift()!.trim() !== '## 概括子树区') throw Error('Unexpected content in summary section');
        const ids = new Set<string>();
        for (const chunk of chunks) {
            const lines = chunk.trimEnd().split('\n');
            const header = /^### (.*?)\s*<!-- mm:summary (\{.*\}) -->\s*$/.exec(lines.shift()!);
            if (!header) throw Error('Malformed summary');
            const meta = JSON.parse(header[2]);
            if (typeof meta.id !== 'string' || !/^[\w-]{1,128}$/.test(meta.id) || ids.has(meta.id) || !Array.isArray(meta.members) || !meta.members.length || meta.members.some((id: any) => typeof id !== 'string' || !/^[\w-]{1,128}$/.test(id)) || new Set(meta.members).size !== meta.members.length) throw Error('Invalid summary references');
            if (Object.keys(meta).some(key=>!['id','members','expanded'].includes(key))) throw Error('Unknown summary metadata');
            ids.add(meta.id);
            const root: any = { id: meta.id, text: readStyleMarker(header[1]).text, stylePreset: readStyleMarker(header[1]).name, nodeStyle: readStyleMarker(header[1]).overrides, expanded: meta.expanded !== false, children: [] };
            const stack: any[] = [root];
            let current = root, fence = /^\s*(```|~~~)/.test(root.text);
            for (const line of lines) {
                if (!line.trim()) { current.text += '\n'; continue; }
                const item = /^( *)- (.*?)(?:\s*<!-- mm:item (\{.*\}) -->)?\s*$/.exec(line);
                if (item && !fence) {
                    const depth = item[1].length / 2;
                    if (!Number.isInteger(depth) || depth >= stack.length) throw Error('Invalid summary indentation');
                    const info = item[3] ? JSON.parse(item[3]) : {};
                    if (info.id && (typeof info.id !== 'string' || !/^[\w-]{1,128}$/.test(info.id) || ids.has(info.id))) throw Error('Duplicate summary node ID');
                    if (info.id) ids.add(info.id);
                    if (Object.keys(info).some(key=>!['id','expanded'].includes(key))) throw Error('Unknown summary node metadata');
                    const node: any = { id: info.id || '', text: readStyleMarker(item[2]).text, stylePreset: readStyleMarker(item[2]).name, nodeStyle: readStyleMarker(item[2]).overrides, expanded: info.expanded !== false, children: [] };
                    stack[depth].children.push(node); stack[depth + 1] = node; stack.length = depth + 2;
                    current = node; fence = /^\s*(```|~~~)/.test(item[2]);
                } else {
                    const indent = current === root ? 0 : (stack.length - 1) * 2;
                    const content = line.startsWith(' '.repeat(indent)) ? line.slice(indent) : line;
                    current.text += '\n' + content;
                    if (/^\s*(```|~~~)/.test(content)) fence = !fence;
                }
            }
            const trim = (n: any) => { n.text = n.text.trimEnd(); n.children.forEach(trim); }; trim(root);
            entries.push({ id: meta.id, memberIds: meta.members, root });
        }
        return { main, entries, preserved: '', error: '', raw };
    } catch (error) {
        return { main, entries: [] as SummaryData[], preserved: raw, error: String(error) };
    }
}
export function summaryMarkdown(entries: SummaryData[]): string {
    if (!entries.length) return '';
    const chunks = entries.map(entry => {
        const lines = entry.root.text.split('\n');
        let out = `### ${lines.shift() || ''}${styleMarker(entry.root.stylePreset, entry.root.nodeStyle)} <!-- mm:summary ${JSON.stringify({ id: entry.id, members: entry.memberIds, expanded: entry.root.expanded !== false })} -->\n`;
        if (lines.length) out += lines.join('\n') + '\n';
        const visit = (node: any, depth: number) => {
            const text = node.text.split('\n');
            out += '  '.repeat(depth) + '- ' + (text.shift() || '') + (styleMarker(node.stylePreset, node.nodeStyle)) + ` <!-- mm:item ${JSON.stringify({ id: node.id, expanded: node.expanded !== false })} -->\n`;
            text.forEach((line: string) => { out += '  '.repeat(depth + 1) + line + '\n'; });
            node.children.forEach((child: any) => visit(child, depth + 1));
        };
        entry.root.children.forEach((child: any) => visit(child, 0));
        return out.trimEnd();
    });
    return START + '\n## 概括子树区\n\n' + chunks.join('\n\n') + '\n\n' + END;
}
export function readNodeMarker(text: string) {
    const match = /\s*<!-- mm:node (\{[^\n]*?\}) -->/.exec(text);
    if (!match) return { text, id: '' };
    try { const data = JSON.parse(match[1]); if (typeof data.id !== 'string' || !/^[\w-]{1,128}$/.test(data.id)) throw Error(); return { text: text.replace(match[0], ''), id: data.id }; }
    catch (_) { return { text, id: '' }; }
}

export function prepareMainMarkdown(source: string) {
    const markers = new Map<number, string>();
    const styles = new Map<number, {name?: string; overrides?: any}>();
    const emptyItems = new Set<number>();
    const original = source.split('\n');
    let fence = '';
    const lines = original.map((line, index) => {
        const delimiter = /^\s*(`{3,}|~{3,})/.exec(line);
        if (delimiter) { if (!fence) fence = delimiter[1][0]; else if (delimiter[1][0] === fence) fence = ''; }
        if (fence || delimiter) return line;
        const structural = /^(?:#{1,6}(?:\s|$)|\s*(?:[-*+]|\d+\.)(?:\s|$))/.test(line);
        const styled = structural ? readStyleMarker(line) : {text: line};
        if (styled.name || styled.overrides) styles.set(index, {name: styled.name, overrides: styled.overrides});
        const marker = readNodeMarker(styled.text);
        if (marker.id) markers.set(index, marker.id);
        if (/^\s*[-*+]\s*$/.test(marker.text)) emptyItems.add(index);
        return marker.text;
    });
    // A bare dash below text can be parsed as a setext heading. Give the parser
    // an invisible placeholder; sourceNodeContent still reads the untouched lines.
    return { styles, text: lines.map((line, index) => emptyItems.has(index) ? line + ' \u200b' : line).join('\n'), lines, markers };
}
export function sourceNodeContent(node: any, prepared: ReturnType<typeof prepareMainMarkdown>) {
    const start = node.p?.lines?.[0];
    const stableId = prepared.markers.get(start) || '';
    if (start !== undefined && node.t === 'heading') {
        const header = /^(#{1,6})\s?(.*)$/.exec(prepared.lines[start]);
        if (header) {
            const children = (node.c || []).filter((child: any) => ['list_item', 'heading'].includes(child.t));
            let end = Math.min(prepared.lines.length, ...children.map((child: any) => child.p?.lines?.[0] ?? prepared.lines.length));
            let fence = '';
            for (let index = start + 1; index < end; index++) {
                const line = prepared.lines[index];
                const delimiter = /^\s*(`{3,}|~{3,})/.exec(line);
                if (delimiter) { if (!fence) fence = delimiter[1][0]; else if (delimiter[1][0] === fence) fence = ''; }
                const next = /^(#{1,6})(?:\s|$)/.exec(line);
                if (!fence && next && next[1].length <= header[1].length) { end = index; break; }
            }
            const fold = /(?:^| )\^([\w-]+)$/.exec(header[2]);
            const title = fold ? header[2].slice(0, fold.index) : header[2];
            const body = prepared.lines.slice(start + 1, end).join('\n').trimEnd();
            node.c = children;
            return { text: (title + (body ? '\n' + body : '')).trim(), stableId, foldedId: fold?.[1] || '' };
        }
    }
    if (node.t !== 'list_item' || start === undefined) return { text: node.v, stableId, foldedId: '' };
    const first = prepared.lines[start];
    const match = /^(\s*)(?:[-*+]|\d+\.)\s?(.*)$/.exec(first);
    if (!match) return { text: node.v, stableId, foldedId: '' };
    const children = (node.c || []).filter((child: any) => ['list_item', 'heading'].includes(child.t));
    // Markmap can shorten a list item's source range to its first paragraph.
    // Read indented continuation blocks until the next structural sibling/child.
    let end = Math.min(prepared.lines.length, ...children.map((child: any) => child.p?.lines?.[0] ?? prepared.lines.length));
    const continuation = match[1] + '  ';
    let fence = '';
    for (let index = start + 1; index < end; index++) {
        const line = prepared.lines[index];
        if (!fence && line.trim() && !line.startsWith(continuation) && index >= node.p.lines[1]) { end = index; break; }
        const delimiter = /^\s*(`{3,}|~{3,})/.exec(line);
        if (delimiter) { if (!fence) fence = delimiter[1][0]; else if (delimiter[1][0] === fence) fence = ''; }
    }
    const fold = /(?:^| )\^([\w-]+)$/.exec(match[2]);
    const parts = [fold ? match[2].slice(0, fold.index) : match[2]];
    const indent = match[1] + '  ';
    prepared.lines.slice(start + 1, end).forEach(line => parts.push(line.startsWith(indent) ? line.slice(indent.length) : line.trim() ? line : ''));
    node.c = children;
    return { text: parts.join('\n').trim(), stableId, foldedId: fold?.[1] || '' };
}
