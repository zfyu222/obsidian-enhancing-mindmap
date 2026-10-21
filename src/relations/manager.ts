import { Notice } from 'obsidian';
import { uuid } from '../MindMapView';
import { t } from '../lang/helpers';
import { RelationData, relationsMarkdown, relationCurve } from './model';

export default class RelationManager {
    items: RelationData[] = []; preserved = ''; pending = ''; selected = ''; svg?: SVGGElement;
    constructor(public map: any) {}
    snapshot() { return this.items.map(link=>({...link})); }
    restore(links: RelationData[]) { this.items = links.map(link=>({...link})); this.selected=''; this.pending=''; this.syncMarkers(); }
    load(entries: RelationData[], preserved = '', original = '') {
        this.pending='';this.selected='';this.preserved=preserved;this.items=entries.map(link=>({...link}));
        const ids = new Map<string,number>();this.map.traverseAll((n:any)=>ids.set(n.getId(),(ids.get(n.getId())||0)+1));
        if (this.items.some(link=>ids.get(link.from)!==1 || ids.get(link.to)!==1)) { this.preserved=original || relationsMarkdown(entries);this.items=[]; }
        if (this.preserved) { const referenced=new Set<string>();entries.forEach(link=>{referenced.add(link.from);referenced.add(link.to);});this.map.traverseAll((n:any)=>{if(n.data.summaryMember||referenced.has(n.getId()))n.data.relationMember=true;});new Notice(t('Invalid relation data preserved')); }
        this.syncMarkers();this.render();
    }
    syncMarkers() {
        if (this.preserved) return;
        const ids=new Set<string>();this.items.forEach(link=>{ids.add(link.from);ids.add(link.to);});
        this.map.traverseAll((node:any)=>{if(ids.has(node.getId()))node.data.relationMember=true;else delete node.data.relationMember;});
    }
    reconcile(command?: any) {
        if (this.preserved) return;
        if (command?.name==='pasteNode' && command.data?.relations) this.items.push(...command.data.relations.map((link:RelationData)=>({...link})));
        this.items=this.items.filter(link=>this.map.getNodeById(link.from)&&this.map.getNodeById(link.to));
        if(this.pending && !this.map.getNodeById(this.pending))this.pending='';
        if(!this.items.some(link=>link.id===this.selected))this.selected='';
        this.syncMarkers();
    }
    markdown() { return this.preserved || relationsMarkdown(this.items); }
    cancel() { this.pending='';this.selected='';this.render();this.map.emit('toolbarChange'); }
    begin() {
        if (this.preserved || this.map.isComposing) return;
        this.map.grafts?.cancel();
        if(this.pending){this.cancel();return;}
        this.map.finishEditingForHistory(); const nodes=this.map.getSelectedNodes();
        if(nodes.length===2){this.create(nodes[0].getId(),nodes[1].getId());return;}
        if(nodes.length!==1)return;
        this.pending=nodes[0].getId();this.selected='';this.map.emit('toolbarChange');new Notice(t('Click the target node; click blank space or Escape to cancel'));
    }
    create(from: string, to: string) {
        this.pending='';
        from = this.map.grafts?.original(this.map.getNodeById(from))?.getId() || from;
        to = this.map.grafts?.original(this.map.getNodeById(to))?.getId() || to;
        if (this.preserved || this.map.isComposing || from===to || !this.map.getNodeById(from) || !this.map.getNodeById(to)) {this.map.emit('toolbarChange');return;}
        if(this.items.some(link=>link.from===from&&link.to===to)){new Notice(t('Relation already exists'));this.map.emit('toolbarChange');return;}
        const link={id:uuid(),from,to},manager=this;
        this.map.exec.history.execute({name:'addRelation',execute(){manager.items.push({...link});return true;},undo(){manager.items=manager.items.filter(item=>item.id!==link.id);},redo(){this.execute();}} as any);
    }
    remove() {
        if(this.preserved || this.map.isComposing)return;
        this.map.finishEditingForHistory(); const link=this.items.find(item=>item.id===this.selected);if(!link)return;
        const manager=this;
        this.map.exec.history.execute({name:'removeRelation',execute(){manager.items=manager.items.filter(item=>item.id!==link.id);manager.selected='';return true;},undo(){manager.items.push({...link});},redo(){this.execute();}} as any);
    }
    select(id: string) {
        if(this.map.isComposing)return;
        this.map.finishEditingForHistory();this.map.clearSelectNode();this.selected=id;this.pending='';
        this.render();this.map.appEl.focus({preventScroll:true});this.map.emit('toolbarChange');
    }
    render() {
        const host=this.map.contentEL?.querySelector?.('svg'),doc=this.map.contentEL?.ownerDocument;if(!host||!doc)return;
        if(!this.svg || this.svg.parentNode!==host){this.svg=doc.createElementNS('http://www.w3.org/2000/svg','g');this.svg.classList.add('mm-relations');host.appendChild(this.svg);}
        this.svg.textContent='';
        this.items.forEach(link=>{
            const from=this.map.getNodeById(link.from),to=this.map.getNodeById(link.to);
            if(!from?.isShow()||!to?.isShow())return;
            const curve=relationCurve(from.getBox(),to.getBox());
            const group=doc.createElementNS(host.namespaceURI,'g');group.setAttribute('data-relation-id',link.id);group.setAttribute('class','mm-relation'+(this.selected===link.id?' is-selected':''));
            const path=(d:string,cls:string)=>{const p=doc.createElementNS(host.namespaceURI,'path');p.setAttribute('d',d);p.setAttribute('class',cls);group.appendChild(p);return p;};
            path(curve.path,'mm-relation-line');path(curve.arrow,'mm-relation-arrow');
            const hit=path(curve.path,'mm-relation-hit');hit.setAttribute('tabindex','0');hit.setAttribute('role','button');hit.setAttribute('aria-label',t('Relation line'));
            hit.addEventListener('mousedown',(e:MouseEvent)=>{e.preventDefault();e.stopPropagation();});
            hit.addEventListener('click',(e:MouseEvent)=>{e.preventDefault();e.stopPropagation();this.select(link.id);});
            hit.addEventListener('keydown',(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();this.select(link.id);}});
            this.svg!.appendChild(group);
        });
    }
    clear(){this.svg?.remove();this.svg=undefined;this.items=[];this.pending='';this.selected='';}
}
