'use strict';
const assert=require('node:assert/strict');
const lab=require('../network/packet-simulator.js');
const m=require('../network/redundant-model.cjs');
const {evaluateSitePanPolicy}=require('../network/redundant-configs.cjs');
let checks=0;const states=Array.from({length:23},(_,n)=>m.makeScenario(n));
const overrides={};
function env(){
 return {
  site:num=>m.inspect(states[num]),
  overlay:num=>overrides[num]!==false,
  policy:(...args)=>evaluateSitePanPolicy(...args),
  destinationMember:(num,ip)=>num===1&&ip==='10.70.1.11'?2:1
 };
}
function inp(p={}){return {siteNum:1,zone:'USERS',sourceIp:'10.70.1.10',
 member:1,destinationIp:'10.70.0.110',application:'dns',...p};}
function run(p){return lab.trace(inp(p),env());}
function eq(p,code,allowed=false){
 const r=run(p);assert.equal(r.code,code,JSON.stringify(r));checks++;
 assert.equal(r.allowed,allowed,JSON.stringify(r));checks++;
 assert.ok(r.hops.every((h,i)=>h.ok||r.hops.slice(i+1).length===0));checks++;
 return r;
}
eq({},'INTERSITE',true);
eq({application:'ssl'},'POLICY_DENY');
eq({application:'ssh'},'POLICY_DENY');
eq({application:'icmp'},'POLICY_DENY');
eq({destinationIp:'8.8.8.8',application:'ssl'},'INTERNET',true);
eq({zone:'VOICE',sourceIp:'10.70.1.130'},'INTERSITE',true);
eq({zone:'GUESTS',sourceIp:'10.70.1.180'},'POLICY_DENY');
eq({destinationIp:'10.70.1.11'},'LOCAL_L2',true);
eq({destinationIp:'10.70.1.130',application:'ssl'},'POLICY_DENY');
eq({destinationIp:'10.70.0.12'},'POLICY_DENY');
eq({destinationIp:'10.70.99.10'},'NO_ROUTE');
eq({destinationIp:'10.70.1.127'},'NO_ROUTE');
eq({destinationIp:'10.72.1.1'},'NO_ROUTE');
eq({destinationIp:'bad ip'},'BAD_DEST');
eq({sourceIp:'10.70.2.10'},'SOURCE_MISMATCH');
eq({sourceIp:'10.70.1.180'},'SOURCE_MISMATCH');
eq({application:'fake-app'},'BAD_INPUT');
m.setWan(states[1],'starlink',false);
assert.equal(eq({},'INTERSITE',true).wan,'leo');checks++;
for(const key of m.WAN_ORDER)m.setWan(states[1],key,false);
eq({},'WAN_DOWN');
for(const key of m.WAN_ORDER)m.setWan(states[1],key,true);
overrides[1]=false;eq({},'TUNNEL_DOWN');overrides[1]=true;
m.setWan(states[0],'starlink',false);
for(const key of m.WAN_ORDER)m.setWan(states[0],key,false);
eq({},'HUB_DOWN');
for(const key of m.WAN_ORDER)m.setWan(states[0],key,true);
m.setLink(states[1],'T1',false);m.setLink(states[1],'T2',false);
eq({},'TRANSIT_DOWN');
m.setLink(states[1],'T1',true);
m.setLink(states[1],'T2',true);
m.setLink(states[1],'STACK-A',false);m.setLink(states[1],'STACK-B',false);
eq({destinationIp:'10.70.1.11'},'STACK_PARTITION');
eq({},'GATEWAY_DOWN');
m.setLink(states[1],'STACK-A',true);
m.setNode(states[1],'sw1',false);
eq({},'ACCESS_DOWN');
m.setNode(states[1],'sw1',true);
m.setNode(states[0],'firewall',false);
eq({},'HUB_DOWN');
m.setNode(states[0],'firewall',true);
eq({siteNum:0,sourceIp:'10.70.0.10',destinationIp:'10.70.1.10',application:'ssl'},'POLICY_DENY');
for(let n=1;n<23;n++){
 const result=lab.trace({siteNum:n,sourceIp:'10.70.'+n+'.10',zone:'USERS',member:1,
  destinationIp:'10.70.0.111',application:'dns'},env());
 assert.equal(result.code,'INTERSITE','DNS allowed '+n);checks++;
 assert.equal(result.modelOnly,true);checks++;
}
assert.deepEqual(lab.target('10.70.0.110'),{kind:'corporate',siteNum:0,zone:'USERS',vlan:10});
assert.deepEqual(lab.target('10.70.1.180'),{kind:'corporate',siteNum:1,zone:'GUESTS',vlan:40});
assert.equal(lab.target('192.168.1.1').kind,'private-other');
assert.equal(lab.target('1.1.1.1').kind,'public');
console.log('Packet flow: '+checks+' assertions; WAN failover, ACL, StackWise, C8300/PA failures, 22 branches and unknown routes.');
