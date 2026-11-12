const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}) {const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:id=>deps[id]||{},console:{error(){}},Blob,atob,getComputedStyle:()=>({backgroundColor:'white'})});return module.exports;}
const {imageFilename}=load('src/image-export.ts');
test('image filenames identify pages and remove unsafe filename characters',()=>{
 assert.equal(imageFilename('Raw/Note.md','','png'),'Note.png');
 assert.equal(imageFilename('Raw/Note.MD','Page: A/B','jpeg'),'Note-Page- A-B.jpeg');
});
function fixture() {
 const notices=[],writes=[];let removed=0,rendered=0;
 const snapshot={width:100,height:100,element:{},background:"rgb(255, 255, 255)",ready:async()=>{},remove(){removed++}};
 const View=load('src/MindMapView.ts',{
  obsidian:{TextFileView:class{},Notice:class{constructor(text){notices.push(text)}}},
  './markmapLib/markmap-lib':{Transformer:class{}},
  './html-export':{standaloneHtml:()=>'<!doctype html>example'},
  './lang/helpers':{t:x=>x},'./image-export':{imageFilename,imageSnapshot:()=>snapshot},
  './dom-to-image-more.js':{default:{toPng:async()=>{rendered++;return 'data:image/png;base64,aGVsbG8='},toSvg:async(el,options)=>{options.onclone({});return 'svg'}}}
 }).MindMapView;
 const view=Object.create(View.prototype);
 view.mindmap={root:{},contentEL:{},finishEditingForHistory(){}};
 view.file={path:'Raw/Note.md'};
 view.pageDocument={pages:[{},{}],active:()=>({meta:{name:'Page A'}})};
 view.app={fileManager:{getAvailablePathForAttachment:async name=>'Assets/'+name},vault:{create:async(path,text)=>writes.push({path,text}),createBinary:async(path,bytes)=>writes.push({path,bytes})}};
 return {view,snapshot,notices,writes,get removed(){return removed},get rendered(){return rendered}};
}
test('export uses attachment API, page name and binary bytes then cleans up',async()=>{
 const f=fixture();await f.view.exportToPng(2);
 assert.equal(f.writes[0].path,'Assets/Note-Page A.png');
 assert.equal(Buffer.from(f.writes[0].bytes).toString(),'hello');
 assert.equal(f.removed,1);assert.equal(f.view.exportingImage,false);
});
test('write errors clean the snapshot and permit a later retry',async()=>{
 const f=fixture(),save=f.view.app.vault.createBinary;
 f.view.app.vault.createBinary=async()=>{throw new Error('disk full')};
 await f.view.exportToPng(1);assert.equal(f.removed,1);assert.match(f.notices[0],/disk full/);
 f.view.app.vault.createBinary=save;await f.view.exportToPng(1);
 assert.equal(f.writes.length,1);assert.equal(f.removed,2);
});
test('large images are rejected before rendering and concurrent exports are ignored',async()=>{
 const f=fixture();f.snapshot.width=40000;await f.view.exportToPng(1);
 assert.equal(f.rendered,0);assert.equal(f.removed,1);assert.equal(f.writes.length,0);
 f.snapshot.width=100;
 await Promise.all([f.view.exportToPng(1),f.view.exportToPng(1)]);
 assert.equal(f.writes.length,1);assert.equal(f.removed,2);
});

test('HTML saves native markup via attachment API without raster size limits',async()=>{
 const f=fixture();f.snapshot.width=40000;await f.view.exportToHtml();
 assert.equal(f.writes[0].path,'Assets/Note-Page A.html');
 assert.match(f.writes[0].text,/<!doctype html>/);
 assert.equal(f.rendered,0);assert.equal(f.removed,1);
 assert.equal(f.view.exportingImage,false);
});
test('HTML write failures clean up and permit retry',async()=>{
 const f=fixture(),save=f.view.app.vault.create;
 f.view.app.vault.create=async()=>{throw new Error('disk full')};
 await f.view.exportToHtml();assert.equal(f.removed,1);assert.match(f.notices[0],/HTML export failed.*disk full/);
 f.view.app.vault.create=save;await f.view.exportToHtml();assert.equal(f.writes.length,1);
});

test('image decode failure saves no incomplete image and cleans up for retry',async()=>{
 const f=fixture();f.snapshot.ready=async()=>{throw new Error('image decode failed')};
 await f.view.exportToPng(1);assert.equal(f.removed,1);assert.equal(f.writes.length,0);assert.equal(f.view.exportingImage,false);assert.match(f.notices[0],/image decode failed/);
 f.snapshot.ready=async()=>{};await f.view.exportToPng(1);assert.equal(f.writes.length,1);
});
