const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:id=>deps[id]||{},console,setTimeout,clearTimeout});return module.exports;}
const graftsModel=load('src/grafts/model.ts'),selection=load('src/mindmap/selection.ts');
const clip=load('src/mindmap/clipboard.ts',{'./selection':selection,'../grafts/model':graftsModel});
const serialize=require('./pages-serialize.cjs');
let sequence=0;const uuid=()=>`id-${++sequence}`;
class Node{
 constructor(data,map){this.data=data;this.mindmap=map;this.children=[];this.isExpand=true;this.containEl={classList:{add(){},remove(){}},setAttribute(){},remove(){},focus(){},title:''};this.contentEl={};}
 getId(){return this.data.id}getData(){return{...this.data}}getLevel(){return this.parent?this.parent.getLevel()+1:0}
 refreshBox(){}clearCacheData(){}setPosition(){}setText(text){this.data.text=text}show(){this.isHide=false}hide(){this.isHide=true}isShow(){return !this.isHide}
 expand(){if(this.virtualSource)this.mindmap.grafts.rememberExpansion(this,true);this.isExpand=true}collapse(){if(this.virtualSource)this.mindmap.grafts.rememberExpansion(this,false);this.isExpand=false}select(preserve=false){if(!preserve)this.mindmap.setSelectedNodes([this]);this.mindmap.selectNode=this}unSelect(){}cancelEdit(){this.data.isEdit=false}
 addChild(n,index=-1){this.children.splice(index<0?this.children.length:index,0,n);n.parent=this}removeChild(n){const i=this.children.indexOf(n);this.children.splice(i,1);return i}
 edit(){this._oldText=this.data.text;this.data.isEdit=true;this.contentEl.innerText=this.data.text;this.mindmap.editNode=this}
}
const commands=load('src/mindmap/Cmds.ts',{'./selection':selection,'./INode':{default:Node}});
const History=load('src/mindmap/History.ts').default;
const Exec=load('src/mindmap/Execute.ts',{'./History':{default:History},'./Cmds':commands,'./INode':{default:Node},'../MindMapView':{uuid},'../lang/helpers':{t:x=>x}}).default;
const Summaries=load('src/summary/manager.ts',{'./markdown':{summaryMarkdown:()=>''},'../mindmap/INode':{default:Node},'obsidian':{Notice:class{}},'../MindMapView':{uuid},'../lang/helpers':{t:x=>x}}).default;
const Grafts=load('src/grafts/manager.ts',{'./model':graftsModel,'../mindmap/INode':{default:Node},'../mindmap/Cmds':commands,'../nodeStyles':{applyNodeStyle(){}},'obsidian':{Notice:class{}},'../MindMapView':{uuid},'../lang/helpers':{t:x=>x}}).default;
const MindMap=load('src/mindmap/mindmap.ts',{'../pages/serialize':serialize,'./selection':selection,'./clipboard':clip,'../MindMapView':{uuid}}).default;

/** `map` is the active page; its source node lives on a detached foreign page. */
function fixture(){
 const map=Object.create(MindMap.prototype);
 Object.assign(map,{exec:new Exec(),setting:{headLevel:1},selectedNodes:[],_menuDom:{style:{}},emit(){},refresh(){if(this.grafts)this.grafts.withTrees(()=>{});},contentEL:{contains(){return false},appendChild(){}},appEl:{focus(){}},edgeGroup:{group(){return{clear(){}}}}});
 map.root=new Node({id:'root',text:'Root',isRoot:true},map);
 map.summaries=new Summaries(map);map.grafts=new Grafts(map);
 const add=(text,parent=map.root)=>{const node=new Node({id:uuid(),text},map);parent.addChild(node);return node};
 const b=add('B');
 const foreignRoot=new Node({id:'f-root',text:'Foreign',isRoot:true},map);
 const f=add2('f-a','Foreign A',foreignRoot),f1=add2('f-a1','Foreign child',f);
 function add2(id,text,parent){const node=new Node({id,text},map);parent.addChild(node);return node}
 map.foreignNodes=()=>[foreignRoot,f,f1];
 return {map,b,f,f1,foreignRoot,add};
}

test('a graft whose source is on another page loads, renders only at the target and keeps its own page text',()=>{
 const {map,b,f,f1,foreignRoot}=fixture();
 const entry={id:'g-1',source:'f-a',target:b.getId()};
 map.grafts.load([entry]);map.grafts.sync();
 assert.equal(map.grafts.preserved,'');
 assert.equal(map.grafts.items.length,1);
 const mirror=map.grafts.roots[0].node;
 assert.equal(mirror.virtualSource,f);
 assert.equal(mirror.children[0].virtualSource,f1);
 assert.equal(map.grafts.roots[0].target,b);
 assert.equal(b.children.length,0);
 // The active page never gains the foreign text; the source page keeps its own identity.
 const raw=map.getMarkdown();
 assert.ok(raw.includes('"source":"f-a"'));
 assert.ok(!raw.includes('Foreign child'));
 assert.equal(f.data.graftMember,true);
 assert.ok(serialize.treeMarkdown(foreignRoot,2).includes('<!-- mm:node {"id":"f-a"} -->'));
});

test('editing a cross-page projection writes the detached source and shares the page history',()=>{
 const {map,b,f}=fixture();
 map.grafts.load([{id:'g-1',source:'f-a',target:b.getId()}]);map.grafts.sync();
 const mirror=map.grafts.roots[0].node;
 const count=map.exec.history.undos.length;
 map.execute('changeNodeText',{node:mirror,oldText:'Foreign A',text:'Changed'});
 assert.equal(f.data.text,'Changed');
 assert.equal(map.exec.history.undos.length,count+1);
 assert.equal(mirror.data.text,'Changed');
 map.undo();
 assert.equal(f.data.text,'Foreign A');
 assert.equal(mirror.data.text,'Foreign A');
});

test('cross-page cycles and chains are refused with the whole document graph',()=>{
 const {map,b,f,f1}=fixture();
 map.grafts.create('f-a',b.getId());
 assert.equal(map.grafts.items.length,1);
 // B now projects the foreign subtree, so grafting its descendant back under B is cyclic.
 map.grafts.create(b.getId(),'f-a1');
 assert.equal(map.grafts.items.length,1);
 // A node that exists on no page is rejected instead of being silently accepted.
 map.grafts.create('missing',b.getId());
 assert.equal(map.grafts.items.length,1);
 // Loading a link whose source page is gone marks the metadata as damaged instead of
 // dropping the reference.
 map.foreignNodes=()=>[];
 map.grafts.load([{id:'g-1',source:'f-a',target:b.getId()}]);
 assert.equal(map.grafts.items.length,0);
 assert.ok(map.grafts.preserved.includes('mm:grafts'));
});
