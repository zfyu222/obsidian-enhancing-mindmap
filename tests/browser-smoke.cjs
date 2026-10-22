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
const names = ['isSearchResultState','searchRequest','sourceNodeAtLine','sameSourceTree','resolveSearchNode','centerSearchNode','SearchNavigation','validateRelations','extractRelations','relationsMarkdown','relationCurve','RelationManager','renderDefaultNodeStyleSettings', 'normalizeNodeBoxStyle', 'renderNodeBoxControls', 'normalizeNodeStyle', 'effectiveNodeStyle', 'snapshotNodeStyle', 'validPresetName', 'normalizePresets', 'findPreset', 'renamePreset', 'styleMarker', 'readStyleMarker', 'applyNodeStyle', 'MindMapPanel', 'renderStylePresetSettings', 'renderPresetColorPicker', 'keepLastIndex', '__awaiter', 'uuid', 'selectionRoots', 'containsNode', 'selectionRect', 'intersectsRect', 'clipboardAction', 'serializeForest', 'parseSubtree', 'Command', 'StyleNodes', 'ChangeNodeStyle', 'Layout', 'AddNode', 'ChangeNodeText', 'RemoveNodes', 'MoveNodes', 'PasteNode', 'History', 'Exec', 'MindMap', 'MindMapToolbar', 'SummaryTransaction', 'SummaryManager', 'validateSummary', 'summaryMarkdown', 'extractSummaries', 'START', 'END', 'TextFormatMenu', 'formatSelection', 'applyEditorStyle', 'editorSelection', 'selectEditorOffsets'];
names.push('GraftManager','validateGrafts','extractGrafts','graftsMarkdown','validGraftGraph','CollapseNode','ExpandNode');
names.push('keywordMatches','keywordSpans','keywordTextColor','KeywordHighlighter');
const code = names.map(name => { assert.ok(definitions.has(name), name); return definitions.get(name); }).join('\n');
(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { channel: process.argv[3] } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent(`<style>${fs.readFileSync(`${repo}/styles.css`, 'utf8')}
          body{margin:0;font:16px system-ui;background:#20242c;color:white}h3{margin:16px}
          #viewport{position:relative;margin:16px;width:1050px;height:470px;overflow:auto;border:1px solid #657080}
          #map{position:relative;width:1200px;height:650px;background:#272d38}.mm-node{position:absolute}.mm-node-content{padding:12px 20px;background:#38485e;border-radius:8px}
          #status{margin:16px}</style><h3>Mind map batch selection — release bundle test harness</h3><div id="viewport"><div id="map"></div></div><div id="status"></div>`);
        await page.addScriptTag({ content: `(() => {
            ${code}
            const cmd = { AddNode, ChangeNodeText, RemoveNodes, MoveNodes, PasteNode, CollapseNode, ExpandNode };
            const randomColor = () => '#90a4bc';
            const t = text => text;
            const obsidian = { Notice: class { constructor(message) { window.lastNotice = message; } }, MarkdownRenderer: { renderMarkdown: async (text, element) => { element.textContent = text; } } };
            const MindMapView = class {};
            const ProdNode = ${Array.from(definitions.values()).find(text => text.includes('select(preserveSelection = false)'))};
            class Node {
                constructor(data, mindmap) {
                    this.data=data; this.mindmap=mindmap; this.children=[]; this.isExpand=true;
                    this.containEl=document.createElement('div'); this.containEl.className='mm-node';
                    this.containEl.setAttribute('data-id',data.id);this.containEl.tabIndex=-1;
                    this.contentEl=document.createElement('div');this.contentEl.className='mm-node-content';this.contentEl.textContent=data.text;this.containEl.append(this.contentEl);
                    this._barDom=document.createElement('div');this._barDom.className='mm-node-bar';this.containEl.append(this._barDom);
                    if(window.cachedGraftGeometry){
                        this.box={x:0,y:0,width:0,height:0};
                        for(const method of ['getBox','getCBox','getDomBox','refreshBox','setPosition','clearCacheData'])this[method]=ProdNode.prototype[method];
                    }
                }
                selectText(){ProdNode.prototype.selectText.call(this)}
                edit(){ProdNode.prototype.edit.call(this)} cancelEdit(){ProdNode.prototype.cancelEdit.call(this)}
                setText(text){ProdNode.prototype.setText.call(this,text)} parseText(){ProdNode.prototype.parseText.call(this)} _delay(){}
                isLeaf(){return this.children.length===0}
                getId(){return this.data.id} getData(){return JSON.parse(JSON.stringify(this.data))}
                select(preserve){ProdNode.prototype.select.call(this,preserve)} unSelect(){ProdNode.prototype.unSelect.call(this)}
                getBox(){return {x:parseFloat(this.containEl.style.left),y:parseFloat(this.containEl.style.top),width:this.containEl.offsetWidth,height:this.containEl.offsetHeight}}
                getCBox(){return this.getBox()} getPosition(){const b=this.getBox();return{x:b.x,y:b.y}}
                getChildren(){return this.children}getSiblings(){return this.parent?this.parent.children.filter(n=>n!==this):[]}
                getShowNodeList(){return ProdNode.prototype.getShowNodeList.call(this)} move(x,y){const p=this.getPosition();this.setPosition(p.x+x,p.y+y)}
                isShow(){return !this.isHide} clearCacheData(){} refreshBox(){}
                setPosition(x,y){this.containEl.style.left=x+'px';this.containEl.style.top=y+'px'}
                show(){this.isHide=false;this.containEl.style.display='block'} hide(){this.isHide=true;this.containEl.style.display='none'}
                expand(){ProdNode.prototype.expand.call(this)} collapse(){ProdNode.prototype.collapse.call(this)}
                getLevel(){return ProdNode.prototype.getLevel.call(this)}
                addChild(n,index=-1){ProdNode.prototype.addChild.call(this,n,index)} removeChild(n){return ProdNode.prototype.removeChild.call(this,n)}
            }
            const Node$1 = Node;
            Object.assign(window,{GraftManager,extractGrafts,validGraftGraph,KeywordHighlighter});
            window.makeGraftTestNode=(id,text,parent)=>{const n=new Node({id,text},testMap);n.setPosition(0,0);if(parent){parent.children.push(n);n.parent=parent;}testMap.appEl.append(n.containEl);n.refreshBox();return n;};
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
            Object.assign(window,{SearchNavigation,centerSearchNode,RelationManager,extractRelations,relationsMarkdown,relationCurve,Layout,SummaryManager,MindMap,MindMapToolbar,MindMapPanel,renderDefaultNodeStyleSettings,renderStylePresetSettings,extractSummaries,editorSelection,selectEditorOffsets,findPreset});
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
        // Hover feedback is lighter than selection and never changes node geometry.
        for (const theme of ['theme-light', 'theme-dark']) {
            await page.evaluate(theme => {
                document.body.className = theme;
                document.body.style.setProperty('--interactive-accent', '#5294e2');
            }, theme);
            const branch = page.locator('[data-id="Branch A"]');
            await page.mouse.move(20, 20);
            const before = await branch.boundingBox();
            await branch.hover();
            const hover = await branch.locator('.mm-node-content').evaluate(el => ({
                style: getComputedStyle(el).outlineStyle, color: getComputedStyle(el).outlineColor
            }));
            assert.equal(hover.style, 'solid');
            assert.match(hover.color, /(?:0\.4|40%)/);
            assert.deepEqual(await branch.boundingBox(), before);
            assert.deepEqual((await page.evaluate(() => snapshot())).selected, ['Root']);
            await page.mouse.move(20, 20);
            assert.equal(await branch.locator('.mm-node-content').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
            await branch.click();
            assert.equal(await branch.locator('.mm-node-content').evaluate(el => getComputedStyle(el).outlineColor), 'rgb(82, 148, 226)');
            await page.evaluate(() => testMap.setSelectedNodes([testMap.root]));
        }
        await page.locator('[data-id="Branch A"]').hover();
        await page.screenshot({ path: path.join(screenshotDir, 'node-hover.png') });
        await page.evaluate(() => { document.body.className = ''; });
        console.log('Node hover: light/dark theme, lighter outline, leave cleanup, selection priority and stable geometry passed.');
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
        // Moving horizontally above/below the editor must keep extending the selection.
        for (const side of [-1, 1]) {
            await page.evaluate(() => getSelection().removeAllRanges());
            const points = await page.evaluate(side => {
                const el = testNodes.target.contentEl, text = el.firstChild;
                const point = offset => { const r = document.createRange(); r.setStart(text, offset); r.collapse(true); const b = r.getBoundingClientRect(); return {x:b.left,y:(b.top+b.bottom)/2}; };
                const box = el.getBoundingClientRect();
                return {start:point(0), three:point(3), eight:point(8), outside:side < 0 ? box.top-25 : box.bottom+25};
            }, side);
            await page.mouse.move(points.start.x, points.start.y); await page.mouse.down();
            await page.mouse.move(points.three.x, points.three.y);
            await page.mouse.move(points.three.x, points.outside);
            await page.mouse.move(points.eight.x, points.outside, {steps:8});
            await page.waitForTimeout(40);
            assert.equal(await page.evaluate(() => getSelection().toString()), updated.slice(0,8), 'Horizontal drag outside editor must extend selection');
            await page.mouse.move(points.three.x, points.outside, {steps:8});
            await page.waitForTimeout(40);
            assert.equal(await page.evaluate(() => getSelection().toString()), updated.slice(0,3), 'Reverse drag outside editor must shrink selection');
            await page.mouse.up();
            assert.equal(await page.evaluate(() => testNodes.target.data.isEdit), true);
        }
        // Multi-line Chinese/emoji text, reverse selection, zoom and reentry into native selection.
        for (const scale of [0.75, 1.5]) {
            const points = await page.evaluate(scale => {
                const el=testNodes.target.contentEl;
                el.innerHTML='<span>第一行文字ABCDE</span><br><span>第二行😀FGHIJK</span>';
                testNodes.target.containEl.style.transform='scale('+scale+')';
                testNodes.target.containEl.style.transformOrigin='top left';
                getSelection().removeAllRanges();
                const point=(text,offset)=>{const r=document.createRange();r.setStart(text,offset);r.collapse(true);const b=r.getBoundingClientRect();return{x:b.left,y:(b.top+b.bottom)/2};};
                const first=el.firstChild.firstChild,last=el.lastChild.firstChild,box=el.getBoundingClientRect();
                const expected=document.createRange();expected.setStart(first,2);expected.setEnd(last,7);
                return{start:point(first,2),end:point(last,7),top:box.top-20,bottom:box.bottom+20,expected:(getSelection().addRange(expected),getSelection().toString())};
            },scale);
            await page.evaluate(()=>getSelection().removeAllRanges());
            if(scale===0.75) await page.evaluate(()=>Object.defineProperty(document,'caretPositionFromPoint',{value:undefined,configurable:true}));
            await page.mouse.move(points.start.x,points.start.y);await page.mouse.down();
            await page.mouse.move(points.end.x,points.bottom,{steps:10});
            await page.waitForTimeout(40);
            assert.equal(await page.evaluate(()=>getSelection().toString()),points.expected);
            await page.mouse.up();
            const selected=await page.evaluate(()=>getSelection().toString());
            await page.mouse.move(500,400);
            assert.equal(await page.evaluate(()=>getSelection().toString()),selected,'Release stops text selection');
            await page.evaluate(()=>getSelection().removeAllRanges());
            await page.mouse.move(points.end.x,points.end.y);await page.mouse.down();
            await page.mouse.move(points.start.x,points.top,{steps:10});
            await page.waitForTimeout(40);
            assert.equal(await page.evaluate(()=>getSelection().toString()),points.expected,'Backward multi-line drag');
            assert.equal(await page.evaluate(()=>getSelection().anchorNode===testNodes.target.contentEl.lastChild.firstChild),true);
            await page.mouse.move(points.start.x,points.start.y,{steps:4});
            await page.mouse.up();
            assert.equal(await page.evaluate(()=>getSelection().toString()),points.expected,'Reenter editor preserves native drag');
            await page.screenshot({path:path.join(screenshotDir,'editor-outside-text-selection.png')});
            await page.evaluate(()=>{delete document.caretPositionFromPoint;testNodes.target.containEl.style.transform='';});
        }
        await page.evaluate(text=>{testNodes.target.contentEl.textContent=text;getSelection().removeAllRanges();},updated);
        console.log('Outside editor drag: horizontal extension/shrink above and below, multiline Chinese/emoji, reverse direction, zoom, legacy caret API, reentry and release passed.');
        // Real text selection dragged out of the editor must keep its range and focus.
        for (const end of [{ x: 700, y: 420 }, { x: 300, y: 260 }]) {
            await page.evaluate(() => getSelection().removeAllRanges());
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
                line(x1,y1,x2,y2){return this.path('M '+x1+' '+y1+' L '+x2+' '+y2);},
                path(d){const path=document.createElementNS(svg.namespaceURI,'path');if(d)path.setAttribute('d',d);el.append(path);return {node:path,plot(v){path.setAttribute('d',v);return this},fill(v){path.setAttribute('fill',v);return this},stroke(v){path.setAttribute('stroke','#8f9baa');path.setAttribute('stroke-width',v.width);return this},addClass(v){path.classList.add(v);path.style.pointerEvents='stroke';return this}}}}};
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
        // Per-map inspector plus the actual settings editor, using the compiled code.
        await page.setViewportSize({width:1600,height:900});
        await page.evaluate(() => {
            testMap.finishEditingForHistory();
            testMap.setting.nodeStylePresets=[{name:'重点',color:'#e53935',fontSize:20,bold:true,italic:true}];
            const host=testMap.containerEL.parentElement;
            const body=document.createElement('div');body.className='mm-view-body';body.style.height='440px';
            host.appendChild(body);body.appendChild(testMap.containerEL);
            window.stylePanel=new MindMapPanel(testMap,body,()=>{window.manageClicked=true});
            testMap.view.panel=stylePanel;
            testMap.setSelectedNodes([testMap.root,testMap.summaries.items[0].root]);
            window.beforeStyleUndos=testMap.exec.history.undos.length;
        });
        const presetSelect=page.locator('.mm-side-panel select[aria-label="Node style preset"]');
        await presetSelect.selectOption('重点');

        assert.deepEqual(errors,[]);
        assert.equal(await page.evaluate(()=>testMap.exec.history.undos.length),await page.evaluate(()=>beforeStyleUndos+1));
        assert.equal(await page.evaluate(()=>testMap.summaries.items[0].root.data.stylePreset),'重点');
        assert.ok(await page.evaluate(()=>testMap.getMarkdown().includes('<!-- mm:style {"name":"重点"} -->')));
        assert.equal(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).color),'rgb(229, 57, 53)');
        assert.equal(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).fontStyle),'italic');
        assert.equal(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).fontSize),'20px');
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(()=>testMap.root.data.stylePreset),undefined);
        await page.evaluate(()=>testMap.redo());
        assert.equal(await presetSelect.inputValue(),'重点');
        await page.getByRole('button',{name:'Toggle mind map panel',exact:true}).click();
        assert.equal(await page.locator('.mm-side-panel').isVisible(),false);
        await page.getByRole('button',{name:'Toggle mind map panel',exact:true}).click();
        await page.getByRole('button',{name:'Manage style presets',exact:true}).click();
        assert.equal(await page.evaluate(()=>manageClicked),true);
        await page.evaluate(()=>{
            const settings=document.createElement('div');settings.id='preset-settings';
            settings.style.cssText='position:fixed;right:12px;top:12px;width:370px;height:820px;overflow:auto;background:#292d36;color:white;z-index:2000;padding:16px';
            document.body.appendChild(settings);
            window.stylePlugin={settings:{nodeStylePresets:testMap.setting.nodeStylePresets},saveSettings:async()=>{
                window.savedPresetData=JSON.stringify(stylePlugin.settings);
                testMap.setting.nodeStylePresets=stylePlugin.settings.nodeStylePresets;testMap.refreshNodeStyles();
            }};
            renderStylePresetSettings(settings,stylePlugin);
        });
        const settings=page.locator('#preset-settings');
        assert.equal(await settings.locator('.mm-preset-settings').evaluate(el=>el.open),false);
        assert.equal(await settings.getByLabel('Preset name',{exact:true}).isVisible(),false);
        await settings.locator('.mm-preset-settings > summary').click();
        assert.equal(await settings.getByLabel('Preset name',{exact:true}).isVisible(),false);
        await settings.locator('.mm-preset-card > summary').click();
        const presetSize=settings.getByLabel('Preset font size',{exact:true});
        assert.equal(await presetSize.getAttribute('placeholder'),'Default (16)');
        assert.equal(await settings.locator('.mm-preset-size-hint').textContent(),'Global default font size: 16 px');
        await presetSize.fill('');
        assert.equal(await settings.locator('.mm-preset-preview .mm-node-content').evaluate(el=>getComputedStyle(el).fontSize),'16px');
        await presetSize.fill('20');
        await page.screenshot({path:path.join(screenshotDir,'preset-default-font-size.png')});
        await settings.getByLabel('Preset name',{exact:true}).fill('结论');
        assert.equal(await settings.locator('input[type=text]').count(),1,'Only the preset name is a text field');
        await settings.getByRole('button',{name:'Blue',exact:true}).click();
        assert.equal(await settings.getByRole('button',{name:'Blue',exact:true}).getAttribute('aria-pressed'),'true');
        assert.equal(await settings.locator('.mm-preset-preview .mm-node-content').evaluate(el=>getComputedStyle(el).color),'rgb(30, 136, 229)');
        await settings.getByRole('button',{name:'Follow theme',exact:true}).click();
        assert.equal(await settings.getByRole('button',{name:'Follow theme',exact:true}).getAttribute('aria-pressed'),'true');
        assert.equal(await settings.locator('.mm-preset-preview').evaluate(el=>el.classList.contains('mm-preset-color')),false);
        const customPicker=settings.getByLabel('Custom text color',{exact:true});
        assert.equal(await customPicker.getAttribute('type'),'color');
        await customPicker.evaluate(el=>{el.value='#22aa88';el.dispatchEvent(new Event('input',{bubbles:true}));});
        assert.equal(await settings.getByRole('button',{name:'Follow theme',exact:true}).getAttribute('aria-pressed'),'false');
        await settings.getByLabel('Italic',{exact:true}).uncheck();
        await settings.getByLabel('Underline',{exact:true}).check();
        await settings.locator('.mm-box-controls summary').click();
        await settings.getByRole('combobox',{name:'Node shape',exact:true}).selectOption('rounded');
        await settings.getByRole('combobox',{name:'Border thickness',exact:true}).selectOption('2');
        assert.equal(await settings.locator('.mm-preset-preview .mm-node-content').evaluate(el=>getComputedStyle(el).borderTopWidth),'2px');
        await settings.locator('.mm-box-controls summary').click();

        await settings.getByRole('button',{name:'Save preset',exact:true}).click();
        assert.equal(await page.evaluate(()=>testMap.root.data.stylePreset),'重点','Existing notes keep the original name alias');
        assert.equal(await presetSelect.inputValue(),'结论');
        assert.equal(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).color),'rgb(34, 170, 136)');
        assert.equal(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).fontStyle),'normal');
        assert.equal(await page.evaluate(()=>JSON.parse(savedPresetData).nodeStylePresets[0].shape),'rounded');
        assert.equal(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).borderTopWidth),'2px');
        assert.match(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).textDecorationLine),/underline/);
        assert.ok(await page.evaluate(()=>JSON.parse(savedPresetData).nodeStylePresets[0].aliases.includes('重点')));
        await page.screenshot({path:path.join(screenshotDir,'style-color-picker.png')});
        // Invalid names cannot change the active preset; delete retains unresolved note references.
        await settings.getByLabel('Preset name',{exact:true}).fill('');
        await settings.getByRole('button',{name:'Save preset',exact:true}).click();
        assert.ok((await settings.locator('[role=alert]').textContent()).length);
        assert.equal(await page.evaluate(()=>stylePlugin.settings.nodeStylePresets[0].name),'结论');
        await settings.getByLabel('Preset name',{exact:true}).fill('结论');
        await settings.getByRole('button',{name:'Follow theme',exact:true}).click();
        await settings.getByRole('button',{name:'Save preset',exact:true}).click();
        assert.equal(await page.evaluate(()=>stylePlugin.settings.nodeStylePresets[0].color),'');
        assert.equal(await page.evaluate(()=>testMap.root.containEl.classList.contains('mm-preset-color')),false);
        await settings.getByRole('button',{name:'Delete preset',exact:true}).click();
        assert.equal(await page.evaluate(()=>testMap.root.data.stylePreset),'重点');
        assert.equal(await presetSelect.locator('option:checked').textContent(),'Missing preset: 重点');
        await page.evaluate(()=>stylePlugin.settings.fontSize=18);
        await settings.getByRole('button',{name:'Add style preset',exact:true}).click();
        assert.equal(await settings.getByLabel('Preset font size',{exact:true}).getAttribute('placeholder'),'Default (18)');
        assert.equal(await settings.getByLabel('Preset font size',{exact:true}).inputValue(),'');
        assert.equal(await settings.locator('.mm-preset-card').count(),1);
        assert.equal(await settings.locator('.mm-preset-card').evaluate(el=>el.open),true);
        await settings.locator('.mm-preset-settings > summary').click();
        assert.equal(await settings.getByLabel('Preset name',{exact:true}).isVisible(),false);
        await page.screenshot({path:path.join(screenshotDir,'style-settings-collapsed.png')});
        await settings.evaluate(el=>el.remove());
        await page.screenshot({path:path.join(screenshotDir,'style-panel.png')});
        await presetSelect.selectOption('');
        assert.equal(await page.evaluate(()=>testMap.root.data.stylePreset),undefined);
        await page.evaluate(()=>testMap.undo());
        assert.equal(await page.evaluate(()=>testMap.root.data.stylePreset),'重点');
        // Shared sidebar controls target nodes, or a preserved range in a node editor.
        const inspector=page.locator('.mm-side-panel');
        await page.evaluate(()=>{testMap.setSelectedNodes([testMap.root]);delete testMap.root.data.nodeStyle;testMap.refreshNodeStyles();});
        const sidebarSize=inspector.getByLabel('Font size',{exact:true});
        assert.equal(await sidebarSize.inputValue(),'');
        assert.equal(await sidebarSize.getAttribute('placeholder'),'Default (16)');
        await page.evaluate(()=>{testMap.root.containEl.classList.add('mm-root');testMap.emit('toolbarChange');});
        assert.equal(await sidebarSize.getAttribute('placeholder'),'Default (25.6)','Default includes the root node size multiplier');
        await page.evaluate(()=>{testMap.setSelectedNodes([testMap.root,testMap.summaries.items[0].root]);});
        assert.equal(await sidebarSize.getAttribute('placeholder'),'Mixed font sizes');
        await page.evaluate(()=>{testMap.root.containEl.classList.remove('mm-root');testMap.setSelectedNodes([testMap.root]);});
        assert.equal(await sidebarSize.getAttribute('title'),'Current font size: 16 px');
        await inspector.getByRole('button',{name:'Red',exact:true}).click();
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle.color),'#e53935');
        await inspector.getByRole('button',{name:'Bold',exact:true}).click();
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle.bold),true);
        assert.equal(await inspector.getByRole('button',{name:'Apply font size',exact:true}).count(),0);
        const beforeSizeHistory=await page.evaluate(()=>testMap.exec.history.undos.length);
        await inspector.getByLabel('Font size',{exact:true}).fill('21');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle.fontSize),undefined);
        await inspector.getByLabel('Font size',{exact:true}).fill('22');
        await page.waitForFunction(()=>testMap.root.data.nodeStyle?.fontSize===22);
        assert.equal(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).fontSize),'22px');
        assert.equal(await page.evaluate(()=>testMap.exec.history.undos.length),beforeSizeHistory+1);
        assert.equal(await sidebarSize.evaluate(el=>el===document.activeElement),true,'Auto-apply keeps the number field focused');
        await sidebarSize.fill('');
        await page.waitForFunction(()=>testMap.root.data.nodeStyle?.fontSize===null);
        assert.equal(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).fontSize),'16px');
        await sidebarSize.fill('22');await page.waitForFunction(()=>testMap.root.data.nodeStyle?.fontSize===22);
        // Changing the selected node cancels the pending size rather than changing its new target.
        await sidebarSize.fill('23');
        await page.evaluate(()=>testMap.setSelectedNodes([testMap.root.children[0]]));
        await page.waitForTimeout(550);
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle.fontSize),22);
        assert.equal(await page.evaluate(()=>testMap.root.children[0].data.nodeStyle?.fontSize),undefined);
        await page.evaluate(()=>testMap.setSelectedNodes([testMap.root]));
        await sidebarSize.fill('999');await page.waitForTimeout(550);
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle.fontSize),22);
        await sidebarSize.fill('22');

        // Save the effective node style, including overrides, as a reusable named preset.
        await page.evaluate(()=>{testMap.view.plugin=stylePlugin;testMap.emit('toolbarChange');});
        const saveNodePreset=inspector.getByRole('button',{name:'Save node style as preset',exact:true});
        await saveNodePreset.click();
        const presetForm=inspector.locator('.mm-panel-save-preset');
        await presetForm.getByLabel('New preset name',{exact:true}).fill('New style 1');
        await presetForm.getByRole('button',{name:'Save preset',exact:true}).click();
        assert.ok((await presetForm.locator('[role=alert]').textContent()).length,'Duplicate names cannot replace existing presets');
        await presetForm.getByLabel('New preset name',{exact:true}).fill('Saved node style');
        await page.screenshot({path:path.join(screenshotDir,'save-node-style-preset.png')});
        await presetForm.getByRole('button',{name:'Save preset',exact:true}).click();
        await page.waitForFunction(()=>testMap.root.data.stylePreset==='Saved node style');
        assert.equal(await presetForm.isVisible(),false);
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle),undefined);
        assert.equal(await page.evaluate(()=>stylePlugin.settings.nodeStylePresets.find(p=>p.name==='Saved node style').color),'#e53935');
        assert.equal(await page.evaluate(()=>stylePlugin.settings.nodeStylePresets.find(p=>p.name==='Saved node style').fontSize),22);
        assert.equal(await page.evaluate(()=>stylePlugin.settings.nodeStylePresets.find(p=>p.name==='Saved node style').bold),true);
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle.fontSize),22);
        assert.equal(await page.evaluate(()=>testMap.root.data.stylePreset),'重点');
        await saveNodePreset.click();
        await presetForm.getByRole('button',{name:'Cancel saving preset',exact:true}).click();
        assert.equal(await presetForm.isVisible(),false);
        await page.evaluate(()=>testMap.setSelectedNodes([testMap.root,testMap.summaries.items[0].root]));
        assert.equal(await saveNodePreset.isDisabled(),true);
        await page.evaluate(()=>testMap.setSelectedNodes([testMap.root]));
        await inspector.getByRole('button',{name:'Clear local node style',exact:true}).click();
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle),undefined);
        await page.evaluate(()=>{testMap.root.setText('Before selected after');testMap.root.edit();selectEditorOffsets(testMap.root.contentEl,7,15);});
        await page.waitForFunction(()=>document.querySelector('.mm-panel-style-heading').textContent==='Selected text style');
        assert.equal(await inspector.locator('.mm-box-controls').isVisible(),false);
        await sidebarSize.fill('18');
        await page.evaluate(()=>{testMap.root.contentEl.focus();selectEditorOffsets(testMap.root.contentEl,0,6);});
        await page.waitForTimeout(550);
        assert.ok(!(await page.evaluate(()=>testMap.root.data.text)).includes('font-size:18px'),'Changing the text range cancels the old pending value');
        await page.evaluate(()=>selectEditorOffsets(testMap.root.contentEl,7,15));
        assert.equal(await sidebarSize.getAttribute('placeholder'),'Default (16)','Text without explicit size shows its inherited size');
        assert.equal(await presetSelect.isVisible(),false,'Node presets are unavailable for selected text');
        assert.equal(await saveNodePreset.isVisible(),false);
        await inspector.getByRole('button',{name:'Blue',exact:true}).click();
        await page.waitForFunction(()=>testMap.root.data.isEdit && testMap.root.data.text.includes('color:#1e88e5'));
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle),undefined);
        assert.equal(await page.evaluate(()=>testMap.root.data.stylePreset),'重点');
        await inspector.getByLabel('Font size',{exact:true}).fill('19');
        await page.waitForFunction(()=>testMap.root.data.isEdit && testMap.root.data.text.includes('font-size:19px'));
        await page.waitForFunction(()=>testMap.root.data.isEdit && testMap.root.data.text.includes('font-size:19px'));
        const sidebarPicker=inspector.getByLabel('Custom text color',{exact:true});
        const beforeCustom=await page.evaluate(()=>testMap.root.data.text);
        await sidebarPicker.evaluate(el=>{el.value='#ab1234';el.dispatchEvent(new Event('input',{bubbles:true}));});
        assert.equal(await page.evaluate(()=>testMap.root.data.text),beforeCustom,'Dragging the native palette does not create history entries');
        await sidebarPicker.evaluate(el=>el.dispatchEvent(new Event('change',{bubbles:true})));
        await page.waitForFunction(()=>testMap.root.data.isEdit && testMap.root.data.text.includes('color:#ab1234'));
        await inspector.getByRole('button',{name:'Underline',exact:true}).click();
        await page.waitForFunction(()=>testMap.root.data.isEdit && testMap.root.data.text.includes('<u>selected</u>'));
        assert.ok((await page.evaluate(()=>testMap.root.data.text)).startsWith('Before '));
        assert.ok((await page.evaluate(()=>testMap.root.data.text)).endsWith(' after'));
        assert.equal(await presetSelect.isVisible(),false);
        await page.screenshot({path:path.join(screenshotDir,'sidebar-text-style.png')});
        await page.keyboard.press('Control+z');
        assert.ok(!(await page.evaluate(()=>testMap.root.data.text)).includes('<u>'));
        await page.keyboard.press('Control+y');
        assert.ok((await page.evaluate(()=>testMap.root.data.text)).includes('<u>'));
        await page.evaluate(()=>{testMap.finishEditingForHistory();testMap.setSelectedNodes([testMap.root]);});
        await page.waitForFunction(()=>document.querySelector('.mm-panel-style-heading').textContent==='Node style');
        assert.equal(await presetSelect.isVisible(),true);
        await page.screenshot({path:path.join(screenshotDir,'sidebar-node-style.png')});

        await inspector.locator('.mm-box-controls summary').click();
        await inspector.getByRole('combobox',{name:'Node shape',exact:true}).selectOption('pill');
        await inspector.getByRole('combobox',{name:'Border thickness',exact:true}).selectOption('3');
        await inspector.getByLabel('Border color',{exact:true}).evaluate(el=>{el.value='#123456';el.dispatchEvent(new Event('change',{bubbles:true}));});
        await inspector.getByLabel('Fill color',{exact:true}).evaluate(el=>{el.value='#eeeeee';el.dispatchEvent(new Event('change',{bubbles:true}));});
        const boxCss=await page.evaluate(()=>{const css=getComputedStyle(testMap.root.contentEl);return {width:css.borderTopWidth,radius:css.borderTopLeftRadius,fill:css.backgroundColor};});
        assert.deepEqual(boxCss,{width:'3px',radius:'999px',fill:'rgb(238, 238, 238)'});
        await page.screenshot({path:path.join(screenshotDir,'basic-node-border.png')});
        await page.evaluate(()=>testMap.undo());
        assert.notEqual(await page.evaluate(()=>testMap.root.data.nodeStyle.backgroundColor),'#eeeeee');
        await page.evaluate(()=>testMap.redo());
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle.backgroundColor),'#eeeeee');
        await inspector.getByRole('button',{name:'Transparent',exact:true}).click();
        assert.equal(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).backgroundColor),'rgba(0, 0, 0, 0)');
        await inspector.getByRole('combobox',{name:'Node shape',exact:true}).selectOption('none');
        assert.equal(await page.evaluate(()=>getComputedStyle(testMap.root.contentEl).borderTopWidth),'0px');
        const beforeDestroySize=await page.evaluate(()=>testMap.root.data.nodeStyle?.fontSize);
        await sidebarSize.fill('31');
        await page.evaluate(()=>{stylePanel.destroy();testMap.view.panel=null;});
        await page.waitForTimeout(550);
        assert.equal(await page.evaluate(()=>testMap.root.data.nodeStyle?.fontSize),beforeDestroySize);
        assert.equal(await page.locator('.mm-side-panel').count(),0);
        await page.setViewportSize({width:390,height:844});
        await page.evaluate(()=>{
            window.mobilePanel = new MindMapPanel(testMap, document.querySelector('#viewport'), ()=>{}, true);
            testMap.setSelectedNodes([testMap.root]);
        });
        assert.equal(await inspector.isVisible(),false);
        await page.evaluate(()=>testMap.root.contentEl.click());
        assert.equal(await inspector.isVisible(),true);
        assert.equal(await inspector.evaluate(el=>getComputedStyle(el).position),'absolute');
        await page.getByRole('button',{name:'Close mind map panel',exact:true}).click();
        assert.equal(await inspector.isVisible(),false);
        await page.evaluate(()=>testMap.root.contentEl.click());
        assert.equal(await inspector.isVisible(),true);
        await page.evaluate(()=>testMap.appEl.click());
        assert.equal(await inspector.isVisible(),false);
        await page.evaluate(()=>mobilePanel.destroy());
        await page.setViewportSize({width:1200,height:900});

        await page.evaluate(()=>{
            const branch=testMap.root.children[0];
            branch.setText('Ordinary styled branch');
            testMap.setting.nodeStylePresets=[{name:'条件',color:'#43a047',fontSize:15,bold:true}];
            testMap.setSelectedNodes([branch]);
            const previous=testMap.refresh.bind(testMap);
            testMap.refresh=()=>{for(const n of testMap.root.children) Layout.prototype._setDirect.call(Layout.prototype,n,'right');previous();};
            testMap.applyStylePreset('条件');
            testMap.refresh();testMap.refresh();
            window.styledBranch=branch;
        });
        assert.equal(await page.evaluate(()=>getComputedStyle(styledBranch.contentEl).color),'rgb(67, 160, 71)');
        assert.equal(await page.evaluate(()=>getComputedStyle(styledBranch.contentEl).fontSize),'15px');
        assert.equal(await page.evaluate(()=>getComputedStyle(styledBranch.contentEl).fontWeight),'700');
        assert.ok(await page.evaluate(()=>styledBranch.containEl.classList.contains('mm-node-select')));
        await page.evaluate(()=>testMap.undo());
        assert.equal(await page.evaluate(()=>styledBranch.data.stylePreset),undefined);
        await page.evaluate(()=>testMap.redo());
        assert.equal(await page.evaluate(()=>getComputedStyle(styledBranch.contentEl).color),'rgb(67, 160, 71)');
        await page.screenshot({path:path.join(screenshotDir,'style-branch-layout.png')});
        console.log('Style presets: settings save/rename/delete, alias references, live rendering, summary nodes, batch undo/redo, inspector toggle and cleanup passed.');
        // Defaults are global fallbacks, with a persisted editor and explicit reset.
        await page.evaluate(()=>{
            const host=document.createElement('div');host.id='default-style-settings';
            host.style.cssText='position:fixed;right:12px;top:12px;width:370px;max-height:820px;overflow:auto;background:#292d36;color:white;z-index:2000;padding:16px';document.body.appendChild(host);
            window.defaultPlugin={settings:{defaultNodeStyle:{}},saveSettings:async()=>{
                if(defaultPlugin.fail)throw new Error('save failed');
                window.savedDefault=JSON.stringify(defaultPlugin.settings.defaultNodeStyle);
                testMap.setting.defaultNodeStyle=defaultPlugin.settings.defaultNodeStyle;testMap.refreshNodeStyles();
            }};
            renderDefaultNodeStyleSettings(host,defaultPlugin);
        });
        const defaults=page.locator('#default-style-settings');
        await defaults.locator('.mm-default-style > summary').click();
        await defaults.getByRole('combobox',{name:'Node shape',exact:true}).selectOption('rounded');
        await defaults.getByRole('combobox',{name:'Border thickness',exact:true}).selectOption('2');
        await defaults.getByLabel('Fill color',{exact:true}).evaluate(el=>{el.value='#ddeeff';el.dispatchEvent(new Event('change',{bubbles:true}));});
        assert.equal(await defaults.locator('.mm-node-content').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(221, 238, 255)');

        await defaults.getByRole('button',{name:'Blue',exact:true}).click();
        await defaults.getByLabel('Font size',{exact:true}).fill('19');
        for (const label of ['Bold','Italic','Underline','Strikethrough']) await defaults.getByLabel(label,{exact:true}).check();
        const previewText=await defaults.locator('.mm-node-content').evaluate(el=>{const c=getComputedStyle(el);return {color:c.color,size:c.fontSize,weight:c.fontWeight,italic:c.fontStyle,decoration:c.textDecorationLine};});
        assert.equal(previewText.color,'rgb(30, 136, 229)');assert.equal(previewText.size,'19px');assert.equal(previewText.weight,'700');assert.equal(previewText.italic,'italic');assert.match(previewText.decoration,/underline/);assert.match(previewText.decoration,/line-through/);
        await defaults.getByLabel('Font size',{exact:true}).fill('99');
        await defaults.getByRole('button',{name:'Save default node style',exact:true}).click();
        assert.equal(await defaults.locator('[role=alert]').textContent(),'Invalid preset values');
        assert.equal(await page.evaluate(()=>window.savedDefault),undefined);
        await defaults.getByLabel('Font size',{exact:true}).fill('19');
        const beforeDefaults=await page.evaluate(()=>({md:testMap.getMarkdown(),history:testMap.exec.history.undos.length}));
        await defaults.getByRole('button',{name:'Save default node style',exact:true}).click();
        assert.equal(await page.evaluate(()=>JSON.parse(savedDefault).backgroundColor),'#ddeeff');
        assert.equal(await page.evaluate(()=>getComputedStyle(styledBranch.contentEl).fontStyle),'italic');
        await page.screenshot({path:path.join(screenshotDir,'default-node-text-style.png')});
        assert.equal(await page.evaluate(()=>getComputedStyle(styledBranch.contentEl).backgroundColor),'rgb(221, 238, 255)');
        assert.deepEqual(await page.evaluate(()=>({md:testMap.getMarkdown(),history:testMap.exec.history.undos.length})),beforeDefaults);
        await page.evaluate(()=>{const host=document.querySelector('#default-style-settings');host.textContent='';renderDefaultNodeStyleSettings(host,defaultPlugin);});
        await defaults.locator('.mm-default-style > summary').click();
        assert.equal(await defaults.getByLabel('Fill color',{exact:true}).inputValue(),'#ddeeff');
        assert.equal(await defaults.getByLabel('Font size',{exact:true}).inputValue(),'19');
        assert.equal(await defaults.getByLabel('Bold',{exact:true}).isChecked(),true);
        assert.equal(await page.evaluate(()=>testMap.root.containEl.style.getPropertyValue('--mm-preset-color')),'#1e88e5');
        assert.equal(await page.evaluate(()=>JSON.parse(savedDefault).italic),true);
        await defaults.getByLabel('Font size',{exact:true}).fill('');
        await defaults.getByRole('button',{name:'Follow theme',exact:true}).first().click();
        for (const label of ['Bold','Italic','Underline','Strikethrough']) await defaults.getByLabel(label,{exact:true}).uncheck();

        await page.evaluate(()=>{testMap.setSelectedNodes([styledBranch]);testMap.applyLocalNodeStyle({backgroundColor:'#aabbcc'});});
        await defaults.getByLabel('Fill color',{exact:true}).evaluate(el=>{el.value='#eeeeee';el.dispatchEvent(new Event('change',{bubbles:true}));});
        await defaults.getByRole('button',{name:'Save default node style',exact:true}).click();
        assert.equal(await page.evaluate(()=>getComputedStyle(styledBranch.contentEl).backgroundColor),'rgb(170, 187, 204)');
        await page.evaluate(()=>testMap.undo());
        assert.equal(await page.evaluate(()=>getComputedStyle(styledBranch.contentEl).backgroundColor),'rgb(238, 238, 238)');
        await page.evaluate(()=>styledBranch.setText('Default style inherited'));
        assert.equal(await page.evaluate(()=>getComputedStyle(styledBranch.contentEl).borderTopWidth),'2px');
        await page.screenshot({path:path.join(screenshotDir,'default-node-style.png')});
        await page.evaluate(()=>defaultPlugin.fail=true);
        await defaults.getByRole('button',{name:'Restore original node style',exact:true}).click();
        assert.equal(await defaults.locator('[role=alert]').textContent(),'Unable to save presets');
        assert.equal(await page.evaluate(()=>defaultPlugin.settings.defaultNodeStyle.backgroundColor),'#eeeeee');
        await page.evaluate(()=>defaultPlugin.fail=false);
        await defaults.getByRole('button',{name:'Restore original node style',exact:true}).click();
        assert.deepEqual(await page.evaluate(()=>JSON.parse(savedDefault)),{});
        assert.equal(await page.evaluate(()=>styledBranch.containEl.classList.contains('mm-box-border')),false);
        assert.equal(await defaults.getByLabel('Font size',{exact:true}).inputValue(),'');
        assert.equal(await defaults.getByLabel('Bold',{exact:true}).isChecked(),false);
        console.log('Default node styles: preview, persistence, global fallback, explicit override, undo inheritance, renderer, failed save and reset passed.');

        // Actual release relation manager, toolbar and DOM events.
        await page.setViewportSize({width:1600,height:900});
        await page.evaluate(()=>{
            document.querySelector('#default-style-settings')?.remove();
            testMap.finishEditingForHistory();testMap.relations=new RelationManager(testMap);
            const previous=testMap.refresh.bind(testMap);testMap.refresh=()=>{previous();testMap.relations.render();};
            testMap.containerEL.scrollLeft=0;testMap.containerEL.scrollTop=0;
            const a=testMap.root.children[0],b=testMap.root.children[1];window.relationEndpoints=[a,b];
            a.setPosition(200,110);b.setPosition(560,310);testMap.setSelectedNodes([a,b]);
        });
        const addRelation=page.getByRole('button',{name:'Add relation line',exact:true});
        const removeRelation=page.getByRole('button',{name:'Delete relation line',exact:true});
        await addRelation.click();
        assert.equal(await page.locator('.mm-relation').count(),1);
        assert.equal(await page.locator('.mm-relation-arrow').count(),1);
        const initialRelationPath=await page.locator('.mm-relation-line').getAttribute('d');
        await page.evaluate(()=>{relationEndpoints[1].setPosition(670,380);testMap.relations.render();});
        assert.notEqual(await page.locator('.mm-relation-line').getAttribute('d'),initialRelationPath);
        await page.screenshot({path:path.join(screenshotDir,'node-relation-line.png')});
        await page.evaluate(()=>{relationEndpoints[1].hide();testMap.relations.render();});
        assert.equal(await page.locator('.mm-relation').count(),0);
        await page.evaluate(()=>{relationEndpoints[1].show();testMap.relations.render();});
        assert.equal(await page.locator('.mm-relation').count(),1);
        await page.evaluate(()=>{testMap.root.collapse();testMap.relations.render();});
        assert.equal(await page.locator('.mm-relation').count(),0);
        await page.evaluate(()=>{testMap.root.expand();testMap.relations.render();});
        assert.equal(await page.locator('.mm-relation').count(),1);
        const hit=page.locator('.mm-relation-hit');
        const point=await hit.evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()/2);const q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};});
        await page.mouse.click(point.x,point.y);
        assert.equal(await page.locator('.mm-relation.is-selected').count(),1);
        await removeRelation.click();assert.equal(await page.locator('.mm-relation').count(),0);
        await page.keyboard.press('Control+z');assert.equal(await page.locator('.mm-relation').count(),1);
        await page.keyboard.press('Control+y');assert.equal(await page.locator('.mm-relation').count(),0);
        await page.evaluate(()=>testMap.setSelectedNodes([relationEndpoints[0]]));
        await addRelation.click();assert.equal(await addRelation.getAttribute('aria-pressed'),'true');
        await page.locator('[data-id="'+await page.evaluate(()=>relationEndpoints[1].getId())+'"] .mm-node-content').click();
        assert.equal(await page.locator('.mm-relation').count(),1);
        assert.equal(await addRelation.getAttribute('aria-pressed'),'false');
        await page.evaluate(()=>testMap.setSelectedNodes([relationEndpoints[0]]));
        await addRelation.click();await page.keyboard.press('Escape');
        assert.equal(await addRelation.getAttribute('aria-pressed'),'false');
        await addRelation.click();await page.evaluate(()=>testMap.appEl.click());
        assert.equal(await addRelation.getAttribute('aria-pressed'),'false');
        const persistedLinks=await page.evaluate(()=>extractRelations(testMap.getMarkdown()).entries);
        await page.evaluate(links=>{testMap.relations.clear();testMap.relations.load(links);},persistedLinks);
        assert.equal(await page.locator('.mm-relation').count(),1);
        const nodeCountBeforeLineKey=await page.evaluate(()=>{testMap.setSelectedNodes([relationEndpoints[0]]);return testMap.root.children.length;});
        await page.locator('.mm-relation-hit').focus();await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(()=>testMap.root.children.length),nodeCountBeforeLineKey);
        await page.keyboard.press('Delete');
        assert.equal(await page.locator('.mm-relation').count(),0);
        await page.keyboard.press('Control+z');assert.equal(await page.locator('.mm-relation').count(),1);
        console.log('Relation lines: actual toolbar, sequential node clicks, arrow, movement, folding, native hit selection, deletion, undo/redo, cancellation and saved metadata reload passed.');

        // Core Search's real eState.match shape drives the compiled navigation code.
        const searchSource='# Search map\n- Parent ^folded\n  - Same keyword\n    continuation needle\n- Same keyword';
        const searchParser=require('./search-test-helpers.cjs').parsingView();
        const searchParsed=searchParser.mdToData(searchSource,true);
        await page.evaluate(({raw,parsed})=>{
            const viewport=document.createElement('div');viewport.id='search-viewport';viewport.style.cssText='position:fixed;left:30px;top:80px;width:1000px;height:650px;overflow:auto;background:#252a33;z-index:3000';document.body.appendChild(viewport);
            const canvas=document.createElement('div');canvas.style.cssText='position:relative;width:6000px;height:6000px;transform:scale(1.5);transform-origin:1800px 1500px';viewport.appendChild(canvas);
            const map=Object.create(MindMap.prototype);Object.assign(map,{appEl:canvas,contentEL:canvas,containerEL:viewport,selectedNodes:[],setting:{headLevel:1},mindScale:150,isComposing:false,_menuDom:{style:{}},exec:{history:{undos:[],redos:[]}},emit(){}});
            let count=0;
            const make=(data,parent)=>{
                const el=document.createElement('div');el.className='mm-node';el.tabIndex=-1;el.dataset.id=data.id;el.textContent=data.text;
                el.style.cssText='position:absolute;padding:12px 20px;background:#465777;border-radius:8px;white-space:pre;left:'+(1500+count*160)+'px;top:'+(1100+count++*100)+'px';canvas.appendChild(el);
                const n={data:{...data},parent,containEl:el,children:[],isExpand:data.expanded!==false,getId(){return this.data.id},expand(){this.isExpand=true},select(){el.focus({preventScroll:true})},unSelect(){el.classList.remove('mm-node-select')}};n.children=data.children.map(d=>make(d,n));return n;
            };
            map.root=make(parsed);
            map.refresh=()=>{const visit=(node,visible)=>{node.containEl.style.display=visible?'block':'none';node.children.forEach(child=>visit(child,visible&&node.isExpand));};visit(map.root,true);};map.refresh();
            window.searchView={data:raw,file:{path:'search.md'},searchReady:false,mindmap:map,getMdText:text=>text.trim(),mdToData:()=>JSON.parse(JSON.stringify(parsed))};
            window.searchNav=new SearchNavigation(searchView);window.searchMap=map;
            const start=raw.indexOf('continuation needle');searchNav.receive({match:{content:raw,matches:[[start,start+19]]}});
        },{raw:searchSource,parsed:searchParsed});
        assert.equal(await page.evaluate(()=>searchMap.selectedNodes.length),0);
        await page.evaluate(()=>{searchView.searchReady=true;searchNav.flush();});
        await page.waitForTimeout(160);
        assert.equal(await page.evaluate(()=>searchMap.selectNode===searchMap.root.children[0].children[0]),true);
        assert.equal(await page.evaluate(()=>searchMap.root.children[0].isExpand),true);
        const centerDelta=await page.evaluate(()=>{const v=searchMap.containerEL,b=v.getBoundingClientRect(),n=searchMap.selectNode.containEl.getBoundingClientRect();return{x:n.left+n.width/2-b.left-v.clientWidth/2,y:n.top+n.height/2-b.top-v.clientHeight/2};});
        assert.ok(Math.abs(centerDelta.x)<2&&Math.abs(centerDelta.y)<2,JSON.stringify(centerDelta));
        assert.equal(await page.evaluate(()=>searchMap.mindScale),150);
        await page.screenshot({path:path.join(screenshotDir,'search-result-centered-node.png')});
        await page.evaluate(()=>{const raw=searchView.data,start=raw.lastIndexOf('Same keyword');searchNav.receive({match:{content:raw,matches:[[start,start+12]]}});});
        assert.equal(await page.evaluate(()=>searchMap.selectNode===searchMap.root.children[1]),true);
        const panned=await page.evaluate(()=>{searchMap.appEl.dispatchEvent(new Event('pointerdown',{bubbles:true}));searchMap.containerEL.scrollLeft+=75;return searchMap.containerEL.scrollLeft;});
        await page.waitForTimeout(450);
        assert.equal(await page.evaluate(()=>searchMap.containerEL.scrollLeft),panned);
        assert.equal(await page.evaluate(()=>searchMap.exec.history.undos.length),0);
        await page.evaluate(()=>{searchNav.clear();document.querySelector('#search-viewport').remove();});
        console.log('Search navigation: real search payload, render queue, duplicate nodes, folded ancestors, selection, exact visual center at 150% zoom, latest result and manual pan cancellation passed.');
        // Virtual branches use the production layout, manager, editor, toolbar and graph history.
        await page.evaluate(()=>{
            const map=testMap;map.finishEditingForHistory();map.summaries.clear();map.relations.clear();
            map.traverseDF(n=>{if(n!==map.root)n.containEl.remove();});map.root.children=[];
            map.root.data.text='虚拟分支';map.root.contentEl.textContent='虚拟分支';map.root.setPosition(100,350);
            map.setting.layoutDirect='right';map.setting.headLevel=1;map.setting.defaultNodeStyle={};map.setting.nodeStylePresets=[];
            map.mmLayout=null;map.centerOnNode=()=>{};map.refresh=MindMap.prototype.refresh;map.addNode=MindMap.prototype.addNode;map.grafts=new GraftManager(map);
            map._nodeNum=0;map._tempNum=0;map.on('initNode',map.initNode.bind(map));map.on('renderEditNode',map.renderEditNode.bind(map));
            const a=makeGraftTestNode('graft-a','来源 A',map.root),a1=makeGraftTestNode('graft-a1','共享内容',a);
            const b=makeGraftTestNode('graft-b','挂接 B',map.root),c=makeGraftTestNode('graft-c','挂接 C',map.root);
            window.graftTest={a,a1,b,c};map.exec.history.clear();map.refresh();map.setSelectedNodes([a]);
        });
        const graft=page.getByRole('button',{name:'Graft virtual branch',exact:true});
        const detach=page.getByRole('button',{name:'Detach virtual branch',exact:true});
        await graft.click();
        await page.locator('[data-id="graft-b"] .mm-node-content').click();
        assert.equal(await page.evaluate(()=>testMap.grafts.items.length),1);
        assert.equal(await page.evaluate(()=>graftTest.b.children.length),0);
        await page.evaluate(()=>testMap.setSelectedNodes([graftTest.a]));await graft.click();
        await page.locator('[data-id="graft-c"] .mm-node-content').click();
        assert.equal(await page.locator('.mm-virtual-node').count(),4);
        assert.equal(await page.locator('.mm-graft-source-line').count(),2,'Only virtual roots have source links');
        const sourceLineStyle=await page.locator('.mm-graft-source-line').first().evaluate(el=>{const s=getComputedStyle(el);return{color:s.stroke,dash:s.strokeDasharray,pointer:s.pointerEvents};});
        assert.equal(sourceLineStyle.color,'rgb(233, 213, 138)');assert.notEqual(sourceLineStyle.dash,'none');assert.equal(sourceLineStyle.pointer,'none');
        assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('.mm-graft-source-line')).every(path=>{
            const mirror=testMap.getNodeById(path.getAttribute('data-virtual-id')),source=mirror.virtualSource;
            return path.getAttribute('data-source-id')===source.getId()&&path.getAttribute('d')===relationCurve(mirror.getBox(),source.getBox()).path;
        })),true,'Source links attach to the matching original node');
        const previousSourcePath=await page.locator('.mm-graft-source-line').first().getAttribute('d');
        await page.evaluate(()=>testMap.execute('moveNodes',{nodes:[graftTest.a],dropNode:graftTest.c,type:'child-right'}));
        assert.notEqual(await page.locator('.mm-graft-source-line').first().getAttribute('d'),previousSourcePath,'Moving the source updates the path');
        await page.keyboard.press('Control+z');
        const mirror=page.locator('.mm-virtual-node .mm-node-content').filter({hasText:'共享内容'}).first();
        console.log('Virtual branches: two references mounted; editing shared child.');
        await mirror.dblclick();await page.keyboard.press('Control+a');await page.keyboard.type('同步修改');
        assert.equal(await page.locator('[data-id="graft-a1"] .mm-node-content').innerText(),'同步修改','Typing previews the source without duplicating Markdown');
        await page.evaluate(()=>testMap.finishEditingForHistory());
        assert.equal(await page.evaluate(()=>graftTest.a1.data.text),'同步修改');
        assert.equal(await page.locator('.mm-virtual-node .mm-node-content').filter({hasText:'同步修改'}).count(),2);
        await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>graftTest.a1.data.text),'共享内容');
        await page.keyboard.press('Control+y');assert.equal(await page.evaluate(()=>graftTest.a1.data.text),'同步修改');
        await page.evaluate(()=>testMap.setSelectedNodes([testMap.grafts.roots[0].node.children[0]]));
        await page.evaluate(()=>testMap.applyLocalNodeStyle({backgroundColor:'#193c55',shape:'rounded',bold:true}));
        assert.equal(await page.evaluate(()=>graftTest.a1.data.nodeStyle.bold),true);
        assert.equal(await page.evaluate(()=>testMap.grafts.roots[1].node.children[0].data.nodeStyle.backgroundColor),'#193c55');
        await page.evaluate(()=>testMap.setSelectedNodes([testMap.grafts.roots[0].node]));
        console.log('Virtual branches: shared text, history and style passed; adding child.');
        await tool('child').click();await page.waitForFunction(()=>testMap.editNode?.virtualSource?.parent===graftTest.a);
        await page.keyboard.type('新增共享子节点');await page.evaluate(()=>testMap.finishEditingForHistory());
        assert.equal(await page.evaluate(()=>testMap.grafts.roots.every(root=>root.node.children.length===2)),true);
        await page.evaluate(()=>{testMap.execute('collapseNode',{node:graftTest.b});});
        assert.equal(await page.evaluate(()=>testMap.grafts.roots[0].node.isShow()),false);
        assert.equal(await page.evaluate(()=>testMap.grafts.roots[1].node.isShow()),true);
        assert.equal(await page.locator('.mm-graft-source-line').count(),1,'Hidden virtual roots have no source line');
        await page.evaluate(()=>testMap.execute('expandNode',{node:graftTest.b}));
        assert.equal(await page.locator('.mm-graft-source-line').count(),2);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        // Virtual trees must reserve real layout space rather than overlap adjacent branches.
        const overlaps=await page.evaluate(()=>{const boxes=[];testMap.traverseAll(n=>{if(n.isShow())boxes.push({id:n.getId(),...n.containEl.getBoundingClientRect().toJSON()});});const pairs=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)pairs.push([a,b]);}return pairs;});
        await page.screenshot({path:path.join(screenshotDir,'virtual-branches.png')});
        await page.screenshot({path:path.join(screenshotDir,'virtual-branch-source-links.png')});
        assert.deepEqual(overlaps,[],'Projected trees reserve space in the production layout');
        const graftRaw=await page.evaluate(()=>testMap.getMarkdown());
        assert.equal((graftRaw.match(/同步修改/g)||[]).length,1);assert.ok(!graftRaw.includes('virtual:'));
        const savedGrafts=await page.evaluate(()=>extractGrafts(testMap.getMarkdown()).entries);
        await page.evaluate(entries=>{testMap.grafts.clear();testMap.grafts=new GraftManager(testMap);testMap.grafts.load(entries);testMap.refresh();testMap.setSelectedNodes([testMap.grafts.roots[0].node]);},savedGrafts);
        await detach.click();assert.equal(await page.evaluate(()=>testMap.grafts.items.length),1);
        assert.equal(await page.locator('.mm-graft-source-line').count(),1);
        assert.equal(await page.evaluate(()=>graftTest.a.children.length),2);
        await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>testMap.grafts.items.length),2);
        await page.evaluate(()=>{testMap.setSelectedNodes([testMap.grafts.roots[0].node]);});await page.keyboard.press('Delete');
        assert.equal(await page.evaluate(()=>testMap.grafts.items.length),1);assert.equal(await page.evaluate(()=>testMap.getNodeById('graft-a')===graftTest.a),true);
        await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>testMap.grafts.items.length),2);
        await page.evaluate(()=>{testMap.setSelectedNodes([graftTest.a]);testMap.deleteSelectedNodes();});
        assert.equal(await page.locator('.mm-virtual-node').count(),0);
        assert.equal(await page.locator('.mm-graft-source-line').count(),0);
        await page.keyboard.press('Control+z');assert.equal(await page.locator('.mm-virtual-node').count(),6);
        assert.equal(await page.locator('.mm-graft-source-line').count(),2);
        await page.evaluate(()=>testMap.grafts.create(graftTest.c.getId(),graftTest.b.getId()));
        assert.equal(await page.locator('.mm-graft-source-line').count(),4,'Nested graft roots also link to their originals');
        assert.equal(await page.locator('.mm-graft-source-line[data-source-id="graft-a"]').count(),3);
        await page.keyboard.press('Control+z');
        assert.equal(await page.locator('.mm-graft-source-line').count(),2);
        // Fold state belongs to each occurrence, including descendant nodes.
        const firstVirtualId=await page.evaluate(()=>testMap.grafts.roots[0].node.getId());
        const foldButton=page.locator('[data-id="'+firstVirtualId+'"] > .mm-node-bar');
        const projectionCount=await page.locator('.mm-virtual-node').count();
        await foldButton.click();
        assert.deepEqual(await page.evaluate(()=>[graftTest.a.isExpand,...testMap.grafts.roots.map(root=>root.node.isExpand)]),[true,false,true]);
        assert.equal(await page.evaluate(()=>testMap.grafts.roots[0].node.children[0].isShow()),false);
        assert.equal(await page.evaluate(()=>testMap.grafts.roots[1].node.children[0].isShow()),true);
        await page.keyboard.press('Control+z');
        assert.equal(await page.evaluate(()=>testMap.grafts.roots[0].node.isExpand),true);
        await page.keyboard.press('Control+y');
        assert.equal(await page.evaluate(()=>testMap.grafts.roots[0].node.isExpand),false);
        await page.locator('[data-id="graft-a"] > .mm-node-bar').click();
        assert.deepEqual(await page.evaluate(()=>[graftTest.a.isExpand,...testMap.grafts.roots.map(root=>root.node.isExpand)]),[false,false,true]);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
        await page.screenshot({path:path.join(screenshotDir,'independent-virtual-folds.png')});
        const independentState=await page.evaluate(()=>extractGrafts(testMap.getMarkdown()).entries);
        assert.ok(independentState.every(link=>!('folds' in link)));
        await page.evaluate(entries=>{testMap.grafts.clear();testMap.grafts=new GraftManager(testMap);testMap.grafts.load(entries);testMap.refresh();},independentState);
        assert.deepEqual(await page.evaluate(()=>[graftTest.a.isExpand,...testMap.grafts.roots.map(root=>root.node.isExpand)]),[false,true,true]);
        assert.equal(await page.locator('.mm-virtual-node').count(),projectionCount,'Independent folds reuse the same number of DOM nodes');
        // Adding while the source remains collapsed edits in the visible virtual occurrence.
        await page.evaluate(()=>testMap.setSelectedNodes([testMap.grafts.roots[0].node]));
        await tool('child').click();await page.waitForFunction(()=>testMap.editNode?.virtualSource?.parent===graftTest.a);
        assert.equal(await page.evaluate(()=>graftTest.a.isExpand),false);
        assert.equal(await page.evaluate(()=>testMap.editNode.isShow()),true);
        await page.keyboard.type('独立折叠下的共享内容');await page.evaluate(()=>testMap.finishEditingForHistory());
        assert.equal(await page.evaluate(()=>graftTest.a.children.at(-1).data.text),'独立折叠下的共享内容');
        console.log('View-only folds: actual controls, source/copy isolation, undo/redo, reload expanded without saved folds, unchanged DOM count and adding while source is collapsed passed.');
        // Production nodes cache content dimensions; dynamic DOM reads mask hidden-node regressions.
        await page.evaluate(()=>{
            const map=testMap;map.grafts.clear();window.cachedGraftGeometry=true;
            const source=makeGraftTestNode('cached-source','Cached source',map.root);
            for(let i=0;i<5;i++){
                const child=makeGraftTestNode('cached-child-'+i,'Child with a long label '+i,source);
                makeGraftTestNode('cached-leaf-'+i,'Leaf '+i,child);
            }
            const target=makeGraftTestNode('cached-target','Cached target',map.root);
            map.grafts=new GraftManager(map);map.grafts.create(source.getId(),target.getId());
            window.cachedGraftTest={source,target};map.refresh();
        });
        for(const mode of ['target','virtual','descendant','reload','history','target']){
            await page.evaluate(mode=>{
                const map=testMap;
                const node=mode==='target'?cachedGraftTest.target:mode==='descendant'?map.grafts.roots[0].node.children[0]:map.grafts.roots[0].node;
                map.execute('collapseNode',{node});map.refresh();
                if(mode==='reload'){
                    const entries=extractGrafts(map.getMarkdown()).entries;
                    map.grafts.clear();map.grafts=new GraftManager(map);map.grafts.load(entries);map.refresh();
                    map.execute('expandNode',{node:map.grafts.roots[0].node});
                }else if(mode==='history'){map.undo();map.redo();map.undo();}
                else map.execute('expandNode',{node});
            },mode);
            const geometry=await page.evaluate(()=>Array.from(testMap.grafts.nodes.values()).filter(n=>n.isShow()).map(n=>({id:n.getId(),cached:n.getBox(),width:n.contentEl.offsetWidth,height:n.contentEl.offsetHeight})));
            for(const node of geometry){assert.equal(node.cached.width,node.width,'Expanded mirror must remeasure its visible width: '+node.id);assert.equal(node.cached.height,node.height,'Expanded mirror must remeasure its visible height: '+node.id);}
            for(let i=0;i<geometry.length;i++)for(let j=i+1;j<geometry.length;j++){
                const a=geometry[i].cached,b=geometry[j].cached;
                assert.ok(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),'Expanded virtual nodes must not overlap');
            }
        }
        await page.screenshot({path:path.join(screenshotDir,'virtual-expansion-cached-geometry.png')});
        console.log('Cached production geometry: target/virtual root/descendant collapse and expansion, persisted reload and undo/redo restore visible dimensions without subtree collisions.');
        await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
        await page.evaluate(()=>{
            const map=testMap,refresh=map.refresh;window.batchedRefreshes=0;
            map.refresh=function(){window.batchedRefreshes++;return refresh.call(this)};
            for(let i=0;i<368;i++)map.initNode({detail:{}});
            if(window.batchedRefreshes!==0)throw Error('Render burst must yield before layout');
        });
        await page.waitForFunction(()=>window.batchedRefreshes===1);
        await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
        assert.equal(await page.evaluate(()=>window.batchedRefreshes),1);
        await page.evaluate(()=>cachedGraftTest.source.setText('Longer asynchronously rendered source text'));
        await page.waitForFunction(()=>window.batchedRefreshes===2&&testMap.grafts.roots[0].node.contentEl.textContent==='Longer asynchronously rendered source text');
        await page.waitForFunction(()=>window.batchedRefreshes===3);
        assert.equal(await page.evaluate(()=>{const n=testMap.grafts.roots[0].node;return n.getBox().width===n.contentEl.offsetWidth&&n.getBox().width>0}),true);
        console.log('Render batching: 368 notifications share one real layout; later asynchronous source/mirror renders still update dimensions.');
        // Native highlights preserve DOM, inline markup and the browser text selection.
        await page.evaluate(()=>{
            const host=document.createElement('div');host.id='keyword-fixture';document.body.append(host);
            const make=(html,hidden=false,editing=false)=>{
                const contentEl=document.createElement('div');contentEl.className='mm-node-content';contentEl.innerHTML=html;host.append(contentEl);
                return {contentEl,data:{isEdit:editing},isShow:()=>!hidden};
            };
            const nodes=[make('State() bState StateMachine <b>Sta</b>te.Value <a href="#link">State</a> <code>State</code>'),make('State',true),make('State',false,true)];
            const highlighter=new KeywordHighlighter({appEl:host,traverseAll:fn=>nodes.forEach(fn)});
            window.keywordFixture={host,nodes,highlighter,html:nodes[0].contentEl.innerHTML};
            const selection=getSelection(),range=document.createRange();range.selectNodeContents(nodes[0].contentEl.querySelector('b'));selection.removeAllRanges();selection.addRange(range);
            highlighter.set(['State']);
        });
        assert.deepEqual(await page.evaluate(()=>[...CSS.highlights.get(keywordFixture.highlighter.name)].map(r=>r.toString())),['State','State','State','State']);
        assert.equal(await page.evaluate(()=>keywordFixture.nodes[0].contentEl.innerHTML===keywordFixture.html),true);
        assert.equal(await page.evaluate(()=>getSelection().toString()),'Sta');
        await page.evaluate(()=>keywordFixture.highlighter.set(['State'],false));
        assert.equal(await page.evaluate(()=>CSS.highlights.get(keywordFixture.highlighter.name).size),6);
        await page.evaluate(()=>{keywordFixture.highlighter.set(['State'],true);keywordFixture.nodes[0].contentEl.querySelector('code').textContent='Changed';});
        await page.waitForFunction(()=>CSS.highlights.get(keywordFixture.highlighter.name)?.size===3);
        await page.evaluate(()=>{
            keywordFixture.nodes[0].contentEl.innerHTML='<table><tr><td>State</td><td>Value</td></tr></table><p>State</p><p>Value</p>';
        });
        await page.waitForFunction(()=>CSS.highlights.get(keywordFixture.highlighter.name)?.size===2);
        await page.evaluate(()=>{keywordFixture.highlighter.destroy();keywordFixture.host.remove();getSelection().removeAllRanges();});
        // Exercise the older WebView fallback without changing global browser capabilities.
        await page.evaluate(()=>{
            const host=document.createElement('div');host.id='keyword-fallback';host.innerHTML='<div class="mm-node-content">State <b>Sta</b>te.Value bState</div>';document.body.append(host);
            const node={contentEl:host.firstElementChild,data:{},isShow:()=>true};
            const h=new KeywordHighlighter({appEl:host,traverseAll:fn=>fn(node)});h.registry=undefined;h.Highlight=undefined;
            window.keywordFallback={host,node,h,html:node.contentEl.innerHTML};h.set(['State']);
        });
        assert.equal(await page.locator('#keyword-fallback mark').count(),3);
        assert.equal(await page.locator('#keyword-fallback b').textContent(),'Sta');
        await page.evaluate(()=>keywordFallback.h.setColor('State','#124488'));
        assert.equal(await page.locator('#keyword-fallback mark').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(18, 68, 136)');
        assert.equal(await page.locator('#keyword-fallback mark').first().evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
        await page.evaluate(()=>keywordFallback.h.set([]));
        assert.equal(await page.evaluate(()=>keywordFallback.node.contentEl.innerHTML===keywordFallback.html),true);
        await page.evaluate(()=>{keywordFallback.h.destroy();keywordFallback.host.remove();});
        await page.evaluate(async()=>{
            testMap.highlights.set([]);cachedGraftTest.source.setText('State StateMachine bState State()');
            await new Promise(resolve=>setTimeout(resolve,40));
            document.querySelector('.view-content.mm-view').style.height='800px';
            window.keywordPanel=new MindMapPanel(testMap,document.querySelector('.mm-view-body'),()=>{});
            window.keywordBefore={markdown:testMap.getMarkdown(),history:testMap.exec.history.undos.length};
        });
        const keywordInput=page.getByRole('textbox',{name:'Highlight keyword',exact:true});
        assert.equal(await page.getByRole('checkbox',{name:'Whole word match',exact:true}).isChecked(),true);
        await keywordInput.fill('State');await keywordInput.press('Enter');
        assert.equal(await page.evaluate(()=>CSS.highlights.get(testMap.highlights.name).size),4);
        await keywordInput.fill('State');await page.getByRole('button',{name:'Add keyword',exact:true}).click();
        assert.equal(await page.locator('.mm-keyword-chip').count(),1,'Duplicate keywords are ignored');
        await keywordInput.fill('Leaf');await keywordInput.press('Enter');
        assert.equal(await page.locator('.mm-keyword-chip').count(),2);
        assert.equal(await page.evaluate(()=>[...CSS.highlights].filter(([name])=>name===testMap.highlights.name||name.startsWith(testMap.highlights.name+'-')).reduce((sum,[,highlight])=>sum+highlight.size,0)),14);
        assert.notEqual(await page.evaluate(()=>testMap.highlights.color('State')),await page.evaluate(()=>testMap.highlights.color('Leaf')));
        await page.getByLabel('Keyword color: State',{exact:true}).fill('#124488');
        await page.getByLabel('Keyword color: State',{exact:true}).dispatchEvent('change');
        assert.equal(await page.evaluate(()=>testMap.highlights.color('State')),'#124488');
        assert.equal(await page.evaluate(()=>testMap.getMarkdown()===keywordBefore.markdown&&testMap.exec.history.undos.length===keywordBefore.history),true);
        await page.screenshot({path:path.join(screenshotDir,'keyword-highlights.png')});
        await page.getByRole('button',{name:'Remove keyword: Leaf',exact:true}).click();
        await page.evaluate(()=>testMap.execute('collapseNode',{node:cachedGraftTest.target}));
        await page.waitForFunction(()=>CSS.highlights.get(testMap.highlights.name)?.size===2);
        await page.evaluate(()=>testMap.execute('expandNode',{node:cachedGraftTest.target}));
        await page.waitForFunction(()=>CSS.highlights.get(testMap.highlights.name)?.size===4);
        await page.getByRole('checkbox',{name:'Whole word match',exact:true}).uncheck();
        assert.equal(await page.evaluate(()=>CSS.highlights.get(testMap.highlights.name).size),8);
        await page.getByRole('button',{name:'Remove keyword: State',exact:true}).click();
        assert.equal(await page.evaluate(()=>CSS.highlights.has(testMap.highlights.name)),false);
        // Select in an editor and add via the real right-click menu without a content/history change.
        await page.evaluate(()=>{const n=cachedGraftTest.source;testMap.setSelectedNodes([n]);n.edit();selectEditorOffsets(n.contentEl,0,5);window.keywordContextBefore={text:n.data.text,history:testMap.exec.history.undos.length};});
        const selectedPoint=await page.evaluate(()=>{const r=getSelection().getRangeAt(0).getBoundingClientRect();return{x:r.x+2,y:r.y+2}});
        await page.mouse.click(selectedPoint.x,selectedPoint.y,{button:'right'});
        await page.getByRole('menuitem',{name:'Add highlight keyword',exact:true}).click();
        assert.equal(await page.locator('.mm-keyword-chip').count(),1);
        assert.equal(await page.evaluate(()=>cachedGraftTest.source.data.text===keywordContextBefore.text&&testMap.exec.history.undos.length===keywordContextBefore.history&&cachedGraftTest.source.data.isEdit),true);
        await page.evaluate(()=>{testMap.finishEditingForHistory();selectEditorOffsets(cachedGraftTest.source.contentEl,6,18);});
        const renderedPoint=await page.evaluate(()=>{const r=getSelection().getRangeAt(0).getBoundingClientRect();return{x:r.x+2,y:r.y+2}});
        await page.mouse.click(renderedPoint.x,renderedPoint.y,{button:'right'});
        assert.equal(await page.getByRole('menuitem',{name:'Bold',exact:true}).count(),0);
        await page.getByRole('menuitem',{name:'Add highlight keyword',exact:true}).click();
        assert.deepEqual(await page.evaluate(()=>testMap.highlights.keywords),['State','StateMachine']);
        await page.screenshot({path:path.join(screenshotDir,'keyword-colors-context-menu.png')});
        await page.evaluate(()=>keywordPanel.destroy());
        console.log('Keyword highlights: literal whole-word default, substring toggle, native selection/markup, async changes, hidden/editing exclusion, legacy fallback, panel add/delete/dedup, virtual mirrors and unchanged Markdown/history passed.');
        console.log('Virtual branches: toolbar graft/detach, native editing and live preview, shared styles/additions, folding, real layout collision check, persistence, root/source deletion and undo/redo passed.');
        assert.deepEqual(errors,[]);
        console.log('Summary release UI: single/overlapping ranges, editable child tree, Markdown, layout collision checks, parent folding, forest copy/paste remapping, atomic deletion and undo/redo passed.');
        console.log('Headless Chromium: marquee, parent/child filtering, batch clipboard, Delete, native batch drag/drop, right-button panning, text/image paste, native editor caret/word selection, unified draft undo/redo, unselected/body-focus undo and Ctrl+Z passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
