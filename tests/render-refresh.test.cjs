const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(){
 const timers=new Map();let serial=0,refreshes=0;
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/mindmap/mindmap.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
  module,exports:module.exports,require:()=>({}),console,
  setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)
 });
 const map=Object.create(module.exports.default.prototype);
 Object.assign(map,{_nodeNum:306,_tempNum:0,layout(){refreshes++},clearNode(){},removeEvent(){}});
 const flush=()=>{const batch=[...timers.values()];timers.clear();batch.forEach(fn=>fn());};
 return {map,timers,flush,count:()=>refreshes};
}
test('original and virtual completion bursts share one refresh; delayed renders still update',()=>{
 const {map,timers,flush,count}=fixture();
 for(let i=0;i<368;i++)map.initNode({detail:{}});
 assert.equal(timers.size,1);assert.equal(count(),0);flush();assert.equal(count(),1);
 // A slow Markdown/image-backed render must not depend on the original-node counter.
 map.initNode({detail:{}});map.initNode({detail:{}});flush();assert.equal(count(),2);
});
test('synchronous command refresh consumes queued render work without a duplicate layout',()=>{
 const {map,timers,flush,count}=fixture();map.initNode({detail:{}});
 map.refresh();assert.equal(count(),1);assert.equal(timers.size,0);flush();assert.equal(count(),1);
 map.initNode({detail:{}});flush();assert.equal(count(),2);
});
test('clearing a map cancels pending work and ignores stale asynchronous completions',()=>{
 const {map,timers,flush,count}=fixture();map.initNode({detail:{}});
 map.clear();assert.equal(timers.size,0);map.initNode({detail:{}});map.refresh();flush();
 assert.equal(count(),0);assert.equal(timers.size,0);
});
