const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const moduleData={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/mindmap/keyword-highlights.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:moduleData,exports:moduleData.exports});
const matches=(...args)=>JSON.parse(JSON.stringify(moduleData.exports.keywordMatches(...args)));
test('whole-word matching is the default and recognizes identifier boundaries',()=>{
 const text='State State() State.Value bState StateMachine State_1 State2 _State';
 assert.deepEqual(matches(text,['State']),[[0,5],[6,11],[14,19]]);
 assert.equal(matches(text,['State'],false).length,8);
 assert.deepEqual(matches('state STATE State',['State']),[[12,17]]);
});
test('keywords are literal, overlapping matches merge and blank keywords are ignored',()=>{
 assert.deepEqual(matches('a.b aXb (x)',['a.b','(x)','']),[[0,3],[8,11]]);
 assert.deepEqual(matches('State.Value',['State','State.Value']),[[0,11]]);
 assert.deepEqual(matches('ababa',['aba','bab'],false),[[0,5]]);
});
test('Unicode letters, combining marks, Chinese, punctuation and emoji have explicit boundaries',()=>{
 assert.deepEqual(matches('回滚，回滚中；回滚。',['回滚']),[[0,2],[7,9]]);
 assert.deepEqual(matches('😀State😀',['State']),[[2,7]]);
 assert.deepEqual(matches('éState Staté State',['State']),[[14,19]]);
});
