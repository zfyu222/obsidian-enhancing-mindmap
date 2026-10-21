export interface GraftData { id: string; source: string; target: string }

export function validateGrafts(value: any): GraftData[] {
    if (!Array.isArray(value) || value.length > 1000) throw Error('Invalid grafts');
    const ids = new Set<string>(), pairs = new Set<string>();
    return value.map(item => {
        if (!item || Object.keys(item).some(key => !['id', 'source', 'target'].includes(key)) ||
            ['id', 'source', 'target'].some(key => typeof item[key] !== 'string' || !/^[\w-]{1,128}$/.test(item[key])) ||
            item.source === item.target || ids.has(item.id) || pairs.has(item.source + ':' + item.target)) throw Error('Invalid graft');
        ids.add(item.id); pairs.add(item.source + ':' + item.target);
        return { id: item.id, source: item.source, target: item.target };
    });
}

export function graftsMarkdown(items: GraftData[]) {
    return items.length ? `<!-- mm:grafts ${JSON.stringify({ version: 1, links: items })} -->` : '';
}

export function extractGrafts(markdown: string) {
    const raw: string[] = [], main: string[] = []; let fence = '';
    for (const line of markdown.split('\n')) {
        const delimiter = /^\s*(`{3,}|~{3,})/.exec(line);
        if (delimiter) { if (!fence) fence = delimiter[1][0]; else if (delimiter[1][0] === fence) fence = ''; }
        if (!fence && !delimiter && line.startsWith('<!-- mm:grafts ')) raw.push(line);
        else main.push(line);
    }
    if (!raw.length) return { main: markdown, entries: [] as GraftData[], preserved: '', raw: '' };
    const original = raw.join('\n');
    try {
        if (raw.length !== 1 || !raw[0].endsWith(' -->')) throw Error('Malformed grafts');
        const meta = JSON.parse(raw[0].slice('<!-- mm:grafts '.length, -4));
        if (!meta || meta.version !== 1 || Object.keys(meta).some(key => !['version', 'links'].includes(key))) throw Error('Unknown grafts');
        return { main: main.join('\n'), entries: validateGrafts(meta.links), preserved: '', raw: original };
    } catch (_) { return { main: main.join('\n'), entries: [] as GraftData[], preserved: original, raw: original }; }
}

/** Validate the rendered graph (real child edges plus target -> source edges). */
export function validGraftGraph(nodes: any[], links: GraftData[], moving: any[] = [], destination?: any): boolean {
    const byId = new Map(nodes.map(node => [node.getId(), node]));
    if (byId.size !== nodes.length || links.some(link => !byId.has(link.source) || !byId.has(link.target))) return false;
    const children = new Map(nodes.map(node => [node, node.children.filter((child: any) => !moving.includes(child))]));
    if (destination) children.set(destination, [...(children.get(destination) || []), ...moving]);
    links.forEach(link => children.get(byId.get(link.target))!.push(byId.get(link.source)));
    const state = new Map<any, number>(), sizes = new Map<any, number>();
    const visit = (node: any): number => {
        if (state.get(node) === 1) throw Error('Cyclic graft');
        if (state.get(node) === 2) return sizes.get(node)!;
        state.set(node, 1);
        let size = 1;
        for (const child of children.get(node) || []) { size += visit(child); if (size > 10000) throw Error('Graft too large'); }
        state.set(node, 2); sizes.set(node, size); return size;
    };
    try { nodes.forEach(visit); return true; } catch (_) { return false; }
}
