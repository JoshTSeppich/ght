import * as T from 'three';
import {TOASTERS,PALETTE} from '../toaster-spec.mjs';
// Seconds, radians, and local model units. No renderer dependency in the sampler;
// game clients can share these presentation timings without changing economy ticks.
export const BREAD_CHAIN_TIMINGS=Object.freeze({cycleSeconds:6,hopSeconds:.6,flightFraction:.72,stride:.48,hopHeight:.28,popSeconds:.18,grindRadiansPerSecond:3.2,bucketSeconds:1.2,stackSlices:4});
const clamp=x=>Math.max(0,Math.min(1,x));
const spring=t=>Math.exp(-9*t)*Math.sin(24*t);
export function sampleBreadChain(age,active='idle'){
 const t=Math.max(0,age),d=BREAD_CHAIN_TIMINGS,cycle=t%d.cycleSeconds;
 const working=['gather','attack','grind','pump','deliver'].includes(active),moving=active==='move'||working;
 const step=Math.floor(t/d.hopSeconds),p=clamp((t/d.hopSeconds-step)/d.flightFraction),hop=moving?4*p*(1-p):0;
 const pop=t%1.2;
 return {travel:moving?d.stride*(step+p*p*(3-2*p)):0,hop,landing:spring(t%d.hopSeconds),
 sails:t*(working?d.grindRadiansPerSecond:.55),bucket:Math.sin(t*2*Math.PI/d.bucketSeconds)*(working?.28:.045),
 pop:working&&pop<d.popSeconds?Math.sin(Math.PI*pop/d.popSeconds)*.8:0,
 stack:working?Math.min(d.stackSlices,Math.floor((cycle<3?cycle:6-cycle)/.6)):2,
 sack:!working||cycle<3};
}
export function buildBreadChain(look,team){
 const root=new T.Group();root.userData.blocky=true;
 const colors={...PALETTE,team:team==='orange'?PALETTE.orange:PALETTE.cyan};
 const mat=c=>new T.MeshStandardMaterial({color:colors[c]??c,flatShading:true,roughness:look==='Y2K GLOSS'?.25:.85});
 const group=(p,n,pos=[0,0,0])=>{const g=new T.Group();g.name=n;g.position.set(...pos);p.add(g);return g;};
 const mesh=(p,n,geo,c,pos)=>{const m=new T.Mesh(geo,mat(c));m.name=n;m.position.set(...pos);p.add(m);return m;};
 const box=(p,n,size,c,pos)=>mesh(p,n,new T.BoxGeometry(...size),c,pos);
 const crumb=group(root,'chain-crumb',[-2,0,1.6]);
 const body=box(crumb,'body',TOASTERS.crumb[0].size,'cream',[0,.56,0]);
 box(body,'team-mark',[.96,.24,.02],'team',[0,.18,.39]);
 box(body,'face',[.66,.22,.02],'charcoal',[0,-.05,.39]);
 for(const x of [-.175,.175])box(body,'eye',[.115,.08,.012],'eyes',[x,-.03,.407]);
 for(const x of [-.39,.39])box(crumb,x<0?'left-foot':'right-foot',[.27,.19,.36],'feet',[x,.095,.17]);
 box(crumb,'wheat-sack',[.55,.6,.4],'toast',[-.45,1.1,-.18]);
 box(crumb,'carried-toast',[.3,.36,.1],'toast',[.15,1.12,-.04]);
 const mill=group(root,'chain-mill',[-2.4,0,-1.2]);
 box(mill,'mill-body',[1,1.5,.9],'cream',[0,.75,0]);
 const sails=group(mill,'mill-sails',[0,1.6,.65]);
 for(let i=0;i<4;i++){const blade=box(sails,'sail-'+i,[.22,1,.12],'team',[0,0,0]);blade.geometry.translate(0,.65,0);blade.rotation.z=i*Math.PI/2;}
 mesh(mill,'grinding-stone',new T.CylinderGeometry(.38,.38,.16,5),'charcoal',[0,.25,.65]);
 box(mill,'flour-bin',[.65,.32,.45],'cream',[.7,.16,0]);
 const well=group(root,'chain-well',[0,0,-1.2]);
 box(well,'well-base',[1.1,.45,.9],'charcoal',[0,.225,0]);
 box(well,'well-frame',[.16,1.4,.18],'team',[-.5,.9,0]);
 box(well,'well-beam',[1.2,.16,.2],'toast',[0,1.65,0]);
 mesh(well,'well-bucket',new T.CylinderGeometry(.25,.2,.38,5),'cream',[0,.9,0]);
 const toaster=group(root,'chain-toaster',[2,0,-1.2]);
 box(toaster,'toaster-body',[1.25,.9,.9],'cream',[0,.45,0]);
 box(toaster,'toaster-slot',[.85,.06,.2],'charcoal',[0,.92,0]);
 box(toaster,'popping-slice',[.65,.45,.12],'toast',[0,1.05,0]);
 box(toaster,'toaster-lever',[.25,.15,.2],'team',[.75,.55,0]);
 const strip=group(root,'chain-strip',[1.4,0,1.5]);
 box(strip,'strip-body',[1.9,.3,.7],'cream',[0,.15,0]);
 box(strip,'strip-band',[1.8,.08,.72],'team',[0,.31,0]);
 const stack=group(strip,'toast-bank',[1.5,0,0]);
 for(let i=0;i<4;i++)box(stack,'bank-toast-'+i,[.65,.12,.5],'toast',[0,.08+i*.14,0]);
 return root;
}
export function poseBreadChain(root,{active,age}){
 const f=sampleBreadChain(age,active),get=n=>root.getObjectByName(n),crumb=get('chain-crumb');
 root.position.set(0,0,0);
 // Bounded hop route: travel advances only in flight, never during planted time.
 crumb.position.set(-2+2*Math.sin(f.travel*.5),BREAD_CHAIN_TIMINGS.hopHeight*f.hop,1.6);
 const stretch=1+.12*f.hop-.035*f.landing;crumb.scale.set(1/Math.sqrt(stretch),stretch,1/Math.sqrt(stretch));
 get('body').rotation.x=-.12*f.hop;
 for(const n of ['left-foot','right-foot'])get(n).position.y=.095+.08*f.hop;
 get('wheat-sack').visible=f.sack;get('wheat-sack').rotation.z=.08*f.landing;
 get('carried-toast').visible=!f.sack||active==='idle'||active==='move';get('carried-toast').position.y=1.12+.04*f.landing;
 get('mill-sails').rotation.z=f.sails;get('grinding-stone').rotation.y=f.sails*2;
 get('well-bucket').position.y=.9+f.bucket;
 get('popping-slice').position.y=1.05+f.pop+.025*f.landing;
 get('toaster-lever').rotation.z=-f.pop*.3;
 for(let i=0;i<4;i++){const slice=get('bank-toast-'+i);slice.visible=i<f.stack;slice.rotation.z=.035*f.landing;}
}
