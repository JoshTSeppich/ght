import * as T from 'three';
// Field broadcast console: body, paired base, speaker and toast signal.
export function buildSoundList(look,team){
 const root=new T.Group();root.userData.blocky=true;
 const block=(name,w,h,d,x,y,z,color)=>{
  const p=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,flatShading:true,roughness:look==='Y2K GLOSS'?.25:.85}));
  p.name=name;p.position.set(x,y,z);root.add(p);return p;
 };
 block('body',1.25,.85,.7,0,.75,0,0xf2d7a6);
 block('base',1.4,.2,.8,0,.15,0,0x303844);
 block('speaker',.9,.5,.12,0,.75,.4,team==='orange'?0xff8540:0x32d9e8);
 block('signal',.65,.5,.14,0,1.27,0,0xd99448);
 return root;
}
const spring=t=>Math.exp(-10*t)*Math.sin(26*t);
export function poseSoundList(root,{active,age}){
 const t=Math.max(0,age),cycle=t/.6,step=Math.floor(cycle),p=Math.min(1,(cycle-step)/.72);
 const hop=active==='move'?4*p*(1-p):0;
 root.position.set(active==='move'?.45*Math.sin((step+p*p*(3-2*p))*.5):0,.4*hop,0);
 const stretch=1+.12*hop;root.scale.set(1/Math.sqrt(stretch),stretch,1/Math.sqrt(stretch));
 const pulse=active==='attack'?spring(t):.06*spring(t%1.2);
 root.getObjectByName('speaker').position.z=.4+.28*pulse;
 const signal=root.getObjectByName('signal');signal.position.y=1.27+.2*pulse;signal.rotation.z=.15*pulse;
 root.rotation.z=.03*spring(t%1.2);
}
