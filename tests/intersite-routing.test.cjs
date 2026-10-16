'use strict';
const assert=require('node:assert/strict');
const {routerCandidate,paloCandidate,evaluateSitePanPolicy,securityRulesForSite,CM_SERVICES}=require('../network/redundant-configs.cjs');
const {VLAN}=require('../network/redundant-model.cjs');
let checks=0;
const ok=(x,msg)=>{assert.ok(x,msg);checks++};
const eq=(a,b,msg)=>{assert.equal(a,b,msg);checks++};
const decision=(num,from,to,app,dest,src,expectedRule,expectedAction)=>{
 const result=evaluateSitePanPolicy(num,from,to,app,dest,src);
 eq(result.action,expectedAction,'Site '+num+': '+from+'/'+to+' '+app+' '+src+' -> '+dest);
 eq(result.rule,expectedRule,'Unexpected rule on site '+num+' '+src+' -> '+dest);
};
const seen=new Set();
for(let n=0;n<23;n++){
 const cfg=paloCandidate(n),router=routerCandidate(n);
 const prefix='10.70.'+n+'.';
 const rules=securityRulesForSite(n);
 const names=rules.map(r=>r.name);
 eq(names.length,new Set(names).size,'Duplicate PAN-OS rules at site '+n);
 for(const v of VLAN){
   ok(router.includes('ip route '+prefix+v.network+' '+v.mask+' 10.72.'+n+'.2'),
     'Router missing PA L3 return route for '+n+' VLAN '+v.id);
 }
 ok(cfg.includes('set network virtual-router default routing-table ip static-route DEFAULT nexthop ip-address 10.72.'+n+'.1'), 'PA no default to Cisco');
 ok(cfg.includes('set address-group CM-DNS-SERVERS static [ CM-DNS-1 CM-DNS-2 ]'),'DNS group missing');
 ok(cfg.includes('set address-group CM-NTP-SERVERS static [ CM-NTP-1 CM-NTP-2 ]'),'NTP group missing');
 const deny=cfg.indexOf('set rulebase security rules DENY-CORP-RFC1918-TRANSIT action deny');
 const web=cfg.indexOf('set rulebase security rules ALLOW-USERS-WEB-OUT action allow');
 ok(deny>0&&web>deny,'Private destination deny must come before generic web permit');
 const branch=n>0;
 const dnsRule=branch?'BRANCH-DNS-TO-CM':'CM-IN-DNS-FROM-BRANCHES';
 const ntpRule=branch?'BRANCH-NTP-TO-CM':'CM-IN-NTP-FROM-BRANCHES';
 ok(cfg.includes('set rulebase security rules '+dnsRule+' application dns'),'DNS rule missing');
 ok(cfg.includes('set rulebase security rules '+ntpRule+' application ntp'),'NTP rule missing');
 ok(cfg.indexOf('set rulebase security rules '+dnsRule+' action allow')<deny,'DNS exception must precede deny');
 ok(cfg.indexOf('set rulebase security rules '+ntpRule+' action allow')<deny,'NTP exception must precede deny');
 for(const ip of CM_SERVICES.dns)ok(cfg.includes('ip-netmask '+ip+'/32'),'CM DNS host object missing');
 for(const ip of CM_SERVICES.ntp)ok(cfg.includes('ip-netmask '+ip+'/32'),'CM NTP host object missing');
 if(branch){
  const srcUsers='10.70.'+n+'.10';
  const srcMgmt='10.70.'+n+'.162';
  decision(n,'USERS','TRANSIT','dns',CM_SERVICES.dns[0],srcUsers,dnsRule,'allow');
  decision(n,'USERS','TRANSIT','dns',CM_SERVICES.dns[0],'10.70.0.10',
    'DENY-CORP-RFC1918-TRANSIT','deny');
  decision(n,'MGMT-DATA','TRANSIT','ntp',CM_SERVICES.ntp[0],'10.70.10.162',
    'DENY-CORP-RFC1918-TRANSIT','deny');
  ok(cfg.includes('set address-group BR-LOCAL-DNS-CLIENTS static [ BR-LOCAL-USERS BR-LOCAL-MGMT ]'),
    'Branch DNS source group absent');
  ok(cfg.includes('set rulebase security rules BRANCH-NTP-TO-CM source BR-LOCAL-MGMT'),
    'Branch NTP may be sourced from any network');
  decision(n,'MGMT-DATA','TRANSIT','dns',CM_SERVICES.dns[1],srcMgmt,dnsRule,'allow');
  decision(n,'MGMT-DATA','TRANSIT','ntp',CM_SERVICES.ntp[0],srcMgmt,ntpRule,'allow');
  decision(n,'USERS','TRANSIT','ssl','10.70.0.110',srcUsers,'DENY-CORP-RFC1918-TRANSIT','deny');
  decision(n,'USERS','TRANSIT','ssh','10.70.0.110',srcUsers,'DENY-CORP-RFC1918-TRANSIT','deny');
  decision(n,'MGMT-DATA','TRANSIT','dns','10.70.0.100',srcMgmt,'DENY-CORP-RFC1918-TRANSIT','deny');
  decision(n,'USERS','TRANSIT','ssl','10.70.2.10',srcUsers,'DENY-CORP-RFC1918-TRANSIT','deny');
  decision(n,'USERS','TRANSIT','ssl','8.8.8.8',srcUsers,'ALLOW-USERS-WEB-OUT','allow');
  decision(n,'GUESTS','TRANSIT','ssl',CM_SERVICES.dns[0],'10.70.'+n+'.180','DENY-GUEST-RFC1918-TRANSIT','deny');
  // Simetría: PA sucursal -> Cisco -> OSPF -> Cisco CM -> PA CM -> servidor.
  ok(router.includes('redistribute static subnets route-map EXPORT-SITE-LAN'),'OSPF export absent');
  ok(!router.includes('permit '+prefix+'176/28'),'Guest network exported over OSPF');
 }else{
  ok(cfg.includes('set address-group BRANCH-DNS-CLIENTS static [ BR-01-USERS BR-01-MGMT'), 'CM DNS client objects missing');
  ok(cfg.includes('set address-group BRANCH-MGMT-CLIENTS static [ BR-01-MGMT'), 'CM NTP client objects missing');
  for(let remote=1;remote<=22;remote++){
   const u='10.70.'+remote+'.10',m='10.70.'+remote+'.162',g='10.70.'+remote+'.180';
   decision(0,'TRANSIT','USERS','dns',CM_SERVICES.dns[0],u,dnsRule,'allow');
   decision(0,'TRANSIT','USERS','dns',CM_SERVICES.dns[1],m,dnsRule,'allow');
   decision(0,'TRANSIT','USERS','ntp',CM_SERVICES.ntp[0],m,ntpRule,'allow');
   decision(0,'TRANSIT','USERS','ssh',CM_SERVICES.dns[0],u,'interzone-default','deny');
   decision(0,'TRANSIT','USERS','dns',CM_SERVICES.dns[0],g,'interzone-default','deny');
   decision(0,'TRANSIT','USERS','dns','10.70.0.12',u,'interzone-default','deny');
   decision(0,'TRANSIT','MGMT-DATA','ssh','10.70.0.162',u,'interzone-default','deny');
  }
 }
 seen.add(n);
}
assert.throws(()=>evaluateSitePanPolicy(0,'TRANSIT','USERS','dns','invalid','10.70.1.10'),/IPv4/);
assert.throws(()=>evaluateSitePanPolicy(0,'TRANSIT','USERS','dns','10.70.0.110',''),/IP origen/);
eq(seen.size,23,'Every site must be checked');
console.log('TOTAL intersite PAN-OS/OSPF: '+checks+' checks, 23 sites, 22 incoming branches, default-deny for other traffic.');
