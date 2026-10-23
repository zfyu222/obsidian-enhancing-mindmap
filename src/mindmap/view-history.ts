import type MindMap from './mindmap';

interface ViewPosition { x: number; y: number; scale: number }

/** Per-view navigation, deliberately separate from document/command history. */
export default class ViewHistory {
    private positions: ViewPosition[] = [];
    private index = -1;
    private timer?: ReturnType<typeof setTimeout>;
    private disposed = false;
    private restoredScroll?: { left: number; top: number; scale: number };

    constructor(private map: MindMap) {
        map.containerEL.addEventListener('scroll', this.changed, { passive: true });
        this.seed();
    }

    get canBack() { return this.index > 0; }
    get canForward() { return this.index + 1 < this.positions.length; }

    private capture(): ViewPosition | null {
        const { containerEL: viewport, appEl: canvas, mindScale: scale } = this.map;
        if (!this.map.root || !viewport.clientWidth || !viewport.clientHeight || !(scale > 0)) return null;
        const view = viewport.getBoundingClientRect(), rect = canvas.getBoundingClientRect();
        return {
            x: (view.left + viewport.clientLeft + viewport.clientWidth / 2 - rect.left) * 100 / scale,
            y: (view.top + viewport.clientTop + viewport.clientHeight / 2 - rect.top) * 100 / scale,
            scale
        };
    }

    private distant(a: ViewPosition, b: ViewPosition) {
        const viewport = this.map.containerEL;
        const threshold = Math.max(80, Math.min(viewport.clientWidth, viewport.clientHeight) / 4);
        const distance = Math.hypot(a.x - b.x, a.y - b.y) * Math.min(a.scale, b.scale) / 100;
        return distance >= threshold || Math.max(a.scale, b.scale) / Math.min(a.scale, b.scale) >= 1.2 - 1e-9;
    }

    /** Called after initial layout, never records subsequent layout-only changes. */
    seed() {
        if (this.disposed || this.positions.length) return;
        const position = this.capture();
        if (!position) return;
        this.positions.push(position);
        this.index = 0;
        this.map.emit('toolbarChange');
    }

    changed = () => {
        if (this.disposed) return;
        const viewport = this.map.containerEL, restored = this.restoredScroll;
        // Native scroll events arrive asynchronously after go(). Ignore that
        // exact offset until the user actually moves or changes zoom again.
        if (restored && viewport.scrollLeft === restored.left && viewport.scrollTop === restored.top && this.map.mindScale === restored.scale) return;
        this.restoredScroll = undefined;
        clearTimeout(this.timer);
        // No node scans or geometry reads during scrolling.
        this.timer = setTimeout(() => {
            this.timer = undefined;
            if (this.map.containerEL.ownerDocument.visibilityState !== 'hidden') this.record();
        }, 5000);
    };

    private record() {
        if (this.disposed) return;
        const position = this.capture();
        if (!position) return;
        const previous = this.positions[this.index];
        if (previous && !this.distant(previous, position)) return;
        this.positions.splice(this.index + 1);
        this.positions.push(position);
        // Bound memory even during a long editing session.
        if (this.positions.length > 100) this.positions.shift();
        this.index = this.positions.length - 1;
        this.map.emit('toolbarChange');
    }

    go(direction: -1 | 1) {
        if (this.disposed) return;
        const pending = this.timer !== undefined;
        clearTimeout(this.timer);
        this.timer = undefined;
        // Preserve a meaningful current location when leaving before its idle timer.
        if (direction === -1 && pending) this.record();
        const next = this.index + direction;
        if (next < 0 || next >= this.positions.length) return;
        const viewport = this.map.containerEL;
        if (!this.capture()) return;
        const position = this.positions[next];
        const behavior = viewport.style.scrollBehavior;
        viewport.style.scrollBehavior = 'auto';
        // Normalize the zoom origin; center coordinates remain valid across origins
        // and viewport resizes (e.g. opening the side panel or rotating a phone).
        this.map.scalePointer = [0, 0];
        this.map.scale(position.scale);
        const current = this.capture();
        viewport.scrollLeft += (position.x - current.x) * position.scale / 100;
        viewport.scrollTop += (position.y - current.y) * position.scale / 100;
        this.restoredScroll = { left: viewport.scrollLeft, top: viewport.scrollTop, scale: position.scale };
        viewport.style.scrollBehavior = behavior;
        this.index = next;
        clearTimeout(this.timer);
        this.timer = undefined;
        this.map.emit('toolbarChange');
        // The resulting native scroll event is ignored by changed().
    }

    destroy() {
        this.disposed = true;
        clearTimeout(this.timer);
        this.map.containerEL.removeEventListener('scroll', this.changed);
        this.positions = [];
        this.index = -1;
    }
}
