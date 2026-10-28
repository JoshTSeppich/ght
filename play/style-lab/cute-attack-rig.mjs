import {poseWheelsCord} from './wheels-cords.mjs';
import * as T from 'three';
import {buildCute} from './cute-pass.mjs';

// Keep the established attack pivots/timings while drawing the shared cute specification.
export function buildCuteAttackRig(kind,look,team){
 const u=buildCute(kind,look,team),body=u.getObjectByName('body');
 const chassis=u.getObjectByName('chassis');
 for(const p of [...chassis.children])if(p!==body)body.attach(p);
 const left=u.getObjectByName('left-pivot'),right=u.getObjectByName('right-pivot');
 left.name='foot-left';right.name='foot-right';
 const face=u.getObjectByName('face');if(face)face.name='faceplate';
 const brow=new T.Group();brow.name='brow';chassis.add(brow);
 const slot=new T.Mesh(new T.PlaneGeometry(.45,.06),new T.MeshStandardMaterial({color:0x303844,emissive:0xf25745}));slot.name='slot0';slot.position.set(0,u.userData.bodyHeight,.1);body.add(slot);
 const emitters=[],heaters=[];u.traverse(p=>{if(p.name==='emitter')emitters.push(p);if(p.name==='glow')heaters.push(p);});
 emitters.forEach((p,i)=>p.name='coil'+i);heaters.forEach((p,i)=>{p.name='heater'+i;p.material=new T.MeshStandardMaterial({color:0xf25745,emissive:0xff8540});});
 u.traverse(p=>{p.userData.home=p.position.clone();});
 return u;
}

// Wheels and cable share the attack's planted travel; effects retain their reference pivots.
export function poseCuteAttackGear(u,{active,age,homeX=0}){
 const position=u.position.clone(),scale=u.scale.clone(),rotation=u.rotation.clone();
 poseWheelsCord(u,{active,age,travelDistance:Math.max(0,position.x-homeX)});
 position.y+=u.userData.wheelCord.lift;
 u.position.copy(position);u.scale.copy(scale);u.rotation.copy(rotation);
 u.getObjectByName('running-gear').position.y=-position.y;
}
