const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.argv[2] || 'playwright');
const repo = path.resolve(__dirname, '..');
const screenshotDir = path.join(repo, 'node_modules', '.cache', 'mindmap-tests');
fs.mkdirSync(screenshotDir, { recursive: true });
const source = ts.createSourceFile('main.js', fs.readFileSync(`${repo}/main.js`, 'utf8'), ts.ScriptTarget.Latest, true);
const definitions = new Map();
function visit(node) {
    if (ts.isVariableDeclaration(node) && ['START','END'].includes(node.name.getText(source))) definitions.set(node.name.getText(source), 'const ' + node.getText(source) + ';');
    if ((ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name) definitions.set(node.name.text, node.getText(source));
    ts.forEachChild(node, visit);
}
visit(source);
const names = ['keepLastIndex', '__awaiter', 'uuid', 'selectionRoots', 'containsNode', 'selectionRect', 'intersectsRect', 'clipboardAction', 'serializeForest', 'parseSubtree', 'Command', 'AddNode', 'ChangeNodeText', 'RemoveNodes', 'MoveNodes', 'PasteNode', 'History', 'Exec', 'MindMap', 'MindMapToolbar', 'SummaryTransaction', 'SummaryManager', 'validateSummary', 'summaryMarkdown', 'extractSummaries', 'START', 'END', 'TextFormatMenu', 'formatSelection', 'editorSelection', 'selectEditorOffsets'];
const code = names.map(name => { assert.ok(definitions.has(name), name); return definitions.get(name); }).join('\n');
(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { channel: process.argv[3] } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent(`<style>${fs.readFileSync(`${repo}/styles.css`, 'utf8')}
          body{margin:0;font:16px system-ui;background:#20242c;color:white}h3{margin:16px}
          #viewport{position:relative;margin:16px;width:1050px;height:470px;overflow:auto;border:1px solid #657080}
          #map{position:relative;width:1200px;height:650px;background:#272d38}.mm-node{position:absolute}.mm-node-content{padding:12px 20px;background:#38485e;border-radius:8px}
          #status{margin:16px}</style><h3>Mind map batch selection — release bundle test harness</h3><div id="viewport"><div id="map"></div></div><div id="status"></div>`);
        await page.addScriptTag({ content: `(() => {
            ${code}
            const cmd = { AddNode, ChangeNodeText, RemoveNodes, MoveNodes, PasteNode };
            const t = text => text;
            const obsidian = { MarkdownRenderer: { renderMarkdown: async (text, element) => { element.textContent = text; } } };
            const MindMapView = class {};
            const ProdNode = ${Array.from(definitions.values()).find(text => text.includes('select(preserveSelection = false)'))};
            class Node {
                constructor(data, mindmap) {
                    this.data=data; this.mindmap=mindmap; this.children=[]; this.isExpand=true;
                    this.containEl=document.createElement('div'); this.containEl.className='mm-node';
                    this.containEl.setAttribute('data-id',data.id);this.containEl.tabIndex=-1;
                    this.contentEl=document.createElement('div');this.contentEl.className='mm-node-content';this.contentEl.textContent=data.text;this.containEl.append(this.contentEl);
                }
                selectText(){ProdNode.prototype.selectText.call(this)}
                edit(){ProdNode.prototype.edit.call(this)} cancelEdit(){ProdNode.prototype.cancelEdit.call(this)}
                setText(text){ProdNode.prototype.setText.call(this,text)} parseText(){ProdNode.prototype.parseText.call(this)} _delay(){}
                getId(){return this.data.id} getData(){return JSON.parse(JSON.stringify(this.data))}
                select(preserve){ProdNode.prototype.select.call(this,preserve)} unSelect(){ProdNode.prototype.unSelect.call(this)}
                getBox(){return {x:parseFloat(this.containEl.style.left),y:parseFloat(this.containEl.style.top),width:this.containEl.offsetWidth,height:this.containEl.offsetHeight}}
                isShow(){return !this.isHide} clearCacheData(){} refreshBox(){}
                setPosition(x,y){this.containEl.style.left=x+'px';this.containEl.style.top=y+'px'}
                show(){this.isHide=false;this.containEl.style.display='block'} hide(){this.isHide=true;this.containEl.style.display='none'}
                expand(){ProdNode.prototype.expand.call(this)} collapse(){ProdNode.prototype.collapse.call(this)}
                getLevel(){return ProdNode.prototype.getLevel.call(this)}
                addChild(n,index=-1){ProdNode.prototype.addChild.call(this,n,index)} removeChild(n){return ProdNode.prototype.removeChild.call(this,n)}
            }
            const Node$1 = Node;
            const Notice = class { constructor(text) { console.error(text); } };
            let clipboardText='';
            Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{clipboardText=text;},readText:async()=>clipboardText}});
            window.testClipboard=()=>clipboardText;
            const map=Object.create(MindMap.prototype);
            document.querySelector('#map').tabIndex=-1;
            Object.assign(map,{appEl:document.querySelector('#map'),containerEL:document.querySelector('#viewport'),selectedNodes:[],isFocused:true,_dragNodes:[],_selectionBase:[],_menuDom:{style:{}},_indicateDom:document.createElement('div'),_suppressClickUntil:0,exec:new Exec(),_panning:false});
            map.view={app:{workspace:{getActiveViewOfType:()=>map.view}}};
            map.addNode=(node,parent,index=-1)=>{if(!parent)return;parent.children.splice(index<0?parent.children.length:index,0,node);node.parent=parent;map.appEl.append(node.containEl)};
            map.removeNode=node=>{const i=node.parent.children.indexOf(node);node.parent.children.splice(i,1);const remove=n=>{n.containEl.remove();n.children.forEach(remove)};remove(node);return i};
            map.emit=()=>{};
            const make=(id,parent,x,y)=>{const node=new Node({id,text:id},map);node.containEl.style.left=x+'px';node.containEl.style.top=y+'px';if(parent)map.addNode(node,parent);else map.appEl.append(node.containEl);return node};
            map.root=make('Root',null,70,180);map.root.data.isRoot=true;
            const a=make('Branch A',map.root,260,80),child=make('A child',a,480,80),b=make('Branch B',map.root,260,240),target=make('Target',map.root,780,180);
            map.setSelectedNodes([map.root]);
            map.appEl.addEventListener('mousedown',e=>map.appMouseDown(e));
            map.appEl.addEventListener('click',e=>map.appClickFn(e));
            map.appEl.addEventListener('dblclick',e=>map.appDblclickFn(e));
            map.appEl.addEventListener('dragstart',e=>map.appDragstart(e));
            map.appEl.addEventListener('dragover',e=>map.appDragover(e));
            map.appEl.addEventListener('drop',e=>map.appDrop(e));
            map.appEl.addEventListener('dragend',e=>map.appDragend(e));
            document.addEventListener('mousemove',e=>map.appMouseMove(e));
            document.addEventListener('mouseup',e=>map.appMouseUp(e));
            document.addEventListener('keydown',e=>map.appKeydown(e),true);
            document.addEventListener('paste',e=>map.appPaste(e),true);
            map.appEl.addEventListener('contextmenu',e=>{map.appContextMenu(e);window.lastContextPrevented=e.defaultPrevented;},true);
            HTMLElement.prototype.hasClass=function(c){return this.classList.contains(c)};
            window.testMap=map;window.testNodes={a,child,b,target};
            Object.assign(window,{SummaryManager,MindMap,MindMapToolbar,extractSummaries,editorSelection,selectEditorOffsets});
            window.installToolbar=()=>{
                const host=document.createElement('div');host.className='view-content mm-view';
                host.style.cssText='height:480px;width:1050px;margin:16px';
                map.containerEL.before(host);host.append(map.containerEL);
                map.containerEL.className='mm-viewport';map.containerEL.style.cssText='margin:0;width:auto;height:auto;border:0';
                map.emit=MindMap.prototype.emit;
                map.mindScale=100;map.scalePointer=[];map.setting={canvasSize:1200};
                window.toolbar=new MindMapToolbar(map,host);
            };
            window.snapshot=()=>({selected:map.getSelectedNodes().map(n=>n.getId()),roots:map.getSelectedRoots().map(n=>n.getId()),children:map.root.children.map(n=>n.getId()),target:target.children.map(n=>n.getId()),scroll:[map.containerEL.scrollLeft,map.containerEL.scrollTop],undos:map.exec.history.undos.length});
        })();` });
        assert.deepEqual(errors, [], 'Harness initialization errors');
        await page.mouse.move(235, 115);
        await page.mouse.down();
        await page.mouse.move(650, 405, { steps: 12 });
        await page.screenshot({ path: path.join(screenshotDir, 'marquee.png') });
        await page.mouse.up();
        let state = await page.evaluate(() => snapshot());
        assert.deepEqual(state.selected, ['Branch A', 'A child', 'Branch B']);
        assert.deepEqual(state.roots, ['Branch A', 'Branch B']);
        assert.deepEqual(state.scroll, [0, 0]);
        await page.keyboard.press('Control+c');
        assert.equal(JSON.parse(await page.evaluate(() => testClipboard())).text.length, 3);
        await page.locator('[data-id="Target"]').click();
        await page.keyboard.press('Control+v');
        state = await page.evaluate(() => snapshot());
        assert.equal(state.target.length, 2);
        await page.keyboard.press('Control+z');
        assert.deepEqual((await page.evaluate(() => snapshot())).target, []);
        await page.mouse.move(235, 115); await page.mouse.down();
        await page.mouse.move(650, 405, { steps: 8 }); await page.mouse.up();
        await page.keyboard.press('Control+x');
        state = await page.evaluate(() => snapshot());
        assert.deepEqual(state.children, ['Target']);
        assert.equal(state.undos, 1);
        assert.equal(JSON.parse(await page.evaluate(() => testClipboard())).text.length, 3);
        await page.locator('[data-id="Target"]').click();
        await page.keyboard.press('Control+v');
        assert.equal((await page.evaluate(() => snapshot())).target.length, 2);
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Control+z');
        state = await page.evaluate(() => snapshot());
        assert.deepEqual(state.children, ['Branch A', 'Branch B', 'Target']);
        await page.keyboard.press('Control+y');
        assert.deepEqual((await page.evaluate(() => snapshot())).children, ['Target']);
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Delete');
        state = await page.evaluate(() => snapshot());
        assert.deepEqual(state.children, ['Target']);
        assert.equal(state.undos, 1);
        await page.keyboard.press('Control+z');
        state = await page.evaluate(() => snapshot());
        assert.deepEqual(state.children, ['Branch A', 'Branch B', 'Target']);
        // Real native drag events from a member of the multiselection.
        await page.locator('[data-id="Branch A"]').dragTo(page.locator('[data-id="Target"]'));
        state = await page.evaluate(() => snapshot());
        assert.deepEqual(state.target, ['Branch A', 'Branch B']);
        assert.equal(state.undos, 1);
        await page.keyboard.press('Control+z');
        state = await page.evaluate(() => snapshot());
        assert.deepEqual(state.children, ['Branch A', 'Branch B', 'Target']);
        await page.evaluate(() => {
            testMap.containerEL.scrollLeft = 100; testMap.containerEL.scrollTop = 80;
            window.contextBlocked = [];
            document.addEventListener('contextmenu', e => contextBlocked.push(e.defaultPrevented));
        });
        await page.mouse.move(700, 420); await page.mouse.down({ button: 'right' });
        await page.mouse.move(750, 450, { steps: 6 }); await page.mouse.up({ button: 'right' });
        assert.deepEqual((await page.evaluate(() => snapshot())).scroll, [50, 50]);
        assert.equal(await page.evaluate(() => lastContextPrevented), true);
        await page.evaluate(() => { testMap.containerEL.scrollLeft = 0; testMap.containerEL.scrollTop = 0; });
        await page.locator('[data-id="Target"]').click();
        await page.evaluate(() => {
            testMap.view.saveClipboardImage = async image => {
                if (!(image instanceof Blob) || image.type !== 'image/png') throw Error('Expected PNG');
                return '![[Assets/pasted.png]]';
            };
            navigator.clipboard.read = async () => [{ types: ['text/plain', 'image/png'],
                getType: async type => new Blob([type === 'text/plain' ? 'One\nTwo' : 'PNG'], { type }) }];
        });
        await page.keyboard.press('Control+v');
        await page.waitForFunction(() => testNodes.target.children.length === 3);
        assert.deepEqual(await page.evaluate(() => testNodes.target.children.map(n => n.data.text)), ['One', 'Two', '![[Assets/pasted.png]]']);
        await page.keyboard.press('Control+z');
        assert.equal((await page.evaluate(() => snapshot())).target.length, 0);
        await page.evaluate(() => {
            testMap.setSelectedNodes([testNodes.target]);
            const data = new DataTransfer(); data.setData('text/plain', 'Native paste');
            data.items.add(new File(['PNG'], 'image.png', { type: 'image/png' }));
            testNodes.target.containEl.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
        });
        await page.waitForFunction(() => testNodes.target.children.length === 2);
        assert.deepEqual(await page.evaluate(() => testNodes.target.children.map(n => n.data.text)), ['Native paste', '![[Assets/pasted.png]]']);
        await page.keyboard.press('Control+z');
        assert.equal((await page.evaluate(() => snapshot())).target.length, 0);
        await page.evaluate(() => {
            const node = testNodes.target; node.data.text = 'Alpha beta gamma'; node.contentEl.textContent = node.data.text;
        });
        await page.locator('[data-id="Target"] .mm-node-content').dblclick();
        assert.equal(await page.evaluate(() => testNodes.target.data.isEdit), true);
        assert.equal(await page.locator('[data-id="Target"]').getAttribute('draggable'), 'false');
        const caretPoint = await page.evaluate(() => {
            const range = document.createRange(); const text = testNodes.target.contentEl.firstChild;
            range.setStart(text, 0); range.setEnd(text, 6); const box = range.getBoundingClientRect();
            return { x: box.right, y: (box.top + box.bottom) / 2 };
        });
        await page.mouse.click(caretPoint.x, caretPoint.y);
        const caret = await page.evaluate(() => ({ offset: getSelection().anchorOffset, focused: document.activeElement === testNodes.target.contentEl, editing: testNodes.target.data.isEdit }));
        assert.equal(caret.focused, true); assert.equal(caret.editing, true);
        assert.ok(caret.offset > 0 && caret.offset < 'Alpha beta gamma'.length);
        await page.keyboard.type('X');
        const updated = 'Alpha beta gamma'.slice(0, caret.offset) + 'X' + 'Alpha beta gamma'.slice(caret.offset);
        assert.equal(await page.locator('[data-id="Target"] .mm-node-content').innerText(), updated);
        await page.locator('[data-id="Target"] .mm-node-content').dblclick();
        assert.equal(await page.evaluate(() => testNodes.target.data.isEdit), true);
        assert.ok((await page.evaluate(() => getSelection().toString())).length > 0);
        // Real text selection dragged out of the editor must keep its range and focus.
        for (const end of [{ x: 700, y: 420 }, { x: 300, y: 260 }]) {
            const start = await page.evaluate(() => {
                const range = document.createRange();
                range.setStart(testNodes.target.contentEl.firstChild, 3);
                range.setEnd(testNodes.target.contentEl.firstChild, 4);
                const box = range.getBoundingClientRect();
                return { x: box.left, y: (box.top + box.bottom) / 2 };
            });
            await page.mouse.move(start.x, start.y); await page.mouse.down();
            await page.mouse.move(end.x, end.y, { steps: 12 }); await page.mouse.up();
            assert.equal(await page.evaluate(() => testNodes.target.data.isEdit), true);
            assert.equal(await page.evaluate(() => document.activeElement === testNodes.target.contentEl), true);
            assert.ok((await page.evaluate(() => getSelection().toString())).length > 0);
            assert.deepEqual((await page.evaluate(() => snapshot())).selected, ['Target']);
        }
        await page.locator('[data-id="Branch B"]').click();
        assert.equal(await page.evaluate(() => testNodes.target.data.isEdit), false);
        assert.equal(await page.evaluate(() => testNodes.target.data.text), updated);
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(() => testNodes.target.data.text), 'Alpha beta gamma');
        await page.locator('[data-id="Branch B"]').click();
        await page.keyboard.press('Tab');
        await page.waitForFunction(() => testMap.editNode?.data.isEdit && testMap.editNode.parent === testNodes.b);
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(() => testNodes.b.children.length), 0);
        assert.equal(await page.evaluate(() => testMap.editNode), null);
        assert.equal(await page.evaluate(() => testMap.selectNode === testNodes.b), true);
        await page.keyboard.press('Control+y');
        await page.waitForFunction(() => testMap.editNode?.data.isEdit);
        await page.keyboard.type('Typed text');
        assert.equal(await page.evaluate(() => testMap.editNode.contentEl.innerText), 'Typed text');
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(() => testNodes.b.children.length), 1);
        assert.equal(await page.evaluate(() => testNodes.b.children[0].data.text), 'Sub title');
        assert.equal(await page.evaluate(() => testMap.editNode), null);
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(() => testNodes.b.children.length), 0);
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => testMap.editNode?.data.isEdit);
        assert.equal(await page.evaluate(() => testMap.root.children.length), 4);
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(() => testMap.root.children.length), 3);
        await page.keyboard.press('Tab');
        await page.waitForFunction(() => testMap.editNode?.data.isEdit);
        await page.mouse.click(700, 420);
        assert.deepEqual((await page.evaluate(() => snapshot())).selected, []);
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(() => testNodes.b.children.length), 0);
        await page.keyboard.press('Control+y');
        await page.waitForFunction(() => testMap.editNode?.data.isEdit);
        await page.evaluate(() => { testMap.clearSelectNode(); document.activeElement.blur(); testMap.isFocused=false; });
        assert.equal(await page.evaluate(() => document.activeElement === document.body), true);
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(() => testNodes.b.children.length), 0);
        await page.evaluate(() => testMap.setSelectedNodes([testNodes.target]));
        await page.locator('[data-id="Target"] .mm-node-content').dblclick();
        await page.keyboard.press('Control+a'); await page.keyboard.type('Changed in editor');
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(() => testNodes.target.data.text), 'Alpha beta gamma');
        assert.equal(await page.evaluate(() => testMap.editNode), null);
        await page.keyboard.press('Control+Shift+z');
        assert.equal(await page.evaluate(() => testNodes.target.data.text), 'Changed in editor');
        // Fixed toolbar uses production bundle controls and graph history.
        await page.evaluate(() => { installToolbar(); testMap.setSelectedNodes([testNodes.b]); });
        const tool = action => page.locator('.mm-toolbar button[data-action="' + action + '"]');
        await tool('child').click();
        await page.waitForFunction(() => testMap.editNode?.data.isEdit);
        assert.equal(await page.evaluate(() => testNodes.b.children.length), 1);
        await page.keyboard.type('Toolbar draft');
        await tool('undo').click();
        assert.equal(await page.evaluate(() => testNodes.b.children[0].data.text), 'Sub title');
        await tool('undo').click();
        assert.equal(await page.evaluate(() => testNodes.b.children.length), 0);
        await tool('redo').click();
        await page.waitForFunction(() => testMap.editNode?.data.isEdit);
        await tool('sibling').click();
        await page.waitForFunction(() => testNodes.b.children.length === 2 && testMap.editNode?.data.isEdit);
        await page.evaluate(() => { testMap.finishEditingForHistory(); testMap.setSelectedNodes(testNodes.b.children); });
        await tool('delete').click();
        assert.equal(await page.evaluate(() => testNodes.b.children.length), 0);
        await tool('undo').click();
        assert.equal(await page.evaluate(() => testNodes.b.children.length), 2);
        await page.evaluate(() => testMap.setSelectedNodes([testMap.root]));
        assert.equal(await tool('sibling').isDisabled(), true);
        assert.equal(await tool('delete').isDisabled(), true);
        const before = await page.locator('.mm-toolbar').boundingBox();
        await tool('zoomIn').click();
        assert.equal(await tool('reset').innerText(), '110%');
        await page.evaluate(() => { testMap.containerEL.scrollLeft=100; testMap.containerEL.scrollTop=100; });
        assert.deepEqual(await page.locator('.mm-toolbar').boundingBox(), before);
        await tool('reset').click();
        assert.equal(await tool('reset').innerText(), '100%');
        await page.evaluate(() => testMap.scale(20));
        assert.equal(await tool('zoomOut').isDisabled(), true);
        await page.evaluate(() => testMap.scale(300));
        assert.equal(await tool('zoomIn').isDisabled(), true);
        await tool('reset').click();
        await tool('center').click();
        assert.deepEqual(await page.locator('.mm-toolbar').boundingBox(), before);
        await page.screenshot({ path: path.join(screenshotDir, 'toolbar.png') });
        await page.setViewportSize({width:400,height:620});
        await page.evaluate(() => document.querySelector('.mm-view').style.width='360px');
        assert.equal(await page.evaluate(() => toolbar.element.scrollWidth > toolbar.element.clientWidth), true);
        await page.evaluate(() => { toolbar.destroy(); installToolbar(); });
        assert.equal(await page.locator('.mm-toolbar').count(), 1);
        assert.deepEqual(errors, []);
        console.log('Fixed toolbar: add child/sibling, draft undo/redo, batch delete, root protection, zoom limits, fixed position, narrow viewport and recreation passed.');
        assert.deepEqual(errors, []);
        await page.setViewportSize({width:1600,height:900});
        await page.evaluate(() => {
            toolbar.destroy();
            document.querySelectorAll('.mm-view').forEach(host=>host.style.cssText='height:760px;width:1550px;margin:0');
            testMap.containerEL.style.cssText='margin:0;width:auto;height:auto;border:0';
            testMap.appEl.style.cssText='width:5000px;height:2500px;position:relative';
            testMap.appEl.style.transform='';
            testMap.setting.headLevel=1;
            testMap.finishEditingForHistory();
            testMap.exec.history.clear();
            const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
            svg.style.cssText='position:absolute;width:5000px;height:2500px;pointer-events:none'; testMap.appEl.prepend(svg);
            const group=()=>{const el=document.createElementNS(svg.namespaceURI,'g');svg.append(el);return {clear(){el.replaceChildren()},group,
                path(d){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);el.append(path);return {node:path,fill(v){path.setAttribute('fill',v);return this},stroke(v){path.setAttribute('stroke','#8f9baa');path.setAttribute('stroke-width',v.width);return this},addClass(v){path.classList.add(v);path.style.pointerEvents='stroke';return this}}}}};
            testMap.edgeGroup={group};testMap.contentEL=testMap.appEl;
            testMap.summaries=new SummaryManager(testMap);
            const [a,b,c]=[testNodes.a,testNodes.b,testNodes.target];
            testMap.root.children=[a,b,c];
            [a,b,c].forEach((n,i)=>{n.data.id='member-'+i;n.containEl.setAttribute('data-id',n.data.id);testMap.traverseDF(child=>{if(child!==n){child.data.id='descendant-'+i+'-'+child.data.id.replace(/[^a-z0-9-]/gi,'');child.containEl.setAttribute('data-id',child.data.id)}},n);n.parent=testMap.root;n.direct='right';n.data.summaryTree=null;n.setPosition(230,100+i*180);n.children.forEach(child=>child.setPosition(420,100+i*180));});
            testMap.root.setPosition(40,280);
            testMap.refresh=()=>testMap.summaries.layout();
            testMap.removeNode=MindMap.prototype.removeNode;
            window.toolbar=new MindMapToolbar(testMap,document.querySelector('.mm-view'));
            testMap.setSelectedNodes([a]);
        });
        await tool('summary').click();
        assert.equal(await page.evaluate(() => testMap.summaries.items.length), 1);
        assert.equal(await page.evaluate(() => testMap.editNode?.data.summaryRoot), true);
        await page.keyboard.type('单节点概括');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.waitForFunction(()=>testMap.editNode?.parent?.data.summaryRoot);
        await page.keyboard.type('独立子树内容');
        await page.evaluate(()=>{testMap.finishEditingForHistory();testMap.setSelectedNodes([testNodes.a,testNodes.b]);});
        await tool('summary').click();
        await page.keyboard.type('A+B 概括');
        await page.evaluate(()=>{testMap.finishEditingForHistory();testMap.setSelectedNodes([testNodes.b,testNodes.target]);});
        await tool('summary').click();
        await page.keyboard.type('B+C 概括');
        await page.evaluate(()=>{testMap.finishEditingForHistory();testMap.setSelectedNodes([testNodes.a,testNodes.b,testNodes.target]);});
        await tool('summary').click(); await page.keyboard.type('A+B+C 概括');
        await page.evaluate(()=>testMap.finishEditingForHistory());
        assert.equal(await page.locator('.mm-summary-bracket').count(),4);
        const saved=await page.evaluate(()=>testMap.getMarkdown());
        assert.ok(saved.includes('mm:node'));assert.ok(saved.includes('独立子树内容'));
        assert.equal(await page.evaluate(()=>extractSummaries(testMap.getMarkdown()).entries.length),4);
        const boxes=await page.evaluate(()=>testMap.summaries.items.map(s=>{const nodes=[];testMap.traverseDF(n=>{if(n.isShow())nodes.push(n)},s.root);return testMap.getBoundingRect(nodes)}));
        for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(boxes[i].right<=boxes[j].x || boxes[j].right<=boxes[i].x || boxes[i].bottom<=boxes[j].y || boxes[j].bottom<=boxes[i].y,'Summary subtrees must not collide');
        const localAnchor = await page.evaluate(()=>{
            const summary=testMap.summaries.items[0], other=testNodes.target, old=other.getBox();
            const before=summary.root.getBox().x;other.setPosition(2500,950);testMap.refresh();
            const after=summary.root.getBox().x;other.setPosition(old.x,old.y);testMap.refresh();return {before,after};
        });
        assert.equal(localAnchor.after,localAnchor.before,'An unrelated far-right branch must not widen the summary gap');
        await page.screenshot({path:path.join(screenshotDir,'summaries.png')});
        await page.evaluate(()=>{
            const parsed=extractSummaries(testMap.getMarkdown());
            testMap.summaries.load(parsed.entries,parsed.preserved,parsed.raw);testMap.refresh();
        });
        assert.equal(await page.locator('.mm-summary-bracket').count(),4);
        assert.ok(await page.evaluate(()=>testMap.summaries.items[0].root.children.some(n=>n.data.text==='独立子树内容')));
        await page.evaluate(()=>{
            testMap.root.setPosition(2100,280);
            [testNodes.a,testNodes.b,testNodes.target].forEach((n,i)=>{n.direct='left';n.setPosition(1700,100+i*180);n.children.forEach(child=>child.setPosition(1500,100+i*180));});
            testMap.refresh();
        });
        const leftBounds=await page.evaluate(()=>testMap.summaries.items.map(s=>{const nodes=[];s.memberIds.forEach(id=>testMap.traverseDF(n=>{if(n.isShow())nodes.push(n)},testMap.getNodeById(id)));return {root:s.root.getBox(),anchor:testMap.getBoundingRect(nodes).x};}));
        assert.ok(leftBounds.every(b=>b.root.x+b.root.width<b.anchor));
        const leftAnchor = await page.evaluate(()=>{
            const summary=testMap.summaries.items[0], other=testNodes.target, old=other.getBox();
            const before=summary.root.getBox().x;other.setPosition(-2000,950);testMap.refresh();
            const after=summary.root.getBox().x;other.setPosition(old.x,old.y);testMap.refresh();return {before,after};
        });
        assert.equal(leftAnchor.after,leftAnchor.before,'An unrelated far-left branch must not widen the summary gap');
        await page.screenshot({path:path.join(screenshotDir,'summaries-left.png')});

        await page.evaluate(()=>{testMap.root.collapse();testMap.refresh();});
        assert.equal(await page.locator('.mm-summary-bracket').count(),0);
        assert.equal(await page.evaluate(()=>testMap.summaries.items.every(s=>!s.root.isShow())),true);
        await page.evaluate(()=>{testMap.root.expand();testMap.refresh();});
        assert.equal(await page.locator('.mm-summary-bracket').count(),4);
        // A member's collapsed descendants shrink its brace without changing membership.
        const foldedRange = await page.evaluate(()=>{
            const member=testNodes.b, child=member.children[0]; child.setPosition(1500,760); testMap.refresh();
            const id=testMap.summaries.items.find(s=>s.memberIds.length===2 && s.memberIds.includes(member.getId())).id;
            const brace=()=>document.querySelector(`[data-summary-id="${id}"]`).getAttribute('d');
            const before=brace(); member.collapse();testMap.refresh();const after=brace();
            const members=testMap.summaries.items.find(s=>s.id===id).memberIds.length;
            member.expand();child.setPosition(1500,280);testMap.refresh();return {before,after,members};
        });
        assert.notEqual(foldedRange.before,foldedRange.after);assert.equal(foldedRange.members,2);
        // Complete/partial copy and reference remapping.
        await page.evaluate(()=>testMap.setSelectedNodes([testNodes.a,testNodes.b,testNodes.target]));
        const clipboard=await page.evaluate(()=>testMap.copyNode());
        assert.equal(JSON.parse(clipboard).summaries.length,4);
        await page.evaluate(text=>{testMap.setSelectedNodes([testNodes.target]);testMap.pasteNode(text,testNodes.target)},clipboard);
        assert.equal(await page.evaluate(()=>testMap.summaries.items.length),8);
        await tool('undo').click();assert.equal(await page.evaluate(()=>testMap.summaries.items.length),4);
        await tool('redo').click();assert.equal(await page.evaluate(()=>testMap.summaries.items.length),8);
        await tool('undo').click();
        // Delete all members removes every dependent subtree in one history step.
        await page.evaluate(()=>testMap.setSelectedNodes([testNodes.a,testNodes.b,testNodes.target]));
        await tool('delete').click();assert.equal(await page.evaluate(()=>testMap.summaries.items.length),0);
        await tool('undo').click();assert.equal(await page.evaluate(()=>testMap.summaries.items.length),4);
        assert.ok(await page.evaluate(()=>testMap.getMarkdown().includes('独立子树内容')));
        await page.evaluate(()=>testMap.setSelectedNodes(testMap.summaries.items.map(s=>s.root)));
        await tool('delete').click();
        assert.equal(await page.evaluate(()=>testMap.summaries.items.length),0);
        assert.equal(await page.evaluate(()=>testMap.getMarkdown().includes('mm:node')),false);
        await tool('undo').click();assert.equal(await page.evaluate(()=>testMap.summaries.items.length),4);
        // Text-format menu operates on the native contenteditable selection.
        await page.evaluate(()=>{
            testMap.finishEditingForHistory();testMap.exec.history.clear();testMap.containerEL.scrollLeft=0;testMap.containerEL.scrollTop=0;
            const n=testNodes.target;n.setPosition(220,160);n.setText('Alpha beta gamma');testMap.setSelectedNodes([n]);n.edit();
        });
        const openTextMenu=async()=>{
            // Allow focus-induced native scrolling to settle before opening a fixed menu.
            await page.waitForTimeout(60);
            const position=await page.evaluate(()=>{const b=getSelection().getRangeAt(0).getClientRects()[0];return {x:b.x+b.width/2,y:b.y+b.height/2};});
            await page.mouse.click(position.x,position.y,{button:'right'});
            await page.waitForSelector('.mm-text-format-menu');
        };
        const formatButton=id=>page.locator('.mm-text-format-menu button[data-format="'+id+'"]');
        await page.evaluate(()=>selectEditorOffsets(testNodes.target.contentEl,6,10));
        await openTextMenu();assert.equal(await page.evaluate(()=>getSelection().toString()),'beta');
        await page.screenshot({path:path.join(screenshotDir,'text-format-menu.png')});
        await formatButton('bold').click();
        await page.waitForFunction(()=>testNodes.target.data.isEdit && testNodes.target.contentEl.innerText==='Alpha **beta** gamma');
        assert.equal(await page.evaluate(()=>getSelection().toString()),'beta');
        assert.equal(await page.evaluate(()=>testMap.exec.history.undos.length),1);
        await openTextMenu();await formatButton('#e53935').click();
        await page.waitForFunction(()=>testNodes.target.data.isEdit && testNodes.target.contentEl.innerText.includes('color:#e53935'));
        assert.equal(await page.evaluate(()=>testNodes.target.data.text),'Alpha **<span style="color:#e53935">beta</span>** gamma');
        assert.ok(await page.evaluate(()=>testMap.getMarkdown().includes('color:#e53935')));
        await openTextMenu();await formatButton('default').click();
        await page.waitForFunction(()=>testNodes.target.data.isEdit && testNodes.target.data.text==='Alpha **beta** gamma');
        await openTextMenu();await formatButton('bold').click();
        await page.waitForFunction(()=>testNodes.target.data.isEdit && testNodes.target.data.text==='Alpha beta gamma');
        await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>testNodes.target.data.text),'Alpha **beta** gamma');
        await page.keyboard.press('Control+y');assert.equal(await page.evaluate(()=>testNodes.target.data.text),'Alpha beta gamma');
        await page.evaluate(()=>{testMap.exec.history.clear();const n=testNodes.target;testMap.setSelectedNodes([n]);n.edit();});
        await page.keyboard.type(' delta');
        await page.evaluate(()=>selectEditorOffsets(testNodes.target.contentEl,6,10));
        await openTextMenu();await formatButton('bold').click();
        await page.waitForFunction(()=>testNodes.target.data.isEdit && testNodes.target.data.text==='Alpha **beta** gamma delta');
        assert.equal(await page.evaluate(()=>testMap.exec.history.undos.length),2);
        await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>testNodes.target.data.text),'Alpha beta gamma delta');
        await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>testNodes.target.data.text),'Alpha beta gamma');
        await page.keyboard.press('Control+y');await page.keyboard.press('Control+y');assert.equal(await page.evaluate(()=>testNodes.target.data.text),'Alpha **beta** gamma delta');
        // Real multiline DOM offsets include line breaks, and formatting commits a prior draft separately.
        await page.evaluate(()=>{const n=testNodes.target;testMap.setSelectedNodes([n]);n.setText('First line\nSecond line\nThird line');n.edit();selectEditorOffsets(n.contentEl,6,17);});
        assert.deepEqual(await page.evaluate(()=>{const s=editorSelection(testNodes.target.contentEl);return {start:s.start,end:s.end,selected:s.text.slice(s.start,s.end)};}),{start:6,end:17,selected:'line\nSecond'});
        await openTextMenu();await page.keyboard.press('Escape');assert.equal(await page.locator('.mm-text-format-menu').count(),0);
        assert.equal(await page.evaluate(()=>testNodes.target.data.isEdit),true);
        await openTextMenu();await formatButton('italic').click();
        await page.waitForFunction(()=>testNodes.target.data.isEdit && testNodes.target.data.text==='First *line\nSecond* line\nThird line');
        await openTextMenu();await page.locator('.mm-text-custom-color input').evaluate(el=>{el.value='#00ffaa';el.dispatchEvent(new Event('change',{bubbles:true}));});
        await page.waitForFunction(()=>testNodes.target.data.isEdit && testNodes.target.data.text.includes('color:#00ffaa'));
        // No selection / IME retain native context behavior.
        await page.evaluate(()=>selectEditorOffsets(testNodes.target.contentEl,0,0));
        await page.locator('[data-id="member-2"] .mm-node-content').click({button:'right'});
        assert.equal(await page.locator('.mm-text-format-menu').count(),0);
        await page.evaluate(()=>{selectEditorOffsets(testNodes.target.contentEl,0,5);testMap.isComposing=true;});
        const imePosition=await page.evaluate(()=>{const b=getSelection().getRangeAt(0).getBoundingClientRect();return{x:b.x+2,y:b.y+2}});
        await page.mouse.click(imePosition.x,imePosition.y,{button:'right'});assert.equal(await page.locator('.mm-text-format-menu').count(),0);
        await page.evaluate(()=>{testMap.isComposing=false;testMap.finishEditingForHistory();const n=testMap.summaries.items[0].root;n.setText('Summary words');n.setPosition(220,160);testMap.setSelectedNodes([n]);n.edit();selectEditorOffsets(n.contentEl,0,7);});
        await openTextMenu();await formatButton('bold').click();
        await page.waitForFunction(()=>testMap.editNode?.data.summaryRoot && testMap.editNode.contentEl.innerText==='**Summary** words');
        assert.ok(await page.evaluate(()=>extractSummaries(testMap.getMarkdown()).entries.some(s=>s.root.text==='**Summary** words')));
        console.log('Text-format menu: native selection, Markdown emphasis, palette/custom/reset color, multiline offsets, save, undo/redo, Escape, IME and independent summary nodes passed.');
        assert.deepEqual(errors,[]);
        console.log('Summary release UI: single/overlapping ranges, editable child tree, Markdown, layout collision checks, parent folding, forest copy/paste remapping, atomic deletion and undo/redo passed.');
        console.log('Headless Chromium: marquee, parent/child filtering, batch clipboard, Delete, native batch drag/drop, right-button panning, text/image paste, native editor caret/word selection, unified draft undo/redo, unselected/body-focus undo and Ctrl+Z passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
