const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const clipboardNavigator = { clipboard: {} };
const notices = [];
const dom = {
    createElement() { return { style: {}, className: '', remove() {} }; },
    body: { appendChild() {} }
};
function load(file, dependencies = {}) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require: id => dependencies[id] || {}, console, setTimeout, clearTimeout, document: dom, window: {}, navigator: clipboardNavigator });
    return module.exports;
}
const selection = load('src/mindmap/selection.ts');
const clipboard = load('src/mindmap/clipboard.ts', { './selection': selection });
const { default: ActualNode } = load('src/mindmap/INode.ts');
let serial = 0;
const id = () => `new-${++serial}`;
class Node {
    constructor(data, mindmap) {
        this.data = data; this.mindmap = mindmap; this.children = []; this.isExpand = true;
        const classes = new Set();
        this.containEl = { setAttribute() {}, focus() {},
            classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
            getBoundingClientRect: () => this.rect || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } };
    }
    getId() { return this.data.id; }
    getData() { return JSON.parse(JSON.stringify(this.data)); }
    getLevel() { return this.parent ? this.parent.getLevel() + 1 : 0; }
    expand() { this.isExpand = true; }
    collapse() { this.isExpand = false; }
    clearCacheData() {}
    setPosition() {}
    refreshBox() {}
    select(preserve) { ActualNode.prototype.select.call(this, preserve); }
    unSelect() { ActualNode.prototype.unSelect.call(this); }
    isShow() { return !this.isHide; }
    edit() { this._oldText = this.data.text; this.contentEl = { innerText: this.data.text, contains: () => true }; this.data.isEdit = true; this.mindmap.editNode = this; }
    setText(text) { this.data.text = text; if (this.contentEl) this.contentEl.innerText = text; }
    cancelEdit() {
        const text = this.contentEl?.innerText?.trim() ?? this.data.text;
        if (this._oldText !== undefined && text !== this._oldText) this.mindmap.execute('changeNodeText', { node: this, oldText: this._oldText, text });
        this.data.isEdit = false;
    }
}
const commands = load('src/mindmap/Cmds.ts', { './INode': { default: Node }, './selection': selection });
const { PasteNode } = commands;
const history = load('src/mindmap/History.ts');
const { default: Exec } = load('src/mindmap/Execute.ts', {
    './History': history, './Cmds': commands, './INode': { default: Node },
    '../MindMapView': { uuid: id }, '../lang/helpers': { t: text => text }
});
const { default: MindMap } = load('src/mindmap/mindmap.ts', {
    './clipboard': clipboard, './selection': selection, '../MindMapView': { uuid: id }, './INode': { default: Node }, obsidian: { Notice: class { constructor(text) { notices.push(text); } } }
});
function fixture() {
    const map = Object.create(MindMap.prototype);
    map.root = new Node({ id: 'destination', text: 'Destination' }, map);
    map.selectNode = map.root;
    map.addNode = (n, parent) => { parent.children.push(n); n.parent = parent; };
    map.removeNode = n => { n.parent.children.splice(n.parent.children.indexOf(n), 1); };
    map.emit = () => {};
    map.execute = (_, data) => { map.command = new PasteNode(data.node, data.data); map.command.execute(); };
    return map;
}
function source() {
    const root = new Node({ id: 'a', text: 'Topic', mdText: '**Topic**', isRoot: true, note: 'note' });
    const child = new Node({ id: 'b', text: '```js\nconsole.log(1)\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |', pid: 'a' });
    child.children.push(new Node({ id: 'c', text: 'Grandchild', pid: 'b' }));
    root.children.push(child);
    root.isExpand = false;
    return root;
}
test('copy includes hidden descendants and preserves Markdown without changing the source', () => {
    const node = source();
    const before = JSON.stringify(node.data);
    const copied = JSON.parse(clipboard.serializeSubtree(node)).text;
    assert.equal(copied.length, 3);
    assert.equal(copied[0].isExpand, false);
    assert.equal(copied[0].isRoot, false);
    assert.equal(copied[0].mdText, '**Topic**');
    assert.equal(copied[1].text, node.children[0].data.text);
    assert.equal(JSON.stringify(node.data), before);
});
test('repeated cross-map paste creates independent subtrees, and undo/redo retains hierarchy', () => {
    const text = clipboard.serializeSubtree(source());
    const map = fixture();
    map.root.collapse();
    assert.equal(map.pasteNode(text), true);
    const first = map.root.children[0];
    assert.equal(first.children[0].children[0].data.text, 'Grandchild');
    assert.equal(first.isExpand, false);
    assert.equal(map.root.isExpand, true);
    const command = map.command;
    command.undo();
    assert.equal(map.root.children.length, 0);
    assert.equal(map.root.isExpand, false);
    command.redo();
    const second = map.root.children[0];
    assert.equal(second.getId(), first.getId());
    assert.equal(second.children[0].data.pid, second.getId());
    map.pasteNode(text);
    const third = map.root.children[1];
    assert.notEqual(third.getId(), second.getId());
    assert.notEqual(third.children[0].getId(), second.children[0].getId());
    assert.equal(third.children[0].children[0].data.pid, third.children[0].getId());
    assert.equal(third.children[0].data.text, source().children[0].data.text);
    map.setting = { headLevel: 1 };
    const markdown = map.getMarkdown();
    assert.match(markdown, /console\.log\(1\)/);
    assert.match(markdown, /\| A \| B \|/);
    assert.equal((markdown.match(/Grandchild/g) || []).length, 2);
    assert.ok(markdown.includes(`^${second.getId()}`));
});

test('only the active map handles node clipboard keyboard shortcuts', () => {
    const map = fixture();
    map.isFocused = true;
    let active = map.view = { app: { workspace: { getActiveViewOfType: () => active } } };
    let copies = 0;
    map.copyToClipboard = () => { copies++; };
    const event = { key: 'c', ctrlKey: true, target: null, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} };
    map.appKeydown(event);
    assert.equal(copies, 1);
    active = {};
    map.appKeydown(event);
    assert.equal(copies, 1);
    active = map.view;
    map.selectNode.data.isEdit = true;
    map.appKeydown(event);
    assert.equal(copies, 1);
});

function keyboardFixture() {
    const map = fixture();
    map.isFocused = true;
    map.view = { app: { workspace: { getActiveViewOfType: () => map.view } } };
    map._menuDom = { style: {} };
    map._indicateDom = { style: {} };
    map.appEl = { contains: () => true, focus() {} };
    map.containerEL = { contains: () => true, scrollLeft: 15, scrollTop: 25,
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 800 }) };
    map.exec = new Exec();
    map.execute = MindMap.prototype.execute;
    map.addNode = (n, parent, index = -1) => {
        parent.children.splice(index < 0 ? parent.children.length : index, 0, n);
        n.parent = parent;
    };
    map.removeNode = n => {
        const index = n.parent.children.indexOf(n);
        n.parent.children.splice(index, 1);
        return index;
    };
    return map;
}
function press(map, key, props = {}) {
    const event = { key, keyCode: key === 'Tab' ? 9 : key === 'Enter' ? 13 : 0, target: null,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...props };
    map.appKeydown(event);
    map.appKeyup({ ...event, defaultPrevented: false });
    return event;
}
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

test('Tab creates one child through real history and Enter inserts one adjacent sibling', async () => {
    const map = keyboardFixture();
    map.root.collapse();
    assert.equal(press(map, 'Tab').defaultPrevented, true);
    assert.equal(map.root.children.length, 1);
    assert.equal(map.root.isExpand, true);
    assert.equal(map.exec.history.undos.length, 1);
    await nextTick();
    const child = map.selectNode;
    assert.equal(child.data.isEdit, true);
    press(map, 'Enter'); // Finish editing, without creating a second node.
    assert.equal(child.data.isEdit, false);
    assert.equal(map.root.children.length, 1);
    const tail = new Node({ id: 'tail', text: 'Tail' }, map);
    map.addNode(tail, map.root);
    press(map, 'Enter');
    assert.equal(map.root.children.length, 3);
    assert.equal(map.root.children[0], child);
    assert.equal(map.root.children[2], tail);
    assert.equal(map.exec.history.undos.length, 2);
    await nextTick();
});

function add(map, parent, name) {
    const node = new Node({ id: name, text: name }, map);
    map.addNode(node, parent);
    return node;
}
test('marquee selects visible intersecting nodes in viewport coordinates without panning, then click preserves selection', () => {
    const map = keyboardFixture();
    map.selectedNodes = [];
    const a = add(map, map.root, 'A'), b = add(map, a, 'B'), hidden = add(map, a, 'Hidden'), outside = add(map, map.root, 'Outside');
    a.rect = { left: 60, top: 40, right: 120, bottom: 70, width: 60, height: 30 };
    b.rect = { left: 160, top: 40, right: 220, bottom: 70, width: 60, height: 30 };
    hidden.rect = a.rect; hidden.isHide = true;
    outside.rect = { left: 1200, top: 40, right: 1260, bottom: 70, width: 60, height: 30 };
    const background = { closest: () => null };
    map.appMouseDown({ button: 0, clientX: 250, clientY: 100, target: background, preventDefault() {} });
    map.appMouseMove({ clientX: 40, clientY: 20 }); // Drag in reverse direction.
    assert.equal(map.getSelectedNodes().length, 2);
    assert.equal(map.getSelectedRoots().length, 1);
    assert.equal(map.getSelectedRoots()[0], a);
    assert.equal(map.containerEL.scrollLeft, 15);
    assert.equal(map.containerEL.scrollTop, 25);
    assert.equal(map._selectionOverlay.style.left, '40px');
    map.appMouseUp({ button: 0 });
    map.appClickFn({ preventDefault() {} });
    assert.equal(map.getSelectedNodes().length, 2);
    assert.equal(map._selectionOverlay.style.display, 'none');
});

test('right-button background drag pans while left box selection supports additive selection', () => {
    const map = keyboardFixture();
    const node = add(map, map.root, 'A');
    map.setSelectedNodes([node]);
    const background = { closest: () => null };
    map.appMouseDown({ button: 2, clientX: 100, clientY: 100, target: background, preventDefault() {} });
    map.appMouseMove({ clientX: 120, clientY: 130 });
    assert.equal(map.containerEL.scrollLeft, -5);
    assert.equal(map.containerEL.scrollTop, -5);
    map.appMouseUp({ button: 2 });
    assert.equal(map.getSelectedNodes()[0], node);
    const b = add(map, map.root, 'B');
    b.rect = { left: 60, top: 40, right: 120, bottom: 70, width: 60, height: 30 };
    map.appMouseDown({ button: 0, ctrlKey: true, clientX: 30, clientY: 20, target: background, preventDefault() {} });
    map.appMouseMove({ clientX: 130, clientY: 80 });
    assert.equal(map.getSelectedNodes().length, 2);
    map.appMouseUp({ button: 0 });
});

test('batch copy excludes selected descendants and paste/undo/redo retains separate ordered subtrees', () => {
    const map = keyboardFixture();
    const a = add(map, map.root, 'A'), child = add(map, a, 'A-child'), b = add(map, map.root, 'B');
    a.collapse();
    map.setSelectedNodes([b, child, a]); // Selection order differs from outline order.
    const text = map.copyNode();
    const payload = JSON.parse(text);
    assert.equal(payload.type, 'copyNodes');
    assert.deepEqual(Array.from(payload.text, node => node.text), ['A', 'A-child', 'B']);
    const other = keyboardFixture();
    other.pasteNode(text);
    assert.equal(other.root.children.length, 2);
    assert.equal(other.root.children[0].isExpand, false);
    assert.equal(other.root.children[0].children[0].data.text, 'A-child');
    assert.equal(other.exec.history.undos.length, 1);
    other.root.children[1].select();
    press(other, 'z', { ctrlKey: true });
    assert.equal(other.root.children.length, 0);
    assert.equal(other.selectNode, other.root);
    press(other, 'y', { ctrlKey: true });
    assert.deepEqual(other.root.children.map(node => node.data.text), ['A', 'B']);
    other.pasteNode(text);
    assert.equal(new Set(other.root.children.map(node => node.getId())).size, 4);
});

test('batch Delete treats parent plus child once and restores all original sibling indexes in one undo', () => {
    const map = keyboardFixture();
    const a = add(map, map.root, 'A'), child = add(map, a, 'A-child'), keep = add(map, map.root, 'Keep'), b = add(map, map.root, 'B');
    map.setSelectedNodes([child, b, a]);
    press(map, 'Delete');
    assert.deepEqual(map.root.children.map(node => node.data.text), ['Keep']);
    assert.equal(map.exec.history.undos.length, 1);
    press(map, 'z', { ctrlKey: true });
    assert.deepEqual(map.root.children.map(node => node.data.text), ['A', 'Keep', 'B']);
    assert.equal(a.children[0], child);
    assert.equal(map.getSelectedNodes().length, 2);
    press(map, 'y', { ctrlKey: true });
    assert.equal(map.root.children[0], keep);
});

test('batch reparent keeps order and child subtrees, with a single undo and cycle rejection', () => {
    const map = keyboardFixture();
    const a = add(map, map.root, 'A'), child = add(map, a, 'A-child'), b = add(map, map.root, 'B'), target = add(map, map.root, 'Target');
    target.collapse();
    map.setSelectedNodes([b, child, a]);
    map.execute('moveNodes', { nodes: map.getSelectedRoots(), dropNode: target, type: 'child-left' });
    assert.deepEqual(target.children.map(node => node.data.text), ['A', 'B']);
    assert.equal(a.children[0], child);
    assert.equal(a.direct, 'left');
    assert.equal(target.isExpand, true);
    assert.equal(map.exec.history.undos.length, 1);
    press(map, 'z', { ctrlKey: true });
    assert.deepEqual(map.root.children.map(node => node.data.text), ['A', 'B', 'Target']);
    assert.equal(target.isExpand, false);
    map.execute('moveNodes', { nodes: [a, child], dropNode: child, type: 'child' });
    assert.equal(map.exec.history.undos.length, 0);
    assert.equal(map.exec.history.redos.length, 1); // Invalid move must preserve redo.
    press(map, 'y', { ctrlKey: true });
    assert.equal(target.children.length, 2);
});

test('batch sibling move within the same parent computes insertion after removing selected siblings', () => {
    const map = keyboardFixture();
    const a = add(map, map.root, 'A'), keep = add(map, map.root, 'Keep'), b = add(map, map.root, 'B'), tail = add(map, map.root, 'Tail');
    map.execute('moveNodes', { nodes: [a, b], dropNode: tail, type: 'down' });
    assert.deepEqual(map.root.children.map(node => node.data.text), ['Keep', 'Tail', 'A', 'B']);
    press(map, 'z', { ctrlKey: true });
    assert.deepEqual(map.root.children.map(node => node.data.text), ['A', 'Keep', 'B', 'Tail']);
    assert.equal(map.root.children[1], keep);
});

test('dragging any selected node carries only top-level selected roots through dragstart and drop', () => {
    const map = keyboardFixture();
    const a = add(map, map.root, 'A'), child = add(map, a, 'A-child'), b = add(map, map.root, 'B'), target = add(map, map.root, 'Target');
    map.setSelectedNodes([child, b, a]);
    const element = node => ({ getAttribute: () => node.getId() });
    const eventTarget = node => ({ closest: selector => selector === '.mm-node' ? element(node) : null });
    let clipboardText;
    const transfer = { files: [], setData: (_, text) => { clipboardText = text; } };
    map.appMouseDown({ button: 0, target: eventTarget(child) });
    assert.equal(map.getSelectedNodes().length, 3);
    map.appDragstart({ target: eventTarget(child), dataTransfer: transfer, pageX: 10, pageY: 10, stopPropagation() {}, preventDefault() { throw new Error('Unexpected drag rejection'); } });
    assert.equal(map._dragNodes.length, 2);
    assert.equal(JSON.parse(clipboardText).text.length, 3);
    map.appMouseMove({ target: { closest: () => null }, offsetX: 25, offsetY: 35, pageX: 50, pageY: 60 });
    assert.equal(map.containerEL.scrollLeft, 15); // Node dragging must never pan the canvas.
    map._getDragType = () => 'child';
    map.appDrop({ target: eventTarget(target), dataTransfer: transfer, clientX: 50, clientY: 50, preventDefault() {} });
    assert.deepEqual(target.children.map(node => node.data.text), ['A', 'B']);
    assert.equal(map.exec.history.undos.length, 1);
    press(map, 'z', { ctrlKey: true });
    assert.equal(a.parent, map.root);
    assert.equal(child.parent, a);
});

test('Ctrl-drag copies the selected forest and protects root/self drops without altering the original', () => {
    const map = keyboardFixture();
    const a = add(map, map.root, 'A'), child = add(map, a, 'A-child'), b = add(map, map.root, 'B'), target = add(map, map.root, 'Target');
    map.setSelectedNodes([a, child, b]);
    map._dragNodes = map.getSelectedRoots(); map.drag = true;
    map.appDrop({ target: { closest: () => ({ getAttribute: () => target.getId() }) }, dataTransfer: { files: [] }, ctrlKey: true, preventDefault() {} });
    assert.equal(map.root.children.length, 3);
    assert.equal(target.children.length, 2);
    assert.notEqual(target.children[0].getId(), a.getId());
    assert.equal(target.children[0].children[0].data.text, child.data.text);
    press(map, 'z', { ctrlKey: true });
    assert.equal(target.children.length, 0);
    map._dragNodes = [a]; map.drag = true;
    map.appDrop({ target: { closest: () => ({ getAttribute: () => child.getId() }) }, dataTransfer: { files: [] }, preventDefault() {} });
    assert.equal(child.parent, a);
    assert.equal(map.exec.history.undos.length, 0);
    map.root.data.isRoot = true;
    map.setSelectedNodes([map.root, child]);
    press(map, 'Delete');
    assert.equal(map.root.children.length, 3);
});

test('Ctrl+Z after a paste removes the complete subtree through real Exec/History, and redo restores it', () => {
    const map = keyboardFixture();
    map.pasteNode(clipboard.serializeSubtree(source()));
    assert.equal(map.exec.history.undos.length, 1);
    map.root.children[0].children[0].children[0].select();
    assert.equal(press(map, 'z', { ctrlKey: true }).defaultPrevented, true);
    assert.equal(map.root.children.length, 0);
    assert.equal(map.selectNode, map.root);
    press(map, 'y', { ctrlKey: true });
    assert.equal(map.root.children[0].children[0].children[0].data.text, 'Grandchild');
    press(map, 'z', { metaKey: true });
    assert.equal(map.root.children.length, 0);
    press(map, 'z', { metaKey: true, shiftKey: true });
    assert.equal(map.root.children.length, 1);
});

test('Tab finishes editing and modified Enter/Tab retain their behavior', () => {
    const map = keyboardFixture(); let finishes = 0;
    map.root.cancelEdit = () => { finishes++; map.root.data.isEdit = false; };
    map.root.edit(); const editor = { isContentEditable: true };
    map.root.contentEl = { contains: target => target === editor };
    assert.equal(press(map, 'Enter', { shiftKey: true, target: editor }).defaultPrevented, undefined);
    assert.equal(press(map, 'Tab', { target: editor }).defaultPrevented, true);
    assert.equal(finishes, 1); assert.equal(map.editNode, null);
    assert.equal(press(map, 'Tab', { shiftKey: true }).defaultPrevented, undefined);
});

test('IME confirmation, inactive maps, and other input fields do not create nodes or undo', () => {
    const map = keyboardFixture();
    press(map, 'Enter', { isComposing: true });
    press(map, 'Enter', { keyCode: 229 });
    map.isComposing = true;
    press(map, 'Tab');
    map.isComposing = false;
    press(map, 'Tab', { target: { closest: () => ({}) } });
    press(map, 'z', { ctrlKey: true, target: { closest: () => ({}) } });
    map.containerEL.contains = () => false;
    press(map, 'Tab', { target: {} });
    press(map, 'z', { ctrlKey: true, target: {} });
    map.view.app.workspace.getActiveViewOfType = () => ({});
    press(map, 'Tab');
    press(map, 'Enter');
    press(map, 'z', { ctrlKey: true });
    assert.equal(map.root.children.length, 0);
    assert.equal(map.exec.history.undos.length, 0);
});

test('restored Space and Delete shortcuts use node editing and history', async () => {
    const map = keyboardFixture();
    map.root.data.isRoot = true;
    press(map, 'Delete');
    assert.equal(map.exec.history.undos.length, 0);
    press(map, 'Tab');
    await nextTick();
    press(map, 'Tab'); // Finish editor.
    press(map, ' ');
    assert.equal(map.selectNode.data.isEdit, true);
    press(map, 'Enter');
    press(map, 'Delete');
    assert.equal(map.root.children.length, 0);
    press(map, 'z', { ctrlKey: true });
    assert.equal(map.root.children.length, 1);
});
test('ordinary text, invalid topology, duplicate IDs and missing destination leave the map intact', () => {
    const map = fixture();
    const invalid = ['plain text', '{}', 'null', JSON.stringify({ type: 'copyNode', text: [] }),
        JSON.stringify({ type: 'copyNode', text: [{ id: 'a', text: 'A', pid: null }, { id: 'b', text: 'B', pid: 'missing' }] }),
        JSON.stringify({ type: 'copyNode', text: [{ id: 'a', text: 'A', pid: null }, { id: 'a', text: 'B', pid: 'a' }] })];
    invalid.forEach(text => assert.equal(map.pasteNode(text), false));
    assert.equal(map.root.children.length, 0);
    map.selectNode = null;
    assert.equal(map.pasteNode(clipboard.serializeSubtree(source())), false);
});
test('Ctrl/Cmd hotkeys only operate outside text editing', () => {
    const event = { key: 'c', ctrlKey: true, target: { closest: () => null } };
    assert.equal(clipboard.clipboardAction(event, false), 'copy');
    assert.equal(clipboard.clipboardAction({ ...event, ctrlKey: false, metaKey: true, key: 'V' }, false), 'paste');
    assert.equal(clipboard.clipboardAction(event, true), null);
    for (const props of [{ shiftKey: true }, { altKey: true }, { isComposing: true }, { defaultPrevented: true },
        { target: { isContentEditable: true } }, { target: { closest: () => ({}) } }]) {
        assert.equal(clipboard.clipboardAction({ ...event, ...props }, false), null);
    }
});


test('right panning suppresses drag context menus but middle button and plain right clicks do not pan/menu-block', () => {
    const map = keyboardFixture(); const target = { closest: () => null };
    map.appMouseDown({ button: 1, target }); assert.ok(!map._panning);
    map.appMouseDown({ button: 2, target, clientX: 40, clientY: 40, preventDefault() {} });
    map.appMouseMove({ clientX: 65, clientY: 55 });
    map.appMouseUp({ button: 0 }); assert.equal(map._panning, true);
    map.appMouseUp({ button: 2 }); assert.equal(map._panning, false);
    let prevented = false;
    map.appContextMenu({ preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
    assert.equal(prevented, true);
    map.appMouseDown({ button: 2, target, clientX: 40, clientY: 40, preventDefault() {} });
    map.appMouseUp({ button: 2 }); prevented = false;
    map.appContextMenu({ preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
    assert.equal(prevented, false);
});

test('ordinary text and images paste as an ordered forest and undo/redo once', async () => {
    const map = keyboardFixture(); const target = map.root;
    const images = [{ type: 'image/png' }, { type: 'image/jpeg' }];
    let saved = 0; map.view.saveClipboardImage = async () => `![[Assets/image-${++saved}.png]]`;
    await map.pasteContent('First\r\n\r\n**Second**', images, target);
    assert.deepEqual(target.children.map(n => n.data.text), ['First', '**Second**', '![[Assets/image-1.png]]', '![[Assets/image-2.png]]']);
    assert.equal(map.exec.history.undos.length, 1);
    map.undo(); assert.equal(target.children.length, 0);
    map.redo(); assert.equal(target.children.length, 4); assert.equal(saved, 2);
});

test('internal subtree takes precedence over image representations and stays intact', async () => {
    const map = keyboardFixture(); let saved = 0;
    map.view.saveClipboardImage = async () => { saved++; };
    await map.pasteContent(clipboard.serializeSubtree(source()), [{}], map.root);
    assert.equal(saved, 0); assert.equal(map.root.children.length, 1);
    assert.equal(map.root.children[0].children[0].children.length, 1);
});

test('async image paste refuses removed destinations or editors, and failure creates no partial nodes', async () => {
    const map = keyboardFixture(); const target = add(map, map.root, 'Target');
    map.view.saveClipboardImage = async () => { map.removeNode(target); return '![[image.png]]'; };
    await map.pasteContent('Text', [{}], target); assert.equal(target.children.length, 0);
    map.view.saveClipboardImage = async () => { throw new Error('Write failed'); };
    await map.pasteContent('Text', [{}], map.root); assert.equal(map.root.children.length, 0);
    map.root.data.isEdit = true;
    await map.pasteContent('Text', [], map.root); assert.equal(map.root.children.length, 0);
});

test('clipboard API reads mixed text/image, falls back to text, and uses root without selection', async () => {
    const map = keyboardFixture(); map.selectNode = null;
    map.view.saveClipboardImage = async () => '![[picture.png]]';
    clipboardNavigator.clipboard = { read: async () => [{ types: ['text/plain', 'image/png'], getType: async type => type === 'text/plain' ? { text: async () => 'Text' } : { type } }] };
    await map.pasteFromClipboard(); assert.deepEqual(map.root.children.map(n => n.data.text), ['Text', '![[picture.png]]']);
    clipboardNavigator.clipboard = { read: async () => { throw Error('Permission'); }, readText: async () => 'Fallback' };
    await map.pasteFromClipboard(); assert.equal(map.root.children.at(-1).data.text, 'Fallback');
});

test('native paste event creates nodes only inside active map and outside text editing', async () => {
    const map = keyboardFixture(); let called = 0;
    map.pasteContent = async (text, images, target) => { called++; assert.equal(text, 'Text'); assert.equal(images.length, 1); assert.equal(target, map.root); };
    const event = { target: { closest: () => null }, clipboardData: { getData: () => 'Text', files: [{ type: 'image/png' }, { type: 'application/pdf' }] }, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() {} };
    map.appPaste(event); assert.equal(called, 1); assert.equal(event.defaultPrevented, true);
    map.appPaste({ ...event, defaultPrevented: false, target: { closest: () => ({}) } }); assert.equal(called, 1);
    map.root.data.isEdit = true; map.appPaste({ ...event, defaultPrevented: false }); assert.equal(called, 1);
});


test('click/double-click inside the current editor leave native caret and text selection untouched', () => {
    const map = keyboardFixture(); const n = map.root; const inner = {};
    n.data.isEdit = true; map.editNode = n; n.contentEl = { contains: target => target === inner };
    map.setSelectedNodes = () => { throw Error('Editor must not be reselected'); };
    map._suppressClickUntil = Date.now() + 100;
    const event = { target: inner, ctrlKey: true, shiftKey: true, preventDefault() { throw Error('Native editor input must not be blocked'); } };
    map.appClickFn(event); map.appDblclickFn(event); map.appDragstart(event);
    assert.equal(n.data.isEdit, true); assert.equal(map.editNode, n);
    assert.equal(map._selectionStart, undefined);
});

test('editor text drag released outside preserves editing, but the next deliberate click commits', () => {
    const map = keyboardFixture(); const node = map.root; const inner = {};
    node.data.isEdit = true; node.contentEl = { contains: target => target === inner }; map.editNode = node;
    let commits = 0; node.cancelEdit = () => { node.data.isEdit = false; commits++; };
    const outside = { tagName: 'DIV', hasClass: () => false, closest: () => null };
    map.appMouseDown({ button: 0, target: inner });
    map.appMouseUp({ type: 'mouseup', button: 0, target: outside });
    map.appClickFn({ target: outside, preventDefault() { throw Error('Native selection must survive'); } });
    assert.equal(node.data.isEdit, true); assert.equal(commits, 0);
    assert.equal(map._selectionStart, undefined);
    // A release outside the entire graph may have no click dispatched to it.
    map.appMouseDown({ button: 0, target: inner });
    map.appMouseUp({ type: 'mouseup', button: 0, target: outside });
    map.appMouseDown({ button: 0, target: outside, preventDefault() {} });
    map.appMouseUp({ type: 'mouseup', button: 0, target: outside });
    map.appClickFn({ target: outside });
    assert.equal(node.data.isEdit, false); assert.equal(commits, 1);
});

test('window blur clears the pending editor mouse gesture', () => {
    const map = keyboardFixture(); const inner = {};
    map.root.data.isEdit = true; map.root.contentEl = { contains: target => target === inner }; map.editNode = map.root;
    map.appMouseDown({ button: 0, target: inner });
    map.appMouseUp({ type: 'blur' });
    assert.equal(map._editorMouseDown, false); assert.equal(map._editorClickPending, false);
});

test('clicking another node commits the previous editor once and selects the destination', () => {
    const map = keyboardFixture(); const edited = map.root; const other = add(map, map.root, 'Other');
    edited.data.isEdit = true; edited.contentEl = { contains: () => false }; map.editNode = edited;
    let commits = 0; edited.cancelEdit = () => { edited.data.isEdit = false; commits++; };
    const element = { getAttribute: () => other.getId() };
    const target = { tagName: 'DIV', hasClass: () => false, closest: selector => selector === '.mm-node' ? element : null };
    map.appClickFn({ target });
    assert.equal(commits, 1); assert.equal(map.editNode, null); assert.equal(map.selectNode, other);
});


test('Ctrl/Cmd+Z removes a newly added unchanged node from its auto-editor, and redo restores it', async () => {
    const map = keyboardFixture(); press(map, 'Tab'); await nextTick();
    const added = map.selectNode; assert.equal(added.data.isEdit, true);
    assert.equal(press(map, 'z', { ctrlKey: true }).defaultPrevented, true);
    assert.equal(map.root.children.length, 0); assert.equal(map.editNode, null);
    assert.equal(map.selectNode, map.root); assert.equal(map.exec.history.redos.length, 1);
    press(map, 'y', { ctrlKey: true }); await nextTick();
    assert.equal(map.root.children[0], added);
    assert.equal(press(map, 'z', { metaKey: true }).defaultPrevented, true);
    assert.equal(map.root.children.length, 0);
});

test('draft text and node creation share ordered global undo/redo', async () => {
    const map = keyboardFixture(); press(map, 'Tab'); await nextTick();
    const added = map.selectNode; added.contentEl.innerText = 'New words';
    assert.equal(press(map, 'z', { ctrlKey: true }).defaultPrevented, true);
    assert.equal(map.root.children.length, 1);
    assert.equal(added.data.text, 'Sub title');
    assert.equal(map.editNode, null);
    assert.equal(press(map, 'z', { ctrlKey: true }).defaultPrevented, true);
    assert.equal(map.root.children.length, 0);
});

test('fast undo before scheduled editor cannot refocus a removed node, even across rapid redo/undo', async () => {
    const map = keyboardFixture(); press(map, 'Tab');
    press(map, 'z', { ctrlKey: true });
    assert.equal(map.selectNode, map.root); assert.equal(map.root.children.length, 0);
    press(map, 'y', { ctrlKey: true }); press(map, 'z', { ctrlKey: true });
    await nextTick(); assert.equal(map.selectNode, map.root);
    assert.equal(map.editNode, null); assert.equal(map.root.children.length, 0);
    assert.equal(map.exec.history.undos.length, 0); assert.equal(map.exec.history.redos.length, 1);
});


test('page/body focus and no selection still undo creation, while other views and inputs retain shortcuts', async () => {
    const map = keyboardFixture(); press(map, 'Tab'); await nextTick();
    map.clearSelectNode(); map.isFocused = false;
    map.containerEL.contains = target => target !== dom.body;
    const event = press(map, 'z', { ctrlKey: true, target: dom.body });
    assert.equal(event.defaultPrevented, true); assert.equal(map.root.children.length, 0);
    map.clearSelectNode(); assert.equal(press(map, 'y', { ctrlKey: true, target: dom.body }).defaultPrevented, true);
    await nextTick(); assert.equal(map.root.children.length, 1);
    const input = { closest: () => ({}) };
    map.editNode.contentEl.contains = () => false;
    map.containerEL.contains = () => true;
    assert.equal(press(map, 'z', { ctrlKey: true, target: input }).defaultPrevented, undefined);
    map.view.app.workspace.getActiveViewOfType = () => ({});
    assert.equal(press(map, 'z', { ctrlKey: true, target: dom.body }).defaultPrevented, undefined);
});

test('existing node draft, creation, and text redo retain one unified sequence without selection', async () => {
    const map = keyboardFixture(); press(map, 'Tab'); await nextTick(); const n = map.selectNode;
    n.contentEl.innerText = 'Draft';
    press(map, 'z', { ctrlKey: true }); assert.equal(n.data.text, 'Sub title');
    map.clearSelectNode(); press(map, 'z', { ctrlKey: true }); assert.equal(map.root.children.length, 0);
    press(map, 'y', { ctrlKey: true }); await nextTick();
    press(map, 'y', { ctrlKey: true }); assert.equal(n.data.text, 'Draft');
    n.edit(); n.contentEl.innerText = 'Changed again';
    press(map, 'z', { metaKey: true }); assert.equal(n.data.text, 'Draft');
    press(map, 'z', { metaKey: true, shiftKey: true }); assert.equal(n.data.text, 'Changed again');
});


test('Ctrl/Cmd+X cuts selected subtrees once, pastes intact and supports undo/redo', async () => {
    for (const modifier of ['ctrlKey', 'metaKey']) {
        const map = keyboardFixture();
        const a = add(map, map.root, 'A'), child = add(map, a, '**Child**'), b = add(map, map.root, 'B'), target = add(map, map.root, 'Target');
        a.collapse();
        map.setSelectedNodes([b, child, a]);
        let text;
        clipboardNavigator.clipboard.writeText = async value => { text = value; };
        assert.equal(press(map, 'x', { [modifier]: true }).defaultPrevented, true);
        await nextTick();
        assert.deepEqual(map.root.children, [target]);
        assert.equal(map.exec.history.undos.length, 1);
        assert.equal(JSON.parse(text).text.length, 3);
        press(map, 'z', { ctrlKey: true });
        assert.deepEqual(map.root.children, [a, b, target]);
        assert.equal(a.children[0], child);
        press(map, 'y', { ctrlKey: true });
        assert.deepEqual(map.root.children, [target]);
        map.setSelectedNodes([target]);
        map.pasteNode(text);
        assert.deepEqual(target.children.map(n => n.data.text), ['A', 'B']);
        assert.equal(target.children[0].isExpand, false);
        assert.equal(target.children[0].children[0].data.text, '**Child**');
        press(map, 'z', { ctrlKey: true });
        assert.equal(target.children.length, 0);
        press(map, 'z', { ctrlKey: true });
        assert.deepEqual(map.root.children, [a, b, target]);
    }
});

test('cut protects roots, native text editing and failed clipboard writes', async () => {
    const map = keyboardFixture();
    const a = add(map, map.root, 'A');
    let writes = 0;
    clipboardNavigator.clipboard.writeText = async () => { writes++; throw Error('denied'); };
    map.setSelectedNodes([map.root]);
    await map.cutSelectedNodes();
    assert.equal(writes, 0);
    map.setSelectedNodes([a]);
    a.edit();
    assert.ok(!press(map, 'x', { ctrlKey: true }).defaultPrevented);
    assert.equal(writes, 0);
    a.cancelEdit(); map.editNode = null;
    const before = notices.length;
    press(map, 'x', { ctrlKey: true }); await nextTick();
    assert.equal(writes, 1);
    assert.deepEqual(map.root.children, [a]);
    assert.equal(map.exec.history.undos.length, 0);
    assert.equal(notices.length, before + 1);
    assert.ok(!press(map, 'x', { ctrlKey: true, target: { closest: () => ({}) } }).defaultPrevented);
    map.view.app.workspace.getActiveViewOfType = () => null;
    assert.ok(!press(map, 'x', { ctrlKey: true }).defaultPrevented);
});

test('delayed cut never deletes edited, removed or inactive nodes', async () => {
    for (const change of ['text', 'editor', 'removed', 'inactive']) {
        const map = keyboardFixture(); const a = add(map, map.root, 'A');
        map.setSelectedNodes([a]);
        let resolve;
        clipboardNavigator.clipboard.writeText = () => new Promise(done => { resolve = done; });
        const pending = map.cutSelectedNodes();
        if (change === 'text') a.data.text = 'Changed';
        if (change === 'editor') a.edit();
        if (change === 'removed') map.removeNode(a);
        if (change === 'inactive') map.view.app.workspace.getActiveViewOfType = () => null;
        resolve(); await pending;
        assert.equal(map.exec.history.undos.length, 0);
        if (change !== 'removed') assert.deepEqual(map.root.children, [a]);
    }
});
