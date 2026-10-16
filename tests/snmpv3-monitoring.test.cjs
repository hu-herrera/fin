'use strict';
const assert=require('node:assert/strict');
const {pcInventory,exportCandidate}=require('../network/export-candidate.cjs');
const {COLLECTOR,FLAGS,assessSnmpv3Plan,renderSnmpv3Plan}=
 require('../network/snmpv3-monitoring-candidate.cjs');
const good=()=>({
 ...Object.fromEntries(Object.keys(FLAGS).map(k=>[k,true])),
 collectorIp:COLLECTOR,version:3,securityLevel:'authPriv',
 permission:'read-only',trapsEnabled:false,includePaloAltoManagement:false
});
let checks=0;
for(let n=0;n<=22;n++){
 const key=n===0?'cm':'s'+String(n).padStart(2,'0'),data=good();
 const report=assessSnmpv3Plan(n,data);
 assert.equal(report.status,'LAB_CANDIDATE',key+' '+report.issues.join(';'));checks++;
 assert.equal(report.certified,false);checks++;
 assert.equal(report.deployable,false);checks++;
 const cli=exportCandidate(key,'snmpv3-plan',data);
 const tokens=[
  'snmp-server group NETOPS-PRIV v3 priv read NETOPS-READ access NETOPS-SNMP-POLLER',
  'permit 10.70.0.101 0.0.0.0',
  'set service SVC-NETOPS-SNMP-UDP161 protocol udp port 161',
  'set address SNMP-STACK-'+key.toUpperCase()+' ip-netmask 10.70.'+n+'.162/32',
  'NO COMMIT'
 ];
 for(const token of tokens){assert.ok(cli.includes(token),key+' '+token);checks++;}
 assert.ok(!cli.split('\n').some(line=>/^\s*snmp-server (user|community)\b/.test(line)) &&
   !/privacyKey|authKey/.test(cli),
   key+' executable config contains users or forbidden secrets');checks++;
 if(n){
  assert.ok(cli.includes('move rulebase security rules CM-SNMP-TO-'+key.toUpperCase()+
   ' before DENY-CORP-RFC1918-TRANSIT'));checks++;
  assert.ok(cli.includes('move rulebase security rules BR-SNMP-FROM-CM-'+key.toUpperCase()+
   ' before DENY-GUEST-TO-CORP'));checks++;
 }else{
  assert.ok(cli.includes('move rulebase security rules CM-SNMP-LOCAL-STACK before DENY-USERS-TO-MGMT'));checks++;
 }
 assert.ok(!cli.includes('snmp-server group NETOPS-PRIV v2c'),key);checks++;
}
for(const patch of [
 {version:2},{version:'3'},{securityLevel:'authNoPriv'},
 {securityLevel:'noAuthNoPriv'}, {permission:'read-write'},
 {collectorIp:'10.70.0.100'},{collectorIp:'0.0.0.0'},
 {trapsEnabled:true},{includePaloAltoManagement:true},
 {authKey:'no'}, {community:'public'}, {password:'do-not-log'},
 {labChangeApproved:false},{deviceRecoveryPlanReviewed:false},
 {ipsecOspfReturnVerified:false},{panosSyntaxAndOrderVerified:false}
]){
 const p={...good(),...patch};
 assert.equal(assessSnmpv3Plan(1,p).status,'BLOCKED');
 assert.throws(()=>renderSnmpv3Plan(1,p),/MONITOREO SNMPV3 BLOQUEADO/);
}
assert.equal(assessSnmpv3Plan(1).status,'BLOCKED');
assert.throws(()=>exportCandidate('s01','snmpv3-plan'),/MONITOREO SNMPV3 BLOQUEADO/);
assert.throws(()=>assessSnmpv3Plan(23,good()),/Sede/);
console.log('SNMPv3: '+checks+' checks, 23 sites, poll-only authPriv RO, /32 collectors and no credentials.');
