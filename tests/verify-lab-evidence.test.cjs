'use strict';
const assert=require('node:assert/strict');
const {assess,siteNumber,inspectText}=require('../network/verify-lab-evidence.cjs');
assert.equal(siteNumber('cm'),0);
assert.equal(siteNumber('s22'),22);
assert.throws(()=>siteNumber('s23'));
assert.throws(()=>siteNumber('../etc'));
const empty=assess('s01');
assert.equal(empty.status,'INCOMPLETE');
assert.equal(empty.certified,false);
assert.equal(empty.summary.passed,0);
assert.equal(empty.summary.total,16);
assert.equal(inspectText('router','SIMULADOR version 17.9'),null);
// Solo fixtures inventados para probar EL VERIFICADOR; no son capturas reales.
// Ni siquiera con fixtures completos se emite una certificación.
const router=[
'show version','Cisco C8300-2N2S-4T2X',
'show etherchannel summary','10 Po10(RU) LACP Te0/0/4(P) Te0/0/5(P)',
'show ip interface brief','Po10 10.72.1.1 YES manual up up',
'show ip route','S 10.70.1.0/25 [1/0] via 10.72.1.2',
'show ip ospf neighbor','10.70.100.1 1 FULL/ - 00:00:30 Tunnel100',
'show crypto ipsec sa',' #pkts encaps: 201',' #pkts decaps: 193'
].join('\n');
const stack=[
'show version','Cisco C9200L-48T-4G',
'show switch detail','*1 Active Ready','2 Standby Ready',
'show etherchannel summary',
'20 Po20(SU) LACP Gi1/0/45(P) Gi1/0/46(P) Gi2/0/45(P) Gi2/0/46(P)',
'show ip interface brief','Vlan30 10.70.1.162 YES manual up up'
].join('\n');
const palo=[
'show system info','model: PA-1410',
'show interface all','ae1 10.72.1.2/30 up','ae2.30 10.70.1.161/28 up',
'show lacp aggregate-ethernet all',
'ae1 ethernet1/19 ethernet1/20',
'ae2 ethernet1/3 ethernet1/4 ethernet1/5 ethernet1/6',
'show routing route','0.0.0.0/0 via 10.72.1.1',
'show running security-policy','DENY-GUEST-TO-CORP DENY-CORP-RFC1918-TRANSIT'
].join('\n');
const complete=assess('s01',{router,stack,palo});
assert.equal(complete.summary.total,16);
assert.equal(complete.summary.passed,16);
assert.equal(complete.status,'READY_FOR_HUMAN_LAB_REVIEW');
assert.equal(complete.certified,false,'No automated device certification allowed');
const noTunnel=assess('s01',{router:router.replace('FULL/ -','DOWN/ -'),stack,palo});
assert.equal(noTunnel.status,'INCOMPLETE');
assert.ok(noTunnel.checks.some(x=>x.id==='ospf-neighbor'&&x.state==='BLOCKED'));
const missingMember=assess('s01',{router,stack:stack.replace('Gi2/0/46(P)','Gi2/0/46(D)'),palo});
assert.ok(missingMember.checks.some(x=>x.id==='po20-bundle'&&x.state==='BLOCKED'));
const wrongTransit=assess('s01',{router:router.replace('10.72.1.1 YES','10.72.1.9 YES'),stack,palo});
assert.ok(wrongTransit.checks.some(x=>x.id==='transit-ip'&&x.state==='BLOCKED'));
const fake=assess('s01',{router:router+'\nSIMULADOR',stack,palo});
assert.equal(fake.summary.passed,10,'Simulated router evidence must be entirely ignored');
assert.equal(fake.certified,false);
console.log('Lab evidence validator: 16 conservative gates; missing, fake, route, LACP and OSPF evidence rejected.');
