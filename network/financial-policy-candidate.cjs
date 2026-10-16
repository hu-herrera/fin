'use strict';
// Financial app intersite permissions, only when a service owner provides the
// real endpoints and PAN-OS App-ID. Does not fabricate banking applications.
// NO client traffic is authorized until a human reviews both firewalls.
const {checkSiteNum}=require('./redundant-model.cjs');
const {pcInventory}=require('./export-candidate.cjs');
const {centralReservations}=require('./management-services-candidate.cjs');
const {evaluateSitePanPolicy,paloCandidate}=require('./redundant-configs.cjs');
const REQUIRED={
 authorizedChange:'Cambio de política no autorizado',
 financialApplicationOwnerApproved:'Propietario de aplicación no autorizó el flujo',
 sourceAssetVerified:'Activo de origen no verificado',
 destinationAssetVerified:'Servidor real no inventariado ni verificado',
 applicationIdVerified:'App-ID registrado en PAN-OS no validado',
 tcpServicePortVerified:'Puerto TCP de aplicación no validado',
 securityProfileVerified:'Perfil de prevención de amenazas y licencias no comprobado',
 routeAndReturnVerified:'VPN/OSPF y rutas de retorno no comprobados',
 loggedDenyBaselineCaptured:'No hay línea base de logs de denegación',
 testedWithApplication:'Flujo legítimo no probado contra política candidata',
 rollbackAndConsoleVerified:'Consola, backup y rollback sin comprobar'
};
function assessFinancialFlow(siteNum,p,inventory=pcInventory()){
 checkSiteNum(siteNum);
 const site=siteNum===0?'cm':'s'+String(siteNum).padStart(2,'0'),issues=[];
 if(siteNum===0)issues.push('Este flujo modela sucursal → CM; CM→sucursal necesita diseño separado');
 if(!p||typeof p!=='object'||Array.isArray(p))
  return {status:'BLOCKED',site,issues:['Parámetros del aplicativo y aprobaciones no definidos'],
    deployable:false,certified:false};
 for(const [key,msg] of Object.entries(REQUIRED))if(p[key]!==true)issues.push(msg);
 if(typeof p.applicationId!=='string'||!/^[a-z][a-z0-9-]{1,49}$/.test(p.applicationId)||
   p.applicationId==='any')issues.push('App-ID debe ser nombre válido, explícito y no any');
 if(typeof p.securityProfile!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{2,48}$/.test(p.securityProfile))
   issues.push('Nombre de security profile group inválido');
 if(!Number.isInteger(p.tcpPort)||p.tcpPort<1||p.tcpPort>65535)
   issues.push('Puerto TCP fuera de rango');
 if(typeof p.approvalRef!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{2,30}$/.test(p.approvalRef))
   issues.push('Referencia de aprobación inválida');
 const source='10.70.'+siteNum+'.',src=Number(String(p.sourceIp).startsWith(source)?
    String(p.sourceIp).slice(source.length):NaN);
 const numberOfPcs=inventory[site];
 if(!Number.isInteger(numberOfPcs)||numberOfPcs<1||numberOfPcs>60||
   !Number.isInteger(src)||src<10||src>=10+numberOfPcs||p.sourceIp!==source+src)
   issues.push('Origen fuera de los PCs inventariados de VLAN10 en esta sede');
 const dest='10.70.0.',dst=Number(String(p.destinationIp).startsWith(dest)?
   String(p.destinationIp).slice(dest.length):NaN);
 const reservations=new Set(Object.values(centralReservations().catalog));
 if(!Number.isInteger(dst)||dst<65||dst>126||p.destinationIp!==dest+dst||
   reservations.has(p.destinationIp))
   issues.push('Destino debe ser servidor REAL /32 en VLAN10 CM, no PC ni servicio reservado');
 const dangerous=['secret','password','psk','token','privateKey','credentials'];
 for(const key of dangerous)if(Object.prototype.hasOwnProperty.call(p,key))
   issues.push('Credencial prohibida en contrato: '+key);
 if(siteNum!==0&&issues.length===0){
   const branch=evaluateSitePanPolicy(siteNum,'USERS','TRANSIT','ssl',p.destinationIp,p.sourceIp);
   const cm=evaluateSitePanPolicy(0,'TRANSIT','USERS','ssl',p.destinationIp,p.sourceIp);
   if(branch.action!=='deny'||cm.action!=='deny')
     issues.push('El flujo no está bloqueado por defecto: revisar reglas duplicadas antes de añadir excepción');
   if(!paloCandidate(siteNum).includes('set rulebase security rules DENY-CORP-RFC1918-TRANSIT'))
     issues.push('No hay referencia de deny RFC1918 para posicionar una excepción');
 }
 return {site,status:issues.length?'BLOCKED':'LAB_CANDIDATE',deployable:false,certified:false,
   issues,sourceIp:p.sourceIp,destinationIp:p.destinationIp,port:p.tcpPort,
   note:'Aprobaciones son declaraciones del JSON, no validación de transacciones bancarias.'};
}
function renderFinancialFlow(siteNum,p,inventory){
 const result=assessFinancialFlow(siteNum,p,inventory);
 if(result.issues.length)throw Error('FLUJO FINANCIERO BLOQUEADO:\n'+result.issues.join('\n'));
 const branch='FIN-'+result.site.toUpperCase()+'-TO-CM',inbound='FIN-CM-FROM-'+result.site.toUpperCase();
 const svc='FIN-TCP-'+p.tcpPort+'-'+result.site.toUpperCase();
 const source='FIN-APP-SRC-'+result.site.toUpperCase(),dest='FIN-APP-DST-'+result.site.toUpperCase();
 const app=p.applicationId;
 const make=(name,from,to)=>[
  'set rulebase security rules '+name+' from '+from,
  'set rulebase security rules '+name+' to '+to,
  'set rulebase security rules '+name+' source '+source,
  'set rulebase security rules '+name+' destination '+dest,
  'set rulebase security rules '+name+' application '+app,
  'set rulebase security rules '+name+' service '+svc,
  'set rulebase security rules '+name+' profile-setting group '+p.securityProfile,
  'set rulebase security rules '+name+' action allow',
  'set rulebase security rules '+name+' log-end yes',
 ];
 const addresses=[
  'set address '+source+' ip-netmask '+p.sourceIp+'/32',
  'set address '+dest+' ip-netmask '+p.destinationIp+'/32',
  'set service '+svc+' protocol tcp port '+p.tcpPort
 ];
 return [
  '# SOLO LABORATORIO, PROHIBIDO COMMIT SIN VALIDAR REGLAS, LATERALIDAD Y LOGS',
  '# Ref '+p.approvalRef+'; App-ID declarado '+app+'; no representa aplicación instalada',
  '# ---- En PA de sucursal '+result.site+' ----',
  ...addresses,...make(branch,'USERS','TRANSIT'),
  'move rulebase security rules '+branch+' before DENY-CORP-RFC1918-TRANSIT',
  '# ---- En PA de casa matriz, cambiar de equipo antes de ejecutar ----',
  ...addresses,...make(inbound,'TRANSIT','USERS'),
  'move rulebase security rules '+inbound+' before CM-IN-DNS-FROM-BRANCHES',
  '# Verificar también host firewall/servidor, reglas de retorno, NAT exemption y perfiles reales',
  '# No mover reglas generales; comprobar orden first-match con test security-policy-match',
  '# El contenido es candidato, no altera el simulador ni autoriza tráfico real.'
 ].join('\n');
}
module.exports={REQUIRED,assessFinancialFlow,renderFinancialFlow};
