'use strict';
// Read-only SNMPv3 poll *design*, NOT installation of SNMPv3 identities.
// Dedicated CM monitor .101; exact /32 routers + stack management SVI.
// Do not invent auth/privacy keys or make UDP/161 globally reachable.
const {checkSiteNum}=require('./redundant-model.cjs');
const {ROUTER_NTP_SOURCES}=require('./redundant-configs.cjs');
const COLLECTOR='10.70.0.101';
const FLAGS={
 labChangeApproved:'Cambio SNMPv3 no autorizado',
 snmpV3AuthPrivVerified:'No se ha confirmado autenticación y cifrado authPriv real',
 credentialsProvisionedOutsideRepo:'Credenciales no aprovisionadas fuera del repositorio',
 authAlgorithmReviewed:'Algoritmo SHA/AES compatible no validado para ambos modelos',
 readOnlyGroupReviewed:'Permisos SNMP RO y vista MIB sin revisar',
 collectorAssetVerified:'Colector real .101 no inventariado/probado',
 cmSourceZoneReviewed:'CM USERS→TRANSIT y USERS→MGMT-DATA sin prueba de reglas',
 branchPolicyReviewed:'Sucursales TRANSIT→MGMT-DATA no auditadas',
 ipsecOspfReturnVerified:'Rutas de ida/vuelta a router y stack por VPN no verificadas',
 panosSyntaxAndOrderVerified:'Orden de reglas PAN-OS no validado',
 deviceRecoveryPlanReviewed:'Rollback/recuperación y tasa de sondeo no revisados'
};
function assessSnmpv3Plan(num,p){
 checkSiteNum(num);
 const issues=[];
 if(!p||typeof p!=='object'||Array.isArray(p))
  return {siteNum:num,status:'BLOCKED',certified:false,deployable:false,
    issues:['Sin aprobaciones ni colector comprobado']};
 for(const [flag,label] of Object.entries(FLAGS))if(p[flag]!==true)issues.push(label);
 if(p.collectorIp!==COLLECTOR)issues.push('El colector debe ser exclusivamente 10.70.0.101/32');
 if(p.version!==3||p.securityLevel!=='authPriv'||p.permission!=='read-only')
  issues.push('SNMPv3 authPriv read-only requerido; sin v1/v2c, community, noAuth');
 if(p.trapsEnabled!==false)
  issues.push('Este diseño contempla sólo polling UDP161; traps UDP162 separados');
 if(p.includePaloAltoManagement!==false)
  issues.push('SNMP del propio PA requiere perfil MGT/service route y certificación propios');
 for(const key of ['password','community','authKey','privacyKey','secret'])
  if(Object.prototype.hasOwnProperty.call(p,key))
   issues.push('No incluir credenciales o communities: '+key);
 return {siteNum:num,status:issues.length?'BLOCKED':'LAB_CANDIDATE',
   certified:false,deployable:false,issues,collectorIp:COLLECTOR,
   router:ROUTER_NTP_SOURCES[num],stack:'10.70.'+num+'.162',
   note:'NO genera usuarios SNMP ni prueba conectividad. Reglas para revisión manual en PA de CM y sede.'};
}
function renderSnmpv3Plan(num,p){
 const r=assessSnmpv3Plan(num,p);
 if(r.issues.length)throw Error('MONITOREO SNMPV3 BLOQUEADO:\n'+r.issues.join('\n'));
 const site=num===0?'CM':'S'+String(num).padStart(2,'0');
 const svc='SVC-NETOPS-SNMP-UDP161',src='SNMP-COLLECTOR-CM',
   stack='SNMP-STACK-'+site,loop='SNMP-RTR-'+site;
 const common=[
  'set address '+src+' ip-netmask '+COLLECTOR+'/32',
  'set address '+stack+' ip-netmask '+r.stack+'/32',
  'set address '+loop+' ip-netmask '+r.router+'/32',
  'set service '+svc+' protocol udp port 161'
 ];
 const policy=(name,from,to,destination)=>[
  'set rulebase security rules '+name+' from '+from,
  'set rulebase security rules '+name+' to '+to,
  'set rulebase security rules '+name+' source '+src,
  'set rulebase security rules '+name+' destination '+destination,
  'set rulebase security rules '+name+' application any',
  'set rulebase security rules '+name+' service '+svc,
  'set rulebase security rules '+name+' action allow',
  'set rulebase security rules '+name+' log-end yes'
 ];
 const acl=[
  '! En C8300 Y stack, por separado: NO INCLUYE snmp-server user ni claves',
  'ip access-list standard NETOPS-SNMP-POLLER',
  ' permit '+COLLECTOR+' 0.0.0.0',
  ' deny any log',
  'snmp-server view NETOPS-READ iso included',
  'snmp-server group NETOPS-PRIV v3 priv read NETOPS-READ access NETOPS-SNMP-POLLER',
  '! Verificar versión y credenciales authPriv fuera de Git antes de aplicar'
 ];
 const lines=[
  '# CANDIDATO SOLO REVISIÓN: NO SE HAN INSTALADO IDENTIDADES SNMPv3',
  '# No habilitar hasta confirmar servidor, dos PA, IPsec, MIB RO y rollback',
  '# ================== Cisco C8300 / C9200L (bloques independientes) =========',
  ...acl,'# ================== PA CASA MATRIZ ==================',
  ...common
 ];
 if(num===0){
  lines.push(...policy('CM-SNMP-LOCAL-STACK','USERS','MGMT-DATA',stack),
   'move rulebase security rules CM-SNMP-LOCAL-STACK before DENY-USERS-TO-MGMT');
 }else{
  lines.push(...policy('CM-SNMP-TO-'+site,'USERS','TRANSIT','[ '+loop+' '+stack+' ]'),
   'move rulebase security rules CM-SNMP-TO-'+site+' before DENY-CORP-RFC1918-TRANSIT',
   '# ================== PA SUCURSAL '+site+' ==================',
   ...common,
   ...policy('BR-SNMP-FROM-CM-'+site,'TRANSIT','MGMT-DATA',stack),
   'move rulebase security rules BR-SNMP-FROM-CM-'+site+' before DENY-GUEST-TO-CORP');
 }
 lines.push('# NO COMMIT: confirmar hits, UDP161, SNMPv3 authPriv y rutas simétricas');
 return lines.join('\n');
}
module.exports={COLLECTOR,FLAGS,assessSnmpv3Plan,renderSnmpv3Plan};
