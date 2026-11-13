const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const JSZip = require('jszip');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  });
  module._compile(outputText, filename);
};
const { convertXmind } = require('../src/mindmap/import/xmind.ts');
const { basicFrontmatter } = require('../src/constants.ts');
const { PageDocument } = require('../src/pages/document.ts');
const { prepareMainMarkdown, sourceNodeContent } = require('../src/summary/markdown.ts');
const { Transformer } = require('../src/markmapLib/markmap-lib/dist/browser/index.js');
delete require.extensions['.ts'];

async function archive(sheets) {
  const zip = new JSZip();
  zip.file('content.json', JSON.stringify(sheets));
  zip.file('content.xml', '<unused/>');
  zip.file('resources/test.png', new Uint8Array([1, 2, 3]));
  return zip.generateAsync({ type: 'arraybuffer' });
}

function readPages(result) {
  return new PageDocument(result.markdown.slice(basicFrontmatter.length));
}

test('XMind sheets round-trip in order with independent trees, summaries, relations and shared images', async () => {
  const source = await archive([{
    title: 'First sheet',
    rootTopic: {
      id: 'root', title: 'First root', children: {
        attached: [
          { id: 'a', title: 'A\n# Literal', children: { attached: [{ title: 'Grandchild' }] } },
          { id: 'b', title: 'B', image: { src: 'xap:resources/test.png' } }
        ],
        detached: [{ title: 'Floating topic' }],
        summary: [{ id: 's', title: 'Summary', children: { attached: [{ title: 'Detail' }] } }]
      },
      summaries: [{ range: '(0,1)', topicId: 's' }]
    },
    relationships: [{ end1Id: 's', end2Id: 'b' }]
  }, {
    title: 'Second sheet',
    rootTopic: { id: 'root', title: 'Other root', image: { src: 'xap:resources/test.png' } }
  }]);
  const result = await convertXmind(source, 2, 'example');
  assert.equal(result.nodeCount, 8);
  assert.equal(result.assets.length, 1);
  assert.deepEqual([...new Uint8Array(result.assets[0].data)], [1, 2, 3]);
  const doc = readPages(result);
  assert.equal(doc.error, '');
  assert.deepEqual(doc.pages.map(page => page.meta.name), ['First sheet', 'Second sheet']);
  assert.match(doc.pages[0].tree, /## A.*\n\\# Literal/);
  assert.match(doc.pages[0].tree, /- Grandchild/);
  assert.match(doc.pages[0].tree, /## Floating topic/);
  assert.match(doc.pages[1].tree, /!\[\[Assets\/example-1.png\]\]/);
  const [summary] = doc.pages[0].summaries.entries;
  assert.equal(summary.root.children[0].text, 'Detail');
  assert.deepEqual(summary.memberIds, ['xmind-2', 'xmind-4']);
  assert.deepEqual(doc.pages[0].relations.entries.map(({ from, to }) => [from, to]), [[summary.id, 'xmind-4']]);
  assert.equal(doc.pages[1].relations.entries.length, 0);
  assert.equal(doc.compose('') + '\n', result.markdown.slice(basicFrontmatter.length));
});

test('XMind import rejects a malformed workbook', async () => {
  await assert.rejects(convertXmind(await archive([{ title: 'Empty' }]), 2, 'example'), /Invalid XMind topic/);
});

if (process.env.XMIND_SAMPLE) {
  test('the supplied workbook opens with all 9 pages and all 877 topics', async () => {
    const source = Uint8Array.from(fs.readFileSync(process.env.XMIND_SAMPLE)).buffer;
    const result = await convertXmind(source, 2, 'example');
    const doc = readPages(result);
    assert.equal(doc.error, '');
    assert.equal(result.pageCount, 9);
    assert.equal(result.nodeCount, 877);
    assert.equal(result.assets.length, 3);
    assert.equal(result.skippedImages, 0);
    const transformer = new Transformer();
    let count = 0, summaries = 0, relations = 0;
    for (const page of doc.pages) {
      assert.equal(page.summaries.preserved, '');
      assert.equal(page.relations.preserved, '');
      const prepared = prepareMainMarkdown(page.tree);
      const { root } = transformer.transform(prepared.text);
      const ids = new Set();
      const visit = node => {
        if (node.t === 'heading' || node.t === 'list_item') {
          const source = sourceNodeContent(node, prepared);
          if (source.stableId) ids.add(source.stableId);
          count++;
        }
        (node.c || []).forEach(visit);
      };
      visit(root);
      const visitSummary = node => { ids.add(node.id); count++; node.children.forEach(visitSummary); };
      for (const summary of page.summaries.entries) visitSummary(summary.root);
      for (const summary of page.summaries.entries) {
        assert.ok(summary.memberIds.every(id => ids.has(id)));
        summaries++;
      }
      for (const relation of page.relations.entries) {
        assert.ok(ids.has(relation.from) && ids.has(relation.to));
        relations++;
      }
    }
    assert.equal(count, 877);
    assert.equal(summaries, 12);
    assert.equal(relations, 1);
  });
}
