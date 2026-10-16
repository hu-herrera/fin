'use strict';
const assert=require('node:assert/strict');
const {guestDhcpAssessment,renderGuestDhcpCandidate}=require('../network/guest-dhcp-candidate.cjs');
const {exportCandidate}=require('../network/export-candidate.cjs');
const configured=n=>({
 approvedGuestDhcp:true,verifiedPublicDns:true,
 start:'10.70.'+n+'.178',end:'10.70.'+n+'.190',
 dnsPrimary:'1.1.1.1',dnsSecondary:'9.9.9.9',expectedGuests:10
});
let checks=0;
for(let n=0;n<=22;n++){
 const key=n===0?'cm':'s'+String(n).padStart(2,'0'),v=configured(n);
 const a=guestDhcpAssessment(n,v);
 assert.deepEqual(a.issues,[],key+' DHCP candidate should be valid');checks++;
 assert.equal(a.poolSize,13);checks++;
 const s=renderGuestDhcpCandidate(n,v),cli=exportCandidate(key,'guest-dhcp',v);
 const p='set network dhcp interface ae2.40 server';
 for(const fragment of [
   p+' mode enabled',
   p+' ip-pool [ 10.70.'+n+'.178-10.70.'+n+'.190 ]',
   p+' option gateway 10.70.'+n+'.177',
   p+' option subnet-mask 255.255.255.240',
   p+' option dns primary 1.1.1.1',
   p+' option dns secondary 9.9.9.9']){
   assert.ok(s.includes(fragment),key+' missing '+fragment);checks++;
 }
 assert.ok(cli.includes('NO COMMIT')&&cli.includes(s));checks++;
 assert.ok(!s.includes('ip helper-address'));checks++;
 assert.ok(!s.includes('ae2.10 server'));checks++;
 assert.ok(!s.includes('ae2.20 server'));checks++;
}
function rejected(patch,num=1){
 const data={...configured(num),...patch};
 assert.ok(guestDhcpAssessment(num,data).issues.length>0);
 assert.throws(()=>renderGuestDhcpCandidate(num,data),/DHCP INVITADOS NO GENERADO/);
}
rejected({approvedGuestDhcp:false});
rejected({verifiedPublicDns:false});
rejected({start:'10.70.1.177'});
rejected({end:'10.70.1.191'});
rejected({start:'10.70.2.178'});
rejected({start:'10.70.1.190',end:'10.70.1.178'});
rejected({expectedGuests:14});
rejected({expectedGuests:0});
rejected({dnsPrimary:'10.70.0.110'});
rejected({dnsPrimary:'203.0.113.10'});
rejected({dnsSecondary:'1.1.1.1'});
rejected({dnsPrimary:'not.ip'});
rejected({dnsSecondary:'255.255.255.255'});
assert.throws(()=>exportCandidate('s01','guest-dhcp'),/DHCP INVITADOS NO GENERADO/);
assert.throws(()=>guestDhcpAssessment(23,configured(23)),/Sede/);
console.log('PAN-OS guest DHCP '+checks+' positive checks across 23 sites; invalid or unapproved inputs rejected.');
