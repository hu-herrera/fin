'use strict';
const assert=require('node:assert/strict');
const {pcInventory,exportCandidate}=require('../network/export-candidate.cjs');
const {REQUIRED,assessFinancialFlow,renderFinancialFlow}=
 require('../network/financial-policy-candidate.cjs');
const good=n=>({
 ...Object.fromEntries(Object.keys(REQUIRED).map(k=>[k,true])),
 approvalRef:'FIN-APPROVED-2026',
 applicationId:'ssl',
 securityProfile:'FIN-Threat-Prevention',
 tcpPort:443,
 sourceIp:'10.70.'+n+'.10',
 destinationIp:'10.70.0.90'
});
const inventory=pcInventory();let checks=0;
for(let n=1;n<=22;n++){
 const key='s'+String(n).padStart(2,'0'),d=good(n),s=assessFinancialFlow(n,d,inventory);
 assert.equal(s.status,'LAB_CANDIDATE',key+' '+s.issues.join(';'));checks++;
 assert.equal(s.deployable,false);checks++;
 assert.equal(s.certified,false);checks++;
 const cli=exportCandidate(key,'financial-app',d),branch='FIN-'+key.toUpperCase()+'-TO-CM';
 const incoming='FIN-CM-FROM-'+key.toUpperCase();
 for(const v of [
  'set address FIN-APP-SRC-'+key.toUpperCase()+' ip-netmask 10.70.'+n+'.10/32',
  'set address FIN-APP-DST-'+key.toUpperCase()+' ip-netmask 10.70.0.90/32',
  'set service FIN-TCP-443-'+key.toUpperCase()+' protocol tcp port 443',
  'set rulebase security rules '+branch+' application ssl',
  'set rulebase security rules '+branch+' profile-setting group FIN-Threat-Prevention',
  'set rulebase security rules '+incoming+' from TRANSIT',
  'set rulebase security rules '+incoming+' to USERS',
  'move rulebase security rules '+branch+' before DENY-CORP-RFC1918-TRANSIT',
  'move rulebase security rules '+incoming+' before CM-IN-DNS-FROM-BRANCHES',
  'PROHIBIDO COMMIT'
 ]){assert.ok(cli.includes(v),key+' missing '+v);checks++;}
 assert.ok(!cli.split('\n').some(line=>line.startsWith('set ')&&
   (/application any\b/.test(line)||/service any\b/.test(line)||
     /source any\b/.test(line)||/destination any\b/.test(line))),key+' overly broad');checks++;
}
const cases=[
 {applicationId:'any'}, {applicationId:'DROP; commit'},
 {securityProfile:''}, {securityProfile:'bad profile'},
 {sourceIp:'10.70.1.9'},{sourceIp:'10.70.1.41'},
 {sourceIp:'10.70.2.10'},{destinationIp:'10.70.0.110'},
 {destinationIp:'10.70.0.100'}, {destinationIp:'10.70.0.10'},
 {destinationIp:'10.70.0.127'}, {destinationIp:'10.70.1.90'},
 {tcpPort:0},{tcpPort:65536},{tcpPort:'443'},
 {approvalRef:'bad ref'}, {destinationAssetVerified:false},
 {appIdentityReviewed:false},{financialApplicationOwnerApproved:false},
 {applicationIdVerified:false},{securityProfileVerified:false},
 {routeAndReturnVerified:false},{rollbackAndConsoleVerified:false},
 {secret:'do-not-store'},{password:'do-not-store'}
];
for(const patch of cases){
 const d={...good(1),...patch};
 assert.equal(assessFinancialFlow(1,d,inventory).status,'BLOCKED',
  'Accepted unsafe '+JSON.stringify(patch));
 assert.throws(()=>renderFinancialFlow(1,d,inventory),/FLUJO FINANCIERO BLOQUEADO/);
}
assert.equal(assessFinancialFlow(0,good(0),inventory).status,'BLOCKED');
assert.equal(assessFinancialFlow(1,null,inventory).status,'BLOCKED');
assert.throws(()=>exportCandidate('s01','financial-app'),/FLUJO FINANCIERO BLOQUEADO/);
assert.throws(()=>assessFinancialFlow(23,good(1),inventory),/Sede/);
console.log('Financial app policy: '+checks+' positive checks across 22 branches; real endpoints, App-ID, threat group and exact rule ordering required.');
