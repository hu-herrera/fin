'use strict';
const assert=require('node:assert/strict');
const {assessWanIpsecReadiness}=require('../network/wan-ipsec-readiness.cjs');
const {exportCandidate}=require('../network/export-candidate.cjs');
const baseWan=()=>({
 mode:'cgnat',contractVerified:true,nextHopVerified:true,mtuVerified:true,
 outboundIkev2NatTVerified:true,returnTrafficVerified:true,
 vpnPeerAndTunnelVerified:true,ospfOverTunnelVerified:true,
 remoteSlaTargetsVerified:true
});
const good=()=>({
 // Synthetic test-only public address; NOT a real VPN hub and never exported.
 hub:{
   publicEndpoint:'8.8.8.8',verifiedPublicReachability:true,
   inboundUdp500Verified:true,inboundUdp4500Verified:true,
   ikev2IdentityApproved:true,behindCgnat:false
 },
 wan:{starlink:baseWan(),leo:{mode:'unavailable'},
   entel5g:{mode:'unavailable'},gtd4g:{mode:'unavailable'}}
});
let checks=0;
for(let n=0;n<=22;n++){
 const r=assessWanIpsecReadiness(n,good());
 assert.equal(r.status,'CANDIDATE_FOR_LAB_REVIEW');checks++;
 assert.equal(r.certified,false);checks++;
 assert.equal(r.blockers.length,0);checks++;
 assert.equal(r.links.length,4);checks++;
 assert.ok(r.warnings.some(w=>w.includes('CGNAT')));checks++;
 assert.ok(r.links.some(w=>w.type==='leo'&&w.status==='NOT_DEPLOYED'));checks++;
}
function rejects(mutate,expected){
 const p=good();mutate(p);
 const r=assessWanIpsecReadiness(1,p);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.certified,false);
 assert.ok(r.blockers.some(e=>e.includes(expected)),r.blockers.join(' | '));
}
rejects(p=>{p.hub.publicEndpoint='10.70.0.10'},'pública');
rejects(p=>{p.hub.publicEndpoint='203.0.113.10'},'pública');
rejects(p=>{p.hub.publicEndpoint='bad.ip'},'IPv4');
rejects(p=>{p.hub.verifiedPublicReachability=false},'alcanzabilidad');
rejects(p=>{p.hub.inboundUdp4500Verified=false},'UDP/500');
rejects(p=>{p.hub.ikev2IdentityApproved=false},'Identidad');
rejects(p=>{p.hub.behindCgnat=true},'CGNAT');
rejects(p=>{p.wan.starlink.outboundIkev2NatTVerified=false},'NAT-T');
rejects(p=>{p.wan.starlink.ospfOverTunnelVerified=false},'OSPF');
rejects(p=>{p.wan.starlink.remoteSlaTargetsVerified=false},'sondas');
rejects(p=>{p.wan.starlink.mode='other'},'modo WAN inválido');
rejects(p=>{p.wan.starlink.mode='unavailable'},'ninguna WAN');
rejects(p=>{delete p.wan.entel5g},'falta declaración');
const nil=assessWanIpsecReadiness(1,null);
assert.equal(nil.status,'BLOCKED');
const cli=exportCandidate('s01','wan-readiness',good());
assert.ok(cli.includes('NO CERTIFICA VPN REAL'));
assert.ok(cli.includes('"status": "CANDIDATE_FOR_LAB_REVIEW"'));
assert.ok(cli.includes('"certified": false'));
const missingReport=exportCandidate('s01','wan-readiness',null);
assert.ok(missingReport.includes('"status": "BLOCKED"'));
assert.throws(()=>assessWanIpsecReadiness(23,good()),/Sede/);
console.log('WAN IPsec/CGNAT: '+checks+' candidate assertions across 23 sites; no fictitious SA accepted as certification.');
