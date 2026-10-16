'use strict';
const assert=require('node:assert/strict');
const {DESTS,FLAGS,assessServiceRoutes,renderServiceRoutesCandidate}=
 require('../network/panos-service-routes.cjs');
const {exportCandidate}=require('../network/export-candidate.cjs');
const {CM_SERVICES}=require('../network/redundant-configs.cjs');
const base=n=>({
 ...Object.fromEntries(Object.keys(FLAGS).map(k=>[k,true])),
 ospfIpsecToCmVerified:n!==0?true:undefined,
 interfaceName:'ae2.30',sourceAddress:'10.70.'+n+'.161',
 useMgtPort:false,overrideAllServices:false,destinations:[...DESTS]
});
let checks=0;
assert.equal(DESTS.length,7);
assert.deepEqual(DESTS,[
 ...CM_SERVICES.dns,...CM_SERVICES.ntp,...CM_SERVICES.tacacs,...CM_SERVICES.syslog]);
for(let n=0;n<23;n++){
 const site=n===0?'cm':'s'+String(n).padStart(2,'0'),cfg=base(n);
 const r=assessServiceRoutes(n,cfg);
 assert.equal(r.status,'LAB_CANDIDATE');checks++;
 assert.equal(r.certified,false);checks++;
 assert.equal(r.deployable,false);checks++;
 assert.equal(r.sourceAddress,cfg.sourceAddress);checks++;
 const cli=exportCandidate(site,'pa-services',cfg);
 assert.equal(cli.includes('NO COMMIT'),true);checks++;
 assert.equal(cli.includes('licencias/WildFire NO tocado'),true);checks++;
 for(const d of DESTS){
  const start='set deviceconfig system route destination '+d+' source';
  assert.ok(cli.includes(start+' interface ae2.30'),site+' missing '+d);checks++;
  assert.ok(cli.includes(start+' address 10.70.'+n+'.161'));checks++;
 }
 assert.ok(!cli.includes('route destination 10.70.0.101 source'),
   'SNMP collector must not be treated as configured service');checks++;
 assert.ok(!cli.includes('set deviceconfig system route service all'),
   'Global service override prohibited');checks++;
}
const mutations=[
 {interfaceName:'ethernet1/19'},
 {sourceAddress:'10.70.1.162'},
 {useMgtPort:true},{overrideAllServices:true},
 {destinations:[...DESTS,'10.70.0.101']},
 {destinations:DESTS.slice(1)},
 {panosVersionVerified:false},{tacacsAuthProfileVerified:false},
 {panosLogForwardingProfileVerified:false},{collectorTlsCertificateVerified:false},
 {returnRoutesToSourceVerified:false},{panosManagementAccessVerified:false},
 {ospfIpsecToCmVerified:false}
];
for(const patch of mutations){
 const bad={...base(1),...patch};
 assert.equal(assessServiceRoutes(1,bad).status,'BLOCKED');
 assert.throws(()=>renderServiceRoutesCandidate(1,bad),/NO GENERADAS/);
}
assert.equal(assessServiceRoutes(0,{...base(0),ospfIpsecToCmVerified:false}).status,'LAB_CANDIDATE');
assert.equal(assessServiceRoutes(1).status,'BLOCKED');
assert.throws(()=>exportCandidate('s01','pa-services'),/NO GENERADAS/);
assert.throws(()=>assessServiceRoutes(23,base(1)),/Sede/);
console.log('PAN-OS service routes: '+checks+' checks, 23 sites, seven exact destinations and MGT/overrides blocked.');
