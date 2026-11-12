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
      ${['__awaiter','exportHtmlEscape','standaloneHtml','exportBackground','imageSnapshot','imageFilename','MindMapView'].map(name=>declarations.get(name)).join('\n')}
      window.exportView=Object.create(MindMapView.prototype);
      const content=document.querySelector('#content'), viewport=document.querySelector('#viewport');
      exportView.mindmap={root:{},contentEL:content,containerEL:viewport,finishEditingForHistory(){},traverseAll(fn){fn({isShow:()=>true,getBox:()=>({x:1000,y:1000,width:100,height:50})})}};
      exportView.file={path:'Raw/Note.md'};
      exportView.pageDocument={pages:[{},{}],active:()=>({meta:{name:'Page: A'}})};
      window.saved=[];
      async function saveExport(app,name,format,data){const path='Chosen/'+saved.length+'-'+name;if(format==='html')await app.vault.create(path,await data.text());else await app.vault.createBinary(path,await data.arrayBuffer());return path;}
      exportView.app={vault:{createBinary:async(path,bytes)=>{saved.push({path,bytes:Array.from(new Uint8Array(bytes))})}}};
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
    const transparent = await page.evaluate(async () => {
      document.querySelector('#content').style.background='transparent';
      document.querySelector('#viewport').style.background='white';
      await exportView.exportToJpeg(1);
      const file=saved[saved.length-1];
      const bitmap=await createImageBitmap(new Blob([new Uint8Array(file.bytes)],{type:'image/jpeg'}));
      const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
      const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);
      return Array.from(context.getImageData(10,10,1,1).data);
    });
    assert.deepEqual(transparent,[255,255,255,255],'Transparent content must capture the visible white viewport background in JPEG');
    const diagram = await page.evaluate(() => {
      const canvas=document.createElement('canvas');canvas.width=80;canvas.height=40;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#22bb66';ctx.fillRect(0,0,80,40);ctx.strokeStyle='black';ctx.strokeRect(1,1,78,38);
      return canvas.toDataURL().split(',')[1];
    });
    let denyEmbedding=false;
    await page.route('https://vault.test/diagram.png',route=>denyEmbedding && route.request().resourceType()==='xhr' ? route.fulfill({status:404,headers:{'Access-Control-Allow-Origin':'*'},body:''}) : route.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:Buffer.from(diagram,'base64')}));
    await page.evaluate(async()=>{
      const img=new Image();img.src='https://vault.test/diagram.png';img.style.position='absolute';img.style.left='1140px';img.style.top='1000px';
      document.querySelector('#content').append(img);await img.decode();img.loading='lazy';
      const hidden=document.createElement('div');hidden.style.display='none';
      hidden.innerHTML='<img loading="lazy" src="https://vault.test/missing-hidden.png">';document.querySelector('#content').append(hidden);
      document.querySelector('#content svg path').setAttribute('stroke','black');
    });
    for (const mode of ['white','dark','custom','alpha']) {
      for(const format of ['png','jpeg']) {
        const data=await page.evaluate(async ({mode,format})=>{
          const content=document.querySelector('#content'),viewport=document.querySelector('#viewport');
          viewport.style.background=mode==='dark'?'rgb(32, 36, 44)':'white';
          content.style.background=mode==='custom'?'rgb(240, 220, 180)':mode==='alpha'?'rgba(0, 0, 255, .25)':'transparent';
          const before=content.outerHTML;
          await exportView.exportImage(format,1);
          if(window.notice.includes('failed'))throw new Error(window.notice);
          const savedFile=saved[saved.length-1];
          const bitmap=await createImageBitmap(new Blob([new Uint8Array(savedFile.bytes)],{type:'image/'+format}));
          const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
          const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
          const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
          return {background:pixel(10,10),line:pixel(70,110),diagram:pixel(310,70),unchanged:content.outerHTML===before,bytes:savedFile.bytes};
        },{mode,format});
        const expected={white:[255,255,255],dark:[32,36,44],custom:[240,220,180],alpha:[191,191,255]}[mode];
        expected.forEach((value,index)=>assert.ok(Math.abs(data.background[index]-value)<=3,`${mode} ${format} background ${data.background}`));
        assert.equal(data.background[3],255);
        assert.ok(data.line.slice(0,3).every(value=>value<20),`${mode} ${format}: black SVG line`);
        [34,187,102].forEach((value,index)=>assert.ok(Math.abs(data.diagram[index]-value)<=6,`${mode} ${format} embedded image ${data.diagram}`));
        assert.equal(data.unchanged,true);
        if(mode==='white')fs.writeFileSync(`node_modules/.cache/mindmap-tests/image-fidelity.${format}`,Buffer.from(data.bytes));
      }
    }
    denyEmbedding=true;
    const missing=await page.evaluate(async()=>{
      const count=saved.length;await exportView.exportToPng(1);
      return {notice:window.notice,count:saved.length-count,clean:!exportView.exportingImage && document.querySelector('#viewport').children.length===1};
    });
    assert.equal(missing.count,0);assert.equal(missing.clean,true);assert.match(missing.notice,/Failed to embed image/);
    denyEmbedding=false;
    const retry=await page.evaluate(async()=>{
      const count=saved.length;await exportView.exportToPng(1);
      return saved.length-count;
    });
    assert.equal(retry,1,'A failed fetch must not poison the retry cache');
    console.log('Image fidelity: transparent layers over white/dark/custom/alpha backgrounds, opaque PNG/JPEG pixels, black SVG lines and lazy attachment image pixels passed.');
    await page.route('https://assets.test/pixel.png',route=>route.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')}));
    const html = await page.evaluate(async () => {
      const node=document.querySelector('.mm-node');
      node.innerHTML='<div class="mm-node-content"><b>中文节点</b><table><tbody><tr><td>表格内容</td></tr></tbody></table><code>code &amp; text</code><a href="https://example.com">link</a><a href="javascript:alert(1)" onclick="alert(1)">bad link</a></div>';
      node.style.width='1100px';node.style.height='210px';node.style.borderRadius='10px';
      const pre=document.createElement('pre');pre.style.cssText='white-space:pre;overflow-x:auto;width:100%;margin:0';
      const code=document.createElement('code');code.style.whiteSpace='pre';code.textContent='const veryLongLine = '+ 'parameter, '.repeat(160)+';';pre.append(code);node.querySelector('.mm-node-content').append(pre);
      node.querySelector('.mm-node-content').style.cssText='box-sizing:border-box;width:1100px;max-width:1100px;user-select:none';
      const handle=document.createElement('span');handle.className='mm-node-resize';node.append(handle);
      const img=new Image();img.src='https://assets.test/pixel.png';
      img.style.width='12px';img.style.height='12px';node.append(img);await img.decode();
      const original=document.querySelector('#content').outerHTML;
      exportView.mindmap.traverseAll=fn=>fn({isShow:()=>true,getBox:()=>({x:1000,y:1000,width:1100,height:210})});
      exportView.app.vault.create=async(path,text)=>{window.htmlPath=path;window.htmlText=text};
      await exportView.exportToHtml();
      if(!window.htmlText) throw new Error(window.notice);
      if(original!==document.querySelector('#content').outerHTML) throw new Error('Export mutated graph');
      if(!htmlPath.endsWith('Note-Page- A.html')) throw new Error(htmlPath);
      if(exportView.exportingImage || document.querySelector('#viewport').children.length!==1) throw new Error('Snapshot leaked');
      return htmlText;
    });
    // Missing HTML image resources abort the save, clean up, and allow a later retry.
    await page.route('https://assets.test/missing-html.png',route=>route.fulfill({status:404,body:'missing'}));
    await page.evaluate(async()=>{
      const bad=new Image();bad.src='https://assets.test/missing-html.png';document.querySelector('.mm-node').append(bad);
      window.htmlText='';await exportView.exportToHtml();
      if(window.htmlText || !window.notice.includes('HTML export failed'))throw new Error('Incomplete HTML was saved');
      if(exportView.exportingImage || document.querySelector('#viewport').children.length!==1)throw new Error('Failed HTML leaked a snapshot');
      bad.remove();await exportView.exportToHtml();if(!window.htmlText)throw new Error('HTML retry failed');
    });
    const htmlFile=require('node:path').resolve('node_modules/.cache/mindmap-tests/html-export.html');
    fs.writeFileSync(htmlFile,html);
    const viewer=await browser.newPage({viewport:{width:1100,height:700}});
    const requests=[];viewer.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
    await viewer.context().setOffline(true);
    await viewer.goto(require('node:url').pathToFileURL(htmlFile).href);
    await viewer.waitForFunction(()=>document.querySelector('#mm-export-zoom').textContent);
    const checks=await viewer.evaluate(()=>{
      const node=document.querySelector('.mm-node'),content=document.querySelector('.mm-node-content');
      const range=document.createRange();range.selectNodeContents(content);getSelection().removeAllRanges();getSelection().addRange(range);
      return {title:document.title,text:getSelection().toString(),svg:!!document.querySelector('#mm-export-map svg path'),background:getComputedStyle(node).backgroundColor,radius:getComputedStyle(node).borderRadius,imageSrc:document.querySelector('#mm-export-map img').src,image:document.querySelector('#mm-export-map img').complete && document.querySelector('#mm-export-map img').naturalWidth,
        unsafe:document.querySelectorAll('[onclick],a[href^="javascript:"]').length,table:!!content.querySelector('table'),code:!!content.querySelector('code'),userSelect:getComputedStyle(content).userSelect,link:content.querySelector('a').href, width:content.offsetWidth, preWhiteSpace:getComputedStyle(content.querySelector('pre')).whiteSpace, scroll:content.querySelector('pre').scrollWidth>content.querySelector('pre').clientWidth, handles:document.querySelectorAll('.mm-node-resize').length, csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]').content};
    });
    assert.equal(checks.title,'Note-Page- A');assert.match(checks.text,/中文节点/);assert.match(checks.text,/表格内容/);
    assert.equal(checks.svg,true);assert.equal(checks.background,'rgb(255, 0, 0)');assert.equal(checks.radius,'10px');assert.equal(checks.image,1);assert.match(checks.imageSrc,/^data:image\/png;base64,/);
    assert.equal(checks.unsafe,0);assert.equal(checks.table,true);assert.equal(checks.code,true);assert.equal(checks.userSelect,'text');assert.equal(checks.link,'https://example.com/');assert.equal(requests.length,0);assert.equal(checks.width,1100);assert.equal(checks.preWhiteSpace,'pre');assert.equal(checks.scroll,true);assert.equal(checks.handles,0);assert.match(checks.csp,/default-src 'none'/);
    // A real pointer gesture must work: the capture host deliberately disables pointer events.
    const word=await viewer.locator('#mm-export-map b').boundingBox();
    await viewer.mouse.move(word.x+1,word.y+word.height/2);await viewer.mouse.down();
    await viewer.mouse.move(word.x+word.width-1,word.y+word.height/2,{steps:8});await viewer.mouse.up();
    assert.match(await viewer.evaluate(()=>getSelection().toString()),/中文节点/);
    const codeBounds=await viewer.locator('#mm-export-map pre').boundingBox();
    await viewer.mouse.move(codeBounds.x+40,codeBounds.y+codeBounds.height/2);await viewer.mouse.wheel(300,0);
    await viewer.waitForFunction(()=>document.querySelector('#mm-export-map pre').scrollLeft>0);
    await viewer.click('#mm-export-reset');assert.equal(await viewer.locator('#mm-export-zoom').textContent(),'100%');
    await viewer.click('#mm-export-plus');assert.equal(await viewer.locator('#mm-export-zoom').textContent(),'120%');
    await viewer.click('#mm-export-minus');assert.equal(await viewer.locator('#mm-export-zoom').textContent(),'100%');
    await viewer.setViewportSize({width:390,height:700});await viewer.click('#mm-export-fit');
    assert.ok(parseInt(await viewer.locator('#mm-export-zoom').textContent())<100);
    await viewer.setViewportSize({width:1100,height:700});await viewer.click('#mm-export-fit');
    await viewer.evaluate(()=>getSelection().removeAllRanges());
    await viewer.screenshot({path:'node_modules/.cache/mindmap-tests/html-export.png'});
    // Note markup is data. Only the viewer's nonce-authorized script survives.
    const escapedHtml=await page.evaluate(()=>{
      const fragment=document.createElement('div');fragment.style.cssText='width:400px;height:200px';
      fragment.innerHTML='<script>window.noteExecuted=1</script><iframe srcdoc="bad"></iframe><a href="javascript:alert(1)" onclick="window.noteExecuted=1">unsafe</a><svg><a href="https://example.com"><animate attributeName="href" values="javascript:alert(1)"/></a></svg>';
      const text=document.createElement('p');text.textContent='Literal </script> <img onerror=alert(1)> & Chinese 中文';fragment.append(text);
      return standaloneHtml(fragment,'<img onerror=alert(1)> & title',400,200,{fit:'<fit>',reset:'100%',zoomIn:'Zoom in',zoomOut:'Zoom out'});
    });
    const safeFile=require('node:path').resolve('node_modules/.cache/mindmap-tests/html-export-escaped.html');fs.writeFileSync(safeFile,escapedHtml);
    await viewer.goto(require('node:url').pathToFileURL(safeFile).href);
    assert.equal(await viewer.title(),'<img onerror=alert(1)> & title');
    assert.match(await viewer.locator('#mm-export-map').innerText(),/Literal <\/script> <img onerror=alert\(1\)>/);
    assert.equal(await viewer.locator('script').count(),1);
    assert.equal(await viewer.locator('[onclick],iframe,animate,a[href^="javascript:"]').count(),0);
    assert.equal(await viewer.evaluate(()=>window.noteExecuted),undefined);
    await viewer.click('#mm-export-plus');assert.equal(await viewer.locator('#mm-export-zoom').textContent(),'120%');
    console.log('HTML export: offline file, native selectable Chinese/table/code, styled SVG, embedded image, safe links, zoom/fit and live-graph isolation passed.');
    console.log('Image export bundle browser checks passed: PNG pixels, JPEG signature, SVG bounds, zoom, page naming, failure cleanup and retry.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
