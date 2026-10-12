const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const parser = require('../src/markmapLib/markmap-lib/dist/browser/index.js');

function load(file, dependencies = {}) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports,
        require: id => dependencies[id] || {}, console,
        setTimeout, clearTimeout, document: { createElement: () => ({ style: {} }) }, window: {} });
    return module.exports;
}
const obsidian = { TextFileView: class {}, MarkdownRenderer: {
    async renderMarkdown(text, el) { el.innerHTML = text; }
} };
const { default: Node } = load('src/mindmap/INode.ts', { obsidian });
const commands = load('src/mindmap/Cmds.ts');
const { default: History } = load('src/mindmap/History.ts');
const { default: MindMap } = load('src/mindmap/mindmap.ts');
const { MindMapView } = load('src/MindMapView.ts', {
    obsidian, './markmapLib/markmap-lib': parser
});
function node(text, parent = null, expanded = true) {
    const n = Object.create(Node.prototype);
    Object.assign(n, { data: { id: `id-${++serial}`, text, isRoot: !parent },
        parent, children: [], isExpand: expanded, contentEl: { innerHTML: '', innerText: '', setAttribute() {} },
        containEl: { classList: { contains: () => false } }, refreshBox() {}, _delay() {} });
    if (parent) parent.children.push(n);
    return n;
}
let serial = 0;
test('clearing actual node edit commits empty text, preserves children, and supports undo/redo', async () => {
    const history = new History();
    const map = { path: '', emit() {}, execute(_, data) {
        history.execute(new commands.ChangeNodeText(data.node, data.oldText, data.text));
    } };
    const n = node('Original'); n.mindmap = map;
    const child = node('Child', n);
    n._oldText = n.data.text; n.data.isEdit = true;
    n.contentEl.innerText = ' \n ';
    n.cancelEdit(); await Promise.resolve();
    assert.equal(n.data.text, ''); assert.equal(n.data.mdText, '');
    assert.equal(n.data.isEdit, false); assert.equal(n.children[0], child);
    assert.equal(history.undos.length, 1);
    history.undo(); await Promise.resolve(); assert.equal(n.data.text, 'Original');
    history.redo(); await Promise.resolve(); assert.equal(n.data.text, '');
    n._oldText = ''; n.cancelEdit();
    assert.equal(history.undos.length, 1, 'unchanged empty node creates no extra edit');
});
function roundTrip(root, headLevel) {
    const map = Object.create(MindMap.prototype);
    map.root = root; map.setting = { headLevel };
    map.traverseDF = (callback, n) => { callback(n); n.children.forEach(c => map.traverseDF(callback, c)); };
    function bind(n) { n.mindmap = map; n.children.forEach(bind); } bind(root);
    const md = map.getMarkdown();
    const view = Object.create(MindMapView.prototype);
    return { md, data: view.mdToData(md) };
}
for (const headLevel of [1, 2, 3]) {
    test(`empty nodes round-trip ordinary Markdown at heading depth ${headLevel}`, () => {
        const root = node('');
        const empty = node('', root);
        const nested = node('', empty, false);
        node('Child', nested); node('', nested); node('', root); node('Sibling', root);
        const { md, data } = roundTrip(root, headLevel);
        assert.equal(data.text, ''); assert.equal(data.children.length, 3);
        const restored = data.children[0]; assert.equal(restored.text, '');
        assert.equal(restored.children[0].text, '');
        assert.equal(restored.children[0].id, nested.data.id);
        assert.equal(restored.children[0].expanded, false);
        assert.equal(restored.children[0].children[0].text, 'Child');
        assert.equal(restored.children[0].children[1].text, '');
        assert.equal(data.children[1].text, ''); assert.equal(data.children[2].text, 'Sibling');
        assert.ok(!md.includes('Sub title')); assert.ok(!md.includes('<span'));
    });
}
test('single empty root survives serialization and collapsed root preserves ID', () => {
    const root = node(''); assert.equal(roundTrip(root, 2).data.text, '');
    root.isExpand = false;
    const { data } = roundTrip(root, 2);
    assert.equal(data.text, ''); assert.equal(data.id, root.data.id); assert.equal(data.expanded, false);
});
test('explicitly empty new node remains empty while omitted text uses the default', () => {
    const added = [];
    class NewNode { constructor(data) { this.data = data; } }
    const { default: Exec } = load('src/mindmap/Execute.ts', {
        './INode': { default: NewNode }, '../MindMapView': { uuid: () => 'id' },
        '../lang/helpers': { t: text => text }, './History': { default: class { execute() {} } },
        './Cmds': { AddNode: class { constructor(n) { added.push(n); } } }
    });
    const exec = new Exec(); const parent = { mindmap: {} };
    exec.execute('addChildNode', { parent, text: '' });
    exec.execute('addChildNode', { parent });
    assert.equal(added[0].data.text, ''); assert.equal(added[1].data.text, 'Sub title');
});


test('image attachment uses configured folder and generates a durable Markdown embed', async () => {
    const view = Object.create(MindMapView.prototype); view.file = { path: 'Notes/map.md' };
    const calls = [];
    view.app = { fileManager: {
        async getAvailablePathForAttachment(name, source) { calls.push([name, source]); return 'Assets/picture.png'; },
        generateMarkdownLink(file, source) { assert.equal(source, 'Notes/map.md'); return `[[${file.path}]]`; }
    }, vault: { async createBinary(path, buffer) { assert.equal(path, 'Assets/picture.png'); assert.equal(buffer.byteLength, 3); return { path }; } } };
    const link = await view.saveClipboardImage({ type: 'image/png', arrayBuffer: async () => new ArrayBuffer(3) });
    assert.equal(link, '![[Assets/picture.png]]'); assert.match(calls[0][0], /\.png$/); assert.equal(calls[0][1], view.file.path);
    await assert.rejects(view.saveClipboardImage({ type: 'image/unknown' }), /Unsupported/);
    delete view.app.fileManager.getAvailablePathForAttachment;
    await assert.rejects(view.saveClipboardImage({ type: 'image/png' }), /1.5.7/);
});
