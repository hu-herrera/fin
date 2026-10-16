'use strict';
const assert=require('node:assert/strict');
const {WAN_KEYS,DISTANCE,prefixMask,validateWanSettings,renderWanSlaCandidate}=require('../network/wan-sla-candidate.cjs');
const {PORTS}=require('../network/redundant-model.cjs');
const {exportCandidate}=require('../network/export-candidate.cjs');
let checks=0;
const verify=(x,label)=>{assert.ok(x,label);checks++};
const pair={
 starlink:['9.9.9.9','149.112.112.112'],
 leo:['1.1.1.1','1.0.0.1'],
 entel5g:['8.8.8.8','8.8.4.4'],
 gtd4g:['208.67.222.222','208.67.220.220']
};
function labSite(n){
  const result={};
  for(const [type,gateway,address] of [
    ['starlink','100.64.'+n+'.1','100.64.'+n+'.2'],
    ['leo','100.64.'+n+'.5','100.64.'+n+'.6'],
    ['entel5g','100.85.'+n+'.1','100.85.'+n+'.2'],
    ['gtd4g','100.92.'+n+'.1','100.92.'+n+'.2']]){
    result[type]={gateway,address,prefix:30,monitors:pair[type].slice()};
  }
  return result;
}
assert.equal(prefixMask(30),'255.255.255.252');
assert.equal(prefixMask(24),'255.255.255.0');
assert.throws(()=>prefixMask(32),/Prefijo/);
assert.throws(()=>renderWanSlaCandidate(),/NO GENERADO/);
assert.throws(()=>exportCandidate('s01','wan-sla'),/NO GENERADO/);
assert.throws(()=>renderWanSlaCandidate({}),/NO GENERADO/);
for(let n=0;n<23;n++){
  const settings=labSite(n);
  assert.deepEqual(validateWanSettings(settings),[]);
  const text=renderWanSlaCandidate(settings);
  const id=n===0?'cm':'s'+String(n).padStart(2,'0');
  const exported=exportCandidate(id,'wan-sla',settings);
  verify(exported.includes('Sede '+id.toUpperCase()),id+' wrong exported site');
  verify(exported.includes(text),id+' differs from validated SLA generator');
  verify(!text.includes('TEST-NET'), 'incorrect sample IP');
  for(const [i,type] of WAN_KEYS.entries()){
    const w=settings[type];
    verify(text.includes('interface '+PORTS.wan[type]+'\n description WAN '+type.toUpperCase()+' - direccionamiento contractual VERIFICADO SOLO POR USUARIO\n ip address '+w.address+' '+prefixMask(w.prefix)),
      type+' interface IP/mask missing or incorrect');
    verify(text.includes('ip nat outside'),type+' missing NAT outside');
    verify(text.includes('ip route 0.0.0.0 0.0.0.0 '+w.gateway+' '+DISTANCE[type]+' track '+(i+1)),type+' failover distance incorrect');
    verify(text.includes('track '+(i+1)+' list boolean or'),type+' track must require one of two probes');
    verify(text.includes(' object '+(101+i*10))&&text.includes(' object '+(102+i*10)),type+' track missing members');
    for(const [j,ip] of w.monitors.entries()){
      const id=101+i*10+j;
      verify(text.includes('ip route '+ip+' 255.255.255.255 '+w.gateway),type+' monitor not pinned to provider gateway');
      verify(text.includes('ip sla '+id+'\n icmp-echo '+ip+' source-interface '+PORTS.wan[type]),type+' SLA wrong source interface');
      verify(text.includes('track '+id+' ip sla '+id+' reachability'),type+' missing SLA tracker');
    }
  }
  verify((text.match(/ list boolean or/g)||[]).length===4,'not four tracked ISP objects');
  verify((text.match(/icmp-echo/g)||[]).length===8,'not eight independent probes');
  verify((text.match(/255\.255\.255\.255 /g)||[]).length===8,'not eight pinned /32 routes');
}
const changes=[
  [s=>{s.starlink.monitors[0]='203.0.113.10'},'RFC5737'],
  [s=>{s.starlink.monitors[0]='10.70.0.1'},'RFC1918'],
  [s=>{s.starlink.monitors[0]=s.leo.monitors[0]},'duplicado'],
  [s=>{s.starlink.monitors.pop()},'dos destinos'],
  [s=>{s.starlink.gateway='192.168.1.1'},'gateway fuera'],
  [s=>{s.starlink.address='100.64.1.2'},'gateway fuera'],
  [s=>{s.starlink.gateway='100.64.0.0'},'gateway es red'],
  [s=>{s.starlink.gateway='100.64.0.3'},'gateway es broadcast'],
  [s=>{s.starlink.address='100.64.0.0'},'dirección WAN es red'],
  [s=>{s.starlink.address='100.64.0.3'},'dirección WAN es broadcast'],
  [s=>{s.starlink.monitors[1]='555.1.1.1'},'Octeto'],
  [s=>{s.starlink.prefix=0},'prefijo'],
  // Solapamiento exacto de las WAN Starlink y Leo.
  [s=>{s.leo.address=s.starlink.address;s.leo.gateway=s.starlink.gateway},'subred WAN solapada'],
  // Prefijo más ancho en Starlink que invade la /30 de Leo.
  [s=>{s.starlink.prefix=29},'subred WAN solapada'],
  // Otro par de operadores también debe ser rechazado.
  [s=>{s.gtd4g.address=s.entel5g.address;s.gtd4g.gateway=s.entel5g.gateway},'subred WAN solapada'],
];
for(const [mutate,part] of changes){
  const settings=labSite(0);
  mutate(settings);
  const issues=validateWanSettings(settings).join(';');
  verify(issues.length>0,'config invalid not detected '+part);
  if(part==='subred WAN solapada')verify(issues.includes(part),'WAN overlap not diagnosed');
  assert.throws(()=>renderWanSlaCandidate(settings),/NO GENERADO/);
}
console.log('TOTAL WAN IP SLA: 23 sedes, '+checks+' verificaciones; 2 pruebas remotas/ISP; configuraciones inválidas rechazadas.');
