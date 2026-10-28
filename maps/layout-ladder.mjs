// Crosscurrent: a rotationally symmetric 132 x 148 ladder map. No seeded scatter in lanes:
// a competitive spawn must keep its rush time, pad access and expansion routes for every seed.
export const LADDER = Object.freeze({ name: 'ladder', title: 'Crosscurrent', w: 132, h: 148, gateBase: 32, idDigits: 1 });
const flip = ([x,y]) => [131-x,147-y];
const point = ([x,y]) => ({x,y});
const BASE = { main: [20,18], natural: [40,27], third: [72,24] };
const SOCKETS = [[24,26],[44,34],[74,32],[106,36]];
export const LADDER_SITES = Object.freeze([...SOCKETS,...SOCKETS.map(flip)].map(([x,y]) => Object.freeze({kind:'windmill',x,y})));

export function drawLadder() {
  const W = LADDER.w, H = LADDER.h;
  const tiles = Array.from({length:H},()=>Array(W).fill('.'));
  const heights = Array.from({length:H},()=>Array(W).fill(0));
  const reachId = Array.from({length:H},()=>Array(W).fill(0));
  const reaches = [], gates = [];
  const paint = (x,y,ch,mirror=true) => {
    tiles[y][x]=ch;
    if (mirror) { const [a,b]=flip([x,y]); tiles[b][a]=ch; }
  };
  for (let x=0;x<W;x++) { tiles[0][x]='#'; tiles[H-1][x]='#'; }
  for (let y=0;y<H;y++) { tiles[y][0]='#'; tiles[y][W-1]='#'; }
  // Two broad ridges route the opening ground rush through opposite ends of the centre.
  // Seven-tile entrances leave room for armies and a cord chain side by side.
  for (let y=47;y<=51;y++) for (let x=1;x<W-1;x++) if (x<97 || x>103) paint(x,y,'#');
  const rows = [
    ['main','Main',[1,1,30,46],BASE.main],
    ['natural','Natural',[31,1,49,46],BASE.natural],
    ['third','Third',[50,1,92,46],BASE.third],
    ['flank','Outer',[93,1,130,46],[111,24]],
  ];
  for (let side=0;side<2;side++) for (let n=0;n<rows.length;n++) {
    const [kind,name,rect,centre]=rows[n];
    const r = side ? [131-rect[2],147-rect[3],131-rect[0],147-rect[1]] : rect.slice();
    const id=side*4+n+1;
    reaches.push({id,key:kind,name,kind,side,rect:r,h:0,chamfer:0,center:side?flip(centre):centre.slice(),gates:[],outline:[[r[0],r[1]],[r[2]+1,r[1]],[r[2]+1,r[3]+1],[r[0],r[3]+1]]});
    for (let y=r[1];y<=r[3];y++) for (let x=r[0];x<=r[2];x++) reachId[y][x]=id;
  }
  const centre={id:9,key:'centre',name:'Crosscurrent',kind:'centre',side:null,rect:[1,52,130,95],h:0,chamfer:0,center:[65,73],gates:[],outline:[[1,52],[131,52],[131,96],[1,96]]};
  reaches.push(centre);
  for (let y=52;y<=95;y++) for (let x=1;x<W-1;x++) reachId[y][x]=9;
  for (const [side,x0,y0,a] of [[0,97,47,4],[1,28,96,8]]) {
    const cells=[]; const id=32+gates.length;
    for(let y=y0;y<y0+5;y++) for(let x=x0;x<x0+7;x++) { reachId[y][x]=id; cells.push([x,y]); }
    gates.push({id,a,b:9,type:'floor',axis:'ns',center:[x0+3,y0+2],cells});
    reaches[a-1].gates.push(id); centre.gates.push(id);
  }
  // Eight wheat tiles per base; long-lived fields make the second and third bases useful.
  for (const [cx,cy] of [[24,13],[44,22],[76,19]]) for(let y=cy;y<cy+2;y++) for(let x=cx;x<cx+4;x++) paint(x,y,'S');
  // Each main has a pond for a Well; every expansion has its own spring.
  for(let y=8;y<=10;y++) for(let x=10;x<=12;x++) paint(x,y,'~');
  for(const [x,y] of [[35,23],[67,20]]) paint(x,y,'U');
  for(const [x,y] of SOCKETS) paint(x,y,'G');
  const watchtowers = [[83,62],[48,85]].map(([x,y])=>({x,y,sight:12,captureRadius:2}));
  for(const t of watchtowers) paint(t.x,t.y,'T',false);
  // Golden pocket: the only doorway is one pushable rock. The spare floor immediately
  // behind it lets a Crumb push it inward; the mining approach then opens around it.
  for(let y=58;y<=70;y++) for(let x=115;x<=129;x++) if(x===115||x===129||y===58||y===70) paint(x,y,'#');
  for(let y=62;y<=63;y++) for(let x=122;x<=125;x++) paint(x,y,'R');
  const gold0={entrance:[115,65],stand:[114,65],mining:{x:121,y:64}};
  const gold1={entrance:flip(gold0.entrance),stand:flip(gold0.stand),mining:point(flip([121,64]))};
  const bases=[0,1].map(side=>{
    const p = v => point(side?flip(v):v);
    return {side,main:p(BASE.main),natural:p(BASE.natural),third:p(BASE.third),cord:[{kind:'extension',...p([31,23])},{kind:'outlet',...p(BASE.natural)}]};
  });
  const workers0=[[21,18],[20,19],[21,19],[22,20],[22,18],[20,20]];
  return {spec:LADDER,tiles,heights,reachId,reaches,gates,cores:[point(BASE.main),point(flip(BASE.main))],workers:[workers0.map(point),workers0.map(flip).map(point)],extras:{bases,watchtowers,gold:[gold0,gold1],energySites:LADDER_SITES.map(p=>({...p}))}};
}

/** Neutral watchtowers are occupied, rather than permanently owned. Both sides nearby = no bonus. */
export function watchtowerSources(state, side) {
  return (state.watchtowers ?? []).filter(t => {
    const owners = new Set(state.units.filter(u => u.hp>0 && u.inside == null && u.layer !== 'air' && !['skiff','barge','seer','crouton-kite','waffle-wing','crumpet-bomber'].includes(u.kind) && Math.max(Math.abs(u.x-t.x),Math.abs(u.y-t.y)) <= (t.captureRadius??2)).map(u=>u.owner));
    return owners.size===1 && owners.has(side);
  }).map(t=>({...t,kind:'watchtower',owner:side,complete:true}));
}
