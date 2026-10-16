'use strict';
const assert=require('node:assert/strict');
const {clientDhcpAssessment,renderClientDhcpCandidate}=require('../network/client-dhcp-candidate.cjs');
const {exportCandidate,pcInventory}=require('../network/export-candidate.cjs');
const inventory=pcInventory();
const params=(n,count)=>({
 approvedClientDhcp:true,
 staticAddressMigrationApproved:true,
 verifiedDnsReachability:true,
 verifiedLanGateway:true,
 dns:['10.70.0.110','10.70.0.111'],
 expectedUsers:count,
 voice:{enabled:true,approvedVoiceDhcp:true,vendorOptionsReviewed:true,expectedPhones:7}
});
let checks=0;
for(let n=0;n<=22;n++){
 const id=n===0?'cm':'s'+String(n).padStart(2,'0'),count=inventory[id];
 const v=params(n,count),a=clientDhcpAssessment(n,v,inventory);
 assert.deepEqual(a.issues,[],id+' invalid');checks++;
 assert.equal(a.userCount,count);checks++;
 assert.equal(a.voiceCount,7);checks++;
 const output=exportCandidate(id,'client-dhcp',v),base='set network dhcp interface ae2.';
 const expected=[
   base+'10 server mode enabled',
   base+'10 server probe-ip yes',
   base+'10 server ip-pool [ 10.70.'+n+'.10-10.70.'+n+'.'+(count+9)+' ]',
   base+'10 server option gateway 10.70.'+n+'.1',
   base+'10 server option subnet-mask 255.255.255.128',
   base+'10 server option dns primary 10.70.0.110',
   base+'10 server option dns secondary 10.70.0.111',
   base+'20 server mode enabled',
   base+'20 server ip-pool [ 10.70.'+n+'.130-10.70.'+n+'.136 ]',
   base+'20 server option gateway 10.70.'+n+'.129',
   base+'20 server option subnet-mask 255.255.255.224',
   base+'20 server option dns primary 10.70.0.110'
 ];
 for(const line of expected){assert.ok(output.includes(line),id+' '+line);checks++;}
 assert.ok(output.includes('NO COMMIT'));checks++;
 assert.ok(!output.includes('ip helper-address'));checks++;
 assert.ok(!output.includes('ae2.40 server'));checks++;
 assert.ok(!output.includes('set network dhcp interface ae1'));checks++;
 const usersOnly=renderClientDhcpCandidate(n,{...v,voice:{enabled:false}},inventory);
 assert.ok(!usersOnly.includes('ae2.20 server'));checks++;
 const omittedVoice=renderClientDhcpCandidate(n,{...v,voice:undefined},inventory);
 assert.ok(!omittedVoice.includes('ae2.20 server'));checks++;
}
function rejects(changes,where=1){
 const id='s'+String(where).padStart(2,'0'),v={...params(where,inventory[id]),...changes};
 const a=clientDhcpAssessment(where,v,inventory);
 assert.ok(a.issues.length>0,'Expected candidate rejection');
 assert.throws(()=>renderClientDhcpCandidate(where,v,inventory),/DHCP CLIENTES NO GENERADO/);
}
rejects({approvedClientDhcp:false});
rejects({staticAddressMigrationApproved:false});
rejects({verifiedDnsReachability:false});
rejects({verifiedLanGateway:false});
rejects({expectedUsers:29});
rejects({expectedUsers:31});
rejects({dns:['10.70.0.110','10.70.0.110']});
rejects({dns:['1.1.1.1','9.9.9.9']});
rejects({dns:['10.70.0.110','invalid']});
rejects({dns:['10.70.0.110']});
rejects({dns:null});
rejects({voice:{enabled:true,approvedVoiceDhcp:true,vendorOptionsReviewed:true,expectedPhones:30}});
rejects({voice:{enabled:true,approvedVoiceDhcp:true,vendorOptionsReviewed:true,expectedPhones:55}},0);
rejects({voice:{enabled:true,approvedVoiceDhcp:false,vendorOptionsReviewed:true,expectedPhones:7}});
rejects({voice:{enabled:true,approvedVoiceDhcp:true,vendorOptionsReviewed:false,expectedPhones:7}});
rejects({voice:{enabled:true,approvedVoiceDhcp:true,vendorOptionsReviewed:true,expectedPhones:0}});
rejects({voice:{enabled:'yes'}});
rejects({voice:null});
assert.throws(()=>exportCandidate('s01','client-dhcp'),/DHCP CLIENTES NO GENERADO/);
assert.throws(()=>clientDhcpAssessment(23,params(23,8),inventory),/Sede fuera/);
console.log('Corporate/voice DHCP: '+checks+' approved candidate assertions in 23 sites; unsafe migrations and oversize voice rejected.');
