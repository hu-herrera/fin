'use strict';
const assert=require('node:assert/strict');
const {siteCandidate}=require('../network/redundant-configs.cjs');
const {PORTS,VLAN}=require('../network/redundant-model.cjs');
let passed=0,checks=0;
function check(ok,message){assert.ok(ok,message);checks++;}
function count(s,needle){return s.split(needle).length-1;}
for(let n=0;n<=22;n++){
  const p=siteCandidate(n),c=p.cisco,sw=p.stack,fw=p.palo;
  const label='CM/Sede '+n;
  check(p.deployable===false,label+' candidate must not be marked production ready');
  check(p.blockers.length>=4,label+' blockers undocumented');
  for(const v of VLAN){
    check(c.includes('ip route 10.70.'+n+'.'+v.network+' '+v.mask+' 10.72.'+n+'.2'),label+' missing static '+v.id);
    check(c.includes('ip prefix-list SITE-LAN-'+n+' seq '+(v.id*10)),label+' missing OSPF route filter '+v.id);
    check(fw.includes('ae2.'+v.id+' tag '+v.id),label+' missing PA tagged VLAN '+v.id);
    check(fw.includes('ae2.'+v.id+' ip 10.70.'+n+'.'+v.offset+'/'+v.prefix),label+' missing PA gateway '+v.id);
  }
  check(!c.includes('GigabitEthernet0/0/0.10'),label+' legacy router-on-a-stick remains');
  check(c.includes('interface Port-channel10'),label+' Cisco LACP transit missing');
  check(count(c,'channel-group 10 mode active')===2,label+' Cisco LACP must have 2 members');
  for(const port of Object.values(PORTS.wan))check(c.includes('interface '+port),label+' WAN '+port+' missing');
  for(const p of PORTS.transit){
    check(c.includes('interface '+p.router),label+' Cisco port missing '+p.router);
    check(fw.includes('ethernet '+p.firewall+' aggregate-group ae1'),label+' PA 10G member missing');
  }
  for(const p of PORTS.distribution){
    check(sw.includes('interface '+p.switch),label+' stack member absent '+p.switch);
    check(fw.includes('ethernet '+p.firewall+' aggregate-group ae2'),label+' firewall distribution member absent');
  }
  check(sw.includes('switch 1 provision c9200l-48t-4g'),label+' stack member 1 not provisioned');
  check(sw.includes('switch 2 provision c9200l-48t-4g'),label+' stack member 2 not provisioned');
  check(count(sw,'channel-group 20 mode active')===4,label+' cross stack MEC must use four ports');
  check(!sw.includes('channel-group 1 mode active'),label+' legacy inter-switch Po1 is invalid after stacking');
  check(count(sw,'interface Vlan30')===1,label+' stacked switches have more than one mgmt SVI');
  check(sw.includes('10.70.'+n+'.162 255.255.255.240'),label+' stack mgmt IP wrong');
  check(!fw.includes('virtual-wire'),label+' Layer3 must not use legacy virtual wire');
  check(fw.includes('ae1 layer3 lacp enable yes'),label+' PA LACP ae1 disabled');
  check(fw.includes('ae2 layer3 lacp enable yes'),label+' PA LACP ae2 disabled');
  check(!fw.includes('set deviceconfig system ip-address 10.70.'+n+'.164'),label+' OOB overlap');
  check(fw.includes('DEFAULT nexthop ip-address 10.72.'+n+'.1'),label+' default route to router missing');
  check(!c.includes('203.0.113.'),label+' nonroutable test peer incorrectly installed');
  passed++;
}
console.log('TOTAL '+passed+' sitios; '+checks+' verificaciones de candidato Cisco/PAN/StackWise.');
