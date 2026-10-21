const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,View,markdown,relations,navigation,parsingView,fixture,state,constants}=require('./search-test-helpers.cjs');
const raw='---\r\nmindmap-plugin: basic\r\ntitle: duplicate\r\n---\r\n\r\n# Root\r\n\r\n- duplicate ^parent\r\n  - duplicate\r\n    continuation needle\r\n  - ```ts\r\n    // code needle\r\n    ```\r\n- Other\r\n';
test('search offsets map repeated text, continuation and code lines to exact nodes with frontmatter and CRLF',()=>{
 const {view,map}=fixture(raw);
 const parent=navigation.resolveSearchNode(view,navigation.searchRequest(state(raw,'duplicate',1)));
 const child=navigation.resolveSearchNode(view,navigation.searchRequest(state(raw,'duplicate',2)));
 assert.equal(parent,map.root.children[0]);assert.equal(child,parent.children[0]);
 assert.equal(navigation.resolveSearchNode(view,navigation.searchRequest(state(raw,'continuation needle'))),child);
 assert.equal(navigation.resolveSearchNode(view,navigation.searchRequest(state(raw,'code needle'))),parent.children[1]);
 assert.equal(navigation.resolveSearchNode(view,navigation.searchRequest(state(raw,'title: duplicate'))),null);
 assert.equal(navigation.searchRequest({scroll:100}),null);assert.equal(navigation.searchRequest({line:-1}),null);
 assert.equal(navigation.searchRequest({startLoc:{line:0,col:0}}).line,0);
 const data=view.mdToData(view.getMdText(raw));assert.equal(data.sourceStartLine,undefined);
});
test('independent summary root, child, continuation and code searches resolve by ID without joining the main tree',()=>{
 const summary={id:'s',memberIds:['member'],root:{id:'s',text:'Conclusion',expanded:true,children:[{id:'sc',text:'Detail\ncontinued needle',expanded:true,children:[]},{id:'code',text:'```js\n- literal needle\n```',expanded:true,children:[]}]}};
 const note='# Root\n- Member <!-- mm:node {"id":"member"} -->\n\n'+relations.relationsMarkdown([{id:'r',from:'member',to:'s'}])+'\n\n'+markdown.summaryMarkdown([summary]);
 const {view,map}=fixture(note);
 for(const [text,id] of [['Conclusion','s'],['continued needle','sc'],['literal needle','code']])assert.equal(navigation.resolveSearchNode(view,navigation.searchRequest(state(note,text))).getId(),id);
 assert.equal(navigation.resolveSearchNode(view,navigation.searchRequest(state(note,'mm:relations'))),null);
 const manual=note.replace(' <!-- mm:item {"id":"sc","expanded":true} -->','');const manualView=fixture(manual);assert.equal(navigation.resolveSearchNode(manualView.view,navigation.searchRequest(state(manual,'continued needle'))),manualView.map.summaries.items[0].root.children[0]);
});
test('queued search waits for render, selects the latest match, expands ancestors and leaves text/history unchanged',()=>{
 const {view,map}=fixture(raw);view.searchReady=false;const before=view.data;
 view.searchNavigation.receive(state(raw,'Other'));view.searchNavigation.receive(state(raw,'continuation needle'));assert.equal(map.selected.length,0);
 view.searchReady=true;view.searchNavigation.flush();assert.equal(map.selected[0],map.root.children[0].children[0]);assert.equal(map.root.children[0].isExpand,true);assert.equal(view.data,before);assert.equal(map.historyCount,0);
 view.searchNavigation.clear();
});
test('stale results do not choose an arbitrary duplicate, but stable IDs survive node moves and text changes',()=>{
 const original='# Root\n- duplicate\n- duplicate\n',current='# Root\n- inserted\n- duplicate\n- duplicate\n';const {view}=fixture(current);
 assert.equal(navigation.resolveSearchNode(view,navigation.searchRequest(state(original,'duplicate',1))),null);
 const stable='# Root\n- Old <!-- mm:node {"id":"stable"} -->';const changed='# Root\n- Inserted\n- New <!-- mm:node {"id":"stable"} -->';const fresh=fixture(changed);
 assert.equal(navigation.resolveSearchNode(fresh.view,navigation.searchRequest(state(stable,'Old'))).getId(),'stable');
});
test('search for a hidden summary child expands its own tree and the original members ancestors',()=>{
 const note='# Root\n- Group ^group\n  - Member <!-- mm:node {"id":"member"} -->\n\n'+markdown.summaryMarkdown([{id:'s',memberIds:['member'],root:{id:'s',text:'Conclusion',expanded:false,children:[{id:'sc',text:'needle',expanded:true,children:[]}]}}]);
 const {view,map}=fixture(note);view.searchNavigation.receive(state(note,'needle'));assert.equal(map.selected[0].getId(),'sc');assert.equal(map.root.children[0].isExpand,true);assert.equal(map.summaries.items[0].root.isExpand,true);view.searchNavigation.clear();
});
test('new files and disposal cancel pending navigation; current viewport geometry honors zoom without changing it',()=>{
 const {view,map}=fixture(raw);view.searchReady=false;view.searchNavigation.receive(state(raw,'Other'));view.file={path:'different.md'};view.searchNavigation.beginRender();view.searchReady=true;view.searchNavigation.flush();assert.equal(map.selected.length,0);
 const viewport={scrollLeft:40,scrollTop:20,clientLeft:1,clientTop:2,clientWidth:800,clientHeight:600,getBoundingClientRect:()=>({left:30,top:50})};
 navigation.centerSearchNode({containerEL:viewport},{containEl:{getBoundingClientRect:()=>({left:900,top:700,width:200,height:80})}});
 assert.equal(viewport.scrollLeft,609);assert.equal(viewport.scrollTop,408);view.searchNavigation.clear();
});
test('virtual branch metadata is excluded from searches and projected copies do not make a unique source ambiguous',()=>{
 const original='# Root\n- Needle\n- Other\n',current='# Root\n- Inserted\n- Needle\n- Other\n\n<!-- mm:grafts {"version":1,"links":[{"id":"g","source":"a","target":"b"}]} -->';
 const {view,map}=fixture(current),source=map.root.children[1],walk=map.traverseAll;
 map.traverseAll=callback=>{walk(callback);callback({data:{text:'Needle'},virtualSource:source,getId:()=> 'virtual:g:a'});};
 assert.equal(navigation.resolveSearchNode(view,navigation.searchRequest(state(original,'Needle'))),source);
 assert.equal(navigation.resolveSearchNode(view,navigation.searchRequest(state(current,'mm:grafts'))),null);
});
test('view receives ephemeral state and the existing leaf routing preserves the search payload, even from markdown mode',()=>{
 const f=fixture(raw);View.prototype.setEphemeralState.call(f.view,state(raw,'Other'));assert.equal(f.map.selected[0],f.map.root.children[1]);f.view.searchNavigation.clear();
 let wrappers;const Leaf=class{};const Plugin=load('src/main.ts',{obsidian:{Plugin:class{},WorkspaceLeaf:Leaf},'./constants':constants,'./search/navigation':navigation,'./MindMapView':{mindmapViewType:'mindmapView'},'monkey-around':{around:(p,w)=>{wrappers=w;return()=>{};}}}).default;
 const plugin={_loaded:true,mindmapFileModes:{leaf:'markdown'},app:{metadataCache:{getCache:path=>path==='map.md'?{frontmatter:{'mindmap-plugin':'basic'}}:{}}},register(){}};
 Plugin.prototype.registerMonkeyAround.call(plugin);let received;const wrapped=wrappers.setViewState(function(...args){received=args;});const leaf={id:'leaf'};
 const ephemeral=state(raw,'Other');wrapped.call(leaf,{type:'markdown',state:{file:'map.md'}},ephemeral);assert.equal(received[0].type,'mindmapView');assert.equal(received[1],ephemeral);
 wrapped.call(leaf,{type:'markdown',state:{file:'map.md'}},{focus:true});assert.equal(received[0].type,'markdown');
 wrapped.call(leaf,{type:'markdown',state:{file:'plain.md'}},ephemeral);assert.equal(received[0].type,'markdown');
});

test('rapid file renders discard obsolete initialization and closing a view cancels queued work',async()=>{
 const maps=[],flushed=[];
 class FakeMap{constructor(data){this.data=data;this.summaries={load(){}};this.relations={load(){}};this.grafts={load(){}};maps.push(this);}init(){this.inits=(this.inits||0)+1;this.root={};}refresh(){}clear(){this.cleared=true;}}
 class Control{update(){}destroy(){}}
 const el=()=>({innerHTML:'',classList:{add(){}},appendChild(){}});
 const parser=require('../src/markmapLib/markmap-lib/dist/browser/index.js');
 const ScopedView=load('src/MindMapView.ts',{obsidian:{TextFileView:class{},Platform:{}},'./markmapLib/markmap-lib':parser,'./constants':constants,'./summary/markdown':markdown,'./relations/model':relations,'./mindmap/mindmap':{default:FakeMap},'./MindMapToolbar':{default:Control},'./MindMapPanel':{default:Control}},{document:{createElement:el}}).MindMapView;
 const view=Object.create(ScopedView.prototype);Object.assign(view,{firstInit:true,renderGeneration:0,colors:[],plugin:{settings:{}},contentEl:el(),file:{path:'first.md'},app:{metadataCache:{getFileCache:()=>({})}},searchNavigation:{beginRender(){},flush(){flushed.push(view.data)},clear(){}}});view.leaf={view};
 view.setViewData('# First');view.file={path:'second.md'};view.setViewData('# Second');
 await new Promise(resolve=>setTimeout(resolve,140));assert.equal(maps[0].inits,undefined);assert.equal(maps[1].inits,1);assert.deepEqual(flushed,['# Second']);
 view.firstInit=true;view.setViewData('# Closed');await view.onClose();await new Promise(resolve=>setTimeout(resolve,140));assert.equal(maps[2].inits,undefined);
});
