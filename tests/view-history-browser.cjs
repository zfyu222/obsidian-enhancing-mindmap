const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ browser, definitions, screenshotDir }) => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.setContent(`<style>${fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8')}
        body{margin:0;background:#20242c;color:white;font:16px system-ui}
        #host{height:600px;width:950px;margin:15px;background:#272d38}
        #viewport{border:2px solid #657080}
        #canvas{position:relative;width:6000px;height:6000px;flex:none}
        .spot{position:absolute;padding:20px;border:1px solid #86b7ef;border-radius:8px}
        </style><div id="host" class="view-content mm-view"><div id="viewport" class="mm-viewport"><div id="canvas">
        <div class="spot" style="left:1800px;top:1600px">Opening position</div>
        <div class="spot" style="left:2400px;top:1900px">Second viewing position</div>
        </div></div></div>`);
        await page.addScriptTag({ content: `(() => {
            ${['ViewHistory', 'MindMap', 'MindMapToolbar'].map(name => definitions.get(name)).join('\n')}
            const t = text => text;
            const map = Object.create(MindMap.prototype);
            Object.assign(map, {
                root: {}, mindScale: 100, scalePointer: [],
                appEl: document.querySelector('#canvas'), containerEL: document.querySelector('#viewport'),
                exec: {history:{undos:[],redos:[]}},
                getSelectedRoots: () => [], getSelectedNodes: () => [],
                focusAfterHistory: () => { throw new Error('Viewing navigation must not focus/scroll the selected node'); }
            });
            map.containerEL.scrollLeft=1500; map.containerEL.scrollTop=1300;
            window.map=map;
            window.toolbar=new MindMapToolbar(map,document.querySelector('#host'));
            window.position=()=>map.viewHistory.capture();
            window.record=()=>{clearTimeout(map.viewHistory.timer);map.viewHistory.timer=undefined;map.viewHistory.record();};
        })();` });
        const tool = id => page.locator(`button[data-action="${id}"]`);
        const initial = await page.evaluate(() => position());
        assert.equal(await tool('viewBack').isDisabled(), true);
        assert.equal(await tool('viewForward').isDisabled(), true);
        // Real native viewport scrolling and the production five-second idle timer.
        await page.evaluate(() => { map.containerEL.scrollLeft+=600;map.containerEL.scrollTop+=300; });
        await page.waitForTimeout(300);
        assert.equal(await tool('viewBack').isDisabled(), true);
        await page.waitForFunction(() => !toolbar.buttons.viewBack.disabled, { timeout: 7000 });
        const second = await page.evaluate(() => position());
        const close = (actual, expected) => {
            assert.equal(actual.scale, expected.scale);
            assert.ok(Math.abs(actual.x-expected.x)<1 && Math.abs(actual.y-expected.y)<1, JSON.stringify({actual,expected}));
        };
        await tool('viewBack').click(); close(await page.evaluate(() => position()), initial);
        assert.equal(await tool('viewForward').isDisabled(), false);
        await page.evaluate(() => record());
        assert.equal(await tool('viewForward').isDisabled(), false);
        await tool('viewForward').click(); close(await page.evaluate(() => position()), second);
        // Arbitrary transform origin and zoom must restore in both directions.
        await page.evaluate(() => {map.scalePointer=[3200,2700];map.scale(160);map.containerEL.scrollLeft+=700;map.containerEL.scrollTop+=350;});
        await page.waitForTimeout(50);
        await page.evaluate(() => record());
        const zoomed = await page.evaluate(() => position());
        await tool('viewBack').click(); close(await page.evaluate(() => position()), second);
        await tool('viewForward').click(); close(await page.evaluate(() => position()), zoomed);
        await page.evaluate(() => document.querySelector('#host').style.width='650px');
        await page.waitForTimeout(50);
        await tool('viewBack').click(); close(await page.evaluate(() => position()), second);
        // A new stable viewing location after going back invalidates the old forward path.
        await page.evaluate(() => {map.containerEL.scrollTop+=500;});
        await page.waitForTimeout(50); await page.evaluate(() => record());
        assert.equal(await tool('viewForward').isDisabled(), true);
        assert.equal(await tool('viewBack').isDisabled(), false);
        await page.screenshot({ path: path.join(screenshotDir, 'view-position-history.png') });
        await page.evaluate(() => {window.oldHistory=map.viewHistory;toolbar.destroy();});
        assert.equal(await page.locator('.mm-toolbar').count(), 0);
        assert.equal(await page.evaluate(() => !map.viewHistory && !oldHistory.canBack), true);
        assert.deepEqual(errors, []);
        console.log('Viewing history: native scroll/idle timing, actual toolbar back/forward, zoom/origin restoration, resize, forward branching and cleanup passed.');
    } finally { await page.close(); }
};
