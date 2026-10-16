import { selectionRoots } from './selection';

// Single subtrees keep the existing format; forests use a distinct type.
export function serializeSubtree(node: any): string {
    return serializeForest([node]);
}

export function serializeForest(nodes: any[], summaries: any[] = []): string {
    const roots = selectionRoots(nodes);
    if (!roots.length) return '';
    const data: any[] = [];
    const visit = (current: any, pid: string | null) => {
        const d = current.getData();
        delete d.children;
        delete d.summaryRoot; delete d.summaryTree; delete d.summaryMember;
        d.pid = pid;
        d.isRoot = false;
        d.isEdit = false;
        d.isExpand = current.isExpand;
        d.expanded = current.isExpand;
        data.push(d);
        current.children.forEach((child: any) => visit(child, d.id));
    };
    roots.forEach(node => visit(node, null));
    const copiedIds = new Set(data.map(d=>d.id));
    const included = summaries.filter(s=>s.memberIds.every((id: string)=>copiedIds.has(id)));
    return JSON.stringify({ type: roots.length === 1 ? 'copyNode' : 'copyNodes', text: data, ...(included.length ? {summaries:included} : {}) });
}

// Validate the complete subtree before changing the map, and allocate IDs per paste.
export function parseSubtree(text: string, createId: () => string): any[] | null {
    try {
        const payload = JSON.parse(text);
        if (!payload || !['copyNode', 'copyNodes'].includes(payload.type) || !Array.isArray(payload.text) || !payload.text.length) return null;
        const ids = new Map<string, string>();
        let roots = 0;
        for (let i = 0; i < payload.text.length; i++) {
            const d = payload.text[i];
            if (!d || typeof d.id !== 'string' || typeof d.text !== 'string' || ids.has(d.id)) return null;
            if (d.pid == null) roots++;
            else if (!ids.has(d.pid)) return null;
            ids.set(d.id, createId());
        }
        if (!roots || (payload.type === 'copyNode' && roots !== 1)) return null;
        const result = payload.text.map((d: any, i: number) => {
            const result = { ...d, id: ids.get(d.id), pid: d.pid == null ? null : ids.get(d.pid), isRoot: false, isEdit: false };
            delete result.children;
            delete result.summaryRoot; delete result.summaryTree; delete result.summaryMember;
            return result;
        });
        if (payload.summaries !== undefined) {
            if (!Array.isArray(payload.summaries)) return null;
            const used = new Set<string>();
            const copyTree = (node: any, depth = 0): any => {
                if (depth > 100 || !node || typeof node.id !== 'string' || typeof node.text !== 'string' || used.has(node.id) || !Array.isArray(node.children)) throw Error('Invalid summary clipboard');
                used.add(node.id);
                return {id:createId(),text:node.text,stylePreset:node.stylePreset,expanded:node.expanded!==false,children:node.children.map((child:any)=>copyTree(child,depth+1))};
            };
            (result as any).summaries = payload.summaries.map((summary:any)=>{
                if (!summary || !Array.isArray(summary.memberIds) || !summary.memberIds.length || summary.memberIds.some((id:string)=>!ids.has(id))) throw Error('Invalid summary clipboard references');
                const root=copyTree(summary.root);
                return {id:root.id,memberIds:summary.memberIds.map((id:string)=>ids.get(id)),root};
            });
        }
        return result;
    } catch (_) {
        return null;
    }
}

export function clipboardAction(e: KeyboardEvent, editing: boolean): 'copy' | 'cut' | 'paste' | null {
    const target = e.target as HTMLElement;
    if (editing || e.isComposing || e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return null;
    if (target && (target.isContentEditable || (typeof target.closest === 'function' && target.closest('input, textarea, [contenteditable="true"]')))) return null;
    const key = e.key.toLowerCase();
    return key === 'c' ? 'copy' : key === 'x' ? 'cut' : key === 'v' ? 'paste' : null;
}
