const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:id=>deps[id]||{},console,setTimeout,clearTimeout});return module.exports;}
const styles=load('src/nodeStyles.ts');
const model=load('src/pages/model.ts');
const serialize=load('src/pages/serialize.ts',{'../nodeStyles':styles});

const marker=(id,name)=>`<!-- mm:page {"id":"${id}","name":"${name}"} -->`;

test('a file without markers is one unnamed page and is written back verbatim',()=>{
 const source='# Root\n- One\n- Two';
 const result=model.splitPages(source);
 assert.equal(result.marked,false);
 assert.equal(result.error,'');
 assert.equal(result.pages.length,1);
 assert.equal(result.pages[0].body,source);
 assert.equal(result.pages[0].startLine,0);
 assert.equal(model.serializePages([{meta:result.pages[0].meta,content:source}],false),source);
});

test('page markers split blocks in order and round-trip through serialization',()=>{
 const source=[marker('pg-a','Page A'),'','# A','- a1','','',marker('pg-b','Page B'),'','# B','- b1'].join('\n');
 const result=model.splitPages(source);
 assert.equal(result.marked,true);
 assert.equal(JSON.stringify(result.pages.map(page=>page.meta)),JSON.stringify([{id:'pg-a',name:'Page A'},{id:'pg-b',name:'Page B'}]));
 assert.equal(result.pages[0].body,'# A\n- a1');
 assert.equal(result.pages[1].body,'# B\n- b1');
 const written=model.serializePages(result.pages.map(page=>({meta:page.meta,content:page.body})),true);
 const again=model.splitPages(written);
 assert.equal(JSON.stringify(again.pages.map(page=>page.meta)),JSON.stringify(result.pages.map(page=>page.meta)));
 assert.equal(JSON.stringify(again.pages.map(page=>page.body)),JSON.stringify(result.pages.map(page=>page.body)));
 assert.equal(model.serializePages(result.pages.map(page=>({meta:page.meta,content:page.body})),true),written);
});

test('an empty page keeps its marker and position',()=>{
 const result=model.splitPages([marker('pg-a','A'),'# A',marker('pg-b','Empty'),marker('pg-c','C'),'# C'].join('\n\n'));
 assert.equal(result.pages.length,3);
 assert.equal(result.pages[1].body,'');
 assert.equal(result.pages[2].body,'# C');
 assert.ok(model.serializePages(result.pages.map(page=>({meta:page.meta,content:page.body})),true).includes(marker('pg-b','Empty')));
});

test('markers inside code fences and other mm metadata are not page boundaries',()=>{
 const source=['# Root','```md',marker('pg-fake','Fake'),'-->','```','- <!-- mm:style {"name":"重点"} -->'].join('\n');
 const result=model.splitPages(source);
 assert.equal(result.marked,false);
 assert.equal(result.pages.length,1);
 assert.ok(result.pages[0].body.includes(marker('pg-fake','Fake')));
});

test('malformed, unknown and duplicate markers are reported and never dropped',()=>{
 const malformed=model.splitPages(['# Root',marker('pg-a','A'),'# A','<!-- mm:page {broken} -->'].join('\n'));
 assert.ok(malformed.error);
 assert.equal(malformed.pages.length,1);
 assert.ok(malformed.pages[0].body.includes('{broken}'));

 const unknown=model.splitPages(['# Root','<!-- mm:page {"id":"pg-a","name":"A","extra":1} -->'].join('\n'));
 assert.ok(unknown.error);
 assert.equal(unknown.pages.length,1);

 const duplicate=model.splitPages([marker('pg-a','A'),'# A',marker('pg-a','Again'),'# B'].join('\n'));
 assert.ok(duplicate.error);
 assert.equal(duplicate.pages.length,1);
 assert.ok(duplicate.pages[0].body.includes('# B'));
});

test('content before the first marker stays with the first page',()=>{
 const result=model.splitPages(['# Preamble',marker('pg-a','A'),'# A'].join('\n'));
 assert.equal(result.pages.length,1);
 assert.equal(result.pages[0].body,'# Preamble\n# A');
 assert.equal(result.pages[0].startLine,0);
});

test('page names are trimmed, bounded and stripped of control characters',()=>{
 assert.equal(model.cleanPageName('  Page 1  '),'Page 1');
 assert.equal(model.cleanPageName('line\nbreak'),'line break');
 assert.equal(model.cleanPageName('a\u0000b'),'a b');
 assert.equal(model.cleanPageName('x'.repeat(200)).length,80);
 assert.equal(model.cleanPageName(42),'');
 assert.ok(model.pageMarker({id:'pg-1',name:' "quoted" '}).startsWith('<!-- mm:page {"id":"pg-1","name":"\\"quoted\\""} -->'));
});

test('tree serialization keeps headings, list depth, styles, stable IDs and block content',()=>{
 const root={id:'r',text:'Root',children:[
  {id:'a',text:'Child',stylePreset:'重点',children:[{id:'a1',text:'Grand',children:[{id:'a2',text:'Second list level',children:[]}]}]},
  {id:'b',text:'',children:[]},
  {id:'c',text:'```ts\nconst x = 1;\n```',children:[{id:'c1',text:'After code',children:[]}]},
  {id:'d',text:'| a | b |',graftMember:true,children:[]}
 ]};
 const out=serialize.treeMarkdown(root,2);
 assert.ok(out.startsWith('# Root'));
 assert.ok(out.includes('## Child <!-- mm:style {"name":"重点"} -->'));
 assert.ok(out.includes('\n- Grand'));
 assert.ok(out.includes('\n\t- Second list level'));
 assert.ok(out.includes('```ts')&&out.includes('const x = 1;'));
 assert.ok(out.includes('<!-- mm:node {"id":"d"} -->'));
 assert.ok(out.includes('- After code'));
 assert.equal(serialize.treeMarkdown({data:{id:'r',text:'Root'},children:[]},2),'# Root');
 assert.equal(serialize.treeMarkdown({id:'r',text:'Root',children:[]},0),'# Root');
 const deep=serialize.treeMarkdown({id:'r',text:'Root',children:[{id:'a',text:'A',children:[]}]},7);
 assert.equal(deep,'# Root\n\n## A');
});

test('compose helpers keep section order and skip empty metadata',()=>{
 assert.equal(model.composePage('# A','',''),'# A');
 assert.equal(model.composePage('# A','<!-- mm:relations -->','<!-- mm:summaries:start -->'),'# A\n\n<!-- mm:relations -->\n\n<!-- mm:summaries:start -->');
 assert.equal(model.composeSinglePage('# A','R','G','S'),'# A\n\nR\n\nG\n\nS');
 assert.equal(model.composeSinglePage('# A','','',''),'# A');
});
