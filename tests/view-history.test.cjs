const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./search-test-helpers.cjs');

function fixture(ready = true) {
    let now = 0, serial = 0, events = 0, reads = 0;
    const timers = new Map(), listeners = new Map();
    const setTimer = (fn, delay) => { const id = ++serial; timers.set(id, { fn, at: now + delay }); return id; };
    const clearTimer = id => timers.delete(id);
    const History = load('src/mindmap/view-history.ts', {}, { setTimeout: setTimer, clearTimeout: clearTimer }).default;
    const viewport = {
        clientWidth: 800, clientHeight: 600, clientLeft: 2, clientTop: 2,
        scrollLeft: 1000, scrollTop: 800, style: {}, ownerDocument: { visibilityState: 'visible' },
        getBoundingClientRect() { reads++; return { left: 25, top: 45 }; },
        addEventListener(name, fn) { listeners.set(name, fn); },
        removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); }
    };
    const map = {
        root: ready ? {} : null, containerEL: viewport, mindScale: 100, scalePointer: [],
        appEl: { getBoundingClientRect() { return { left: 27 - viewport.scrollLeft, top: 47 - viewport.scrollTop }; } },
        emit() { events++; },
        scale(scale) { this.mindScale = scale; history.changed(); }
    };
    const history = new History(map);
    const advance = duration => {
        const end = now + duration;
        for (;;) {
            const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            now = next[1].at; timers.delete(next[0]); next[1].fn();
        }
        now = end;
    };
    const scroll = (dx, dy = 0) => { viewport.scrollLeft += dx; viewport.scrollTop += dy; listeners.get('scroll')?.(); };
    return { history, map, viewport, advance, scroll, timers, listeners, events: () => events, reads: () => reads };
}

test('view history waits five seconds after the last movement and does not measure while scrolling', () => {
    const f = fixture();
    assert.equal(f.history.canBack, false); assert.equal(f.history.canForward, false);
    const initialReads = f.reads();
    for (let i = 0; i < 100; i++) f.scroll(2);
    assert.equal(f.reads(), initialReads); assert.equal(f.timers.size, 1);
    f.advance(4999); assert.equal(f.history.canBack, false);
    f.scroll(200); f.advance(4999); assert.equal(f.history.canBack, false);
    f.advance(1); assert.equal(f.history.canBack, true);
    assert.equal(f.events(), 2);
});

test('small movements accumulate relative to the last recorded position; zoom alone can create a stop', () => {
    const f = fixture();
    f.scroll(40); f.advance(5000); f.scroll(60); f.advance(5000);
    assert.equal(f.history.canBack, false);
    f.scroll(50); f.advance(5000); assert.equal(f.history.canBack, true);
    const zoom = fixture();
    // Keep the same canvas center, so this checks zoom rather than translation.
    zoom.map.mindScale = 119;
    zoom.viewport.scrollLeft = 1400 * 1.19 - 400; zoom.viewport.scrollTop = 1100 * 1.19 - 300;
    zoom.history.changed(); zoom.advance(5000); assert.equal(zoom.history.canBack, false);
    zoom.map.mindScale = 120;
    zoom.viewport.scrollLeft = 1400 * 1.2 - 400; zoom.viewport.scrollTop = 1100 * 1.2 - 300;
    zoom.history.changed(); zoom.advance(5000); assert.equal(zoom.history.canBack, true);
});

test('back/forward restores center and zoom, survives a viewport resize, and does not duplicate restored stops', () => {
    const f = fixture();
    f.scroll(400, 200); f.advance(5000);
    f.map.scale(150); f.advance(5000);
    f.history.go(-1);
    assert.equal(f.map.mindScale, 100); assert.equal(f.viewport.scrollLeft, 1400); assert.equal(f.viewport.scrollTop, 1000);
    assert.equal(f.history.canForward, true);
    f.listeners.get('scroll')(); assert.equal(f.timers.size, 0);
    f.history.changed(); f.advance(5000); assert.equal(f.history.canForward, true);
    f.viewport.clientWidth = 400; f.viewport.clientHeight = 300;
    f.history.go(-1);
    assert.equal(f.viewport.scrollLeft, 1200); assert.equal(f.viewport.scrollTop, 950);
    f.history.go(1); assert.equal(f.viewport.scrollLeft, 1600); assert.equal(f.viewport.scrollTop, 1150);
    f.history.go(1); assert.equal(f.map.mindScale, 150); assert.equal(f.history.canForward, false);
});

test('back preserves a pending meaningful location; a new settled stop replaces the forward branch', () => {
    const f = fixture();
    f.scroll(400); f.advance(5000);
    f.scroll(400); f.history.go(-1);
    assert.equal(f.viewport.scrollLeft, 1400); assert.equal(f.history.canForward, true);
    f.history.go(-1); assert.equal(f.viewport.scrollLeft, 1000);
    f.scroll(200, 500); f.advance(5000);
    assert.equal(f.history.canForward, false);
    f.history.go(-1); assert.equal(f.viewport.scrollTop, 800);
    f.history.go(1); assert.equal(f.viewport.scrollTop, 1300);
});

test('initial layout seeds once; hidden views, cleanup and the 100-position limit are handled', () => {
    const f = fixture(false);
    assert.equal(f.events(), 0);
    f.map.root = {}; f.history.seed(); f.history.seed(); assert.equal(f.events(), 1);
    f.viewport.ownerDocument.visibilityState = 'hidden'; f.scroll(300); f.advance(5000);
    assert.equal(f.history.canBack, false);
    f.viewport.ownerDocument.visibilityState = 'visible';
    f.viewport.clientWidth = 0; f.history.changed(); f.advance(5000); assert.equal(f.history.canBack, false);
    f.viewport.clientWidth = 800;
    for (let i = 0; i < 105; i++) { f.scroll(300); f.advance(5000); }
    let count = 0;
    while (f.history.canBack) { f.history.go(-1); count++; }
    assert.equal(count, 99);
    f.scroll(500); f.history.destroy(); f.advance(5000); f.history.changed(); f.history.seed(); f.history.go(-1);
    assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0); assert.equal(f.history.canBack, false);
});
