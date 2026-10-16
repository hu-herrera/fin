'use strict';
// Explicitly opt-in IN-BAND PA admin access. Never install administrative
// access to VLAN10 users, guests, or all of VLAN30 by default.
// The existing C9200L stack has spare access port Gi1/0/35 or Gi2/0/35.
const {checkSiteNum}=require('./redundant-model.cjs');
const {stackCandidate,paloCandidate}=require('./redundant-configs.cjs');
const {centralReservations}=require('./management-services-candidate.cjs');
const APPROVED_PORTS=Object.freeze([
 'GigabitEthernet1/0/35','GigabitEthernet2/0/35'
]);
const FLAGS=Object.freeze({
  labChangeApproved:'Cambio de administración no aprobado por responsable',
  authorizedAdministratorVerified:'No se ha verificado administrador y propósito del acceso',
  physicalPortUnusedVerified:'Puerto dedicado ocupado o no verificado',
  addressInventoryConfirmed:'No se ha comprobado que la IP de mantenimiento esté libre',
  adminHostHardenedVerified:'Equipo de gestión no endurecido o no inventariado',
  networkIsolationVerified:'Acceso físico/lógico a VLAN30 no aislado',
  httpsCertificateReviewed:'Certificado HTTPS y host identity sin revisión',
  sshAuthorizationReviewed:'Perfil actual VLAN30-STACK también permite SSH: comprobar autorizaciones',
  accessRollbackTested:'Sin prueba de consola/rollback antes de modificar permitted-ip',
  panosVersionVerified:'Sintaxis y versión PAN-OS del PA-1410 aún no comprobadas',
  stackConfigConfirmed:'Configuración de los dos miembros del stack no verificada',
  existingSshRiskAcknowledged:'El perfil VLAN30-STACK tiene SSH habilitado; debe revisarse su seguridad'
});
function evaluateAdminAccess(num,params,inventory=centralReservations().pcs){
  checkSiteNum(num);
  const site=num===0?'cm':'s'+String(num).padStart(2,'0');
  const failures=[];
  if(!params||typeof params!=='object'||Array.isArray(params))
    return {site,status:'BLOCKED',deployable:false,certified:false,
     blockers:['Se requieren parámetros de seguridad aprobados, puerto e IP exactos']};
  for(const [flag,reason] of Object.entries(FLAGS))
    if(params[flag]!==true)failures.push(reason);
  const ip='10.70.'+num+'.';
  const host=params.adminHostIp;
  if(typeof host!=='string'||!host.startsWith(ip)||
    !/^(?:10\.70\.\d{1,2}\.\d{1,3})$/.test(host)||
    !Number.isInteger(Number(host.slice(ip.length)))||
    Number(host.slice(ip.length))<163||Number(host.slice(ip.length))>174)
    failures.push('Estación de gestión requiere una IP exclusiva 10.70.'+num+'.163–.174/28; .161 es PA, .162 es stack');
  if(!APPROVED_PORTS.includes(params.stackPort))
    failures.push('Puerto autorizado: GigabitEthernet1/0/35 o GigabitEthernet2/0/35');
  if(typeof params.operatorRef!=='string'||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/.test(params.operatorRef))
    failures.push('Se necesita referencia de aprobación (sin datos personales ni credenciales)');
  if(!Number.isInteger(inventory[site])||inventory[site]>60||inventory[site]<0)
    failures.push('Inventario de PCs anormal o incompatible con puertos 3–32');
  else{
    const sw=stackCandidate(num,inventory[site]);
    if(params.stackPort&&sw.includes('interface '+params.stackPort+'\n'))
      failures.push('Puerto de administración ya configurado/ocupado en candidato base');
    const fw=paloCandidate(num);
    if(!fw.includes('set network profiles interface-management-profile VLAN30-STACK permitted-ip '+ip+'162/32'))
      failures.push('Regla de seguridad .162/32 existente no encontrada');
  }
  return {site,status:failures.length?'BLOCKED':'LAB_CANDIDATE',
    blockers:failures,deployable:false,certified:false,
    port:params.stackPort,host,firewall:ip+'161',
    notice:'Puerto existente sin nuevos switches. No prueba presencia del host ni acceso real; sólo candidato revisable.'};
}
function renderAdminAccessCandidate(num,params,inventory){
  const report=evaluateAdminAccess(num,params,inventory);
  if(report.blockers.length)throw Error('ACCESO ADMIN PA BLOQUEADO:\n'+report.blockers.join('\n'));
  return [
   '# CANDIDATO DE LABORATORIO, NO AUTORIZA COMMIT NI MODIFICA EQUIPOS',
   '# PA-1410 ae2.30 admin: preservar explícitamente la entrada del stack .162',
   '# El perfil actual también tiene SSH: no asumir que esta excepción es HTTPS-only',
   '# Aprobación referencia '+params.operatorRef,
   '# --- En STACK único C9200L, puerto dedicado SOLO mantenimiento ---',
   'interface '+params.stackPort,
   ' description PA-ADMIN-AUTHORIZED-LAB',
   ' switchport mode access',
   ' switchport access vlan 30',
   ' spanning-tree portfast',
   ' spanning-tree bpduguard enable',
   ' no shutdown',
   '# --- En PA-1410 PAN-OS candidate/configure ---',
   'set network profiles interface-management-profile VLAN30-STACK permitted-ip '+report.host+'/32',
   '# EXISTENTE QUE DEBE PERMANECER: set network profiles interface-management-profile VLAN30-STACK permitted-ip 10.70.'+num+'.162/32',
   '# Acceso administrativo exclusivamente desde '+report.host+', máscara /28 y gateway '+report.firewall,
   '# No agregar permisos para VLAN10 ni para 0.0.0.0/0; confirmar consola y rollback',
   '# Comprobar HTTPS, SSH permitido por perfil, políticas de admin y logs; commit validate real',
   '# MGT dedicado / OOB independiente sigue sin provisionar y requiere decisión aparte'
  ].join('\n');
}
module.exports={APPROVED_PORTS,FLAGS,evaluateAdminAccess,renderAdminAccessCandidate};
