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
}
const { PasteNode } = load('src/mindmap/Cmds.ts', { './INode': { default: Node } });
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
    const event = { key: 'c', ctrlKey: true, target: null, preventDefault() {}, stopPropagation() {} };
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
