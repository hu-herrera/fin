'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {oobAddressing,validateOobPlan,oobCandidate}=require('../network/oob-management.cjs');
const {candidateAddressing}=require('../network/redundant-model.cjs');
const {exportCandidate}=require('../network/export-candidate.cjs');
const html=fs.readFileSync('index.html','utf8');
const mm=html.match(/const PC_COUNT\s*=\s*(\{[\s\S]*?\});/);
assert.ok(mm,'missing PC_COUNT');
const pcCounts=vm.runInNewContext('('+mm[1]+')');
let checks=0;function check(x,msg){assert.ok(x,msg);checks++}
const fullOob=new Set(),fullData=new Set();
for(let n=0;n<23;n++){
  const key=n===0?'cm':'s'+String(n).padStart(2,'0'),a=oobAddressing(n),b=oobCandidate(n);
  const addresses=[a.gateway,a.firewallMgt,a.stackMgt,a.routerMgtReserved,a.jumpHostReserved];
  const data=candidateAddressing(n);
  assert.deepEqual(validateOobPlan(n),[]);
  check(a.network==='10.73.'+n+'.0/28',key+' OOB is not /28');
  check(new Set(addresses).size===5,key+' duplicated OOB hosts');
  check(b.deployable===false,key+' unprovisioned OOB marked deployed');
  const exported=exportCandidate(key,'oob');
  check(exported.includes('NO APLICAR SIN GATEWAY'),key+' OOB export not clearly blocked');
  check(exported.includes('interface GigabitEthernet0/0'),key+' OOB missing Catalyst Mgmt-vrf');
  check(exported.includes('C8300 NO CONFIGURADO'),key+' router OOB interface prematurely configured');
  check(b.requiredHardware.length>=3,key+' missing dedicated OOB equipment');
  for(const addr of addresses){
    check(!fullOob.has(addr),key+' OOB IP duplicates other site '+addr);
    fullOob.add(addr);
    check(!addr.startsWith('10.70.'+n+'.'),key+' OOB shares dataplane VLAN');
    check(!addr.startsWith('10.72.'+n+'.'),key+' OOB shares transit L3');
    check(!fullData.has(addr),key+' OOB collision with dataplane');
  }
  for(let i=10;i<10+pcCounts[key];i++)fullData.add('10.70.'+n+'.'+i);
  for(const vlanGateway of Object.values(data.vlanGateways))fullData.add(vlanGateway.split('/')[0]);
  fullData.add(data.switchStackManagement.split('/')[0]);
  fullData.add(data.transitRouter.split('/')[0]);
  fullData.add(data.transitFirewall.split('/')[0]);
  check(b.firewall.includes('set deviceconfig system ip-address '+a.firewallMgt),key+' PA MGT wrong');
  check(b.firewall.includes('default-gateway '+a.gateway),key+' PA MGT gateway wrong');
  check(b.stack.includes('interface GigabitEthernet0/0'),key+' Mgmt interface invalid');
  check(b.stack.includes('vrf forwarding Mgmt-vrf'),key+' Mgmt-vrf not separated');
  check(b.stack.includes('ip route vrf Mgmt-vrf 0.0.0.0 0.0.0.0 '+a.gateway),key+' no independent OOB default');
  check(!/interface GigabitEthernet0\/0\/[0-9]/.test(b.router),key+' invented router mgmt port');
  check(!b.stack.includes('router ospf'),key+' OOB leaked to OSPF');
}
assert.throws(()=>oobCandidate(23),/fuera/);
assert.throws(()=>oobCandidate(-1),/fuera/);
check(pcCounts.cm===55,'CM inventory not expected');
check(Object.values(pcCounts).reduce((a,b)=>a+b,0)===650,'PC inventory total changed');
const overlap=[...fullOob].filter(ip=>fullData.has(ip));
assert.deepEqual(overlap,[]);
console.log('TOTAL OOB: 23 sedes, '+fullOob.size+' IP reservadas, '+checks+' comprobaciones, 650 PCs sin solapamiento.');
