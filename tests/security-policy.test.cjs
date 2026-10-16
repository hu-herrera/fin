'use strict';
const assert=require('node:assert/strict');
const {PANOS_RULES,evaluatePanPolicy,routerCandidate,paloCandidate}=require('../network/redundant-configs.cjs');
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
  truth(!pa.includes('action allow-any'),'allow-any insegura en sede '+n);
}
console.log('TOTAL política de seguridad: '+checks+' comprobaciones; '+PANOS_RULES.length+' reglas; 23 sedes.');
