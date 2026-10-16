'use strict';
// Structural acceptance matrix for ALL 23 sites. It is deliberately unable
// to mark a site "physically accepted" without external equipment evidence.
// Never treat Playwright or template validation as real hardware certification.
const {pcInventory}=require('./export-candidate.cjs');
const {siteCandidate,ROUTER_NTP_SOURCES}=require('./redundant-configs.cjs');
const {addressReview}=require('./management-services-candidate.cjs');
const {checkSiteNum,VLAN}=require('./redundant-model.cjs');
const REQUIRED_EXTERNAL=Object.freeze([
 'physical-router-switch-and-firewall-inventory',
 'licensed-iosxe-and-panos-candidate-commit-validation',
 'switch-stackwise-cabling-and-transceivers',
 'wan-isp-contracts-and-addressing',
 'vpn-ikev2-ipsec-peer-and-nat-t',
 'ospf-encrypted-neighbors-and-routing',
 'dns-ntp-service-reachability',
 'aaa-break-glass-tacacs-authorization',
 'tls-syslog-collector-and-certificates',
 'panos-authorized-admin-host-or-independent-mgt',
 'panos-firewall-originated-service-routes',
 'dhcp-design-or-approved-static-host-addressing',
 'snmpv3-or-monitoring-plan-with-actual-evidence',
 'app-specific-financial-policies-with-approval',
 'failover-and-restoration-device-tests',
 'recovery-backup-rollback-and-acceptance-signatures'
]);
function siteReport(n,inventory=pcInventory()){
 checkSiteNum(n);
 const id=n===0?'cm':'s'+String(n).padStart(2,'0');
 const count=inventory[id],failures=[];
 if(!Number.isInteger(count)||count<0||count>60){
  return {site:id,siteNum:n,pcs:count,modeled:false,certified:false,
   status:'SIMULATOR_STRUCTURAL_FAILURE',failures:['Invalid PC count'],externalBlockers:[...REQUIRED_EXTERNAL]};
 }
 const conf=siteCandidate(n,count),prefix='10.70.'+n+'.';
 const ok=(result,reason)=>{if(!result)failures.push(reason)};
 ok(conf.deployable===false,'Candidate incorrectly marked deployable');
 ok(conf.cisco.includes('interface Port-channel10'),'Router LACP 10 missing');
 ok(conf.palo.includes('set network interface aggregate-ethernet ae1 layer3 ip 10.72.'+n+'.2/30'),
   'PA L3 transit incorrect');
 ok(conf.stack.includes('interface Port-channel20'),'Stack LACP 20 missing');
 ok(conf.stack.includes('ip dhcp snooping vlan 10,20,40'),'Stack DHCP snooping not enabled');
 ok(conf.stack.includes('switch 2 provision c9200l-48t-4g'),'Stack second member absent');
 ok(conf.cisco.includes('10.72.'+n+'.2'),'Cisco return next-hop missing');
 ok(conf.cisco.includes('ip address '+ROUTER_NTP_SOURCES[n]+' 255.255.255.255'),
   'Cisco loopback source incorrect');
 ok(conf.palo.includes('set network profiles interface-management-profile VLAN30-STACK permitted-ip '+prefix+'162/32'),
   'Management stack /32 not protected');
 ok(!conf.cisco.includes('permit '+prefix+'176/28'),'Guest network advertised over OSPF');
 for(const v of VLAN)
   ok(conf.palo.includes('units ae2.'+v.id+' ip '+prefix+v.offset+'/'+v.prefix),
     'Missing VLAN'+v.id+' PA gateway');
 const warnings=[];
 if(count>29)warnings.push('One phone per PC would exceed 29 available DHCP leases on VLAN20 /27');
 if(!failures.length&&n===0&&addressReview().issues.length)
   failures.push(...addressReview().issues);
 return {site:id,siteNum:n,pcs:count,modeled:!failures.length,certified:false,
  status:failures.length?'SIMULATOR_STRUCTURAL_FAILURE':'SIMULATOR_MODEL_ONLY',
  failures,warnings,externalBlockers:[...REQUIRED_EXTERNAL]};
}
function overallReadiness(inventory=pcInventory()){
 const rows=Array.from({length:23},(_,n)=>siteReport(n,inventory));
 const totalPCs=rows.reduce((sum,r)=>sum+(Number.isInteger(r.pcs)?r.pcs:0),0);
 const issues=[];
 if(Object.keys(inventory).length!==23)issues.push('Expected 23 sites in inventory');
 if(totalPCs!==650)issues.push('Expected 650 modeled PCs');
 if(rows.some(r=>!r.modeled))issues.push('One or more sites fail structural checks');
 return {summary:{
  totalSites:23,totalPCs,structurallyPassing:rows.filter(r=>r.modeled).length,
  physicallyCertified:0,externalGateCountPerSite:REQUIRED_EXTERNAL.length,
  status:issues.length?'STRUCTURAL_FAILURE':'SIMULATED_ONLY_PHYSICAL_BLOCKED'
 },issues,sites:rows};
}
if(require.main===module){
 const report=overallReadiness();
 if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
 else{
  const s=report.summary;
  console.log(s.status+': '+s.structurallyPassing+'/23 structural site models; '+s.totalPCs+' PCs.');
  console.log('Physical certification: '+s.physicallyCertified+'/23; '+s.externalGateCountPerSite+
    ' external gates per site still require real evidence.');
  for(const issue of report.issues)console.error('ERROR '+issue);
 }
 if(report.issues.length)process.exitCode=1;
}
module.exports={REQUIRED_EXTERNAL,siteReport,overallReadiness};
