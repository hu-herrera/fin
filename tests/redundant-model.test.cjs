'use strict';
const assert=require('node:assert/strict');
const {
 PORTS,WAN_ORDER,VLAN,candidateAddressing,makeScenario,setLink,setNode,setWan,inspect,validatePortPlan
}=require('../network/redundant-model.cjs');
let cases=0,assertions=0;
function ok(condition,message){assert.ok(condition,message);assertions++;}
function eq(actual,expected,message){assert.equal(actual,expected,message);assertions++;}
function test(name,fn){fn();cases++;console.log('OK',name);}
test('Inventario real 4 WAN, 2x10G, 4x1G MEC y 2 cables StackWise',()=>{
 eq(Object.keys(PORTS.wan).length,4);
 eq(PORTS.transit.length,2);
 eq(PORTS.distribution.length,4);
 eq(PORTS.stack.length,2);
 assert.deepEqual(validatePortPlan(),[]);assertions++;
});
for(let num=0;num<=22;num++){
 const label='Sede '+(num===0?'CM':String(num).padStart(2,'0'));
 test(label+' base y direccionamiento sin colisiones',()=>{
  const a=candidateAddressing(num),s=makeScenario(num),z=inspect(s);
  eq(a.transitRouter,'10.72.'+num+'.1/30');
  eq(a.transitFirewall,'10.72.'+num+'.2/30');
  for(const v of VLAN)eq(a.vlanGateways[v.id],'10.70.'+num+'.'+v.offset+'/'+v.prefix);
  ok(a.firewallOobManagement.startsWith('PENDIENTE'),'OOB no debe simularse activada');
  eq(z.transitMembers.length,2);
  eq(z.paStackMembers.length,4);
  eq(z.stackFunctional,true);
  eq(z.switchLan[1],true);
  eq(z.switchLan[2],true);
  eq(z.activeWan,'starlink');
 });
 test(label+' LACP router-PA sobrevive a fallo individual y detecta corte doble',()=>{
  const s=makeScenario(num);
  setLink(s,'T1',false);eq(inspect(s).transitUp,true);
  setLink(s,'T2',false);eq(inspect(s).transitUp,false);
  eq(inspect(s).switchLan[1],false);
  eq(inspect(s).switchLan[2],false);
  setLink(s,'T1',true);eq(inspect(s).switchLan[1],true);
 });
 test(label+' MEC PA-Stack sobrevive perdida de un enlace o dos del mismo miembro',()=>{
  const s=makeScenario(num);
  setLink(s,'D1',false);
  eq(inspect(s).switchLan[1],true);
  setLink(s,'D2',false);
  eq(inspect(s).switchLan[1],true); // llega via stack SW2
  eq(inspect(s).switchLan[2],true);
  setLink(s,'D3',false);setLink(s,'D4',false);
  eq(inspect(s).switchLan[1],false);
  eq(inspect(s).switchLan[2],false);
  setLink(s,'D4',true);
  eq(inspect(s).switchLan[1],true);
 });
 test(label+' failover ante switch completo sin fingir recuperacion de sus PCs',()=>{
  const s=makeScenario(num);
  setNode(s,'sw1',false);
  eq(inspect(s).switchLan[1],false);
  eq(inspect(s).switchLan[2],true);
  setNode(s,'sw1',true);eq(inspect(s).switchLan[1],true);
  setNode(s,'sw2',false);
  eq(inspect(s).switchLan[1],true);
  eq(inspect(s).switchLan[2],false);
  setNode(s,'sw2',true);eq(inspect(s).switchLan[2],true);
 });
 test(label+' cable StackWise simple degradado, particion doble marcada insegura',()=>{
  const s=makeScenario(num);
  setLink(s,'STACK-A',false);
  eq(inspect(s).stackFunctional,true);
  eq(inspect(s).switchLan[1],true);
  setLink(s,'STACK-B',false);
  eq(inspect(s).stackPartitioned,true);
  eq(inspect(s).switchLan[1],false);
  eq(inspect(s).switchLan[2],false);
  setLink(s,'STACK-B',true);
  eq(inspect(s).stackPartitioned,false);
  eq(inspect(s).switchLan[2],true);
 });
 test(label+' fallos router, firewall y WAN por prioridad',()=>{
  const s=makeScenario(num);
  for(const w of WAN_ORDER.slice(0,-1)){
   setWan(s,w,false);
  }
  eq(inspect(s).activeWan,'gtd4g');
  eq(inspect(s).switchInternet[1],true);
  setWan(s,'gtd4g',false);
  eq(inspect(s).activeWan,null);
  eq(inspect(s).switchInternet[1],false);
  setWan(s,'entel5g',true);
  eq(inspect(s).activeWan,'entel5g');
  setNode(s,'firewall',false);
  eq(inspect(s).switchLan[1],false);
  eq(inspect(s).switchLan[2],false);
  setNode(s,'firewall',true);
  eq(inspect(s).switchLan[2],true);
  setNode(s,'router',false);
  eq(inspect(s).switchLan[1],false);
 });
}
console.log('TOTAL '+cases+' casos; '+assertions+' aserciones; 23 sedes verificadas.');
