const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, deps = {}) {
    const module = {exports: {}};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
        {module,exports:module.exports,require:id=>id.endsWith('nodeStyles') ? styles : deps[id] || {},console,setTimeout,clearTimeout});
    return module.exports;
}
const styles = load('src/nodeStyles.ts');
const markdown = load('src/summary/markdown.ts');
const selection = load('src/mindmap/selection.ts');
const clipboard = load('src/mindmap/clipboard.ts', {'./selection':selection});
const commands = load('src/mindmap/Cmds.ts', {'./selection':selection});
const Layout = load('src/mindmap/Layout.ts').default;
const styleCommands = load('src/mindmap/StyleNodes.ts', {'./Cmds':commands});
const StyleNodes = styleCommands.default;
const History = load('src/mindmap/History.ts').default;
const MindMap = load('src/mindmap/mindmap.ts', {'./StyleNodes':styleCommands}).default;
const parser = require('../src/markmapLib/markmap-lib/dist/browser/index.js');
const View = load('src/MindMapView.ts', {obsidian:{TextFileView:class{}},'./markmapLib/markmap-lib':parser,'./summary/markdown':markdown}).MindMapView;
const Plugin = load('src/main.ts', {obsidian:{Plugin:class{}},'./MindMapView':{mindmapViewType:'mindmapView'}}).default;
let serial=0;
function node(text, parent, preset='重点') {
    const values=new Map(), classes=new Set();
    const n={data:{id:'n-'+ ++serial,text,stylePreset:preset},parent,children:[],isExpand:true,
        getId(){return this.data.id},getData(){return {...this.data}},refreshBox(){},clearCacheData(){},
        containEl:{style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k),getPropertyValue:k=>values.get(k)},
            classList:{add:(...names)=>names.forEach(k=>classes.add(k)),remove:(...names)=>names.forEach(k=>classes.delete(k)),toggle:(k,v)=>v?classes.add(k):classes.delete(k),contains:k=>classes.has(k)}},
        getLevel(){return this.parent?this.parent.getLevel()+1:0}};
    if(parent) parent.children.push(n); else n.data.isRoot=true;
    return n;
}
function mapFixture(level=1) {
    const map=Object.create(MindMap.prototype);
    map.setting={headLevel:level,nodeStylePresets:[{name:'重点',color:'#e53935',italic:true}]};
    map.root=node('Main');map.refresh=()=>{};map.emit=()=>{};map.finishEditingForHistory=()=>{};
    map.exec={history:new History()};map.selectedNodes=[];return map;
}
test('preset validation rejects unsafe values and rename preserves old references without collisions',()=>{
    const presets=styles.normalizePresets([{name:'重点',color:'#e53935',fontSize:20,italic:true},{name:'重点'},{name:'<bad>'},{name:'Other',color:'url(x)',fontSize:999}]);
    assert.equal(presets.length,2);assert.equal(presets[1].color,undefined);assert.equal(presets[1].fontSize,undefined);
    assert.equal(styles.renamePreset(presets,presets[0],'结论'),true);
    assert.equal(styles.findPreset(presets,'重点'),presets[0]);
    assert.equal(styles.renamePreset(presets,presets[1],'重点'),false);
    assert.equal(styles.renamePreset(presets,presets[0],'Other'),false);
    assert.equal(styles.renamePreset(presets,presets[0],'重点'),true);
    assert.equal(styles.findPreset(presets,'结论'),presets[0]);
});
for(const level of [0,1,2,3]) test('style names round-trip headings, empty nodes, folded nodes and rich content at depth '+level,()=>{
    const map=mapFixture(level);const heading=node('Topic',map.root);const empty=node('',heading);
    const code=node('```js\nconst a = 1;\n```',empty);const table=node('| A | B |\n|---|---|\n| 1 | 2 |',heading);
    heading.data.summaryMember=true;heading.isExpand=false;
    const text=map.getMarkdown();assert.ok(text.includes('<!-- mm:style {"name":"重点"} -->'));
    const data=View.prototype.mdToData.call({},text);
    assert.equal(data.stylePreset,'重点');assert.equal(data.text,'Main');
    assert.equal(data.children[0].stylePreset,'重点');assert.equal(data.children[0].id,heading.getId());assert.equal(data.children[0].expanded,false);
    assert.equal(data.children[0].children[0].text,'');assert.equal(data.children[0].children[0].stylePreset,'重点');
    assert.equal(data.children[0].children[0].children[0].text,code.data.text);
    assert.equal(data.children[0].children[1].text,table.data.text);
});
test('literal fenced markers and unknown metadata are preserved',()=>{
    const literal='<!-- mm:style {"name":"重点"} -->';
    const source='# Main\n- Code\n  ```md\n  - Example '+literal+'\n  ```\n- Invalid <!-- mm:style {"name":"重点","future":1} -->';
    const prepared=markdown.prepareMainMarkdown(source);
    assert.equal(prepared.styles.size,0);assert.equal(prepared.text,source);
    assert.equal(styles.readStyleMarker('text <!-- mm:style {bad} -->').text,'text <!-- mm:style {bad} -->');
});
test('batch preset assignment including selected descendants has one undo and clear restores names',()=>{
    const map=mapFixture(),a=node('A',map.root),b=node('B',a);
    delete a.data.stylePreset;delete b.data.stylePreset;map.selectedNodes=[a,b];
    map.applyStylePreset('重点');assert.equal(map.exec.history.undos.length,1);
    assert.equal(a.data.stylePreset,'重点');assert.equal(b.data.stylePreset,'重点');assert.equal(map.root.data.text,'Main');
    map.applyStylePreset('重点');assert.equal(map.exec.history.undos.length,1);
    map.exec.history.undo();assert.equal(a.data.stylePreset,undefined);assert.equal(b.data.stylePreset,undefined);
    map.exec.history.redo();assert.equal(b.data.stylePreset,'重点');
    map.applyStylePreset();assert.equal(a.data.stylePreset,undefined);map.exec.history.undo();assert.equal(a.data.stylePreset,'重点');
    map.applyStylePreset('Missing');assert.equal(a.data.stylePreset,'重点');
});
test('updating presets refreshes all open maps without rewriting notes; missing definitions preserve references',async()=>{
    const a=mapFixture(),b=mapFixture();let saved=0;
    const plugin={settings:{nodeStylePresets:[{name:'重点',color:'#123456',bold:true}]},saveData:async()=>saved++,app:{workspace:{getLeavesOfType:()=>[{view:{mindmap:a}},{view:{mindmap:b}}]}}};
    await Plugin.prototype.saveSettings.call(plugin);assert.equal(saved,1);
    for(const map of [a,b]) assert.equal(map.root.containEl.style.getPropertyValue('--mm-preset-color'),'#123456');
    plugin.settings.nodeStylePresets=[];await Plugin.prototype.saveSettings.call(plugin);
    assert.equal(a.root.data.stylePreset,'重点');assert.equal(a.root.containEl.classList.contains('mm-preset-node'),false);
    assert.ok(a.getMarkdown().includes('mm:style'));
});
test('independent summary styles survive Markdown and clipboard remapping',()=>{
    const entries=[{id:'summary',memberIds:['a'],root:{id:'summary',text:'Conclusion',stylePreset:'重点',expanded:true,children:[{id:'detail',text:'Details',stylePreset:'辅助',expanded:false,children:[]}]}}];
    const text=markdown.summaryMarkdown(entries),result=markdown.extractSummaries(text);
    assert.equal(result.error,'');assert.equal(result.entries[0].root.stylePreset,'重点');assert.equal(result.entries[0].root.children[0].stylePreset,'辅助');
    const a=node('A');a.data.id='a';
    const copied=clipboard.parseSubtree(clipboard.serializeForest([a],entries),()=>`fresh-${++serial}`);
    assert.equal(copied[0].stylePreset,'重点');assert.equal(copied.summaries[0].root.stylePreset,'重点');assert.equal(copied.summaries[0].root.children[0].stylePreset,'辅助');
});

test('style redo resolves recreated pasted nodes by ID instead of editing detached objects',()=>{
    const map=mapFixture(),a=node('A',map.root);delete a.data.stylePreset;map.selectedNodes=[a];
    map.applyStylePreset('重点');map.exec.history.undo();
    const replacement=node('A');replacement.data.id=a.getId();replacement.parent=map.root;delete replacement.data.stylePreset;
    map.root.children=[replacement];map.exec.history.redo();
    assert.equal(replacement.data.stylePreset,'重点');assert.equal(a.data.stylePreset,undefined);
});

test('real layout preserves branch presets, selection and editor state while updating direction classes',()=>{
    const map=mapFixture(),branch=node('Ordinary styled branch',map.root,'重点'),child=node('Child',branch,'重点');
    for(const n of [branch,child]) { n.isLeaf=()=>!n.children.length; styles.applyNodeStyle(n,map.setting.nodeStylePresets); }
    branch.containEl.classList.add('mm-node-select','mm-edit-node','mm-node-left','mm-summary-node');
    const layout=Object.create(Layout.prototype);
    for(let index=0;index<3;index++) layout._setDirect(branch,'right');
    for(const name of ['mm-preset-node','mm-preset-color','mm-node-select','mm-edit-node','mm-summary-node','mm-node-right','mm-node-second']) assert.ok(branch.containEl.classList.contains(name),name);
    assert.equal(branch.containEl.classList.contains('mm-node-left'),false);
    assert.ok(child.containEl.classList.contains('mm-preset-color'));
    assert.equal(branch.containEl.style.getPropertyValue('--mm-preset-color'),'#e53935');
    assert.equal(branch.data.stylePreset,'重点');
    layout._setDirect(branch,'left');assert.ok(branch.containEl.classList.contains('mm-node-left'));
    assert.equal(branch.containEl.classList.contains('mm-node-right'),false);
});

test('local node styles override a shared preset without changing it and undo independently',()=>{
    const map=mapFixture(),a=node('A',map.root),b=node('B',map.root);map.selectedNodes=[a,b];
    map.applyLocalNodeStyle({color:'#43a047',bold:true,italic:false,fontSize:15});
    assert.equal(map.exec.history.undos.length,1);
    assert.equal(map.setting.nodeStylePresets[0].color,'#e53935');
    assert.equal(styles.effectiveNodeStyle(a,map.setting.nodeStylePresets).color,'#43a047');
    assert.equal(styles.effectiveNodeStyle(a,map.setting.nodeStylePresets).italic,false);
    const md=map.getMarkdown(),parsed=View.prototype.mdToData.call({},md);
    assert.equal(parsed.children[0].nodeStyle.color,'#43a047');assert.equal(parsed.children[0].stylePreset,'重点');
    assert.equal(parsed.children[1].nodeStyle.fontSize,15);
    map.exec.history.undo();assert.equal(a.data.nodeStyle,undefined);
    map.exec.history.redo();assert.equal(b.data.nodeStyle.bold,true);
    map.applyLocalNodeStyle();assert.equal(a.data.nodeStyle,undefined);
    map.exec.history.undo();assert.equal(a.data.nodeStyle.fontSize,15);
    map.applyStylePreset('重点');assert.equal(a.data.nodeStyle,undefined);
    map.exec.history.undo();assert.equal(a.data.nodeStyle.color,'#43a047');
});
test('standalone local styles and summary local styles persist without any preset name',()=>{
    const map=mapFixture(),a=node('A',map.root);delete a.data.stylePreset;
    a.data.nodeStyle={color:'',fontSize:null,bold:false,underline:true};
    const md=map.getMarkdown(),parsed=View.prototype.mdToData.call({},md);
    assert.equal(parsed.children[0].stylePreset,undefined);assert.equal(parsed.children[0].nodeStyle.underline,true);
    const entries=[{id:'s',memberIds:['a'],root:{id:'s',text:'Summary',nodeStyle:{color:'#123456'},expanded:true,children:[]}}];
    const result=markdown.extractSummaries(markdown.summaryMarkdown(entries));assert.equal(result.entries[0].root.nodeStyle.color,'#123456');
    const copied=clipboard.parseSubtree(clipboard.serializeForest([a]),()=>`new-${++serial}`);assert.equal(copied[0].nodeStyle.underline,true);
});
test('invalid local style attributes cannot inject CSS through metadata',()=>{
    assert.equal(styles.normalizeNodeStyle({color:'red;position:fixed',fontSize:999,bold:'yes'}),undefined);
    const original='text <!-- mm:style {"overrides":{"color":"#123456","future":true}} -->';
    assert.equal(styles.readStyleMarker(original).text,original);
    const text=styles.styleMarker(undefined,{bold:false,color:'#123456'});assert.equal(styles.readStyleMarker(text).overrides.bold,false);
});

test('saving a node style snapshots effective values but excludes names, aliases and inline text formatting',()=>{
    const map=mapFixture(),a=node('**Inline bold text**',map.root);
    map.setting.nodeStylePresets[0].aliases=['Old name'];
    a.data.nodeStyle={color:'#43a047',fontSize:22,italic:false,underline:true};
    const snapshot=styles.snapshotNodeStyle(a,map.setting.nodeStylePresets);
    assert.equal(snapshot.color,'#43a047');assert.equal(snapshot.fontSize,22);assert.equal(snapshot.italic,false);assert.equal(snapshot.underline,true);
    assert.equal(snapshot.bold,false);assert.equal(snapshot.name,undefined);assert.equal(snapshot.aliases,undefined);
    snapshot.color='#123456';assert.equal(a.data.nodeStyle.color,'#43a047');assert.equal(map.setting.nodeStylePresets[0].color,'#e53935');
});
