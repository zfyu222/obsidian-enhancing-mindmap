// Exercise keyboard handling from the generated release bundle, not the TS source.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const bundle = ts.createSourceFile('main.js', fs.readFileSync('main.js', 'utf8'), ts.ScriptTarget.Latest, true);
const declarations = new Map();
function visit(node) {
    if ((ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name) {
        declarations.set(node.name.text, node.getText(bundle));
    }
    ts.forEachChild(node, visit);
}
visit(bundle);
const code = ['clipboardAction', 'selectionRoots', 'containsNode', 'selectionRect', 'intersectsRect', 'MindMap'].map(name => {
    assert.ok(declarations.has(name), `Release bundle missing ${name}`);
    return declarations.get(name);
}).join('\n');
const MindMap = vm.runInNewContext(`${code}\nMindMap`, { MindMapView: class {} });
const map = Object.create(MindMap.prototype);
map.isFocused = true;
map.view = { app: { workspace: { getActiveViewOfType: () => map.view } } };
map._menuDom = { style: {} };
const parent = { children: [] };
map.selectNode = { data: {}, isExpand: true, parent };
parent.children.push(map.selectNode);
const operations = [];
map.execute = (command, data) => operations.push([command, data]);
map.undo = () => operations.push(['undo']);
map.redo = () => operations.push(['redo']);
function key(key, props = {}) {
    const e = { key, target: null, preventDefault() { this.defaultPrevented = true; },
        stopPropagation() {}, stopImmediatePropagation() {}, ...props };
    map.appKeydown(e);
    assert.equal(e.defaultPrevented, true);
}
key('Tab');
key('Enter');
key('z', { ctrlKey: true });
key('y', { ctrlKey: true });
assert.deepEqual(operations.map(([command]) => command), ['addChildNode', 'addSiblingNode', 'undo', 'redo']);
assert.equal(operations[1][1].index, 1);
map.root = { children: [] };
const a = { parent: map.root, children: [], data: {} };
const child = { parent: a, children: [], data: {} };
const b = { parent: map.root, children: [], data: {} };
map.root.children = [a, b]; a.children = [child];
map.selectedNodes = [b, child, a];
const roots = map.getSelectedRoots();
assert.equal(roots.length, 2);
assert.equal(roots[0], a);
assert.equal(roots[1], b);
map._menuDom = { style: {} };
map.deleteSelectedNodes();
assert.equal(operations[4][0], 'removeNodes');
assert.equal(operations[4][1].nodes.length, 2);
console.log('Release bundle keyboard smoke check passed (Tab, Enter, Ctrl+Z/Y).');

// Exercise the bundled parser cleanup: empty content is a real node, not a wrapper.
const cleanNode = vm.runInNewContext(`${declarations.get('cleanNode')}\ncleanNode`, {
    _extends: Object.assign, _extends$1: Object.assign
});
const tree = { t: 'root', v: '', p: {}, c: [{ t: 'heading', v: '', p: {}, c: [
    { t: 'bullet_list', v: '', p: {}, c: [{ t: 'list_item', v: '', p: {}, c: [
        { t: 'bullet_list', v: '', p: {}, c: [{ t: 'list_item', v: 'Child', p: {}, c: [] }] }
    ] }] }
] }] };
cleanNode(tree);
assert.equal(tree.c[0].t, 'heading');
assert.equal(tree.c[0].c[0].t, 'list_item');
assert.equal(tree.c[0].c[0].v, '');
assert.equal(tree.c[0].c[0].c[0].v, 'Child');
const nodeDeclaration = [...declarations.values()].find(text => text.includes('select(preserveSelection = false)'));
assert.ok(nodeDeclaration);
const ActualNode = vm.runInNewContext(`${declarations.get('__awaiter')}\nconst ActualNode = ${nodeDeclaration};\nActualNode`, {
    obsidian: { MarkdownRenderer: { renderMarkdown: async () => {} } }, console
});
const empty = Object.create(ActualNode.prototype);
empty.data = { text: 'Before' }; empty._oldText = 'Before';
empty.contentEl = { innerText: '', innerHTML: '', setAttribute() {} };
empty.containEl = { classList: { contains: () => false } };
empty.refreshBox = () => {}; empty._delay = () => {};
empty.mindmap = { emit() {}, execute(command, data) {
    assert.equal(command, 'changeNodeText'); assert.equal(data.text, '');
} };
empty.cancelEdit(); assert.equal(empty.data.text, '');
empty.parseText(); assert.equal(empty.data.text, '');
console.log('Release bundle empty-node edit, rendering and parser cleanup checks passed.');
