// A5: match setup and pausing menu; no simulation or input ownership here.
import { loadReplays } from './replay-storage.mjs';
const MAPS = [['wheatfield','Wheatfield Valley'],['ladder','Ladder Kitchen'],['standard','Standard'],['large','Large'],['huge','Huge']];
const LEVELS = [['easy','Easy'],['normal','Normal'],['hard','Hard'],['brutal','Brutal'],['none','Sandbox']];
export function setupValues(query = '') {
  const q = new URLSearchParams(query);
  const pick=(key, choices, fallback)=>choices.some(([v])=>v===q.get(key))?q.get(key):fallback;
  return {map:pick('map',MAPS,'wheatfield'),side:q.get('side')==='1'?'1':'0',difficulty:pick('difficulty',LEVELS,'easy'),keys:q.get('keys')==='classic'?'classic':'grid'};
}
export function setupQuery(query, values) {
  const q = new URLSearchParams(query);
  const settings=setupValues(new URLSearchParams(values));
  for (const [key,value] of Object.entries(settings)) q.set(key,value);
  q.set('ai', {easy:'toaster-easy',normal:'toaster-sonnet',hard:'toaster-hard',brutal:'toaster-brutal',none:'toaster-easy'}[settings.difficulty]);
  q.set('play','1'); q.delete('mode'); q.delete('replay');
  return q.toString();
}
export function replaySetupQuery(query, record, index='last') {
  const q = new URLSearchParams(query);
  for(const [key,value] of Object.entries(record?.setup ?? {})) q.set(key,value);
  q.set('mode','watch'); q.set('replay',String(index)); q.delete('ai');
  return q.toString();
}
export function setupHtml(query) {
 const values=setupValues(query);
 const select=(key,label,choices)=>`<label>${label} <select name="${key}">${choices.map(([v,name])=>`<option value="${v}"${values[key]===v?' selected':''}>${name}</option>`).join('')}</select></label>`;
 return '<h1>GHOSTIES, TOASTIES & BROSKIES</h1><p>Set up your match</p><form style="display:grid;gap:16px;text-align:left">'+select('map','Map',MAPS)+select('side','Side',[['0','Side 1'],['1','Side 2']])+select('difficulty','Difficulty',LEVELS)+select('keys','Key profile',[['grid','Grid (Q W E R T)'],['classic','Classic (M S H P A)']])+'<button type="submit">Start match</button></form>';
}
const panelStyle='position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#151122f5;color:#fff;font:16px system-ui;text-align:center';
export function mountStartScreen(root,{query='',go=s=>{location.search=s;}}={}) {
 const doc=root.ownerDocument, box=doc.createElement('section'); box.id='start-screen'; box.style.cssText=panelStyle; box.innerHTML=setupHtml(query); root.append(box);
 box.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));try{globalThis.localStorage?.setItem('keys',values.keys);}catch{}go(setupQuery(query,values));});
 const records=loadReplays();
 if(records.length){const label=doc.createElement('label');label.textContent='Recent replays ';const select=doc.createElement('select');records.forEach((r,i)=>{const o=doc.createElement('option');o.value=String(i);o.textContent=`${i+1}. Seed ${r.seed} · ${r.setup?.map??'Wheatfield'} · ${r.setup?.difficulty??'match'}`;select.append(o);});const button=doc.createElement('button');button.textContent='Watch replay';button.onclick=()=>go(replaySetupQuery(query,records[Number(select.value)],select.value));label.append(select,button);box.append(label);}
 return box;
}
export function createMenuPause({isPaused,pause,resume}) {
 let open=false,wasPaused=false;
 return {open(){if(open)return;open=true;wasPaused=isPaused();pause();},close(){if(!open)return;open=false;if(!wasPaused)resume();},get isOpen(){return open;}};
}
export function mountFlowMenu(root,{query,isPaused,pause,resume,onSurrender,onRestart,isOver,onSpeed}) {
 const doc=root.ownerDocument, button=doc.createElement('button'), box=doc.createElement('section');
 const gate=createMenuPause({isPaused,pause,resume});
 button.id='menubtn';button.textContent='Menu (F10)';button.style.cssText='position:fixed;right:8px;top:44px;z-index:5';
 box.id='matchmenu';box.style.cssText=panelStyle;box.style.display='none';box.innerHTML='<h2>Paused</h2><button id="mm-resume">Resume</button><label>Speed <select id="mm-speed"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="2">2x</option><option value="4">4x</option></select></label><button id="mm-new">New match setup</button><button id="mm-restart">Restart</button><button id="mm-surrender">Surrender</button>';
 root.append(button,box);
 const close=()=>{box.style.display='none';gate.close();}; const open=()=>{if(isOver())return;gate.open();box.style.display='flex';};
 button.onclick=()=>gate.isOpen?close():open();box.querySelector('#mm-resume').onclick=close;
 box.querySelector('#mm-speed').onchange=e=>onSpeed(Number(e.target.value));
 box.querySelector('#mm-new').onclick=()=>{const q=new URLSearchParams(query);q.delete('play');q.delete('mode');q.delete('replay');location.search=q.toString();};
 box.querySelector('#mm-restart').onclick=onRestart;
 const surrender=box.querySelector('#mm-surrender');surrender.onclick=()=>{if(surrender.dataset.sure==='1'){close();onSurrender();}else{surrender.dataset.sure='1';surrender.textContent='Really surrender?';}};
 doc.defaultView.addEventListener('keydown',e=>{if(e.key==='F10'||(e.key==='Escape'&&gate.isOpen)){e.preventDefault();e.stopImmediatePropagation();gate.isOpen?close():open();}else if(gate.isOpen && !/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName ?? '')){e.stopImmediatePropagation();}}, true);
 return {open,close,get isOpen(){return gate.isOpen;}};
}
