'use strict';
const assert=require('node:assert/strict');
const {APPROVED_PORTS,FLAGS,evaluateAdminAccess,renderAdminAccessCandidate}=
 require('../network/panos-admin-access.cjs');
const {pcInventory,exportCandidate}=require('../network/export-candidate.cjs');
const good=n=>({
 ...Object.fromEntries(Object.keys(FLAGS).map(k=>[k,true])),
 adminHostIp:'10.70.'+n+'.163',stackPort:APPROVED_PORTS[0],
 operatorRef:'LAB-APPROVED-001'
});
let total=0;
const pcs=pcInventory();
for(let n=0;n<=22;n++){
 const key=n===0?'cm':'s'+String(n).padStart(2,'0'),data=good(n);
 const report=evaluateAdminAccess(n,data,pcs);
 assert.equal(report.status,'LAB_CANDIDATE');total++;
 assert.equal(report.certified,false);total++;
 assert.equal(report.deployable,false);total++;
 assert.deepEqual(report.blockers,[]);total++;
 const cfg=renderAdminAccessCandidate(n,data,pcs);
 for(const fragment of [
   'interface GigabitEthernet1/0/35',
   ' switchport access vlan 30',
   'spanning-tree bpduguard enable',
   'set network profiles interface-management-profile VLAN30-STACK permitted-ip 10.70.'+n+'.163/32',
   '# EXISTENTE QUE DEBE PERMANECER: set network profiles interface-management-profile VLAN30-STACK permitted-ip 10.70.'+n+'.162/32',
   'NO AUTORIZA COMMIT'
 ]){assert.ok(cfg.includes(fragment),key+' missing '+fragment);total++;}
 assert.ok(!cfg.split('\n').some(line=>line.startsWith('set ')&&line.includes('permitted-ip 0.0.0.0/0')));total++;
 assert.ok(!cfg.includes('switchport access vlan 10'));total++;
 const cli=exportCandidate(key,'pa-admin',data);
 assert.ok(cli.includes(cfg)&&cli.includes('VLAN30'));total++;
 const second=evaluateAdminAccess(n,{...data,adminHostIp:'10.70.'+n+'.174',
   stackPort:APPROVED_PORTS[1]},pcs);
 assert.equal(second.status,'LAB_CANDIDATE');total++;
}
const cases=[
 {adminHostIp:'10.70.1.161'},{adminHostIp:'10.70.1.162'},
 {adminHostIp:'10.70.1.175'},{adminHostIp:'10.70.1.10'},
 {adminHostIp:'10.70.2.163'},{adminHostIp:'10.70.1.176'},
 {stackPort:'GigabitEthernet1/0/10'},{stackPort:'GigabitEthernet1/0/45'},
 {stackPort:'GigabitEthernet3/0/35'},{operatorRef:'../../a'},
 {physicalPortUnusedVerified:false},{addressInventoryConfirmed:false},
 {approvedLabWindow:true,labChangeApproved:false},
 {existingSshRiskAcknowledged:false},{httpsCertificateReviewed:false},
 {accessRollbackTested:false}
];
for(const bad of cases){
 const data={...good(1),...bad};
 assert.equal(evaluateAdminAccess(1,data,pcs).status,'BLOCKED');
 assert.throws(()=>renderAdminAccessCandidate(1,data,pcs),/ACCESO ADMIN PA BLOQUEADO/);
}
assert.equal(evaluateAdminAccess(1,good(1),{...pcs,s01:61}).status,'BLOCKED');
assert.equal(evaluateAdminAccess(1).status,'BLOCKED');
assert.throws(()=>exportCandidate('s01','pa-admin'),/ACCESO ADMIN PA BLOQUEADO/);
assert.throws(()=>evaluateAdminAccess(23,good(1)),/Sede/);
console.log('PA admin in-band: '+total+' positive checks across 23 sites; unapproved, occupied or overbroad access rejected.');
