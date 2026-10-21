const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:id=>deps[id]||{},console,setTimeout,clearTimeout});return module.exports;}
const model=load('src/grafts/model.ts'),selection=load('src/mindmap/selection.ts');
const clip=load('src/mindmap/clipboard.ts',{'./selection':selection,'../grafts/model':model});
let sequence=0;const uuid=()=>`id-${++sequence}`;
class Node{
 constructor(data,map){this.data=data;this.mindmap=map;this.children=[];this.isExpand=true;this.containEl={classList:{add(){},remove(){}},setAttribute(){},remove(){this.removed=true},focus(){}};this.contentEl={};}
 getId(){return this.data.id}getData(){return{...this.data}}getLevel(){return this.parent?this.parent.getLevel()+1:0}
 refreshBox(){}clearCacheData(){}setPosition(){}setText(text){this.data.text=text}show(){this.isHide=false}hide(){this.isHide=true}isShow(){return !this.isHide}
 expand(){this.isExpand=true}collapse(){this.isExpand=false}select(preserve=false){if(!preserve)this.mindmap.setSelectedNodes([this]);this.mindmap.selectNode=this}unSelect(){}cancelEdit(){this.data.isEdit=false}
 addChild(n,index=-1){this.children.splice(index<0?this.children.length:index,0,n);n.parent=this}removeChild(n){const i=this.children.indexOf(n);this.children.splice(i,1);return i}
}
const commands=load('src/mindmap/Cmds.ts',{'./selection':selection,'./INode':{default:Node}});
const History=load('src/mindmap/History.ts').default;
const Exec=load('src/mindmap/Execute.ts',{'./History':{default:History},'./Cmds':commands,'./INode':{default:Node},'../MindMapView':{uuid},'../lang/helpers':{t:x=>x}}).default;
const Summaries=load('src/summary/manager.ts',{'./markdown':{summaryMarkdown:()=>''},'../mindmap/INode':{default:Node},'obsidian':{Notice:class{}},'../MindMapView':{uuid},'../lang/helpers':{t:x=>x}}).default;
const Grafts=load('src/grafts/manager.ts',{'./model':model,'../mindmap/INode':{default:Node},'../mindmap/Cmds':commands,'../nodeStyles':{applyNodeStyle(){}},'obsidian':{Notice:class{}},'../MindMapView':{uuid},'../lang/helpers':{t:x=>x}}).default;
const MindMap=load('src/mindmap/mindmap.ts',{'./selection':selection,'./clipboard':clip,'../MindMapView':{uuid}}).default;
const json=value=>JSON.parse(JSON.stringify(value));
function fixture(){const map=Object.create(MindMap.prototype);Object.assign(map,{exec:new Exec(),setting:{headLevel:1},selectedNodes:[],_menuDom:{style:{}},emit(){},refresh(){if(this.grafts)this.grafts.withTrees(()=>{});},contentEL:{contains(){return false},appendChild(){}},appEl:{focus(){}},edgeGroup:{group(){return{clear(){}}}}});
 map.root=new Node({id:'root',text:'Root',isRoot:true},map);map.summaries=new Summaries(map);map.grafts=new Grafts(map);
 const add=(text,parent=map.root)=>{const node=new Node({id:uuid(),text},map);parent.addChild(node);return node};
 const a=add('A'),a1=add('A1',a),b=add('B'),c=add('C');return{map,a,a1,b,c,add};}

test('virtual references serialize strictly outside fences and preserve invalid metadata',()=>{
 const items=[{id:'ref',source:'a',target:'b'}],raw=model.graftsMarkdown(items),parsed=model.extractGrafts('# Root\n'+raw);
 assert.deepEqual(json(parsed.entries),items);assert.equal(parsed.main,'# Root');
 assert.equal(model.extractGrafts('```\n'+raw+'\n```').raw,'');
 for(const damaged of [raw+'\n'+raw,'<!-- mm:grafts broken -->','<!-- mm:grafts {"version":9,"links":[]} -->'])assert.equal(model.extractGrafts(damaged).preserved,damaged);
 for(const items of [[{id:'r',source:'a',target:'a'}],[{id:'r',source:'a',target:'b',extra:1}],[{id:'r',source:'a',target:'b'},{id:'s',source:'a',target:'b'}]])assert.throws(()=>model.validateGrafts(items));
});
test('grafts render projections without adding real children and survive Markdown reload with stable IDs',()=>{
 const {map,a,a1,b}=fixture();map.grafts.create(a.getId(),b.getId());
 assert.equal(map.grafts.roots.length,1);assert.equal(b.children.length,0);assert.equal(a.children[0],a1);
 const mirror=map.grafts.roots[0].node;assert.equal(mirror.virtualSource,a);assert.equal(mirror.children[0].virtualSource,a1);
 map.grafts.withTrees(()=>assert.equal(b.children[0],mirror));assert.equal(b.children.length,0);
 assert.throws(()=>map.grafts.withTrees(()=>{throw Error('layout failure')}));assert.equal(b.children.length,0);
 const raw=map.getMarkdown();assert.equal((raw.match(/- A1/g)||[]).length,1);assert.ok(raw.includes('mm:node'));assert.ok(!raw.includes('virtual:'));
 const parsed=model.extractGrafts(raw);assert.deepEqual(json(parsed.entries),json(map.grafts.items));
 const parser=require('../src/markmapLib/markmap-lib/dist/browser/index.js');
 const styles=load('src/nodeStyles.ts'),markdown=load('src/summary/markdown.ts',{'../nodeStyles':styles});
 const View=load('src/MindMapView.ts',{obsidian:{TextFileView:class{}},'./summary/markdown':markdown,'./nodeStyles':styles,'./markmapLib/markmap-lib':parser}).MindMapView;
 const tree=View.prototype.mdToData.call({},parsed.main);
 assert.equal(tree.children[0].id,a.getId());assert.equal(tree.children[1].id,b.getId());
 assert.equal(tree.children[1].children.length,0);assert.equal(tree.children[0].children[0].text,'A1');
 const fresh=fixture().map;
 const restore=(data,parent)=>{const node=new Node({...data,isRoot:!parent},fresh);node.parent=parent;node.children=(data.children||[]).map(child=>restore(child,node));return node;};
 fresh.root=restore(tree);fresh.grafts.load(parsed.entries);fresh.refresh();assert.equal(fresh.grafts.roots[0].node.children[0].data.text,'A1');
 map.grafts.clear();map.grafts.load(parsed.entries);map.refresh();assert.equal(map.grafts.roots[0].node.data.text,'A');assert.equal(b.children.length,0);
});
test('edits through any projected node update the source, all references and global undo/redo',()=>{
 const {map,a,a1,b,c}=fixture();map.grafts.create(a.getId(),b.getId());map.grafts.create(a.getId(),c.getId());
 const mirror=map.grafts.roots[0].node.children[0],count=map.exec.history.undos.length;
 map.execute('changeNodeText',{node:mirror,oldText:'A1',text:'Changed'});
 assert.equal(a1.data.text,'Changed');assert.equal(map.grafts.roots[1].node.children[0].data.text,'Changed');assert.equal(map.exec.history.undos.length,count+1);
 map.undo();assert.equal(a1.data.text,'A1');assert.equal(mirror.data.text,'A1');map.redo();assert.equal(mirror.data.text,'Changed');
 const added=new Node({id:uuid(),text:'New'},map);a.addChild(added);map.refresh();assert.equal(map.grafts.roots[1].node.children.length,2);
 a.collapse();map.refresh();assert.equal(map.grafts.roots[0].node.children[0].isShow(),false);
 a.expand();b.collapse();map.refresh();assert.equal(map.grafts.roots[0].node.isShow(),false);assert.equal(map.grafts.roots[1].node.isShow(),true);
});
test('deleting a projected root detaches only that reference; deleting a source cascades atomically and undo restores',()=>{
 const {map,a,b,c}=fixture();map.grafts.create(a.getId(),b.getId());map.grafts.create(a.getId(),c.getId());
 const count=map.exec.history.undos.length,mirror=map.grafts.roots[0].node;map.setSelectedNodes([mirror]);map.deleteSelectedNodes();
 assert.equal(map.grafts.items.length,1);assert.equal(map.getNodeById(a.getId()),a);assert.equal(map.exec.history.undos.length,count+1);
 map.undo();assert.equal(map.grafts.items.length,2);map.redo();assert.equal(map.grafts.items.length,1);map.undo();
 map.setSelectedNodes([a]);map.deleteSelectedNodes();assert.equal(map.grafts.items.length,0);assert.equal(map.getNodeById(a.getId()),null);
 map.undo();assert.equal(map.getNodeById(a.getId()),a);assert.equal(map.grafts.items.length,2);assert.equal(b.children.length,0);
 map.setSelectedNodes([map.grafts.roots[0].node.children[0]]);map.deleteSelectedNodes();assert.equal(a.children.length,0);map.undo();assert.equal(a.children.length,1);
});
test('self, ancestor and chained cycles are refused, including cycles created by moving real source nodes',()=>{
 const {map,a,a1,b,c}=fixture();map.grafts.create(a.getId(),a1.getId());assert.equal(map.grafts.items.length,0);
 map.grafts.create(a.getId(),b.getId());map.grafts.create(b.getId(),c.getId());const before=map.exec.history.undos.length;
 map.grafts.create(c.getId(),a.getId());assert.equal(map.grafts.items.length,2);assert.equal(map.exec.history.undos.length,before);
 map.execute('moveNodes',{nodes:[b],dropNode:a1,type:'child-right'});assert.equal(b.parent,map.root);assert.equal(map.exec.history.undos.length,before);
 const bad=[{id:'x',source:a.getId(),target:a1.getId()}];map.grafts.load(bad);assert.equal(map.grafts.items.length,0);assert.ok(map.grafts.preserved);assert.ok(map.getMarkdown().includes('mm:grafts'));
});
test('copying a forest remaps internal grafts; copying a projection creates independent ordinary text',()=>{
 const {map,a,b}=fixture();map.grafts.create(a.getId(),b.getId());
 const raw=map.copyForest([a,b]),data=clip.parseSubtree(raw,uuid);assert.equal(data.grafts.length,1);
 assert.notEqual(data.grafts[0].source,a.getId());assert.equal(data.grafts[0].source,data[0].id);
 assert.equal(clip.parseSubtree(JSON.stringify({type:'copyNodes',text:[{id:'a',pid:null,text:'A'},{id:'b',pid:'a',text:'B'}],grafts:[{id:'r',source:'a',target:'b'}]}),uuid),null);
 const copied=JSON.parse(map.copyForest([map.grafts.roots[0].node]));assert.equal(copied.text[0].text,'A');assert.equal(copied.text.length,2);assert.equal(copied.grafts,undefined);
 map.execute('pasteNode',{node:map.root,data});assert.equal(map.grafts.items.length,2);map.undo();assert.equal(map.grafts.items.length,1);map.redo();assert.equal(map.grafts.items.length,2);
});
