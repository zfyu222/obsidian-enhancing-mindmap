import { selectionRoots } from './selection';
import { validateRelations } from '../relations/model';
import { validateGrafts } from '../grafts/model';

// Single subtrees keep the existing format; forests use a distinct type.
export function serializeSubtree(node: any): string {
    return serializeForest([node]);
}

export function serializeForest(nodes: any[], summaries: any[] = [], relations: any[] = [], grafts: any[] = []): string {
    const roots = selectionRoots(nodes);
    if (!roots.length) return '';
    const data: any[] = [];
    const visit = (current: any, pid: string | null) => {
        const d = current.getData();
        delete d.children;
        delete d.summaryRoot; delete d.summaryTree; delete d.summaryMember; delete d.relationMember; delete d.graftMember;
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
    const included = summaries.filter(s=>!copiedIds.has(s.root.id) && s.memberIds.every((id: string)=>copiedIds.has(id)));
    const collect=(n:any)=>{copiedIds.add(n.id);(n.children||[]).forEach(collect);};included.forEach(s=>collect(s.root));
    const links=relations.filter(link=>copiedIds.has(link.from)&&copiedIds.has(link.to));
    const references = grafts.filter(link => copiedIds.has(link.source) && copiedIds.has(link.target));
    return JSON.stringify({ ...(references.length ? {grafts:references} : {}), ...(links.length ? {relations:links} : {}), type: roots.length === 1 ? 'copyNode' : 'copyNodes', text: data, ...(included.length ? {summaries:included} : {}) });
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
            delete result.summaryRoot; delete result.summaryTree; delete result.summaryMember; delete result.relationMember; delete result.graftMember;
            return result;
        });
        if (payload.summaries !== undefined) {
            if (!Array.isArray(payload.summaries)) return null;
            const used = new Set<string>();
            const copyTree = (node: any, depth = 0): any => {
                if (depth > 100 || !node || typeof node.id !== 'string' || typeof node.text !== 'string' || (used.has(node.id) || ids.has(node.id)) || !Array.isArray(node.children)) throw Error('Invalid summary clipboard');
                used.add(node.id); const id=createId();ids.set(node.id,id);
                return {id,text:node.text,stylePreset:node.stylePreset,nodeStyle:node.nodeStyle,expanded:node.expanded!==false,children:node.children.map((child:any)=>copyTree(child,depth+1))};
            };
            (result as any).summaries = payload.summaries.map((summary:any)=>{
                if (!summary || !Array.isArray(summary.memberIds) || !summary.memberIds.length || summary.memberIds.some((id:string)=>!ids.has(id))) throw Error('Invalid summary clipboard references');
                const root=copyTree(summary.root);
                return {id:root.id,memberIds:summary.memberIds.map((id:string)=>ids.get(id)),root};
            });
        }
        if(payload.relations !== undefined){
            (result as any).relations=validateRelations(payload.relations).map(link=>{
                if(!ids.has(link.from)||!ids.has(link.to))throw Error('Invalid relation clipboard references');
                return {id:createId(),from:ids.get(link.from),to:ids.get(link.to)};
            });
        }
        if (payload.grafts !== undefined) {
            (result as any).grafts = validateGrafts(payload.grafts).map(link => {
                if (!ids.has(link.source) || !ids.has(link.target)) throw Error('Invalid virtual branch clipboard references');
                return { id: createId(), source: ids.get(link.source), target: ids.get(link.target) };
            });
            // Reject cycles before allocating/mounting any graph nodes.
            const edges = new Map<string, string[]>();
            ids.forEach(id => edges.set(id, []));
            result.forEach((node: any) => { if (node.pid) edges.get(node.pid)!.push(node.id); });
            const visitSummary = (node: any) => { (node.children || []).forEach((child: any) => { edges.get(node.id)!.push(child.id); visitSummary(child); }); };
            ((result as any).summaries || []).forEach((entry: any) => visitSummary(entry.root));
            (result as any).grafts.forEach((link: any) => edges.get(link.target)!.push(link.source));
            const active = new Set<string>(), done = new Set<string>();
            const visit = (id: string) => { if (active.has(id)) throw Error('Cyclic virtual branch clipboard'); if (done.has(id)) return; active.add(id); edges.get(id)!.forEach(visit); active.delete(id); done.add(id); };
            edges.forEach((_, id) => visit(id));
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
