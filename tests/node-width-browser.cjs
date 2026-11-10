const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
module.exports = async ({browser, definitions, screenshotDir}) => {
    const page = await browser.newPage({viewport:{width:1200,height:800}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try {
        await page.setContent(`<style>${fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8')}
        body{margin:0;font:16px monospace;background:white;color:black}#view{width:1150px;height:750px;overflow:auto}
        #canvas{position:relative;width:6000px;height:4000px;transform-origin:0 0}.mm-node-content pre{margin:0}</style>
        <div id="view"><div id="canvas"></div></div>`);
        const names=['Command','ChangeNodeStyle','History','MindMap','applyNodeStyle','normalizeNodeStyle','normalizeNodeBoxStyle','effectiveNodeStyle','findPreset'];
        await page.addScriptTag({content:`${names.map(n=>definitions.get(n)).join('\n')}
        const map=Object.create(MindMap.prototype), canvas=document.querySelector('#canvas');
        const n={data:{id:'code',text:'unchanged'},containEl:document.createElement('div'),contentEl:document.createElement('div'),
            getId(){return this.data.id},getBox(){return {x:120,y:120,width:this.contentEl.offsetWidth,height:this.contentEl.offsetHeight}},refreshBox(){},clearCacheData(){}};
        n.containEl.className='mm-node mm-node-select';n.containEl.dataset.id='code';n.containEl.style.cssText='left:120px;top:120px';
        n.contentEl.className='mm-node-content';n.contentEl.innerHTML='<pre><code>const result = someFunction('+'parameter, '.repeat(35)+');</code></pre>';
        n.containEl.append(n.contentEl);canvas.append(n.containEl);
        Object.assign(map,{appEl:canvas,containerEL:document.querySelector('#view'),setting:{},mindScale:100,exec:{history:new History()},
            getNodeById:id=>id==='code'?n:null,finishEditingForHistory(){},setSelectedNodes(){},focusAfterHistory(){canvas.tabIndex=-1;canvas.focus()},
            refresh(){window.layouts=(window.layouts||0)+1},emit(){},getSelectedNodes:()=>[n]});
        applyNodeStyle(n,[]);window.map=map;window.n=n;
        canvas.addEventListener('mousedown',e=>map.appMouseDown(e));
        canvas.addEventListener('dragstart',e=>map.appDragstart(e));
        document.addEventListener('mousemove',e=>map.appMouseMove(e));document.addEventListener('mouseup',e=>map.appMouseUp(e));
        window.addEventListener('blur',e=>map.appMouseUp(e));document.addEventListener('keydown',e=>map.appKeydown(e));
        `});
        const handle=page.locator('.mm-node-resize-right');
        for(const zoom of [100,50,200]) {
            await page.evaluate(zoom=>{map.mindScale=zoom;map.appEl.style.transform='scale('+zoom/100+')';map.applyLocalNodeStyle({width:300});map.exec.history.clear();},zoom);
            const box=await handle.boundingBox();
            await page.mouse.move(box.x+box.width/2,box.y+8);await page.mouse.down();
            await page.mouse.move(box.x+box.width/2+100*zoom/100,box.y+80,{steps:8});await page.mouse.up();
            assert.equal(await page.evaluate(()=>n.data.nodeStyle.width),400,`width at ${zoom}%`);
            assert.equal(await page.evaluate(()=>map.exec.history.undos.length),1);
            await page.evaluate(()=>map.exec.history.undo());assert.equal(await page.evaluate(()=>n.contentEl.offsetWidth),300);
            await page.evaluate(()=>map.exec.history.redo());assert.equal(await page.evaluate(()=>n.contentEl.offsetWidth),400);
        }
        await page.evaluate(()=>{map.mindScale=100;map.appEl.style.transform='';map.exec.history.clear()});
        let box=await page.locator('.mm-node-resize-left').boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+8);await page.mouse.down();await page.mouse.move(box.x-46,box.y+8);
        assert.equal(await page.evaluate(()=>parseFloat(n.containEl.style.left)),70);
        await page.mouse.up();
        assert.equal(await page.evaluate(()=>n.data.nodeStyle.width),450);
        // Blur and Escape discard the preview without adding history.
        for(const cancel of ['blur','Escape']) {
            box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+8);await page.mouse.down();await page.mouse.move(box.x+84,box.y+8);
            if(cancel==='blur') await page.evaluate(()=>window.dispatchEvent(new Event('blur')));else await page.keyboard.press('Escape');
            await page.mouse.up();
            assert.equal(await page.evaluate(()=>n.contentEl.offsetWidth),450);assert.equal(await page.evaluate(()=>map.exec.history.undos.length),1);
        }
        await page.evaluate(()=>map.applyLocalNodeStyle({width:400,codeWrap:false}));
        let values=await page.locator('pre').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,space:getComputedStyle(el).whiteSpace,height:el.offsetHeight}));
        assert.ok(values.scroll>values.client);assert.equal(values.space,'pre');
        const oneLine=values.height;
        await page.evaluate(()=>map.applyLocalNodeStyle({codeWrap:true}));
        assert.ok(await page.locator('pre').evaluate(el=>el.offsetHeight)>oneLine);
        await page.evaluate(()=>map.applyLocalNodeStyle({width:null}));assert.equal(await page.evaluate(()=>n.contentEl.style.width),'');
        assert.equal(await page.evaluate(()=>n.contentEl.style.maxWidth),'');
        assert.equal(await page.evaluate(()=>n.data.text),'unchanged');
        await page.screenshot({path:path.join(screenshotDir,'node-width.png')});
        assert.deepEqual(errors,[]);
        console.log('Node width: native left/right drag, release outside node, 50/100/200% zoom, atomic undo/redo, blur/Escape cancel, auto reset and real code wrap/scroll passed.');
    } finally {await page.close()}
};
