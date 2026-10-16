'use strict';
// VLAN40 guest DHCP is an OPTIONAL Palo Alto local server candidate.
// Guest traffic is already routed by PA-1410 ae2.40; IOS-XE ip helper on
// the C8300 would NOT receive the guest L2 broadcasts.
// Values are deliberate operator inputs, never inferred real contracts.
const {checkSiteNum}=require('./redundant-model.cjs');
const {ipv4,isReservedTarget}=require('./wan-sla-candidate.cjs');
function guestDhcpAssessment(num,settings){
  checkSiteNum(num);
  const issues=[];
  if(!settings||typeof settings!=='object'||Array.isArray(settings))
    return {issues:['Se requieren datos explícitos y autorizados para DHCP de invitados'],poolSize:0};
  if(settings.approvedGuestDhcp!==true)
    issues.push('Falta aprobación explícita de DHCP local en PA-1410');
  if(settings.verifiedPublicDns!==true)
    issues.push('No se verificaron los DNS públicos de invitados');
  const parse=(key)=>{
    try{return ipv4(settings[key]);}
    catch(error){issues.push(key+': '+error.message);return null;}
  };
  const start=parse('start'),end=parse('end');
  const dns1=parse('dnsPrimary'),dns2=parse('dnsSecondary');
  const validGuest=(o)=>o&&o[0]===10&&o[1]===70&&o[2]===num&&o[3]>=178&&o[3]<=190;
  if(start&&!validGuest(start))
    issues.push('El comienzo de pool debe estar entre 10.70.'+num+'.178 y .190');
  if(end&&!validGuest(end))
    issues.push('El fin de pool debe estar entre 10.70.'+num+'.178 y .190');
  const poolSize=validGuest(start)&&validGuest(end)?end[3]-start[3]+1:0;
  if(poolSize<=0)issues.push('El rango del pool está vacío o invertido');
  for(const [key,value] of [['dnsPrimary',dns1],['dnsSecondary',dns2]]){
    if(value&&isReservedTarget(value.join('.')))
      issues.push(key+': DNS no público o dirección reservada para pruebas');
  }
  if(dns1&&dns2&&dns1.join('.')===dns2.join('.'))
    issues.push('DNS primario y secundario no pueden coincidir');
  if(!Number.isInteger(settings.expectedGuests)||settings.expectedGuests<1)
    issues.push('Se requiere número entero positivo de clientes invitados');
  else if(settings.expectedGuests>poolSize)
    issues.push('Clientes invitados '+settings.expectedGuests+' exceden pool de '+poolSize);
  return {issues,poolSize};
}
function renderGuestDhcpCandidate(num,settings){
  const {issues,poolSize}=guestDhcpAssessment(num,settings);
  if(issues.length)throw new Error('DHCP INVITADOS NO GENERADO:\n'+issues.join('\n'));
  const s='10.70.'+num+'.',path='set network dhcp interface ae2.40 server';
  return [
    '# CONFIGURACIÓN CANDIDATA PARA REVISIÓN DE PAN-OS, NO COMMIT AUTOMÁTICO',
    '# VLAN40 no pasa DHCP por el C8300; gateway PA ae2.40 es '+s+'177/28',
    '# '+poolSize+' leases máximos en el pool declarado; '+settings.expectedGuests+' invitados esperados',
    '# PAN-OS 11.1 server mode/ip-pool/option; revisar DHCP conflict detection, lease policy, AP isolation y logs',
    path+' mode enabled',
    path+' probe-ip yes',
    path+' ip-pool [ '+settings.start+'-'+settings.end+' ]',
    path+' option gateway '+s+'177',
    path+' option subnet-mask 255.255.255.240',
    path+' option dns primary '+settings.dnsPrimary,
    path+' option dns secondary '+settings.dnsSecondary,
    '# NO confundir con los 650 PCs estáticos del simulador ni con el DHCP de voz',
    '# NO COMMIT: validar primero con PAN-OS y pruebas de un cliente invitado',
  ].join('\n');
}
module.exports={guestDhcpAssessment,renderGuestDhcpCandidate};
