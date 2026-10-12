import { selectionRoots } from './selection';

// Single subtrees keep the existing format; forests use a distinct type.
export function serializeSubtree(node: any): string {
    return serializeForest([node]);
}

export function serializeForest(nodes: any[]): string {
    const roots = selectionRoots(nodes);
    if (!roots.length) return '';
    const data: any[] = [];
    const visit = (current: any, pid: string | null) => {
        const d = current.getData();
        delete d.children;
        d.pid = pid;
        d.isRoot = false;
        d.isEdit = false;
        d.isExpand = current.isExpand;
        d.expanded = current.isExpand;
        data.push(d);
        current.children.forEach((child: any) => visit(child, d.id));
    };
    roots.forEach(node => visit(node, null));
    return JSON.stringify({ type: roots.length === 1 ? 'copyNode' : 'copyNodes', text: data });
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
        return payload.text.map((d: any, i: number) => {
            const result = { ...d, id: ids.get(d.id), pid: d.pid == null ? null : ids.get(d.pid), isRoot: false, isEdit: false };
            delete result.children;
            return result;
        });
    } catch (_) {
        return null;
    }
}

export function clipboardAction(e: KeyboardEvent, editing: boolean): 'copy' | 'paste' | null {
    const target = e.target as HTMLElement;
    if (editing || e.isComposing || e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return null;
    if (target && (target.isContentEditable || (typeof target.closest === 'function' && target.closest('input, textarea, [contenteditable="true"]')))) return null;
    const key = e.key.toLowerCase();
    return key === 'c' ? 'copy' : key === 'v' ? 'paste' : null;
}
