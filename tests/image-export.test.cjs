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
  './save-export':{saveExport:async(app,name,format,data)=>{
    const path='Chosen/'+name;
    if(format==='html') await app.vault.create(path,await data.text());
    else await app.vault.createBinary(path,await data.arrayBuffer());
    return path;
  }},
  './html-export':{standaloneHtml:()=>'<!doctype html>example'},
  './lang/helpers':{t:x=>x},'./image-export':{imageFilename,imageSnapshot:()=>snapshot},
  './dom-to-image-more.js':{default:{toPng:async()=>{rendered++;return 'data:image/png;base64,aGVsbG8='},toSvg:async(el,options)=>{options.onclone({});return 'svg'}}}
 }).MindMapView;
 const view=Object.create(View.prototype);
 view.mindmap={root:{},contentEL:{},finishEditingForHistory(){}};
 view.file={path:'Raw/Note.md'};
 view.pageDocument={pages:[{},{}],active:()=>({meta:{name:'Page A'}})};
 view.app={vault:{create:async(path,text)=>writes.push({path,text}),createBinary:async(path,bytes)=>writes.push({path,bytes})}};
 return {view,snapshot,notices,writes,get removed(){return removed},get rendered(){return rendered}};
}
test('export passes the suggested filename to the saver, page name and binary bytes then cleans up',async()=>{
 const f=fixture();await f.view.exportToPng(2);
 assert.equal(f.writes[0].path,'Chosen/Note-Page A.png');
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

test('HTML saves native markup through the saver without raster size limits',async()=>{
 const f=fixture();f.snapshot.width=40000;await f.view.exportToHtml();
 assert.equal(f.writes[0].path,'Chosen/Note-Page A.html');
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


test('HTML captures the initiating page and blocks concurrent image exports while preparing resources',async()=>{
 const f=fixture();let release;
 f.snapshot.ready=()=>new Promise(resolve=>{release=resolve});
 const pending=f.view.exportToHtml();
 f.view.file={path:'Other.md'};f.view.pageDocument.active=()=>({meta:{name:'Other page'}});
 await f.view.exportToPng(1);assert.equal(f.writes.length,0);assert.equal(f.rendered,0);
 release();await pending;
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].path,'Chosen/Note-Page A.html');assert.equal(f.removed,1);
});
test('HTML decode failure does not save an incomplete document and permits retry',async()=>{
 const f=fixture();f.snapshot.ready=async()=>{throw new Error('unreadable attachment')};
 await f.view.exportToHtml();assert.equal(f.writes.length,0);assert.equal(f.removed,1);
 assert.match(f.notices[0],/HTML export failed.*unreadable attachment/);assert.equal(f.view.exportingImage,false);
 f.snapshot.ready=async()=>{};await f.view.exportToHtml();assert.equal(f.writes.length,1);
});

test('desktop save dialog writes only to the chosen location and skips canceled exports', async () => {
  const dialogs=[], writes=[];
  let result={canceled:true};
  const activeWindow={};
  const {saveExport}=load('src/save-export.ts',{
    obsidian:{Platform:{isDesktopApp:true}},
    './lang/helpers':{t:x=>x},
    electron:{remote:{getCurrentWindow:()=>activeWindow,dialog:{showSaveDialog:async(parent,options)=>{
      dialogs.push({parent,options});return result;
    }}}},
    fs:{promises:{writeFile:async(path,bytes)=>writes.push({path,bytes:Buffer.from(bytes)})}}
  });
  const data=new Blob(['中文']);
  assert.equal(await saveExport({},'Note.html','html',data),null);
  assert.equal(writes.length,0);
  assert.equal(dialogs[0].parent,activeWindow);
  assert.equal(dialogs[0].options.defaultPath,'Note.html');
  assert.equal(dialogs[0].options.filters[0].extensions.join(','),'html,htm');
  result={canceled:false,filePath:'C:/Chosen/New name.jpg'};
  assert.equal(await saveExport({},'Note.jpeg','jpeg',data),result.filePath);
  assert.equal(dialogs[1].options.filters[0].extensions.join(','),'jpeg,jpg');
  assert.equal(writes[0].path,result.filePath);
  assert.equal(writes[0].bytes.toString(),'中文');
});
