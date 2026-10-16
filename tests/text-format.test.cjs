const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const moduleObject={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/mindmap/text-format.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:moduleObject,exports:moduleObject.exports,require:()=>({t:x=>x}),setTimeout});
const {formatSelection}=moduleObject.exports;
test('emphasis keeps edge whitespace outside its markers',()=>{
 const result=formatSelection('前  重点  后',1,7,'bold');assert.equal(result.text,'前  **重点**  后');
 assert.equal(result.text.slice(result.start,result.end),'重点');assert.equal(formatSelection('   ',0,3,'bold'),null);
});
test('selected words become persistent Markdown without changing surrounding node content',()=>{
 for(const [style,mark] of [['bold','**'],['italic','*'],['strike','~~'],['highlight','==']]) {
  const result=formatSelection('Alpha 中文 gamma',6,8,style);assert.equal(result.text,`Alpha ${mark}中文${mark} gamma`);assert.equal(result.text.slice(result.start,result.end),'中文');
  const undone=formatSelection(result.text,result.start,result.end,style);assert.equal(undone.text,'Alpha 中文 gamma');
 }
});
test('color changes replace the existing span, preserve Markdown emphasis, and reset cleanly',()=>{
 const original='Alpha **beta** gamma';const first=formatSelection(original,8,12,'#E53935');assert.equal(first.text,'Alpha **<span style="color:#e53935">beta</span>** gamma');
 const second=formatSelection(first.text,first.start,first.end,'#1e88e5');assert.equal(second.text,'Alpha **<span style="color:#1e88e5">beta</span>** gamma');
 const reset=formatSelection(second.text,second.start,second.end,'default');assert.equal(reset.text,original);
});
test('selection including an entire formatted span can reset without nested or dangling HTML',()=>{
 const original='<span style="color:#e53935">word</span>';assert.equal(formatSelection(original,0,original.length,'default').text,'word');assert.equal(formatSelection('**word**',0,8,'bold').text,'word');
});
test('invalid ranges and untrusted color values cannot rewrite the node',()=>{
 for(const [start,end,style] of [[0,0,'bold'],[-1,1,'bold'],[0,100,'bold'],[0,4,'red;" onclick="bad']]) assert.equal(formatSelection('word',start,end,style),null);
});

test('italic can format part of a word and combines with bold without removing it',()=>{
 const first=formatSelection('前部分后',1,3,'italic');assert.equal(first.text,'前*部分*后');
 const bold=formatSelection('word',0,4,'bold'),both=formatSelection(bold.text,bold.start,bold.end,'italic');assert.equal(both.text,'***word***');
 assert.equal(formatSelection(both.text,both.start,both.end,'italic').text,'**word**');
 assert.equal(formatSelection(both.text,both.start,both.end,'bold').text,'*word*');
});
test('formatted main nodes survive the production Markdown parser with stable member IDs',()=>{
 function load(file,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:id=>id.endsWith("nodeStyles") ? load("src/nodeStyles.ts") : deps[id]||{}});return m.exports;}
 const markdown=load('src/summary/markdown.ts'),parser=require('../src/markmapLib/markmap-lib/dist/browser/index.js');
 const View=load('src/MindMapView.ts',{obsidian:{TextFileView:class{}},'./markmapLib/markmap-lib':parser,'./summary/markdown':markdown}).MindMapView;
 const styled='前**<span style="color:#e53935">重点</span>**后';const data=View.prototype.mdToData.call({},'# Main\n- '+styled+' <!-- mm:node {"id":"member-a"} -->');
 assert.equal(data.children[0].text,styled);assert.equal(data.children[0].id,'member-a');assert.equal(data.children[0].expanded,true);
});

test('text underline and size apply only within the selected range and preserve color',()=>{
 const u=formatSelection('Before word after',7,11,'underline');assert.equal(u.text,'Before <u>word</u> after');
 assert.equal(formatSelection(u.text,u.start,u.end,'underline').text,'Before word after');
 const color=formatSelection('Before word after',7,11,'#43a047');
 const size=formatSelection(color.text,color.start,color.end,'size:20');assert.equal(size.text,'Before <span style="color:#43a047;font-size:20px">word</span> after');
 const reset=formatSelection(size.text,size.start,size.end,'size:default');assert.equal(reset.text,color.text);
 const clearColor=formatSelection(size.text,size.start,size.end,'default');assert.equal(clearColor.text,'Before <span style="font-size:20px">word</span> after');
 for(const style of ['size:0','size:999','size:abc']) assert.equal(formatSelection('word',0,4,style),null);
});

test('saved text formatting rejects stale ranges, detached nodes and IME without mutating a node',()=>{
 const {applyEditorStyle}=moduleObject.exports;
 const node={getId:()=> 'n',data:{isEdit:true},contentEl:{innerText:'changed'}};
 let edits=0;const map={getNodeById:()=>node,finishEditingForHistory(){edits++}};
 const saved={text:'word',start:0,end:4};
 assert.equal(applyEditorStyle(map,node,saved,'bold'),false);
 node.contentEl.innerText='word';map.isComposing=true;assert.equal(applyEditorStyle(map,node,saved,'bold'),false);
 map.isComposing=false;map.getNodeById=()=>null;assert.equal(applyEditorStyle(map,node,saved,'bold'),false);assert.equal(edits,0);
});
