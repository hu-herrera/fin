'use strict';
// CLI para inspeccionar candidatos SIN desplegarlos ni modificar el simulador.
// node network/export-candidate.cjs s01 router|stack|palo
// node network/export-candidate.cjs s01 wan-sla ./monitores-s01.json
// node network/export-candidate.cjs s01 guest-dhcp ./invitados-s01.json
// node network/export-candidate.cjs s01 client-dhcp ./clientes-s01.json
// node network/export-candidate.cjs s01 wan-readiness ./evidencia-wan-s01.json
// node network/export-candidate.cjs s01 mgmt-services ./servicios-s01.json
const fs=require('node:fs');
const vm=require('node:vm');
const {siteCandidate}=require('./redundant-configs.cjs');
const {renderWanSlaCandidate}=require('./wan-sla-candidate.cjs');
const {oobCandidate}=require('./oob-management.cjs');
const {renderGuestDhcpCandidate}=require('./guest-dhcp-candidate.cjs');
const {renderClientDhcpCandidate}=require('./client-dhcp-candidate.cjs');
const {assessWanIpsecReadiness}=require('./wan-ipsec-readiness.cjs');
const {renderManagementServicesCandidate}=require('./management-services-candidate.cjs');
function pcInventory(){
  const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
  const match=html.match(/const PC_COUNT\s*=\s*(\{[\s\S]*?\});/);
  if(!match)throw new Error('Inventario de PC_COUNT ausente');
  return vm.runInNewContext('('+match[1]+')');
}
function exportCandidate(site,device,wanSettings){
  const key=String(site).toLowerCase();
  if(!/^(cm|s(?:0[1-9]|1[0-9]|2[0-2]))$/.test(key)){
    throw new Error('Sede desconocida; usar cm o s01..s22');
  }
  if(!['router','stack','palo','wan-sla','wan-readiness','oob','guest-dhcp','client-dhcp','mgmt-services'].includes(device)){
    throw new Error('Equipo desconocido; usar router, stack, palo, wan-sla, wan-readiness, mgmt-services, guest-dhcp, client-dhcp u oob');
  }
  const num=key==='cm'?0:Number(key.slice(1)),counts=pcInventory();
  if(!Number.isInteger(counts[key]))throw new Error('Sin inventario de PCs para '+key);
  if(device==='mgmt-services'){
    return '! CANDIDATO IOS-XE PARA LABORATORIO, REQUIERE APROBACIONES Y SERVIDORES REALES\n'+
      '! Sede '+key.toUpperCase()+' — CLI separada por dispositivo\n'+
      renderManagementServicesCandidate(num,wanSettings);
  }
  if(device==='wan-readiness'){
    return '# INFORME DE PRERREQUISITOS WAN/IPsec — NO CERTIFICA VPN REAL\n'+
      JSON.stringify(assessWanIpsecReadiness(num,wanSettings),null,2);
  }
  if(device==='wan-sla'){
    // Sin parámetros de contrato no se emite configuración potencialmente inservible.
    return '# LABORATORIO, VALIDAR CON OPERADOR ANTES DE APLICAR\n'+
      '# Sede '+key.toUpperCase()+' - pruebas WAN autorizadas\n'+
      renderWanSlaCandidate(wanSettings);
  }
  if(device==='client-dhcp'){
    return '# SOLO LABORATORIO, REVISAR MIGRACION DE IP ESTATICAS ANTES DE COMMIT\n'+
      '# Sede '+key.toUpperCase()+' - DHCP PAN-OS VLAN10 y voz opcional\n'+
      renderClientDhcpCandidate(num,wanSettings,counts);
  }
  if(device==='guest-dhcp'){
    return '# CANDIDATO PAN-OS, REVISAR ANTES DE COMMIT\n'+
      '# Sede '+key.toUpperCase()+' - DHCP local para VLAN40 invitados\n'+
      renderGuestDhcpCandidate(num,wanSettings);
  }
  if(device==='oob'){
    const p=oobCandidate(num);
    return ['# SOLO LABORATORIO - NO APLICAR SIN GATEWAY Y SWITCH DE GESTION OOB',
      '# Sede '+key.toUpperCase(),'# Bloqueadores: '+p.blockers.join('; '),
      '# Red reservada: '+p.addressing.network,
      '', '# PA-1410 MGT',p.firewall,'', '# C9200L Mgmt-vrf',p.stack,
      '', '# C8300 NO CONFIGURADO',p.router].join('\n');
  }
  const c=siteCandidate(num,counts[key]);
  return [
    '# SOLO DISEÑO DE LABORATORIO; NO APTO PARA DESPLIEGUE REAL',
    '# Sede '+key.toUpperCase()+' | PC asignados '+counts[key],
    '# Bloqueadores: '+c.blockers.join('; '),
    '',
    c[device==='router'?'cisco':device]
  ].join('\n');
}
if(require.main===module){
  try{
    const needsConfig=['wan-sla','wan-readiness','guest-dhcp','client-dhcp','mgmt-services'].includes(process.argv[3]);
    if(needsConfig&&!process.argv[4])throw new Error('Especifica un JSON de parámetros aprobados para '+process.argv[3]);
    const config=needsConfig?JSON.parse(fs.readFileSync(process.argv[4],'utf8')):undefined;
    process.stdout.write(exportCandidate(process.argv[2],process.argv[3],config)+'\n');
  }catch(error){
    process.stderr.write('Error: '+error.message+'\n');
    process.exitCode=1;
  }
}
module.exports={exportCandidate,pcInventory};
