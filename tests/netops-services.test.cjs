'use strict';
const assert=require('node:assert/strict');
const {CM_SERVICES,NETOPS_SERVICES,ROUTER_NTP_SOURCES,evaluateSitePanPolicy,paloCandidate}=
  require('../network/redundant-configs.cjs');
const {addressReview}=require('../network/management-services-candidate.cjs');
const {validatePolicy,assessNetops,renderNetopsCandidate}=
  require('../network/netops-services-candidate.cjs');
const {exportCandidate}=require('../network/export-candidate.cjs');
const good=n=>({
 approvedLabWindow:true,tacacsPrimaryVerified:true,tacacsSecondaryVerified:true,
 tacacsKeysInstalledSecurely:true,breakGlassLocalLoginTested:true,
 fallbackLoginVerified:true,roleAndAuthorizationReviewed:true,
 syslogTlsServerVerified:true,syslogTlsProfileInstalled:true,
 collectorCertChainReviewed:true,ntpClockSynchronized:true,
 managementFirewallRulesReviewed:true,monitoringAlertsDefined:true,
 ipsecOspfToCmVerified:n!==0?true:undefined,snmpEnabled:false,
 tacacs:['10.70.0.112','10.70.0.113'],syslog:'10.70.0.100',
 tlsProfile:'NETOPS-LOG-TLS'
});
const deny=(num,from,to,app,dst,src)=>
  assert.equal(evaluateSitePanPolicy(num,from,to,app,dst,src).action,'deny',
    'Unexpected '+num+' '+from+'/'+to+' '+app+' '+src+'->'+dst);
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const inventory=addressReview();
assert.deepEqual(inventory.issues,[]);
assert.equal(inventory.reservations.tacacs1,'10.70.0.112');
assert.equal(inventory.reservations.tacacs2,'10.70.0.113');
assert.equal(inventory.reservations.syslog,'10.70.0.100');
assert.equal(inventory.reservations.monitor,'10.70.0.101');
assert.deepEqual(Object.keys(NETOPS_SERVICES).sort(),['aaa-tacacs','syslog-tls']);
for(let n=0;n<23;n++){
 const id=n===0?'cm':'s'+String(n).padStart(2,'0'),report=assessNetops(n,good(n));
 ok(report.status==='LAB_CANDIDATE'&&!report.deployable&&!report.certified,id+' incorrect acceptance');
 ok(report.blockers.length===0,id+': '+report.blockers.join(';'));
 ok(validatePolicy(n).length===0,id+': '+validatePolicy(n).join(';'));
 ok(report.routerSource===ROUTER_NTP_SOURCES[n],id+' wrong router source');
 ok(report.stackSource==='10.70.'+n+'.162',id+' wrong stack source');
 ok(report.syslogTransport==='TLS/TCP6514',id+' logging not TLS');
 const cfg=exportCandidate(id,'netops-services',good(n));
 ok(cfg.includes('CANDIDATO IOS-XE NETOPS')&&cfg.includes('NO CERTIFICADO'),id+' no disclaimer');
 ok(cfg.includes('ip tacacs source-interface Loopback0'),id+' wrong router TACACS source');
 ok(cfg.includes('ip tacacs source-interface Vlan30'),id+' wrong stack TACACS source');
 ok(cfg.includes('logging source-interface Loopback0'),id+' wrong router logging source');
 ok(cfg.includes('logging source-interface Vlan30'),id+' wrong stack logging source');
 ok((cfg.match(/logging host 10\.70\.0\.100 transport tls port 6514 profile NETOPS-LOG-TLS/g)||[]).length===2,
   id+' wrong collector or TLS port');
 ok(cfg.includes('aaa authentication login NETOPS-VTY group NETOPS-TACACS local'),
   id+' missing local fallback');
 ok(!/\b(?:snmp-server community|username .* secret|pre-shared-key|key 0 |password 0 )/i.test(cfg),
   id+' candidate leaks credentials or unsafe SNMP');
 for(const address of CM_SERVICES.tacacs){
  ok(paloCandidate(0).includes('ip-netmask '+address+'/32'),id+' TACACS host missing');
  ok(evaluateSitePanPolicy(0,'TRANSIT','USERS','aaa-tacacs',address,
    ROUTER_NTP_SOURCES[n]).action==='allow',id+' router AAA denied');
  ok(evaluateSitePanPolicy(0,n===0?'MGMT-DATA':'TRANSIT','USERS',
    'aaa-tacacs',address,'10.70.'+n+'.162').action==='allow',id+' stack AAA denied at CM');
  if(n)ok(evaluateSitePanPolicy(n,'MGMT-DATA','TRANSIT','aaa-tacacs',
    address,'10.70.'+n+'.162').action==='allow',id+' stack AAA denied at branch');
  deny(0,'TRANSIT','USERS','ssh',address,ROUTER_NTP_SOURCES[n]);
  deny(0,'TRANSIT','USERS','aaa-tacacs',address,'10.70.100.2');
  if(n){
   deny(n,'USERS','TRANSIT','aaa-tacacs',address,'10.70.'+n+'.10');
   deny(n,'GUESTS','TRANSIT','aaa-tacacs',address,'10.70.'+n+'.180');
   deny(n,'MGMT-DATA','TRANSIT','syslog-tls',address,'10.70.'+n+'.162');
  }
 }
 ok(evaluateSitePanPolicy(0,n===0?'MGMT-DATA':'TRANSIT','USERS','syslog-tls',
   CM_SERVICES.syslog[0],'10.70.'+n+'.162').action==='allow',id+' stack log denied');
 ok(evaluateSitePanPolicy(0,'TRANSIT','USERS','syslog-tls',
   CM_SERVICES.syslog[0],ROUTER_NTP_SOURCES[n]).action==='allow',id+' router log denied');
 if(n)ok(evaluateSitePanPolicy(n,'MGMT-DATA','TRANSIT','syslog-tls',
   CM_SERVICES.syslog[0],'10.70.'+n+'.162').action==='allow',id+' stack log denied branch');
 deny(0,'TRANSIT','USERS','aaa-tacacs',CM_SERVICES.syslog[0],ROUTER_NTP_SOURCES[n]);
 deny(0,'TRANSIT','USERS','syslog-tls',CM_SERVICES.tacacs[0],ROUTER_NTP_SOURCES[n]);
 deny(0,'TRANSIT','USERS','syslog-tls',CM_SERVICES.monitor[0],ROUTER_NTP_SOURCES[n]);
}
const p=paloCandidate(0);
for(const [key,svc] of Object.entries(NETOPS_SERVICES)){
 ok(p.includes('set service '+svc.object+' protocol '+svc.protocol+' port '+svc.port),
   key+' service object absent');
 const rule='CM-IN-'+(key==='aaa-tacacs'?'TACACS':'SYSLOG')+'-NETOPS';
 ok(p.includes('set rulebase security rules '+rule+' application any') &&
    p.includes('set rulebase security rules '+rule+' service '+svc.object),
   key+' must bind tcp-specific service object when using application any');
}
for(const key of Object.keys(good(1))){
 if(key==='ipsecOspfToCmVerified'||typeof good(1)[key]!=='boolean'||key==='snmpEnabled')continue;
 const cfg={...good(1),[key]:false};
 ok(assessNetops(1,cfg).status==='BLOCKED',key+' should prevent unsafe config');
 assert.throws(()=>renderNetopsCandidate(1,cfg),/AAA\/SYSLOG NO GENERADO/);
}
for(const settings of [
 null,undefined,
 {...good(1),snmpEnabled:true},
 {...good(1),tacacs:['10.70.0.112','10.70.0.114']},
 {...good(1),syslog:'10.70.0.99'},
 {...good(1),tlsProfile:'../../etc/passwd'},
 {...good(1),secret:'never-copy-to-repo'},
 {...good(1),ipsecOspfToCmVerified:false},
 {...good(1),monitoringAlertsDefined:false}
]){
 ok(assessNetops(1,settings).status==='BLOCKED','Invalid configuration accepted');
 assert.throws(()=>renderNetopsCandidate(1,settings),/NO GENERADO/);
}
ok(assessNetops(0,{...good(0),ipsecOspfToCmVerified:false}).status==='LAB_CANDIDATE',
  'CM should not depend on remote overlay');
assert.throws(()=>exportCandidate('s01','netops-services'),/NO GENERADO/);
console.log('Network AAA/TLS Syslog: '+checks+
  ' reviewed gates across 23 sites; custom TCP ports, precise sources, failure-closed and secrets prohibited.');
