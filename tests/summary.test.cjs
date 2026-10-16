const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:id=>id.endsWith("nodeStyles") ? load("src/nodeStyles.ts") : deps[id]||{},console,setTimeout,clearTimeout});return module.exports;}
const selection=load('src/mindmap/selection.ts');
const markdown=load('src/summary/markdown.ts');
const model=load('src/summary/model.ts',{'../mindmap/selection':selection});
const clip=load('src/mindmap/clipboard.ts',{'./selection':selection});
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
function fixture(){const map=Object.create(MindMap.prototype);Object.assign(map,{exec:new Exec(),setting:{headLevel:1},selectedNodes:[],_menuDom:{style:{}},emit(){},refresh(){},contentEL:{contains(){return false},appendChild(){},removeChild(){}},appEl:{focus(){}},edgeGroup:{group(){return{clear(){}}}}});map.root=new Node({id:'root',text:'Root',isRoot:true},map);map.summaries=new Manager(map);const add=(text,parent=map.root)=>{const n=new Node({id:uuid(),text},map);parent.addChild(n);return n};const a=add('A'),b=add('B'),c=add('C');return{map,a,b,c,add};}
const json=x=>JSON.parse(JSON.stringify(x));
test('summary membership uses ancestry, parent, root side and sibling index; single nodes are valid',()=>{
 const {map,a,b,c,add}=fixture(),child=add('child',a);
 assert.equal(model.validateSummary([a],map.root).error,'');
 assert.deepEqual(Array.from(model.validateSummary([child,a,b],map.root).members),[a,b]);
 assert.match(model.validateSummary([a,c],map.root).error,/consecutive/);
 c.direct='left';assert.match(model.validateSummary([b,c],map.root).error,/same side/);
 assert.match(model.validateSummary([child,b],map.root).error,/same parent/);
 assert.ok(model.validateSummary([map.root],map.root).error);
});
test('summary section round-trips independent trees, empty nodes, folding, paragraphs, code, tables and embeds',()=>{
 const root={id:'s',text:'Conclusion\n\nParagraph',expanded:false,children:[{id:'c1',text:'```js\n- literal list\nconst x=1;\n```',expanded:true,children:[]},{id:'c2',text:'| A | B |\n|---|---|\n| 1 | 2 |\n\n![[Assets/image.png]]',expanded:true,children:[{id:'c3',text:'',expanded:false,children:[]}]}]};
 const entries=[{id:'s',memberIds:['a','b'],root}];const section=markdown.summaryMarkdown(entries),document='# Main\n- A\n\n'+section;
 const parsed=markdown.extractSummaries(document);assert.equal(parsed.main,'# Main\n- A');assert.equal(parsed.error,'');assert.deepEqual(json(parsed.entries),entries);
 assert.equal(markdown.summaryMarkdown(parsed.entries),section);
 const marker=markdown.readNodeMarker('A <!-- mm:node {"id":"stable"} -->');assert.equal(marker.id,'stable');assert.equal(marker.text,'A');
});
test('damaged or future summary sections preserve all original bytes',()=>{
 for(const raw of ['<!-- mm:summaries:start {"version":9} -->\nunknown','<!-- mm:summaries:start {"version":1} -->\n## 概括子树区\n\n### X <!-- mm:summary {"id":"s","members":[]} -->\n<!-- mm:summaries:end -->']){const parsed=markdown.extractSummaries('# Main\n'+raw);assert.equal(parsed.preserved,raw);assert.ok(parsed.error);assert.equal(parsed.entries.length,0);}
});
test('overlapping summaries share IDs; deleting the final relation cleans IDs and undo restores trees',()=>{
 const {map,a,b,c}=fixture();map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();const first=map.summaries.items[0];
 map.setSelectedNodes([b,c]);map.summaries.create();map.finishEditingForHistory();const second=map.summaries.items[1];
 map.setSelectedNodes([first.root]);map.deleteSelectedNodes();assert.equal(map.summaries.items.length,1);assert.equal(a.data.summaryMember,undefined);assert.equal(b.data.summaryMember,true);
 map.setSelectedNodes([second.root]);map.deleteSelectedNodes();assert.equal(map.summaries.items.length,0);assert.equal(b.data.summaryMember,undefined);assert.equal(c.data.summaryMember,undefined);
 map.undo();assert.equal(map.summaries.items.length,1);assert.equal(b.data.summaryMember,true);map.undo();assert.equal(map.summaries.items.length,2);assert.equal(a.data.summaryMember,true);
});
test('deleting all original members removes dependent trees as one command and undo restores child content',()=>{
 const {map,a,b,add}=fixture();map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();const item=map.summaries.items[0];add('Saved child',item.root);
 const old=map.exec.history.undos.length;map.setSelectedNodes([a,b]);map.deleteSelectedNodes();assert.equal(map.exec.history.undos.length,old+1);assert.equal(map.summaries.items.length,0);
 map.undo();assert.equal(map.summaries.items[0].root.children[0].data.text,'Saved child');assert.deepEqual(Array.from(map.summaries.items[0].memberIds),[a.getId(),b.getId()]);map.redo();assert.equal(map.summaries.items.length,0);
});
test('insertion inside a range joins it and shares the same undo transaction',()=>{
 const {map,a,b}=fixture();map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();const item=map.summaries.items[0];
 const n=map.execute('addSiblingNode',{parent:map.root,index:1,text:'Inside'});assert.deepEqual(Array.from(item.memberIds),[a.getId(),n.getId(),b.getId()]);assert.equal(n.data.summaryMember,true);
 map.undo();assert.deepEqual(Array.from(map.summaries.items[0].memberIds),[a.getId(),b.getId()]);
});
test('moving part of a range detaches it; moving the whole group keeps its relation',()=>{
 const {map,a,b,c}=fixture();map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();map.execute('moveNodes',{nodes:[a],dropNode:c,type:'child'});
 assert.deepEqual(Array.from(map.summaries.items[0].memberIds),[b.getId()]);map.undo();map.execute('moveNodes',{nodes:[a,b],dropNode:c,type:'child'});assert.equal(map.summaries.items.length,1);assert.deepEqual(Array.from(map.summaries.items[0].memberIds),[a.getId(),b.getId()]);
});
test('full forest clipboard carries summary trees with new IDs; partial and summary-only copies are independent',()=>{
 const {map,a,b}=fixture();map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();const item=map.summaries.items[0];
 const full=clip.serializeForest([a,b],map.summaries.data()),parsed=clip.parseSubtree(full,uuid);assert.equal(parsed.summaries.length,1);assert.notEqual(parsed.summaries[0].id,item.id);assert.deepEqual(Array.from(parsed.summaries[0].memberIds),Array.from(parsed,n=>n.id));
 assert.equal(JSON.parse(clip.serializeForest([a],map.summaries.data())).summaries,undefined);
 const alone=clip.parseSubtree(clip.serializeForest([item.root]),uuid);assert.equal(alone[0].summaryRoot,undefined);assert.equal(alone[0].summaryTree,undefined);
});
test('stable member ID survives main Markdown parsing without becoming a folded node',()=>{
 const parser=require('../src/markmapLib/markmap-lib/dist/browser/index.js');const view=load('src/MindMapView.ts',{obsidian:{TextFileView:class{}},'./markmapLib/markmap-lib':parser,'./summary/markdown':markdown}).MindMapView;
 const document='# Main\n\n- A <!-- mm:node {"id":"stable"} -->';const data=view.prototype.mdToData.call({},document);assert.equal(data.children[0].id,'stable');assert.equal(data.children[0].expanded,true);assert.equal(data.children[0].text,'A');
});

test('literal section markers in fenced source content are not interpreted as relations',()=>{
 const text='# Main\n\n```md\n<!-- mm:summaries:start {"version":1} -->\n```';const parsed=markdown.extractSummaries(text);assert.equal(parsed.main,text);assert.equal(parsed.preserved,'');
});
test('dangling references freeze the original summary section without discarding Markdown',()=>{
 const {map}=fixture();const raw=markdown.summaryMarkdown([{id:'s',memberIds:['missing'],root:{id:'s',text:'Keep me',expanded:true,children:[]}}]);const parsed=markdown.extractSummaries(raw);map.summaries.load(parsed.entries,'',raw);assert.equal(map.summaries.items.length,0);assert.equal(map.summaries.preserved,raw);assert.ok(map.getMarkdown().endsWith(raw));
});
test('copy/paste undo and redo restore markers on recreated main nodes, not detached objects',()=>{
 const {map,a,b,c}=fixture();map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();const text=map.copyForest([a,b]);map.pasteNode(text,c);assert.equal(map.summaries.items.length,2);const members=Array.from(map.summaries.items[1].memberIds);
 map.undo();assert.equal(map.summaries.items.length,1);map.redo();assert.equal(map.summaries.items.length,2);members.forEach(id=>assert.equal(map.getNodeById(id).data.summaryMember,true));
});
test('overlapping ranges pin connected root branches together during automatic side allocation',()=>{
 const {map,a,b,c}=fixture();map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();map.setSelectedNodes([b,c]);map.summaries.create();map.finishEditingForHistory();a.direct='left';b.direct='right';c.direct='right';map.summaries.pinSides(map.root.children,'mind map');assert.equal(a.direct,b.direct);assert.equal(b.direct,c.direct);map.summaries.pinSides(map.root.children,'left');assert.equal(a.direct,'left');assert.equal(c.direct,'left');
});

test('member markers preserve code and table node identity and sibling topology',()=>{
 const {map,a,b}=fixture();a.data.text='```js\nconst x = 1;\n```';b.data.text='| A | B |\n|---|---|\n| 1 | 2 |';map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();
 const parser=require('../src/markmapLib/markmap-lib/dist/browser/index.js');const View=load('src/MindMapView.ts',{obsidian:{TextFileView:class{}},'./markmapLib/markmap-lib':parser,'./summary/markdown':markdown}).MindMapView;
 map.setting.headLevel=1;const text=markdown.extractSummaries(map.getMarkdown()).main;const data=View.prototype.mdToData.call({},text);assert.equal(data.children.length,3);assert.equal(data.children[0].id,a.getId());assert.equal(data.children[1].id,b.getId());assert.equal(data.children[0].text,a.data.text);assert.equal(data.children[1].text,b.data.text);
});

test('heading members preserve fenced Markdown, descendants and folded identity after save',()=>{
 const {map,a,b,add}=fixture();a.data.text='```md\n<!-- mm:node {"id":"literal"} -->\n```';b.data.text='| A | B |\n|---|---|\n| 1 | 2 |';add('Descendant',a);a.isExpand=false;map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();map.setting.headLevel=2;
 const parser=require('../src/markmapLib/markmap-lib/dist/browser/index.js');const View=load('src/MindMapView.ts',{obsidian:{TextFileView:class{}},'./markmapLib/markmap-lib':parser,'./summary/markdown':markdown}).MindMapView;
 const text=markdown.extractSummaries(map.getMarkdown()).main;const data=View.prototype.mdToData.call({},text);assert.equal(data.children.length,3);assert.equal(data.children[0].id,a.getId());assert.equal(data.children[0].expanded,false);assert.equal(data.children[0].text,a.data.text);assert.equal(data.children[0].children[0].text,'Descendant');assert.equal(data.children[1].text,b.data.text);
});

test('multiline main content and literal block IDs in code survive without becoming collapse markers',()=>{
 const {map,a,b}=fixture();a.data.text='First line\nSecond line\n\nParagraph';b.data.text='```md\ntext ^literal\n```';map.setSelectedNodes([a,b]);map.summaries.create();map.finishEditingForHistory();
 const parser=require('../src/markmapLib/markmap-lib/dist/browser/index.js');const View=load('src/MindMapView.ts',{obsidian:{TextFileView:class{}},'./markmapLib/markmap-lib':parser,'./summary/markdown':markdown}).MindMapView;
 for(const level of [1,2]){map.setting.headLevel=level;const data=View.prototype.mdToData.call({},markdown.extractSummaries(map.getMarkdown()).main);assert.equal(data.children[0].text,a.data.text);assert.equal(data.children[1].text,b.data.text);assert.equal(data.children[1].expanded,true);}
});

function layoutFixture(side='right') {
 const f=fixture(),{map,a,b,c}=f;
 map.summaries.svg={clear(){},path(){return {fill(){return this},stroke(){return this},addClass(){},node:{setAttribute(){},addEventListener(){}}}}};
 map.root.setPosition(side==='right'?0:1200,0);
 [a,b,c].forEach(n=>n.direct=side);
 a.setPosition(side==='right'?100:1000,100);b.setPosition(side==='right'?100:1000,500);c.setPosition(side==='right'?2000:-2000,800);
 map.setSelectedNodes([a]);map.summaries.create();map.finishEditingForHistory();return f;
}
test('summary stays near its own visible subtree despite an unrelated long branch on either side',()=>{
 for(const side of ['right','left']){const {map,a,c}=layoutFixture(side);map.summaries.layout();const root=map.summaries.items[0].root;const gap=side==='right'?root.box.x-(a.box.x+a.box.width):a.box.x-(root.box.x+root.box.width);assert.equal(gap,48);const before=root.box.x;c.setPosition(side==='right'?6000:-6000,800);map.summaries.layout();assert.equal(root.box.x,before);}
});
test('summary moves outward for real collisions and rechecks after hitting further obstacles',()=>{
 for(const side of ['right','left']){const {map,b,c}=layoutFixture(side);b.setPosition(side==='right'?250:850,100);c.setPosition(side==='right'?450:650,100);map.summaries.layout();const root=map.summaries.items[0].root;assert.equal(root.box.x,side==='right'?598:502);}
});
