import * as T from 'three';
// One study, six glyphs; each glyph has 3–6 independent, rigid block pivots.
// Read left-to-right: wheat, water, power, pantry, hunger, emergency bake.
export const HUD_ICONS=Object.freeze([
 ['missing-wheat','No wheat. Send a Crumb to the fields.'],
 ['missing-water','No water. Check the Well and its deliveries.'],
 ['no-power','No power. Reconnect to the Strip.'],
 ['full-pantry','Pantry full. Move supplies to a Toaster.'],
 ['hungry','Hungry. Deliver toast so this soldier can fire.'],
 ['pilot-light','Pilot light. Emergency toast is on its way.'],
].map(([id,tip])=>Object.freeze({id,tip})));
export function buildHudIcons(look,team){
 const root=new T.Group();root.userData.blocky=true;
 const color={dark:0x303844,cream:0xf2d7a6,gold:0xd99448,red:0xf25745,team:team==='orange'?0xff8540:0x32d9e8};
 const material=Object.fromEntries(Object.entries(color).map(([k,c])=>[k,new T.MeshStandardMaterial({color:c,flatShading:true,roughness:look==='Y2K GLOSS'?.25:.85})]));
 HUD_ICONS.forEach(({id,tip},i)=>{
  const icon=new T.Group();icon.name=id;icon.userData.tooltip=tip;icon.userData.homeX=(i%3-1)*2.2;icon.userData.homeY=i<3?2.2:.2;root.add(icon);
  const block=(name,x,y,w,h,c,angle=0)=>{const part=new T.Mesh(new T.BoxGeometry(w,h,.08),material[c]);part.name=name;part.position.set(x,y,0);part.rotation.z=angle;part.userData.rest={x,y,angle};icon.add(part);return part;};
  if(id==='missing-wheat'){
   block('stalk',0,.5,.13,1,'gold');block('left-ear',-.22,.7,.2,.6,'gold',-.65);block('right-ear',.22,.7,.2,.6,'gold',.65);block('missing-bar',0,.45,1.2,.14,'red',-.65);
  }else if(id==='missing-water'){
   block('water-base',0,.25,.85,.4,'team');block('water-tip',0,.67,.46,.46,'team',Math.PI/4);block('missing-bar',0,.4,1.2,.14,'red',-.65);
  }else if(id==='no-power'){
   block('plug',0,.3,.65,.5,'cream');block('pin-left',-.2,.75,.15,.4,'cream');block('pin-right',.2,.75,.15,.4,'cream');block('cut',0,.3,1.2,.14,'red',-.65);
  }else if(id==='full-pantry'){
   block('shelf',0,.1,1.1,.15,'cream');block('stack-low',0,.3,.9,.18,'gold');block('stack-high',0,.53,.9,.18,'gold');block('lid',0,.82,1.1,.15,'red');
  }else if(id==='hungry'){
   block('empty-slot',0,.25,1,.22,'dark');block('droop-left',-.24,.73,.35,.14,'team',-.3);block('droop-right',.24,.73,.35,.14,'team',.3);block('empty-mark',0,.43,.18,.18,'red');
  }else{
   block('burner',0,.1,.85,.2,'dark');block('flame-low',0,.42,.42,.42,'red',Math.PI/4);block('flame-tip',.05,.78,.25,.4,'gold',-.2);
  }
 });return root;
}
const clamp=x=>Math.max(0,Math.min(1,x));
// Analytic damped spring impulse: stable when scrubbing or interrupting actions.
const spring=t=>Math.exp(-9*t)*Math.sin(24*t);
export function poseHudIcons(root,{active,age}){
 root.position.set(0,0,0);
 const t=Math.max(0,age),moving=active==='move',step=Math.floor(t/.6),p=clamp((t/.6-step)/.72),hop=moving?4*p*(1-p):0;
 const pop=['attack','gather','select'].includes(active)?Math.sin(Math.PI*clamp(t/.18))*.38:0;
 root.children.forEach(icon=>{
  icon.position.set(icon.userData.homeX+(moving?.32*Math.sin((step+p*p*(3-2*p))*.5):0),icon.userData.homeY+.3*hop,0);
  const stretch=1+.12*hop-.025*spring(t%.6);icon.scale.set(1/Math.sqrt(stretch),stretch,1);
  icon.children.filter(p=>!p.userData.ink).forEach((part,j)=>{const r=part.userData.rest;part.position.set(r.x,r.y+(j===2?pop:0),0);part.rotation.z=r.angle+(j===1?.07*spring(t%1.2):0);});
 });
}
