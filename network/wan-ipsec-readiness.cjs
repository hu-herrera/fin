'use strict';
// WAN/IPsec PRE-FLIGHT ONLY. A result does not negotiate IKEv2 or create OSPF.
// It never fabricates peers, credentials, ISP addresses, or completed probes.
const {ipv4,isReservedTarget}=require('./wan-sla-candidate.cjs');
const {checkSiteNum,WAN_ORDER}=require('./redundant-model.cjs');
const MODES=new Set(['static-public','dhcp-public','cgnat','unavailable']);
function assessWanIpsecReadiness(num,plan){
 checkSiteNum(num);
 const blockers=[],warnings=[],links=[];
 if(!plan||typeof plan!=='object'||Array.isArray(plan))
   return {siteNum:num,status:'BLOCKED',certified:false,
     blockers:['Falta plan de hub y contratos WAN'],warnings,links};
 const hub=plan.hub;
 if(!hub||typeof hub!=='object'||Array.isArray(hub)){
   blockers.push('Concentrador IKEv2/hub no especificado');
 }else{
   try{
     ipv4(hub.publicEndpoint);
     if(isReservedTarget(hub.publicEndpoint))
       blockers.push('Endpoint del concentrador no es IPv4 pública enrutable');
   }catch(e){blockers.push('Endpoint IPv4 del concentrador inválido')}
   if(hub.verifiedPublicReachability!==true)
     blockers.push('Falta verificar alcanzabilidad pública y puerto UDP/4500 del hub');
   if(hub.inboundUdp500Verified!==true||hub.inboundUdp4500Verified!==true)
     blockers.push('Hub no tiene UDP/500 y UDP/4500 de IKEv2/NAT-T confirmados');
   if(hub.ikev2IdentityApproved!==true)
     blockers.push('Identidad IKEv2 y certificados/PSK seguros del hub no aprobados');
   if(hub.behindCgnat===true)
     blockers.push('Hub detrás de CGNAT sin publicación verificada: no debe presumirse receptor de VPN');
 }
 const wan=plan.wan;
 if(!wan||typeof wan!=='object'||Array.isArray(wan)){
   blockers.push('Falta estado contractual de las cuatro opciones WAN');
 }else{
   let active=0;
   for(const key of WAN_ORDER){
     const v=wan[key];
     if(!v||typeof v!=='object'||Array.isArray(v)){
       blockers.push(key+': falta declaración de estado');continue;
     }
     if(!MODES.has(v.mode)){
       blockers.push(key+': modo WAN inválido');continue;
     }
     if(v.mode==='unavailable'){
       links.push({type:key,mode:v.mode,status:'NOT_DEPLOYED'});
       warnings.push(key+': proveedor no desplegado; no incluir en pruebas de disponibilidad real');
       continue;
     }
     active++;
     const missing=[];
     const required={
       contractVerified:'contrato y tecnología de acceso',
       nextHopVerified:'gateway/modo DHCP operativo',
       mtuVerified:'MTU/PMTUD extremo a extremo',
       outboundIkev2NatTVerified:'salida IKEv2/NAT-T UDP/500,4500',
       returnTrafficVerified:'respuesta del concentrador y NAT',
       vpnPeerAndTunnelVerified:'SA IKEv2/IPsec y peer sobre esta WAN',
       ospfOverTunnelVerified:'OSPF FULL sobre túnel cifrado',
       remoteSlaTargetsVerified:'dos sondas reales autorizadas por ISP'
     };
     for(const [field,label] of Object.entries(required))
       if(v[field]!==true)missing.push(label);
     if(v.mode==='cgnat')
       warnings.push(key+': CGNAT acepta iniciación saliente con NAT-T comprobado, NO hosting entrante sin publicación');
     if(missing.length)blockers.push(key+': pendientes '+missing.join(', '));
     links.push({type:key,mode:v.mode,status:missing.length?'BLOCKED':'EVIDENCE_DECLARED',
       missing});
   }
   if(!active)blockers.push('No hay ninguna WAN disponible para iniciar una VPN');
 }
 return {
   siteNum:num,status:blockers.length?'BLOCKED':'CANDIDATE_FOR_LAB_REVIEW',
   certified:false,blockers,warnings,links,
   notice:'Las banderas booleanas son declaraciones, NO mediciones de enlaces, SAs ni pruebas de fabricante.'
 };
}
module.exports={MODES,assessWanIpsecReadiness};
