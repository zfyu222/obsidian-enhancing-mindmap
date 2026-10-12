// Keep the existing clipboard format so older plugin versions can read it.
export function serializeSubtree(node: any): string {
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
    visit(node, null);
    return JSON.stringify({ type: 'copyNode', text: data });
}

// Validate the complete subtree before changing the map, and allocate IDs per paste.
export function parseSubtree(text: string, createId: () => string): any[] | null {
    try {
        const payload = JSON.parse(text);
        if (!payload || payload.type !== 'copyNode' || !Array.isArray(payload.text) || !payload.text.length) return null;
        const ids = new Map<string, string>();
        for (let i = 0; i < payload.text.length; i++) {
            const d = payload.text[i];
            if (!d || typeof d.id !== 'string' || typeof d.text !== 'string' || ids.has(d.id)) return null;
            if (i === 0 ? d.pid != null : !ids.has(d.pid)) return null;
            ids.set(d.id, createId());
        }
        return payload.text.map((d: any, i: number) => {
            const result = { ...d, id: ids.get(d.id), pid: i === 0 ? null : ids.get(d.pid), isRoot: false, isEdit: false };
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
