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


test('box styles persist through presets, Markdown, clipboard and atomic batch history',()=>{
    const map=mapFixture(),a=node('A',map.root),b=node('B',map.root);
    const box={shape:'pill',borderColor:'#123456',borderWidth:3,backgroundColor:'#eeeeee'};
    map.selectedNodes=[a,b];map.applyLocalNodeStyle(box);
    assert.equal(map.exec.history.undos.length,1);
    assert.equal(a.containEl.classList.contains('mm-box-border'),true);
    assert.equal(a.containEl.style.getPropertyValue('--mm-preset-radius'),'999px');
    const parsed=View.prototype.mdToData.call({},map.getMarkdown());
    assert.deepEqual(JSON.parse(JSON.stringify(parsed.children[0].nodeStyle)),box);
    const copied=clipboard.parseSubtree(clipboard.serializeForest([a]),()=>`box-${++serial}`);
    assert.equal(copied[0].nodeStyle.shape,'pill');assert.equal(copied[0].nodeStyle.borderWidth,3);
    const preset=styles.normalizePresets([{name:'Box',...styles.snapshotNodeStyle(a,map.setting.nodeStylePresets)}])[0];
    assert.equal(preset.shape,'pill');assert.equal(preset.backgroundColor,'#eeeeee');
    map.exec.history.undo();assert.equal(a.data.nodeStyle,undefined);assert.equal(b.containEl.classList.contains('mm-box-border'),false);
    map.exec.history.redo();assert.equal(b.data.nodeStyle.borderWidth,3);
    map.applyLocalNodeStyle({shape:'none',backgroundColor:''});
    assert.equal(a.containEl.classList.contains('mm-box-border'),false);
    assert.equal(a.containEl.style.getPropertyValue('--mm-preset-background'),'transparent');
    map.exec.history.undo();assert.equal(a.data.nodeStyle.shape,'pill');
    const entry={id:'box-summary',memberIds:['a'],root:{id:'box-summary',text:'Summary',nodeStyle:box,expanded:true,children:[]}};
    assert.equal(markdown.extractSummaries(markdown.summaryMarkdown([entry])).entries[0].root.nodeStyle.shape,'pill');
});
test('box validation rejects unsafe CSS and unsupported geometry while old nodes have no box classes',()=>{
    assert.equal(styles.normalizeNodeStyle({shape:'url(x)',borderColor:'red;position:fixed',borderWidth:-1,backgroundColor:'url(x)'}),undefined);
    assert.equal(styles.normalizeNodeStyle({borderWidth:1.5}),undefined);
    const n=node('old');delete n.data.stylePreset;styles.applyNodeStyle(n,[]);
    assert.equal(n.containEl.classList.contains('mm-box-shape'),false);
    assert.equal(n.containEl.classList.contains('mm-box-fill'),false);
    n.data.nodeStyle={shape:'rounded',borderWidth:2};styles.applyNodeStyle(n,[]);
    assert.equal(n.containEl.style.getPropertyValue('--mm-preset-radius'),'8px');
    delete n.data.nodeStyle;styles.applyNodeStyle(n,[]);
    assert.equal(n.containEl.classList.contains('mm-box-border'),false);
});


test('default box style falls back per property, preserves explicit resets, and never serializes inherited values',()=>{
    const map=mapFixture(),a=node('Default node',map.root);delete a.data.stylePreset;
    const defaults={shape:'rounded',borderWidth:2,borderColor:'#123456',backgroundColor:'#eeeeee'};
    map.setting.defaultNodeStyle=defaults;map.refreshNodeStyles();
    assert.equal(a.containEl.classList.contains('mm-box-border'),true);
    assert.equal(a.containEl.style.getPropertyValue('--mm-preset-background'),'#eeeeee');
    assert.equal(a.data.nodeStyle,undefined);assert.equal(a.data.stylePreset,undefined);
    assert.equal(map.getMarkdown().includes('backgroundColor'),false);
    const preset={name:'partial',color:'#222222',shape:undefined,backgroundColor:'#aabbcc'};
    let value=styles.effectiveNodeStyle(a,[preset],defaults);assert.equal(value.shape,'rounded');
    a.data.stylePreset='partial';value=styles.effectiveNodeStyle(a,[preset],defaults);
    assert.equal(value.shape,'rounded');assert.equal(value.backgroundColor,'#aabbcc');
    a.data.nodeStyle={shape:'none',backgroundColor:''};value=styles.effectiveNodeStyle(a,[preset],defaults);
    assert.equal(value.shape,'none');assert.equal(value.backgroundColor,'');
    const snapshot=styles.snapshotNodeStyle(a,[preset],defaults);
    assert.equal(snapshot.borderColor,'#123456');assert.equal(snapshot.backgroundColor,'');
    delete a.data.stylePreset;delete a.data.nodeStyle;map.selectedNodes=[a];
    map.applyLocalNodeStyle({backgroundColor:'#ffffff'});map.exec.history.undo();
    assert.equal(a.data.nodeStyle,undefined);assert.equal(a.containEl.style.getPropertyValue('--mm-preset-background'),'#eeeeee');
    map.setting.defaultNodeStyle={};map.refreshNodeStyles();assert.equal(a.containEl.classList.contains('mm-box-fill'),false);
});

test('newly rendered plain nodes receive defaults without acquiring node metadata',async()=>{
    const ActualNode=load('src/mindmap/INode.ts',{obsidian:{MarkdownRenderer:{renderMarkdown:async(text,el)=>{el.innerHTML=text;}}}}).default;
    const n=node('Fresh');delete n.data.stylePreset;n.contentEl={innerHTML:''};n._delay=()=>{};
    n.mindmap={path:'',setting:{defaultNodeStyle:{backgroundColor:'#aabbcc',shape:'pill'}},emit(){}};
    ActualNode.prototype.parseText.call(n);await Promise.resolve();
    assert.equal(n.containEl.classList.contains('mm-box-border'),true);
    assert.equal(n.containEl.style.getPropertyValue('--mm-preset-background'),'#aabbcc');
    assert.equal(n.data.nodeStyle,undefined);
});

test('default settings load safely and refresh multiple maps without changing history or note content',async()=>{
    const plugin={loadData:async()=>({defaultNodeStyle:{backgroundColor:'#123456',shape:'rounded',borderWidth:999}})};
    await Plugin.prototype.loadSettings.call(plugin);
    assert.equal(plugin.settings.defaultNodeStyle.backgroundColor,'#123456');assert.equal(plugin.settings.defaultNodeStyle.borderWidth,undefined);
    const maps=[mapFixture(),mapFixture()];const before=maps.map(map=>map.getMarkdown());
    plugin.saveData=async()=>{};plugin.app={workspace:{getLeavesOfType:()=>maps.map(map=>({view:{mindmap:map}}))}};
    await Plugin.prototype.saveSettings.call(plugin);
    maps.forEach((map,i)=>{assert.equal(map.root.containEl.style.getPropertyValue('--mm-preset-background'),'#123456');assert.equal(map.getMarkdown(),before[i]);assert.equal(map.exec.history.undos.length,0);});
    const legacy={loadData:async()=>({fontSize:18})};await Plugin.prototype.loadSettings.call(legacy);
    assert.equal(Object.keys(legacy.settings.defaultNodeStyle).length,0);
});


test('default text style persists, inherits through partial presets, and honors explicit text resets',async()=>{
    const defaults={color:'#123456',fontSize:19,bold:true,italic:true,underline:true,strike:true,backgroundColor:'#eeeeee'};
    const plugin={loadData:async()=>({defaultNodeStyle:defaults})};await Plugin.prototype.loadSettings.call(plugin);
    assert.equal(plugin.settings.defaultNodeStyle.fontSize,19);assert.equal(plugin.settings.defaultNodeStyle.bold,true);
    const presets=styles.normalizePresets([{name:'Partial',backgroundColor:'#ffffff'},{name:'Off',bold:false,italic:false,underline:false,strike:false}]);
    const n=node('Inherited');n.data.stylePreset='Partial';
    let value=styles.effectiveNodeStyle(n,presets,plugin.settings.defaultNodeStyle);
    assert.equal(value.bold,true);assert.equal(value.color,'#123456');assert.equal(value.fontSize,19);assert.equal(value.backgroundColor,'#ffffff');
    styles.applyNodeStyle(n,presets,defaults);
    assert.equal(n.containEl.style.getPropertyValue('--mm-preset-font-size'),'19px');assert.equal(n.containEl.style.getPropertyValue('--mm-preset-weight'),'700');
    n.data.stylePreset='Off';value=styles.effectiveNodeStyle(n,presets,defaults);assert.equal(value.bold,false);assert.equal(value.strike,false);
    n.data.nodeStyle={color:'',fontSize:null,bold:false,italic:false,underline:false,strike:false};
    const resetPreset=styles.normalizePresets([{name:'Reset',...styles.snapshotNodeStyle(n,presets,defaults)}])[0];
    assert.equal(resetPreset.color,'');assert.equal(resetPreset.fontSize,null);
    styles.applyNodeStyle(n,presets,defaults);
    assert.equal(n.containEl.classList.contains('mm-preset-color'),false);assert.equal(n.containEl.classList.contains('mm-preset-size'),false);
    assert.equal(n.containEl.style.getPropertyValue('--mm-preset-weight'),'normal');assert.equal(n.containEl.style.getPropertyValue('--mm-preset-decoration'),'none');
    const map=mapFixture();delete map.root.data.stylePreset;map.setting.defaultNodeStyle=defaults;
    const before=map.getMarkdown();map.refreshNodeStyles();assert.equal(map.getMarkdown(),before);
    map.selectedNodes=[map.root];map.applyLocalNodeStyle({bold:false});map.exec.history.undo();
    assert.equal(map.root.containEl.style.getPropertyValue('--mm-preset-weight'),'700');
    const invalid={loadData:async()=>({defaultNodeStyle:{color:'url(x)',fontSize:999,bold:'true'}})};
    await Plugin.prototype.loadSettings.call(invalid);assert.equal(Object.keys(invalid.settings.defaultNodeStyle).length,0);
});
