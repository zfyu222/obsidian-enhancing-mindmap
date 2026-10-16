import Node from '../mindmap/INode';
import { Notice } from 'obsidian';
import { uuid } from '../MindMapView';
import { SummaryData, summaryMarkdown } from './markdown';
import { validateSummary } from './model';
import { t } from '../lang/helpers';

export class SummaryTransaction {
    name: string; node: any; before: any; after: any;
    constructor(private manager: SummaryManager, private command: any) { this.name = command.name; this.node = command.node; }
    execute() {
        if (this.command.name === 'moveNodes' || this.command.name === 'moveNode') {
            const target = this.command.destination || this.command.newParent || this.command.parent;
            const moving = this.command.entries?.map((entry: any) => entry.node) || [this.command.node];
            if (target && moving.some((node: any) => node?.data.summaryTree !== target.data.summaryTree)) { new Notice(t('Move within the same tree')); return false; }
        }
        this.before = this.manager.snapshot();
        return this.run(() => {
            const result = this.command.execute();
            if (result) { if (this.command.name === 'pasteNode' && this.command.data?.summaries) this.manager.importPaste(this.command.data.summaries);
                this.manager.reconcile(this.before, this.command); this.after = this.manager.snapshot(); }
            return result;
        });
    }
    undo() { this.run(() => { this.command.undo(); this.manager.restore(this.before); return true; }); }
    redo() { this.run(() => { this.command.redo(); this.manager.restore(this.after); return true; }); }
    run(action: () => boolean) {
        const map = this.manager.map; map.summaryTransaction = true;
        let changed = false;
        try { changed = action(); return changed; }
        finally { map.summaryTransaction = false; if (changed) { this.manager.mount(); map.refresh(); map.emit('mindMapChange'); map.emit('toolbarChange'); } }
    }
}

export default class SummaryManager {
    items: any[] = []; preserved = ''; loading = false;
    mounted = new Set<any>(); svg: any;
    constructor(public map: any) {
        map.exec.history.decorate = (command: any) => new SummaryTransaction(this, command);
        this.svg = map.edgeGroup.group();
    }
    createTree(data: any, summaryId: string, parent?: any): any {
        const node = new Node({ ...data, id: data.id || uuid(), children: undefined, isRoot: !parent } as any, this.map);
        node.data.summaryTree = summaryId; node.data.summaryRoot = !parent;
        node.isExpand = data.expanded !== false;
        if (parent) { parent.children.push(node); node.parent = parent; }
        (data.children || []).forEach((d: any) => this.createTree(d, summaryId, node));
        node.setPosition(0, 0); node.refreshBox();
        return node;
    }
    load(entries: SummaryData[], preserved = '', original = '') {
        this.preserved = preserved;
        this.items = entries.map(entry => ({ ...entry, root: this.createTree(entry.root, entry.id), side: '' }));
        const all = new Map<string, any[]>();
        this.map.traverseDF((n: any) => { const list = all.get(n.getId()) || []; list.push(n); all.set(n.getId(), list); });
        this.items.forEach(item => {
            const members = item.memberIds.map((id: string) => all.get(id)?.length === 1 ? all.get(id)![0] : null);
            item.invalid = members.some((n: any) => !n) || !members[0]?.parent || members.some((n: any) => n.parent !== members[0].parent);
            if (!item.invalid) {
                const indexes = members.map((n: any) => n.parent.children.indexOf(n)).sort((a: number,b: number)=>a-b);
                item.invalid = indexes.some((n: number,i: number)=> n !== indexes[0]+i);
            }
        });
        const ids = new Set<string>(); let duplicate = false;
        this.map.traverseAll((n: any) => { if(ids.has(n.getId())) duplicate=true; ids.add(n.getId()); });
        if (duplicate || this.items.some(item => item.invalid)) { this.preserved = original || summaryMarkdown(entries); this.items = []; }
        if (this.preserved) new Notice(t('Invalid summary data preserved'));
        this.mount();
    }
    all(callback: (n: any) => void) { this.items.forEach(item => this.map.traverseDF(callback, item.root, true)); }
    mount() {
        const current = new Set(this.items.map(item => item.root));
        this.mounted.forEach(root => { if (!current.has(root)) this.map.traverseDF((n: any) => n.containEl.remove(), root); });
        this.items.forEach(item => this.map.traverseDF((n: any) => {
            n.data.summaryTree = item.id; n.data.summaryRoot = n === item.root;
            n.containEl.classList.add('mm-summary-node');
            if (!this.map.contentEL.contains(n.containEl)) this.map.contentEL.appendChild(n.containEl);
        }, item.root));
        this.mounted = current;
    }
    snapshot() {
        const nodes: any[] = []; this.map.traverseDF((node: any) => nodes.push({ node, id: node.getId(), marker: node.data.summaryMember }));
        return { items: this.items.map(item => ({ ...item, memberIds: item.memberIds.slice() })), nodes,
            positions: new Map(this.items.map(item => [item.id, item.memberIds.map((id: string) => { const n = this.map.getNodeById(id); return { id, parent: n?.parent, index: n?.parent?.children.indexOf(n) }; })])) };
    }
    restore(snapshot: any) {
        this.items = snapshot.items.map((item: any) => ({ ...item, memberIds: item.memberIds.slice() }));
        this.map.traverseDF((n: any) => { delete n.data.summaryMember; });
        snapshot.nodes.forEach(({ id, marker }: any) => { const node = this.map.getNodeById(id); if (node) { if (marker) node.data.summaryMember = marker; else delete node.data.summaryMember; } });
    }
    reconcile(before: any, command?: any) {
        const nodes = new Map<string, any>(); this.map.traverseDF((n: any) => nodes.set(n.getId(), n));
        this.items = this.items.filter(item => {
            if (item.invalid) return true;
            const positions = before.positions.get(item.id);
            if (!positions) return true; // newly created relation
            const oldParent = positions[0]?.parent;
            let members = item.memberIds.map((id: string) => nodes.get(id)).filter(Boolean);
            if (!members.length) return false;
            const moved = members.filter((n: any) => n.parent !== oldParent);
            if (moved.length && moved.length !== item.memberIds.length) members = members.filter((n: any) => n.parent === oldParent);
            if (!members.length) return false;
            const parent = members[0].parent;
            if (!parent) return false;
            members = members.filter((n: any) => n.parent === parent);
            const movedIds = new Set((command?.entries || []).map((entry: any) => entry.node.getId()));
            if (command?.name === 'moveNodes' && moved.length !== item.memberIds.length && members.some((n: any) => movedIds.has(n.getId())) && !members.every((n: any) => movedIds.has(n.getId()))) {
                members = members.filter((n: any) => !movedIds.has(n.getId()));
                if (!members.length) return false;
            }
            const indexes = members.map((n: any)=>parent.children.indexOf(n));
            item.memberIds = parent.children.slice(Math.min(...indexes), Math.max(...indexes)+1).map((n: any)=>n.getId());
            return item.memberIds.length > 0;
        });
        if (!this.preserved && !this.items.some(item => item.invalid)) {
            const ids = new Set(this.items.reduce((ids: string[], item: any) => ids.concat(item.memberIds), []));
            nodes.forEach(node => { if (ids.has(node.getId())) node.data.summaryMember = true; else delete node.data.summaryMember; });
        }
    }
    validation() { return validateSummary(this.map.getSelectedRoots(), this.map.root); }
    create() {
        this.map.finishEditingForHistory(); const result = this.validation();
        if (result.error || this.preserved) { new Notice(result.error ? t(result.error as any) : t('Invalid summary data preserved')); return; }
        const id = uuid(); const item = { id, memberIds: result.members.map(n => n.getId()), root: this.createTree({ id, text: t('Summary'), expanded: true, children: [] }, id), side: result.members[0].direct };
        const manager = this;
        this.map.exec.history.execute({ name: 'createSummary', execute() { manager.items.push(item); item.memberIds.forEach((id: string) => manager.map.getNodeById(id).data.summaryMember = true); manager.mount(); item.root.select(); return true; }, undo() { manager.items = manager.items.filter(i=>i!==item); manager.map.clearSelectNode(); manager.map.root.select(); }, redo() { this.execute(); } } as any);
        item.root.edit(); this.map.emit('toolbarChange');
    }
    importPaste(entries: SummaryData[]) { entries.forEach(entry=>this.items.push({...entry,root:this.createTree(entry.root,entry.id),side:''})); }
    removeRoot(root: any) { const index = this.items.findIndex(item=>item.root===root); if (index>=0) this.items.splice(index,1); this.map._removeChildDom(root); return index; }
    data(): SummaryData[] {
        const toData = (node: any): any => ({ id: node.getId(), text: node.data.text, stylePreset: node.data.stylePreset, nodeStyle: node.data.nodeStyle, expanded: node.isExpand, children: node.children.map(toData) });
        return this.items.map(item=>({ id:item.id, memberIds:item.memberIds, root:toData(item.root) }));
    }
    markdown() { return [summaryMarkdown(this.data()), this.preserved].filter(Boolean).join('\n\n'); }
    pinSides(children: any[], mode: string) {
        const groups: any[][] = [];
        this.items.filter(item=>!item.invalid).forEach(item=>{
            const roots = item.memberIds.map((id: string)=>this.map.getNodeById(id)).filter(Boolean).map((n: any)=>{ while(n.parent && n.parent!==this.map.root) n=n.parent; return n; });
            let group = Array.from(new Set(roots));
            for(let i=groups.length-1;i>=0;i--) if(groups[i].some(n=>group.includes(n))) group=Array.from(new Set([...group,...groups.splice(i,1)[0]]));
            groups.push(group);
        });
        groups.forEach(group=>{
            const item=this.items.find(s=>s.memberIds.some((id:string)=>group.some(n=>n.getId()===id)) && s.side);
            const side=['left','right'].includes(mode)?mode:(item?.side || group[0]?.direct);
            group.forEach(n=>this.map.traverseDF((child:any)=>child.direct=side,n));
        });
    }
    layout() {
        this.mount(); this.svg.clear();
        const originals: any[]=[]; this.map.traverseDF((n:any)=>{if(n.isShow())originals.push(n);});
        if(!originals.length)return;
        const occupied: any[]=[];
        const obstacles = originals.map(node => ({ ...this.map.getBoundingRect([node]), gap: 16 }));
        const walk = (node:any, visible:boolean, side:string) => { node.direct=side; visible?node.show():node.hide(); node.children.forEach((n:any)=>walk(n,visible && node.isExpand,side)); };
        const measure = (node:any):any => {
            const box=node.getBox(); const children=node.isExpand?node.children.map(measure):[];
            const height=children.reduce((h:number,n:any)=>h+n.height,0)+Math.max(0,children.length-1)*16;
            return {node,children,width:box.width+(children.length?40+Math.max(...children.map((c:any)=>c.width)):0),height:Math.max(box.height,height)};
        };
        const arrange=(tree:any,x:number,y:number,side:string)=>{
            const node=tree.node, box=node.getBox(); node.setPosition(side==='right'?x:x-box.width,y+(tree.height-box.height)/2);
            const total=tree.children.reduce((h:number,c:any)=>h+c.height,0)+Math.max(0,tree.children.length-1)*16;
            let cy=y+(tree.height-total)/2;
            tree.children.forEach((child:any)=>{arrange(child,side==='right'?x+box.width+40:x-box.width-40,cy,side);cy+=child.height+16; const a=node.getBox(),b=child.node.getBox(); this.svg.path(`M ${side==='right'?a.x+a.width:a.x} ${a.y+a.height/2} L ${side==='right'?b.x:b.x+b.width} ${b.y+b.height/2}`).fill('none').stroke({color:'var(--text-muted)',width:1.5});});
        };
        this.items.slice().sort((a,b)=>a.memberIds.length-b.memberIds.length).forEach(item=>{
            const members=item.memberIds.map((id:string)=>this.map.getNodeById(id));
            const valid=!item.invalid && members.every((n:any)=>n?.isShow());
            const side=members[0]?.direct || item.side || 'right'; walk(item.root,valid,side);
            if(!valid)return; item.side=side;
            const included:any[]=[]; members.forEach((n:any)=>this.map.traverseDF((child:any)=>{if(child.isShow())included.push(child);},n));
            const bounds=this.map.getBoundingRect(included), tree=measure(item.root);
            const top=bounds.y-8,bottom=bounds.y+bounds.height+8, mid=(top+bottom)/2;
            const y=mid-tree.height/2; let x=side==='right'?bounds.right+28:bounds.x-28;
            // Anchor to these members, not the farthest unrelated branch in the map.
            // Move outward only when the brace/subtree footprint actually intersects an obstacle.
            const blockers = [...obstacles, ...occupied];
            const regionTop = Math.min(top,y), regionBottom = Math.max(bottom,y+tree.height);
            let shifted: boolean;
            do {
                shifted = false;
                blockers.forEach(blocker => {
                    const left = side==='right'?x-12:x-20-tree.width;
                    const right = side==='right'?x+20+tree.width:x+12;
                    if (regionTop < blocker.bottom+blocker.gap && regionBottom > blocker.y-blocker.gap &&
                        left < blocker.right+blocker.gap && right > blocker.x-blocker.gap) {
                        const next = side==='right'?blocker.right+blocker.gap+12:blocker.x-blocker.gap-12;
                        if (side==='right'?next>x:next<x) { x=next; shifted=true; }
                    }
                });
            } while (shifted);
            const s=side==='right'?1:-1;
            const path=this.svg.path(`M ${x-s*12} ${top} Q ${x} ${top} ${x} ${top+16} L ${x} ${bottom-16} Q ${x} ${bottom} ${x-s*12} ${bottom} M ${x} ${mid} L ${x+s*20} ${mid}`).fill('none').stroke({color:'var(--text-normal)',width:1.8});
            path.addClass('mm-summary-bracket'); path.node.setAttribute('data-summary-id',item.id);
            path.node.addEventListener('mousedown',(event:MouseEvent)=>{event.preventDefault();event.stopPropagation();this.map.setSelectedNodes([item.root]);});
            path.node.addEventListener('click',(event:MouseEvent)=>{event.preventDefault();event.stopPropagation();this.map.setSelectedNodes([item.root]);});
            arrange(tree,x+s*20,y,side);
            occupied.push({x:side==='right'?x-12:x-20-tree.width,right:side==='right'?x+20+tree.width:x+12,y:regionTop,bottom:regionBottom,gap:20});
        });
    }
    clear(){ this.all(n=>n.containEl.remove());this.items=[];this.svg.clear(); }
}
