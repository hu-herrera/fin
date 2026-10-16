'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const countMatch=html.match(/const PC_COUNT\s*=\s*(\{[\s\S]*?\});/);
assert.ok(countMatch,'Inventario de PCs no existe en index.html');
const pcCounts=vm.runInNewContext('('+countMatch[1]+')');
const {siteCandidate}=require('../network/redundant-configs.cjs');
const {exportCandidate}=require('../network/export-candidate.cjs');
const {PORTS,VLAN}=require('../network/redundant-model.cjs');
let passed=0,checks=0;
function check(ok,message){assert.ok(ok,message);checks++;}
function count(s,needle){return s.split(needle).length-1;}
for(let n=0;n<=22;n++){
  const siteKey=n===0?'cm':'s'+String(n).padStart(2,'0');
  const pcCount=pcCounts[siteKey];
  const p=siteCandidate(n,pcCount),c=p.cisco,sw=p.stack,fw=p.palo;
  const label='CM/Sede '+n;
  check(p.deployable===false,label+' candidate must not be marked production ready');
  for(const device of ['router','stack','palo']){
    const exported=exportCandidate(siteKey,device);
    check(exported.includes('NO APTO PARA DESPLIEGUE REAL'),label+' exported without warning');
    check(exported.includes('PC asignados '+pcCount),label+' exported count omitted');
    check(exported.includes(device==='router'?c:device==='stack'?sw:fw),label+' exported config incomplete');
  }
  check(p.blockers.length>=4,label+' blockers undocumented');
  for(const v of VLAN){
    check(c.includes('ip route 10.70.'+n+'.'+v.network+' '+v.mask+' 10.72.'+n+'.2'),label+' missing static '+v.id);
    check(c.includes('ip prefix-list SITE-LAN-'+n+' seq '+(v.id*10)),label+' missing OSPF route filter '+v.id);
    check(fw.includes('ae2.'+v.id+' tag '+v.id),label+' missing PA tagged VLAN '+v.id);
    check(fw.includes('ae2.'+v.id+' ip 10.70.'+n+'.'+v.offset+'/'+v.prefix),label+' missing PA gateway '+v.id);
  }
  check(!c.includes('GigabitEthernet0/0/0.10'),label+' legacy router-on-a-stick remains');
  check(c.includes('interface Port-channel10'),label+' Cisco LACP transit missing');
  const routerId='10.70.100.'+(n===0?1:n+10);
  check(c.includes('interface Loopback0\n description ROUTER-ID-OSPF-OVERLAY\n ip address '+routerId+' 255.255.255.255\n ip ospf 1 area 0'),
    label+' Loopback0 /32 missing or mismatched');
  check(c.includes('router ospf 1\n router-id '+routerId+'\n passive-interface default'),
    label+' OSPF Router-ID is not explicitly configured');
  for(const tunnel of [100,200,300,400])
    check(c.includes(' no passive-interface Tunnel'+tunnel),
      label+' OSPF tunnel '+tunnel+' unintentionally left passive');
  check(c.includes(' ip nat inside'),label+' Cisco transit lacks NAT inside');
  for(const [type,iface] of Object.entries(PORTS.wan)){
    const rule='NAT-'+type.toUpperCase();
    check(c.includes('route-map '+rule+' permit 10\n match ip address NAT-LOCAL\n match interface '+iface),label+' NAT route-map not tied to egress '+iface);
    check(c.includes('ip nat inside source route-map '+rule+' interface '+iface+' overload'),label+' NAT/PAT egress translation missing '+type);
  }
  for(const [prefix,wildcard] of [['0','0.0.0.127'],['128','0.0.0.31'],['176','0.0.0.15']])
    check(c.includes(' permit ip 10.70.'+n+'.'+prefix+' '+wildcard+' any'),label+' NAT ACL wildcard mismatch '+prefix);
  check(!c.includes('permit ip 10.70.'+n+'.160 0.0.0.15 any'),label+' NAT must not publish management subnet by default');
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
  check(sw.includes('\nip dhcp snooping\nip dhcp snooping vlan 10,20,40\n'),
    label+' DHCP snooping global and selected VLANs not configured');
  check(sw.includes('interface Port-channel20\n description MEC-TO-PA1410-AE2')&&
        sw.includes(' ip dhcp snooping trust\n'),
    label+' only PA-facing LACP uplink may be DHCP trusted');
  check(count(sw,'ip dhcp snooping trust')===1,
    label+' DHCP snooping trust accidentally configured on access or Wi-Fi trunk ports');
  check(!sw.includes('ip dhcp snooping vlan 30'),
    label+' management static subnet incorrectly included in DHCP snooping');
  check(count(sw,'channel-group 20 mode active')===4,label+' cross stack MEC must use four ports');
  check(!sw.includes('channel-group 1 mode active'),label+' legacy inter-switch Po1 is invalid after stacking');
  check(count(sw,' description PC-')===pcCount,label+' port map loses PCs');
  for(let k=0;k<pcCount;k++){
    const half=Math.ceil(pcCount/2);
    const member=k<half?1:2;
    const port=member===1?k+3:k-half+3;
    const code=n===0?'CM':'S'+String(n).padStart(2,'0');
    const portBlock='interface GigabitEthernet'+member+'/0/'+port+'\n description PC-'+code+'-'+String(k+1).padStart(3,'0');
    check(sw.includes(portBlock),label+' PC '+(k+1)+' mapped to wrong stack member');
  }
  for(const member of [1,2])for(const port of [33,34]){
    const start=sw.indexOf('interface GigabitEthernet'+member+'/0/'+port);
    const next=sw.indexOf('interface ',start+1);
    const block=sw.slice(start,next<0?undefined:next);
    check(block.includes('switchport trunk native vlan 999') &&
          block.includes('switchport trunk allowed vlan 10,40'),
          label+' invalid access point trunk on member '+member);
  }
  check(count(sw,'interface Vlan30')===1,label+' stacked switches have more than one mgmt SVI');
  check(sw.includes('10.70.'+n+'.162 255.255.255.240'),label+' stack mgmt IP wrong');
  check(!fw.includes('virtual-wire'),label+' Layer3 must not use legacy virtual wire');
  for(const [vlan,zone] of [[10,'USERS'],[20,'VOICE'],[30,'MGMT-DATA'],[40,'GUESTS']])
    check(fw.includes('set zone '+zone+' network layer3 ae2.'+vlan),label+' VLAN '+vlan+' missing PA security zone');
  check(fw.includes('set zone TRANSIT network layer3 ae1'),label+' transit zone absent');
  check(!fw.includes('rulebase security rules ALLOW-ANY'),label+' unsafe allow-any policy generated');
  check(fw.includes('ae1 layer3 lacp enable yes'),label+' PA LACP ae1 disabled');
  check(fw.includes('ae2 layer3 lacp enable yes'),label+' PA LACP ae2 disabled');
  check(!fw.includes('set deviceconfig system ip-address 10.70.'+n+'.164'),label+' OOB overlap');
  check(fw.includes('set network profiles interface-management-profile VLAN30-STACK https yes'),
    label+' firewall lacks restricted in-band HTTPS management profile');
  check(fw.includes('set network profiles interface-management-profile VLAN30-STACK ssh yes'),
    label+' firewall lacks restricted in-band SSH management profile');
  check(fw.includes('set network profiles interface-management-profile VLAN30-STACK permitted-ip 10.70.'+n+'.162/32'),
    label+' management profile allows unexpected addresses');
  check(fw.includes('set network interface aggregate-ethernet ae2 layer3 units ae2.30 interface-management-profile VLAN30-STACK'),
    label+' VLAN30 interface missing management profile');
  check(!fw.includes('permitted-ip 0.0.0.0/0'),
    label+' PAN-OS administration must not allow all addresses');
  check(fw.includes('DEFAULT nexthop ip-address 10.72.'+n+'.1'),label+' default route to router missing');
  check(!c.includes('203.0.113.'),label+' nonroutable test peer incorrectly installed');
  passed++;
}
assert.throws(()=>exportCandidate('s99','router'),/Sede desconocida/);
assert.throws(()=>exportCandidate('s01','firewall'),/Equipo desconocido/);
const totalPC=Object.values(pcCounts).reduce((a,b)=>a+b,0);
assert.equal(totalPC,650,'Inventario global esperado de 650 PCs');
console.log('TOTAL '+passed+' sitios; '+totalPC+' PCs mapeados; '+checks+' verificaciones de candidato Cisco/PAN/StackWise.');
