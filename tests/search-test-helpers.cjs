const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={},globals={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:id=>deps[id]||{},console,setTimeout,clearTimeout,...globals});return module.exports;}
const constants=load('src/constants.ts'),styles=load('src/nodeStyles.ts');
const markdown=load('src/summary/markdown.ts',{'../nodeStyles':styles});
const relations=load('src/relations/model.ts');
const navigation=load('src/search/navigation.ts',{'../summary/markdown':markdown,'../relations/model':relations});
const parser=require('../src/markmapLib/markmap-lib/dist/browser/index.js');
const View=load('src/MindMapView.ts',{obsidian:{TextFileView:class{setEphemeralState(){}},Platform:{}},'./markmapLib/markmap-lib':parser,'./constants':constants,'./summary/markdown':markdown,'./relations/model':relations,'./search/navigation':navigation}).MindMapView;
function parsingView(){return {getMdText:View.prototype.getMdText,mdToData:View.prototype.mdToData};}
function fixture(raw){
 const view=Object.assign(parsingView(),{data:raw,file:{path:'map.md'},searchReady:true});
 const body=relations.extractRelations(view.getMdText(raw)).main,document=markdown.extractSummaries(body);
 let n=0;const map={isComposing:false,selected:[],refreshCount:0,historyCount:0,appEl:{addEventListener(){},removeEventListener(){}},containerEL:{scrollLeft:0,scrollTop:0,clientLeft:0,clientTop:0,clientWidth:800,clientHeight:600,getBoundingClientRect:()=>({left:0,top:0})},finishEditingForHistory(){},refresh(){this.refreshCount++},setSelectedNodes(nodes){this.selected=nodes;}};
 const make=(data,parent)=>{const node={data:{...data},parent,children:[],isExpand:data.expanded!==false,getId(){return this.data.id},expand(){this.isExpand=true},containEl:{getBoundingClientRect:()=>({left:100+n*10,top:100,width:100,height:40})}};n++;node.children=(data.children||[]).map(d=>make(d,node));return node;};
 map.root=make(view.mdToData(document.main));map.summaries={items:document.entries.map(item=>{const root=make(item.root);const mark=n=>{n.data.summaryTree=item.id;n.children.forEach(mark);};mark(root);return{...item,root};})};
 map.traverseAll=fn=>{const visit=n=>{fn(n);n.children.forEach(visit)};visit(map.root);map.summaries.items.forEach(item=>visit(item.root));};
 map.getNodeById=id=>{let found;map.traverseAll(n=>{if(n.getId()===id)found=n;});return found;};
 view.mindmap=map;view.searchNavigation=new navigation.SearchNavigation(view);return {view,map};
}
function state(raw,text,occurrence=0){let start=-1;for(let i=0;i<=occurrence;i++)start=raw.indexOf(text,start+1);return {match:{content:raw,matches:[[start,start+text.length]]}};}
module.exports={load,View,markdown,relations,navigation,parsingView,fixture,state,constants,styles};
