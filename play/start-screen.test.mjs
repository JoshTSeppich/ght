import test from 'node:test';
import assert from 'node:assert/strict';
import { setupQuery, setupValues, setupHtml, createMenuPause, replaySetupQuery } from './start-screen.mjs';

test('setup offers ladder, both sides, four difficulties and two key profiles', () => {
  const html = setupHtml(new URLSearchParams());
  for (const value of ['ladder', 'wheatfield', 'easy', 'normal', 'hard', 'brutal', 'grid', 'classic']) assert.ok(html.includes(`value="${value}"`));
  assert.match(html, /Side 1/); assert.match(html, /Side 2/);
});
test('starting preserves graphics settings and applies chosen match settings and bot', () => {
  const q = new URLSearchParams(setupQuery('quality=low&mode=watch&replay=last&ai=sample', {map:'ladder',side:'1',difficulty:'brutal',keys:'classic'}));
  assert.equal(q.get('map'),'ladder'); assert.equal(q.get('side'),'1'); assert.equal(q.get('difficulty'),'brutal');
  assert.equal(q.get('keys'),'classic'); assert.equal(q.get('ai'),'toaster-hard'); assert.equal(q.get('quality'),'low');
  assert.equal(q.get('mode'),null); assert.equal(q.get('replay'),null); assert.equal(q.get('play'),'1');
});
test('invalid setup is normalized and replay setup restores original map and side', () => {
  assert.equal(setupValues(new URLSearchParams('map=bad&side=9&keys=bad')).map,'wheatfield');
  const q = new URLSearchParams(replaySetupQuery('map=wheatfield&side=0', {setup:{map:'ladder',side:'1',difficulty:'hard',keys:'classic'}}));
  assert.equal(q.get('map'),'ladder'); assert.equal(q.get('side'),'1'); assert.equal(q.get('mode'),'watch');
});
test('menu pause restores running or already paused game and is idempotent', () => {
  let paused=false, pauses=0, resumes=0;
  const menu=createMenuPause({isPaused:()=>paused,pause:()=>{paused=true;pauses++;},resume:()=>{paused=false;resumes++;}});
  menu.open(); menu.open(); assert.equal(pauses,1); menu.close(); menu.close(); assert.equal(resumes,1);
  paused=true; menu.open(); menu.close(); assert.equal(paused,true); assert.equal(resumes,1);
});

test('menu buttons pause, change normal-match speed, resume and preserve a manual pause', async () => {
  const {mountFlowMenu}=await import('./start-screen.mjs');
  const nodes=new Map(), listeners=new Map();
  const element=()=>({style:{},dataset:{},append(){},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);}});
  const doc={createElement:element,defaultView:{addEventListener:(name,fn)=>listeners.set(name,fn)}};
  const root={ownerDocument:doc,append(){}};
  let paused=false,speed=1,over=false;
  const menu=mountFlowMenu(root,{query:'',isPaused:()=>paused,pause:()=>paused=true,resume:()=>paused=false,isOver:()=>over,onSpeed:value=>speed=value});
  menu.open(); assert.equal(paused,true);
  nodes.get('#mm-speed').onchange({target:{value:'2'}}); assert.equal(speed,2); assert.equal(paused,true);
  nodes.get('#mm-resume').onclick(); assert.equal(paused,false);
  paused=true; menu.open(); menu.close(); assert.equal(paused,true);
  over=true;menu.open();assert.equal(menu.isOpen,false);
});

test('play again on Normal replaces the former explicit Hard bot and exits replay', () => {
 const q=new URLSearchParams(setupQuery('mode=watch&replay=2&ai=toaster-hard&map=ladder&side=1', {...setupValues('map=ladder&side=1&difficulty=hard'),difficulty:'normal'}));
 assert.equal(q.get('ai'),'toaster-sonnet');assert.equal(q.get('map'),'ladder');assert.equal(q.get('side'),'1');assert.equal(q.get('mode'),null);
});
