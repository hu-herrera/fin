'use strict';
const assert=require('node:assert/strict');
const {PANOS_RULES,evaluatePanPolicy,isPrivateRfc1918,routerCandidate,paloCandidate}=require('../network/redundant-configs.cjs');
const {VLAN}=require('../network/redundant-model.cjs');
let checks=0;
const truth=(value,msg)=>{assert.ok(value,msg);checks++};
const eq=(actual,expected,msg)=>{assert.equal(actual,expected,msg);checks++};
const zones=['USERS','VOICE','MGMT-DATA','GUESTS','TRANSIT'];
const permitted=[
  ['GUESTS','TRANSIT','dns'],
  ['GUESTS','TRANSIT','ssl'],
  ['GUESTS','TRANSIT','web-browsing'],
  ['USERS','TRANSIT','dns'],
  ['USERS','TRANSIT','ssl'],
  ['USERS','TRANSIT','web-browsing'],
  ['VOICE','TRANSIT','dns'],
  ['MGMT-DATA','TRANSIT','ntp'],
  ['MGMT-DATA','TRANSIT','dns']
];
const blocked=[
  ['GUESTS','USERS','ssl'],
  ['GUESTS','VOICE','sip'],
  ['GUESTS','MGMT-DATA','ssh'],
  ['USERS','MGMT-DATA','ssh'],
  ['VOICE','MGMT-DATA','ssh'],
  ['USERS','TRANSIT','ssh'],
  ['GUESTS','TRANSIT','bittorrent'],
  ['VOICE','TRANSIT','ssl'],
  ['TRANSIT','GUESTS','dns'],
  ['TRANSIT','USERS','ssh'],
  ['MGMT-DATA','USERS','ssh'],
  ['USERS','VOICE','sip']
];
for(const [from,to,app] of permitted){
  const result=evaluatePanPolicy(from,to,app);
  eq(result.action,'allow',from+' -> '+to+' '+app+' debería permitirse');
  truth(!result.rule.includes('default'),from+' -> '+to+' no tiene regla específica');
}
for(const [from,to,app] of blocked){
  const result=evaluatePanPolicy(from,to,app);
  eq(result.action,'deny',from+' -> '+to+' '+app+' debería bloquearse');
}
for(const zone of zones){
  eq(evaluatePanPolicy(zone,zone,'ssl').action,'allow','PAN-OS intrazone-default '+zone);
}
for(const ip of ['10.70.0.20','10.72.1.2','172.16.1.1','172.31.255.254','192.168.1.5']){
  eq(isPrivateRfc1918(ip),true,'RFC1918 no identificado '+ip);
  const result=evaluatePanPolicy('GUESTS','TRANSIT','ssl',ip);
  eq(result.action,'deny','Invitados acceden a IP privada '+ip);
  eq(result.rule,'DENY-GUEST-RFC1918-TRANSIT','Regla de aislamiento incorrecta '+ip);
}
for(const ip of ['8.8.8.8','1.1.1.1','172.32.0.1','192.169.0.1']){
  eq(isPrivateRfc1918(ip),false,'IP pública confundida con privada '+ip);
  eq(evaluatePanPolicy('GUESTS','TRANSIT','ssl',ip).action,'allow','WEB a IP pública debería permitirse '+ip);
}
for(const malformed of ['10.300.1.1','hello','10.70.1','10.70.1.3.4']){
  assert.throws(()=>evaluatePanPolicy('GUESTS','TRANSIT','ssl',malformed),/IPv4|Octeto/);
}
assert.throws(()=>evaluatePanPolicy('NO-ZONE','TRANSIT','dns'),/Zona/);
const names=PANOS_RULES.map(r=>r.name);
eq(names.length,new Set(names).size,'Reglas duplicadas');
const firstAllow=PANOS_RULES.findIndex(r=>r.action==='allow');
truth(PANOS_RULES.slice(0,firstAllow).every(r=>r.action==='deny'),'Las denegaciones prioritarias deben preceder los permisos');
for(let n=0;n<23;n++){
  const cfg=routerCandidate(n),pa=paloCandidate(n);
  const prefix='10.70.'+n+'.';
  const block=cfg.slice(cfg.indexOf('ip prefix-list SITE-LAN-'+n));
  truth(block.includes('deny '+prefix+'176/28'),'La VLAN40 invitados NO debe exportarse a OSPF de sede '+n);
  truth(!block.includes('permit '+prefix+'176/28'),'VLAN40 anunciada por OSPF en sede '+n);
  for(const v of VLAN.filter(v=>v.id!==40))
    truth(block.includes('permit '+prefix+v.network+'/'+v.prefix),'OSPF omite VLAN corporativa '+v.id+' en sede '+n);
  truth(cfg.includes('redistribute static subnets route-map EXPORT-SITE-LAN'),'OSPF sin filtro por route-map');
  for(const rule of PANOS_RULES){
    const p='set rulebase security rules '+rule.name;
    truth(pa.includes(p+' action '+rule.action),'regla PAN-OS sin acción '+rule.name+' sede '+n);
    truth(pa.includes(p+' log-end yes'),'falta auditoría de sesiones '+rule.name+' sede '+n);
    truth(pa.includes(p+' service '+(rule.action==='allow'?'application-default':'any')),'regla con servicio no validado '+rule.name+' sede '+n);
  }
  truth(pa.includes('set address-group RFC1918-NETWORKS static [ RFC1918-10 RFC1918-172 RFC1918-192 ]'),'Faltan redes RFC1918 sede '+n);
  truth(pa.includes('set rulebase security rules DENY-GUEST-RFC1918-TRANSIT destination RFC1918-NETWORKS'),'Falta regla invitado anti-redes privadas '+n);
  truth(!pa.includes('set rulebase security rules ALLOW-GUESTS-WEB-OUT service any'),'Permisos invitados usan todos los puertos');
  truth(!pa.includes('action allow-any'),'allow-any insegura en sede '+n);
}
console.log('TOTAL política de seguridad: '+checks+' comprobaciones; '+PANOS_RULES.length+' reglas; 23 sedes.');
