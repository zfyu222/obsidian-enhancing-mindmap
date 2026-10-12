const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require: id => dependencies[id] || {}, console, setTimeout, clearTimeout });
    return module.exports;
}
const clipboard = load('src/mindmap/clipboard.ts');
let serial = 0;
const id = () => `new-${++serial}`;
class Node {
    constructor(data, mindmap) { this.data = data; this.mindmap = mindmap; this.children = []; this.isExpand = true; }
    getId() { return this.data.id; }
    getData() { return JSON.parse(JSON.stringify(this.data)); }
    getLevel() { return this.parent ? this.parent.getLevel() + 1 : 0; }
    expand() { this.isExpand = true; }
    collapse() { this.isExpand = false; }
    clearCacheData() {}
    setPosition() {}
    refreshBox() {}
    select() { this.mindmap.selectNode = this; }
    unSelect() {}
    edit() { this.data.isEdit = true; this.mindmap.editNode = this; }
    cancelEdit() { this.data.isEdit = false; }
}
const commands = load('src/mindmap/Cmds.ts', { './INode': { default: Node } });
const { PasteNode } = commands;
const history = load('src/mindmap/History.ts');
const { default: Exec } = load('src/mindmap/Execute.ts', {
    './History': history, './Cmds': commands, './INode': { default: Node },
    '../MindMapView': { uuid: id }, '../lang/helpers': { t: text => text }
});
const { default: MindMap } = load('src/mindmap/mindmap.ts', {
    './clipboard': clipboard, '../MindMapView': { uuid: id }, './INode': { default: Node }
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
    map.containerEL = { contains: () => true };
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

test('Tab finishes node editing once; native text undo and modified Enter/Tab remain untouched', () => {
    const map = keyboardFixture();
    let finishes = 0;
    map.root.cancelEdit = () => { finishes++; map.root.data.isEdit = false; };
    map.root.edit();
    const editor = { isContentEditable: true };
    map.root.contentEl = { contains: target => target === editor };
    assert.equal(press(map, 'z', { ctrlKey: true, target: editor }).defaultPrevented, undefined);
    assert.equal(press(map, 'Enter', { shiftKey: true, target: editor }).defaultPrevented, undefined);
    assert.equal(press(map, 'Tab', { target: editor }).defaultPrevented, true);
    assert.equal(finishes, 1);
    assert.equal(map.editNode, null);
    assert.equal(map.root.children.length, 0);
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
