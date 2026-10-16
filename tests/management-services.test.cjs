'use strict';
const assert=require('node:assert/strict');
const {CM_SERVICES,ROUTER_NTP_SOURCES,paloCandidate}=require('../network/redundant-configs.cjs');
const {exportCandidate}=require('../network/export-candidate.cjs');
const {addressReview,policyReview,assessManagementServices,renderManagementServicesCandidate}=
  require('../network/management-services-candidate.cjs');
const valid=n=>({
 approvedInLab:true,dnsServersOperational:true,ntpServersOperational:true,
 cmTimeSourceApproved:true,panosNtpPoliciesReviewed:true,
 stackManagementSviVerified:true,routerLoopbackRoutingVerified:true,
 vendorNtpSecurityReviewed:true,
 ospfOverlayVerified:n!==0?true:undefined,
 dns:['10.70.0.110','10.70.0.111'],
 ntp:['10.70.0.116','10.70.0.117']
});
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const inventory=addressReview();
assert.deepEqual(inventory.issues,[]);
assert.equal(inventory.staticCmPcEnd,'10.70.0.64');
assert.equal(new Set(Object.values(inventory.reservations)).size,Object.keys(inventory.reservations).length);
assert.equal(ROUTER_NTP_SOURCES.length,23);
assert.equal(new Set(ROUTER_NTP_SOURCES).size,23);
for(let n=0;n<=22;n++){
 const key=n===0?'cm':'s'+String(n).padStart(2,'0');
 const p=policyReview(n),a=assessManagementServices(n,valid(n));
 ok(p.length===0,key+': '+p.join('; '));
 ok(a.blockers.length===0,key+': '+a.blockers.join('; '));
 ok(a.status==='LAB_CANDIDATE'&&!a.certified&&!a.deployable,key+': false certification');
 ok(a.routerSource===ROUTER_NTP_SOURCES[n],key+': invalid loopback source');
 ok(a.stackSource==='10.70.'+n+'.162',key+': invalid stack SVI source');
 const text=renderManagementServicesCandidate(n,valid(n));
 const exported=exportCandidate(key,'mgmt-services',valid(n));
 ok(exported.includes('SOLO LABORATORIO')&&exported.includes(text),
   key+': CLI export omits NTP review warnings');
 ok(!exported.includes('ntp authentication-key'),key+': accidental key in export');
 for(const source of ['Loopback0','Vlan30']){
   for(const ip of CM_SERVICES.ntp)
     ok(text.includes('ntp server '+ip+' source '+source),
       key+': missing '+ip+' '+source);
 }
 for(const ip of CM_SERVICES.dns)
   ok(text.includes('ip name-server '+ip),key+': DNS missing '+ip);
 ok(!text.includes('ntp authentication-key')&&!text.includes('pre-shared-key'),
   key+': secret or incomplete auth config');
 ok(text.includes('NO DESPLEGABLE'),key+': no deployment warning');
 const fw=paloCandidate(0);
 ok(fw.includes('set address ROUTER-LOOP-'+String(n).padStart(2,'0')+
   ' ip-netmask '+ROUTER_NTP_SOURCES[n]+'/32'),key+': CM missing router source');
}
for(const field of [
 'approvedInLab','dnsServersOperational','ntpServersOperational','cmTimeSourceApproved',
 'panosNtpPoliciesReviewed','stackManagementSviVerified',
 'routerLoopbackRoutingVerified','vendorNtpSecurityReviewed','ospfOverlayVerified'
]){
 const settings={...valid(1),[field]:false};
 const r=assessManagementServices(1,settings);
 ok(r.status==='BLOCKED',field+' should block');
 assert.throws(()=>renderManagementServicesCandidate(1,settings),/SERVICIOS CENTRALES NO GENERADOS/);
}
const cm=assessManagementServices(0,{...valid(0),ospfOverlayVerified:false});
ok(cm.status==='LAB_CANDIDATE','CM does not require WAN VPN to reach its own LAN service');
for(const altered of [
 {...valid(1),dns:['1.1.1.1','9.9.9.9']},
 {...valid(1),ntp:['10.70.0.116','10.70.0.118']},
 {...valid(1),dns:[]},
 {...valid(1),ntp:null}
]){
 ok(assessManagementServices(1,altered).status==='BLOCKED','Changed service IP must block');
}
ok(assessManagementServices(1).status==='BLOCKED','Missing verification must block');
assert.throws(()=>exportCandidate('s01','mgmt-services'),/SERVICIOS CENTRALES NO GENERADOS/);
assert.throws(()=>renderManagementServicesCandidate(1),/NO GENERADOS/);
assert.throws(()=>assessManagementServices(23,valid(1)),/Sede/);
console.log('Central DNS/NTP: '+checks+
  ' checks, 23 sites, strict /32 router and Vlan30 SVI source policy; readiness remains lab-only.');
