const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const moduleData={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/mindmap/keyword-highlights.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:moduleData,exports:moduleData.exports});
const matches=(...args)=>JSON.parse(JSON.stringify(moduleData.exports.keywordMatches(...args)));
test('colored overlaps keep the longest keyword and split remaining text without overlap',()=>{
 const spans=JSON.parse(JSON.stringify(moduleData.exports.keywordSpans('State.Value State',['State','State.Value'])));
 assert.deepEqual(spans,[{start:0,end:11,keyword:'State.Value'},{start:12,end:17,keyword:'State'}]);
 assert.deepEqual(JSON.parse(JSON.stringify(moduleData.exports.keywordSpans('abc',['ab','bc'],false))),[{start:0,end:2,keyword:'ab'},{start:2,end:3,keyword:'bc'}]);
});
test('keyword colors are distinct by default, editable, validated and retained across list changes',()=>{
 const h=Object.create(moduleData.exports.default.prototype);Object.assign(h,{keywords:[],colors:new Map(),wholeWord:true,map:{},render(){}});
 h.set(['State','Leaf']);assert.notEqual(h.color('State'),h.color('Leaf'));
 h.setColor('State','#124488');h.set(['State','Leaf','More']);assert.equal(h.color('State'),'#124488');
 h.setColor('State','red;display:none');assert.equal(h.color('State'),'#124488');
 h.set(['State'],true,['#aabbcc']);assert.equal(h.color('State'),'#aabbcc');
 assert.equal(moduleData.exports.keywordTextColor('#000000'),'#ffffff');assert.equal(moduleData.exports.keywordTextColor('#ffffff'),'#202020');
});
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
