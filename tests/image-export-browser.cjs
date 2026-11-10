const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require(process.argv[2] || 'playwright');
const source = ts.createSourceFile('main.js', fs.readFileSync('main.js', 'utf8'), ts.ScriptTarget.Latest, true);
const declarations = new Map();
function visit(node) {
  if ((ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name) declarations.set(node.name.text, node.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { channel: process.argv[3] } : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>body{font:16px sans-serif}.mm-node{position:absolute;width:100px;height:50px;background:red}.mm-node-select{outline:10px solid blue}</style>
      <div id="viewport" style="width:300px;height:200px;overflow:auto"><div style="transform:scale(.5);width:2000px;height:2000px">
      <div id="content" style="position:relative;width:2000px;height:2000px;background:white">
      <svg width="2000" height="2000" style="position:absolute"><path d="M 900 1050 L 1250 1050" stroke="green" stroke-width="8"/></svg>
      <div class="mm-node mm-node-select" style="left:1000px;top:1000px">中文节点</div>
      <div class="mm-node-menu">MENU</div></div></div></div>`);
    await page.addScriptTag({ content: fs.readFileSync('src/dom-to-image-more.js', 'utf8') });
    await page.addScriptTag({ content: `const domToImageMore=window.domtoimage; const t=x=>x;
      const obsidian={TextFileView:class{},Notice:class{constructor(text){window.notice=text}}};
      ${['__awaiter','imageSnapshot','imageFilename','MindMapView'].map(name=>declarations.get(name)).join('\n')}
      window.exportView=Object.create(MindMapView.prototype);
      const content=document.querySelector('#content'), viewport=document.querySelector('#viewport');
      exportView.mindmap={root:{},contentEL:content,containerEL:viewport,finishEditingForHistory(){},traverseAll(fn){fn({isShow:()=>true,getBox:()=>({x:1000,y:1000,width:100,height:50})})}};
      exportView.file={path:'Raw/Note.md'};
      exportView.pageDocument={pages:[{},{}],active:()=>({meta:{name:'Page: A'}})};
      window.saved=[];
      exportView.app={fileManager:{getAvailablePathForAttachment:async name=>'Assets/'+saved.length+'-'+name},vault:{createBinary:async(path,bytes)=>{saved.push({path,bytes:Array.from(new Uint8Array(bytes))})}}};
      window.original=content.outerHTML;
    ` });
    const result = await page.evaluate(async () => {
      await exportView.exportToPng(2);
      const savedPng=saved[0];
      if(!savedPng) throw new Error(window.notice);
      const bitmap=await createImageBitmap(new Blob([new Uint8Array(savedPng.bytes)],{type:'image/png'}));
      const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
      const red=Array.from(ctx.getImageData(340,140,1,1).data);
      const green=Array.from(ctx.getImageData(140,220,1,1).data);
      await exportView.exportToJpeg(1);
      const unchanged=original===document.querySelector('#content').outerHTML;
      const originalCreate=exportView.app.vault.createBinary;
      exportView.app.vault.createBinary=async()=>{throw new Error('disk full')};
      await exportView.exportToPng(1);
      const failedClean=!exportView.exportingImage && document.querySelector('#viewport').children.length===1 && notice.includes('disk full');
      exportView.app.vault.createBinary=originalCreate;
      await exportView.exportToPng(1);
      return {width:bitmap.width,height:bitmap.height,red,green,unchanged,failedClean,files:saved.map(f=>({path:f.path,magic:f.bytes.slice(0,3)})),bytes:savedPng.bytes};
    });
    assert.equal(result.width,940);assert.equal(result.height,340);
    assert.deepEqual(result.red,[255,0,0,255]);
    assert.ok(result.green[1]>80 && result.green[0]<20);
    assert.equal(result.unchanged,true);assert.equal(result.failedClean,true);
    assert.equal(result.files.length,3);
    assert.ok(result.files[0].path.endsWith('Note-Page- A.png'));
    assert.deepEqual(result.files[1].magic,[255,216,255]);
    fs.mkdirSync('node_modules/.cache/mindmap-tests',{recursive:true});
    fs.writeFileSync('node_modules/.cache/mindmap-tests/image-export.png',Buffer.from(result.bytes));
    console.log('Image export bundle browser checks passed: PNG pixels, JPEG signature, SVG bounds, zoom, page naming, failure cleanup and retry.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
