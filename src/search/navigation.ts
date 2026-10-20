import { extractSummaries } from '../summary/markdown';
import { extractRelations } from '../relations/model';

export function isSearchResultState(state: any) {
    return !!state && typeof state.match?.content === 'string' && Array.isArray(state.match.matches);
}
export function searchRequest(state: any) {
    if (!state || typeof state !== 'object') return null;
    if (isSearchResultState(state)) {
        const content=state.match.content;
        const match=state.match.matches.find((m:any)=>Array.isArray(m)&&Number.isInteger(m[0])&&Number.isInteger(m[1])&&m[0]>=0&&m[1]>=m[0]&&m[1]<=content.length);
        if(match)return {line:content.slice(0,match[0]).split('\n').length-1,content};
    }
    const line=state.startLoc?.line ?? state.line;
    return Number.isInteger(line)&&line>=0 ? {line,content:undefined as string|undefined} : null;
}
export function sourceNodeAtLine(raw: string, line: number, view: any): any {
    const body=view.getMdText(raw);if(!body)return null;
    const offset=raw.trimEnd().length-body.length;
    if(offset<0||raw.slice(offset,offset+body.length)!==body)return null;
    const base=raw.slice(0,offset).split('\n').length-1,local=line-base;if(local<0)return null;
    let fence='';
    const masked=body.split('\n').map((line:string)=>{
        const delimiter=/^\s*(`{3,}|~{3,})/.exec(line);
        if(delimiter){if(!fence)fence=delimiter[1][0];else if(delimiter[1][0]===fence)fence='';}
        return !fence&&!delimiter&&line.startsWith('<!-- mm:relations ')?'':line;
    }).join('\n');
    const summaries=extractSummaries(masked),main=view.mdToData(summaries.main,true);
    let found:any=null;
    const visit=(node:any,path:number[])=>{
        if(local>=node.sourceStartLine&&node.sourceStartLine>=0&&local<node.sourceEndLine)found={kind:'main',path,node,main};
        (node.children||[]).forEach((child:any,index:number)=>visit(child,[...path,index]));
    };visit(main,[]);
    if(found)return found;
    if(!summaries.raw||summaries.preserved)return null;
    const start=masked.slice(0,masked.length-summaries.raw.length).split('\n').length-1;
    if(local<start)return null;
    const entries=new Map(summaries.entries.map(item=>[item.id,item]));
    let current:any=null,entry:any=null,paths:number[][]=[],counts=new Map<string,number>();fence='';
    const lines=summaries.raw.split('\n');
    for(let index=0;index<lines.length && start+index<=local;index++){
        const text=lines[index];
        if(!fence){
            const heading=/^### .*<!-- mm:summary (\{.*\}) -->\s*$/.exec(text);
            const item=/^( *)- (.*)$/.exec(text);
            if(heading){
                try{const id=JSON.parse(heading[1]).id;entry=entries.get(id);current=entry?{kind:'summary',summaryId:id,path:[],node:entry.root,main,summaryRoot:entry.root}:null;paths=[];counts=new Map();}catch(_){current=null;}
            }else if(item&&entry){
                const depth=item[1].length/2,parent=depth?paths[depth-1]:[];
                if(!parent){current=null;continue;}
                const key=parent.join('.'),next=counts.get(key)||0;counts.set(key,next+1);
                const path=[...parent,next];paths[depth]=path;paths.length=depth+1;
                let node=entry.root;path.forEach(i=>node=node?.children[i]);
                current=node?{kind:'summary',summaryId:entry.id,path,node,main,summaryRoot:entry.root}:null;
            }else if(text.startsWith('<!-- mm:summaries:')||text==='## 概括子树区'){current=null;}
            if((heading||item)&&current){const delimiter=/^\s*(`{3,}|~{3,})/.exec(current.node.text);if(delimiter)fence=delimiter[1][0];continue;}
        }
        const delimiter=/^\s*(`{3,}|~{3,})/.exec(text);if(delimiter){if(!fence)fence=delimiter[1][0];else if(delimiter[1][0]===fence)fence='';}
    }
    return current;
}
export function sameSourceTree(a:any,b:any):boolean {
    return !!a&&!!b&&a.text===b.text&&(a.children||[]).length===(b.children||[]).length&&(a.children||[]).every((child:any,index:number)=>sameSourceTree(child,b.children[index]));
}
export function resolveSearchNode(view:any,request:NonNullable<ReturnType<typeof searchRequest>>) {
    const raw=request.content ?? view.data,target=sourceNodeAtLine(raw,request.line,view);if(!target)return null;
    const map=view.mindmap;
    const stable=target.kind==='summary'||target.node.summaryMember||target.node.expanded===false;
    if(stable){const matches:any[]=[];map.traverseAll((node:any)=>{if(node.getId()===target.node.id)matches.push(node);});if(matches.length===1)return matches[0];}
    let node=target.kind==='summary'?map.summaries?.items.find((item:any)=>item.id===target.summaryId)?.root:map.root;
    const currentBody=extractSummaries(extractRelations(view.getMdText(view.data)).main);
    const currentTree=target.kind==='summary'?currentBody.entries.find(entry=>entry.id===target.summaryId)?.root:view.mdToData(currentBody.main,true);
    if(raw.replace(/\r\n/g,'\n')===view.data.replace(/\r\n/g,'\n')||sameSourceTree(target.kind==='summary'?target.summaryRoot:target.main,currentTree)){
        target.path.forEach((index:number)=>node=node?.children[index]);
        if(node?.data.text.trim()===target.node.text.trim())return node;
    }
    const matches:any[]=[];map.traverseAll((node:any)=>{if(node.data.text.trim()===target.node.text.trim())matches.push(node);});
    return matches.length===1?matches[0]:null;
}
/** Use screen rectangles so centering honors the current zoom and transform origin. */
export function centerSearchNode(map:any,node:any) {
    const viewport=map.containerEL,box=node.containEl.getBoundingClientRect(),bounds=viewport.getBoundingClientRect();
    viewport.scrollLeft+=box.left+box.width/2-(bounds.left+(viewport.clientLeft||0)+viewport.clientWidth/2);
    viewport.scrollTop+=box.top+box.height/2-(bounds.top+(viewport.clientTop||0)+viewport.clientHeight/2);
}
export class SearchNavigation {
    pending?:{request:NonNullable<ReturnType<typeof searchRequest>>;file:string};
    private cleanup:(()=>void)[]=[];
    constructor(private view:any){}
    stop(){this.cleanup.splice(0).forEach(fn=>fn());}
    clear(){this.pending=undefined;this.stop();}
    beginRender(){this.stop();if(this.pending?.file&&this.pending.file!==this.view.file?.path)this.pending=undefined;}
    receive(state:any){const request=searchRequest(state);if(!request)return;this.stop();this.pending={request,file:this.view.file?.path||''};this.flush();}
    flush(){
        const view=this.view,map=view.mindmap,pending=this.pending;
        if(!pending||!view.searchReady||!map?.root)return;
        this.pending=undefined;if(pending.file&&pending.file!==view.file?.path)return;
        if(map.isComposing)return;
        map.finishEditingForHistory();
        const node=resolveSearchNode(view,pending.request);if(!node)return;
        map.relations?.cancel();map.textFormatMenu?.close();
        const expand=(n:any)=>{const parents:any[]=[];for(let p=n.parent;p;p=p.parent)parents.unshift(p);parents.forEach(p=>{if(!p.isExpand)p.expand();});};
        expand(node);
        if(node.data.summaryTree){const item=map.summaries?.items.find((entry:any)=>entry.id===node.data.summaryTree);item?.memberIds.forEach((id:string)=>{const member=map.getNodeById(id);if(member)expand(member);});}
        const panel=view.panel;if(panel?.element.classList.contains('mm-mobile-panel')&&!panel.element.hidden)panel.toggle();
        map.refresh();map.setSelectedNodes([node],node);centerSearchNode(map,node);
        const file=view.file?.path;
        const center=()=>{if(view.mindmap===map&&view.file?.path===file&&map.getNodeById(node.getId())===node)centerSearchNode(map,node);};
        const doc=map.appEl.ownerDocument,win=doc?.defaultView;
        if(win){const frame=win.requestAnimationFrame(center);this.cleanup.push(()=>win.cancelAnimationFrame(frame));}
        for(const delay of [120,400]){const timer=setTimeout(center,delay);this.cleanup.push(()=>clearTimeout(timer));}
        const stop=()=>this.stop();for(const event of ['pointerdown','wheel','keydown']){map.appEl.addEventListener(event,stop,true);this.cleanup.push(()=>map.appEl.removeEventListener(event,stop,true));}
    }
}
