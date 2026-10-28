import test from 'node:test';
import assert from 'node:assert/strict';
import { saveReplay, loadReplays, loadReplay } from './replay-storage.mjs';
const memory=()=>{const data=new Map();return {setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)??null};};
test('keeps the newest ten command recordings with setup for exact map and side',()=>{
 const store=memory();
 for(let seed=0;seed<12;seed++) assert.equal(saveReplay({seed,ticks:[{tick:0,commands:{0:[{type:'stop'}],1:[]}}]},new URLSearchParams('map=ladder&side=1&difficulty=hard&keys=classic'),store),true);
 const records=loadReplays(store); assert.equal(records.length,10); assert.deepEqual(records.map(r=>r.seed),[11,10,9,8,7,6,5,4,3,2]);
 assert.equal(loadReplay('last',store).seed,11); assert.equal(loadReplay('9',store).seed,2); assert.equal(loadReplay('10',store),null);
 assert.equal(records[0].setup.map,'ladder'); assert.equal(records[0].setup.side,'1'); assert.equal(records[0].commands[0][0][0].type,'stop');
});
test('storage errors are safe and old single replay migrates on read',()=>{
 const store=memory(); store.setItem('toaster-last-match',JSON.stringify({seed:7,commands:{},maxTicks:2})); assert.equal(loadReplay('last',store).seed,7);
 assert.deepEqual(loadReplays({getItem:()=>'{bad'}),[]);
 assert.equal(saveReplay({seed:1,ticks:[]},'',{getItem:()=>null,setItem:()=>{throw Error('quota');}}),false);
});
