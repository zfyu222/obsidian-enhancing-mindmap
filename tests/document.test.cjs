const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:id=>deps[id]||{},console,setTimeout,clearTimeout});return module.exports;}
const styles=load('src/nodeStyles.ts');
const summary=load('src/summary/markdown.ts',{'../nodeStyles':styles});
const relations=load('src/relations/model.ts');
const pages=load('src/pages/model.ts');
const documentModule=load('src/pages/document.ts',{'../relations/model':relations,'../summary/markdown':summary,'./model':pages});

const marker=(id,name)=>`<!-- mm:page {"id":"${id}","name":"${name}"} -->`;
const single='# Root\n- One\n- Two';
const relation='<!-- mm:relations {"version":1,"links":[{"id":"r-1","from":"a","to":"b"}]} -->';

test('a single page note round-trips unchanged and only reports one page',()=>{
 const doc=new documentModule.PageDocument(single);
 assert.equal(doc.marked,false);
 assert.equal(doc.pages.length,1);
 assert.equal(doc.active().tree,single);
 assert.equal(doc.compose(''),single);
 assert.equal(doc.compose('<!-- mm:grafts {"version":1,"links":[]} -->'),single+'\n\n<!-- mm:grafts {"version":1,"links":[]} -->');
});

test('multi page notes keep per-page bodies, order and metadata scope',()=>{
 const source=[marker('pg-a','Page A'),'# A','- One <!-- mm:node {"id":"a"} -->','- Two <!-- mm:node {"id":"b"} -->',relation,marker('pg-b','Page B'),'# B','- B1'].join('\n');
 const doc=new documentModule.PageDocument(source);
 assert.equal(doc.marked,true);
 assert.equal(doc.pages.length,2);
 assert.equal(doc.pages[0].meta.name,'Page A');
 assert.equal(doc.pages[0].relations.entries.length,1);
 assert.equal(doc.pages[1].relations.entries.length,0);
 assert.equal(doc.pages[1].tree,'# B\n- B1');
 assert.equal(doc.active().meta.id,'pg-a');
 // Page bodies and their own metadata are preserved; only marker spacing normalizes.
 const written=doc.compose('');
 assert.ok(written.includes('# A\n- One <!-- mm:node {"id":"a"} -->\n- Two <!-- mm:node {"id":"b"} -->\n'+relation));
 assert.ok(written.includes(`${marker('pg-b','Page B')}\n\n# B\n- B1`));
 const again=new documentModule.PageDocument(written);
 assert.equal(again.pages.length,2);
 assert.equal(again.pages[0].tree,'# A\n- One <!-- mm:node {"id":"a"} -->\n- Two <!-- mm:node {"id":"b"} -->');
 assert.equal(again.pages[0].relations.entries.length,1);
 assert.equal(again.pages[1].tree,'# B\n- B1');
});

test('adding and renaming a page writes markers for every page and keeps the original body',()=>{
 const doc=new documentModule.PageDocument(single);
 doc.add('Page 2','# Page 2');
 assert.equal(doc.marked,true);
 assert.equal(doc.active().meta.name,'Page 2');
 const written=doc.compose('');
 assert.ok(written.startsWith(marker(doc.pages[0].meta.id,'Page 1')));
 assert.ok(written.includes(single+'\n\n'));
 assert.ok(written.includes('# Page 2'));
 const reloaded=new documentModule.PageDocument(written);
 assert.equal(reloaded.pages.length,2);
 assert.equal(reloaded.pages[0].tree,single);
 assert.equal(reloaded.rename(reloaded.pages[1].meta.id,'Renamed'),true);
 assert.equal(reloaded.compose('').includes(marker(reloaded.pages[1].meta.id,'Renamed')),true);
 assert.equal(reloaded.rename(reloaded.pages[1].meta.id,'   '),false);
 assert.equal(reloaded.rename('missing','Name'),false);
});

test('pages added in mind map survive a Windows Markdown save and reopen independently',()=>{
 const doc=new documentModule.PageDocument(single);
 const added=doc.add('Page 2','# Page 2\n- Only on page two');
 const windows=doc.compose('').replace(/\n/g,'\r\n');
 const reopened=new documentModule.PageDocument(windows,added.meta.id);
 assert.equal(reopened.error,'');
 assert.equal(reopened.pages.length,2);
 assert.equal(reopened.pages[0].tree,single);
 assert.equal(reopened.active().tree,'# Page 2\n- Only on page two');
 assert.equal(reopened.active().meta.id,added.meta.id);
});

test('deleting pages falls back to a neighbour and refuses to remove the last page',()=>{
 const doc=new documentModule.PageDocument([marker('pg-a','A'),'# A',marker('pg-b','B'),'# B',marker('pg-c','C'),'# C'].join('\n\n'));
 doc.setActive('pg-c');
 assert.equal(doc.remove('pg-c').meta.id,'pg-c');
 assert.equal(doc.activePageId,'pg-b');
 assert.equal(doc.pages.length,2);
 assert.equal(doc.compose('').includes('# C'),false);
 assert.equal(doc.remove('pg-b').meta.id,'pg-b');
 assert.equal(doc.activePageId,'pg-a');
 assert.equal(doc.remove('pg-a'),undefined);
 assert.equal(doc.pages.length,1);
});

test('capturing a page replaces its tree and metadata without touching other pages',()=>{
 const doc=new documentModule.PageDocument([marker('pg-a','A'),'# A',marker('pg-b','B'),'# B'].join('\n\n'));
 doc.capture('pg-a',{
  tree:'# A2\n- New <!-- mm:node {"id":"x"} -->',
  relationsMarkdown:relation,
  summariesMarkdown:'<!-- mm:summaries:start {"version":1} -->\n## 概括子树区\n\n### S <!-- mm:summary {"id":"s","members":["x"]} -->\n\n<!-- mm:summaries:end -->',
  relations:{entries:[{id:'r-1',from:'a',to:'b'}],preserved:'',raw:''},
  summaries:{entries:[],preserved:'',raw:''}
 });
 const written=doc.compose('');
 assert.ok(written.includes('# A2'));
 assert.ok(written.includes(relation));
 assert.ok(written.includes('mm:summary'));
 assert.equal(doc.pages[1].content,'# B');
 assert.equal(doc.pages[0].data,undefined);
});

test('reload keeps the active page when it still exists and falls back otherwise',()=>{
 const source=[marker('pg-a','A'),'# A',marker('pg-b','B'),'# B'].join('\n\n');
 const kept=new documentModule.PageDocument(source,'pg-b');
 assert.equal(kept.activePageId,'pg-b');
 const fallback=new documentModule.PageDocument(source,'gone');
 assert.equal(fallback.activePageId,'pg-a');
});

test('invalid markers are reported and leave a single readable page',()=>{
 const doc=new documentModule.PageDocument(['# Root','<!-- mm:page {broken} -->','- One'].join('\n'));
 assert.ok(doc.error);
 assert.equal(doc.pages.length,1);
 assert.ok(doc.pages[0].tree.includes('{broken}'));
});

test('empty pages survive reload so an empty new page is not dropped',()=>{
 const doc=new documentModule.PageDocument([marker('pg-a','A'),'# A',marker('pg-b','Empty')].join('\n\n'));
 assert.equal(doc.pages.length,2);
 assert.equal(doc.pages[1].tree,'');
 const written=doc.compose('');
 const again=new documentModule.PageDocument(written);
 assert.equal(again.pages.length,2);
 assert.equal(again.pages[1].meta.name,'Empty');
});
