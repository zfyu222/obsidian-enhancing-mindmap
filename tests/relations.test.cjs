const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:id=>id.endsWith("nodeStyles") ? load("src/nodeStyles.ts") : deps[id]||{},console,setTimeout,clearTimeout});return module.exports;}
const selection=load('src/mindmap/selection.ts');
const markdown=load('src/summary/markdown.ts');
const model=load('src/summary/model.ts',{'../mindmap/selection':selection});
const relationModel=load('src/relations/model.ts');
const clip=load('src/mindmap/clipboard.ts',{'./selection':selection,'../relations/model':relationModel});
let serial=0;const uuid=()=>`fresh-${++serial}`;
class Node{
 constructor(data,map){this.data=data;this.mindmap=map;this.children=[];this.isExpand=true;this.direct='right';this.box={x:0,y:0,width:100,height:30};this.containEl={setAttribute(){},focus(){},remove(){},classList:{add(){},remove(){},contains(){return false}}};this.contentEl={contains(){return false}};}
 getId(){return this.data.id}getData(){return {...this.data}}getBox(){return {...this.box}}getPosition(){return this.box}
 getLevel(){let l=0,p=this;while(p.parent){l++;p=p.parent}return l}
 setPosition(x,y){this.box.x=x;this.box.y=y}refreshBox(){}clearCacheData(){}
 addChild(n,i=-1){this.children.splice(i<0?this.children.length:i,0,n);n.parent=this}removeChild(n){const i=this.children.indexOf(n);this.children.splice(i,1);return i}
 select(preserve=false){if(!preserve)this.mindmap.setSelectedNodes([this],this);this.mindmap.selectNode=this}unSelect(){}
 edit(){this.data.isEdit=true;this._oldText=this.data.text;this.mindmap.editNode=this}cancelEdit(){this.data.isEdit=false}
 isShow(){return !this.isHide}show(){this.isHide=false}hide(){this.isHide=true}
 expand(){this.isExpand=true}collapse(){this.isExpand=false}setText(text){this.data.text=text}
}
const commands=load('src/mindmap/Cmds.ts',{'./selection':selection,'./INode':{default:Node}});
const History=load('src/mindmap/History.ts').default;
const Exec=load('src/mindmap/Execute.ts',{'./History':{default:History},'./Cmds':commands,'../MindMapView':{uuid},'../lang/helpers':{t:x=>x},'./INode':{default:Node}}).default;
const Manager=load('src/summary/manager.ts',{'../mindmap/INode':{default:Node},'obsidian':{Notice:class{}},'../MindMapView':{uuid},'./markdown':markdown,'./model':model,'../lang/helpers':{t:x=>x}}).default;
const MindMap=load('src/mindmap/mindmap.ts',{'./selection':selection,'./clipboard':clip,'../MindMapView':{uuid}}).default;
const Relations=load('src/relations/manager.ts',{obsidian:{Notice:class{}},'../MindMapView':{uuid},'../lang/helpers':{t:x=>x},'./model':relationModel}).default;
function fixture(){const map=Object.create(MindMap.prototype);Object.assign(map,{exec:new Exec(),setting:{headLevel:1},selectedNodes:[],_menuDom:{style:{}},emit(){},refresh(){},contentEL:{contains(){return false},appendChild(){},removeChild(){}},appEl:{focus(){}},edgeGroup:{group(){return{clear(){}}}}});map.root=new Node({id:'root',text:'Root',isRoot:true},map);map.summaries=new Manager(map);map.relations=new Relations(map);const add=(text,parent=map.root)=>{const n=new Node({id:uuid(),text},map);parent.addChild(n);return n};const a=add('A'),b=add('B'),c=add('C');return{map,a,b,c,add};}
const json=x=>JSON.parse(JSON.stringify(x));

test('relations round trip strict metadata outside code and preserve unknown or damaged comments',()=>{
 const links=[{id:'edge-1',from:'a',to:'b'}],raw=relationModel.relationsMarkdown(links);
 const source='# Root\n- A\n\n'+raw;const parsed=relationModel.extractRelations(source);
 assert.deepEqual(json(parsed.entries),links);assert.equal(parsed.preserved,'');assert.ok(!parsed.main.includes('mm:relations'));
 const literal='# Root\n```\n'+raw+'\n```';assert.equal(relationModel.extractRelations(literal).main,literal);
 for(const damaged of ['<!-- mm:relations {"version":9,"links":[]} -->','<!-- mm:relations broken -->',raw+'\n'+raw]){
  const result=relationModel.extractRelations('# Root\n'+damaged);assert.equal(result.preserved,damaged);assert.equal(result.entries.length,0);
 }
 for(const links of [[{id:'x',from:'a',to:'a'}],[{id:'x',from:'a',to:'b',color:'url(x)'}],[{id:'x',from:'a',to:'b'},{id:'y',from:'a',to:'b'}]])assert.throws(()=>relationModel.validateRelations(links));
});
test('creating, deleting and restoring a relation uses one graph history entry and stable endpoint IDs',()=>{
 const {map,a,b}=fixture();map.relations.create(a.getId(),b.getId());
 assert.equal(map.relations.items.length,1);assert.equal(map.exec.history.undos.length,1);
 assert.equal(a.data.relationMember,true);assert.equal(b.data.relationMember,true);
 const saved=map.getMarkdown();assert.ok(saved.includes('mm:relations'));assert.ok(saved.includes('mm:node'));
 const parsed=relationModel.extractRelations(saved);assert.deepEqual(json(parsed.entries),json(map.relations.items));
 const parser=require('../src/markmapLib/markmap-lib/dist/browser/index.js');
 const View=load('src/MindMapView.ts',{obsidian:{TextFileView:class{}},'./markmapLib/markmap-lib':parser,'./summary/markdown':markdown}).MindMapView;
 const root=View.prototype.mdToData.call({},parsed.main);assert.equal(root.children[0].id,a.getId());assert.equal(root.children[0].text,'A');
 map.relations.create(a.getId(),b.getId());assert.equal(map.exec.history.undos.length,1);
 map.undo();assert.equal(map.relations.items.length,0);assert.equal(a.data.relationMember,undefined);
 map.redo();assert.equal(map.relations.items.length,1);
 map.relations.selected=map.relations.items[0].id;map.relations.remove();assert.equal(map.relations.items.length,0);assert.equal(a.data.relationMember,undefined);
 map.undo();assert.equal(map.relations.items.length,1);assert.equal(a.data.relationMember,true);
});
test('endpoint deletion and summary cascade remove connections atomically and undo restores them',()=>{
 const {map,a,b,c}=fixture();map.relations.create(a.getId(),b.getId());const id=map.relations.items[0].id;
 map.setSelectedNodes([a]);map.deleteSelectedNodes();assert.equal(map.relations.items.length,0);
 map.undo();assert.equal(map.relations.items[0].id,id);map.redo();assert.equal(map.relations.items.length,0);map.undo();
 map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();const summary=map.summaries.items[0];
 map.relations.create(summary.root.getId(),c.getId());
 const count=map.exec.history.undos.length;map.setSelectedNodes([a,b]);map.deleteSelectedNodes();
 assert.equal(map.exec.history.undos.length,count+1);assert.equal(map.relations.items.length,0);assert.equal(map.summaries.items.length,0);
 map.undo();assert.equal(map.summaries.items.length,1);assert.equal(map.relations.items.length,2);
});
test('moving endpoints preserves direction; clipboard remaps only fully copied relations including summary nodes',()=>{
 const {map,a,b,c}=fixture();map.relations.create(a.getId(),b.getId());
 map.execute('moveNodes',{nodes:[a],dropNode:c,type:'child'});assert.equal(map.relations.items[0].from,a.getId());map.undo();
 const single=JSON.parse(map.copyForest([a]));assert.equal(single.relations,undefined);
 const text=map.copyForest([a,b]),parsed=clip.parseSubtree(text,uuid);assert.equal(parsed.relations.length,1);
 assert.equal(parsed.relations[0].from,parsed[0].id);assert.notEqual(parsed.relations[0].id,map.relations.items[0].id);
 map.pasteNode(text,c);assert.equal(map.relations.items.length,2);map.undo();assert.equal(map.relations.items.length,1);map.redo();assert.equal(map.relations.items.length,2);
 map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();const summary=map.summaries.items[0];
 map.relations.create(a.getId(),summary.root.getId());const full=clip.parseSubtree(map.copyForest([a,b]),uuid);
 assert.equal(full.summaries.length,1);assert.equal(full.relations.length,2);assert.ok(full.relations.some(link=>link.to===full.summaries[0].root.id));
 const mixed=clip.parseSubtree(map.copyForest([a,b,summary.root]),uuid);assert.ok(mixed);assert.equal(mixed.summaries,undefined);assert.equal(mixed.relations.length,2);
 const bad=JSON.parse(text);bad.relations[0].to='external';assert.equal(clip.parseSubtree(JSON.stringify(bad),uuid),null);
});
test('invalid endpoint references preserve raw relations through editing and load does not add history',()=>{
 const {map,a,b}=fixture();const raw=relationModel.relationsMarkdown([{id:'x',from:a.getId(),to:'missing'}]);
 map.relations.load([{id:'x',from:a.getId(),to:'missing'}],'',raw);
 assert.equal(map.relations.preserved,raw);assert.equal(map.relations.items.length,0);assert.equal(map.exec.history.undos.length,0);
 map.relations.create(a.getId(),b.getId());assert.equal(map.exec.history.undos.length,0);assert.ok(map.getMarkdown().includes(raw));
});
test('curves attach to node borders in all directions and include finite arrow geometry',()=>{
 const a={x:100,y:100,width:100,height:40};
 for(const b of [{x:350,y:180,width:80,height:30},{x:-100,y:10,width:80,height:30},{x:100,y:400,width:100,height:40},{x:100,y:-100,width:100,height:40}]){
  const curve=relationModel.relationCurve(a,b);assert.ok(curve.path.includes(' C '));assert.ok(curve.arrow.endsWith(' Z'));assert.ok(!/NaN|Infinity/.test(curve.path+curve.arrow));
 }
});
