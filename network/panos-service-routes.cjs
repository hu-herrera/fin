'use strict';
// PAN-OS 11.1 destination service routes: firewall-originated management
// traffic is NOT the same as forwarded user traffic or in-band admin access.
// No fabricated MGT IP/gateway, no global override for license/update services.
const {checkSiteNum}=require('./redundant-model.cjs');
const {CM_SERVICES,paloCandidate}=require('./redundant-configs.cjs');
const DESTS=Object.freeze([
 ...CM_SERVICES.dns,...CM_SERVICES.ntp,...CM_SERVICES.tacacs,
 ...CM_SERVICES.syslog
]);
const FLAGS=Object.freeze({
 labApprovalVerified:'Cambio de service routes sin aprobación de laboratorio',
 panosVersionVerified:'Jerarquía de CLI/versiones de PAN-OS no verificada',
 dataInterfaceAe230Operational:'No está demostrada ae2.30 con IP 10.70.N.161/28',
 selectedRoutesOnlyReviewed:'No se ha comprobado que licencias/actualizaciones conserven su ruta existente',
 localServicesOperational:'DNS/NTP/TACACS/Syslog central no disponible o sin pruebas',
 collectorTlsCertificateVerified:'No se verificó el certificado del colector TLS',
 tacacsAuthProfileVerified:'No se verificó perfil TACACS+ del administrador PA',
 panosLogForwardingProfileVerified:'No existe perfil de envío de logs PAN-OS validado',
 panosManagementAccessVerified:'No existe una vía administrativa autorizada y probada',
 paConsoleRecoveryVerified:'Sin vía de recuperación de consola o rollback',
 returnRoutesToSourceVerified:'Sin ruta de retorno desde CM hacia ae2.30 en cada sede'
});
function assessServiceRoutes(num,settings){
 checkSiteNum(num);
 const site=num===0?'cm':'s'+String(num).padStart(2,'0');
 const blockers=[],source='10.70.'+num+'.161';
 const fw=paloCandidate(num);
 if(!fw.includes('set network interface aggregate-ethernet ae2 layer3 units ae2.30 ip '+source+'/28'))
   blockers.push('La fuente ae2.30/.161 no coincide con la plantilla PAN-OS');
 if(!settings||typeof settings!=='object'||Array.isArray(settings))
   return {site,status:'BLOCKED',certified:false,deployable:false,
     blockers:[...blockers,'Faltan parámetros de rutas de servicio y conformidad PAN-OS']};
 for(const [key,msg] of Object.entries(FLAGS))
   if(settings[key]!==true)blockers.push(msg);
 if(num>0&&settings.ospfIpsecToCmVerified!==true)
   blockers.push('Falta conectividad VPN/OSPF hasta casa matriz');
 if(settings.interfaceName!=='ae2.30'||settings.sourceAddress!==source)
   blockers.push('La ruta debe salir exclusivamente desde ae2.30 / '+source);
 if(settings.useMgtPort===true||settings.overrideAllServices===true)
   blockers.push('No forzar MGT sin red OOB, ni sustituir globalmente rutas de licencias');
 if(!Array.isArray(settings.destinations)||settings.destinations.length!==DESTS.length||
    settings.destinations.some((ip,i)=>ip!==DESTS[i]))
   blockers.push('Solo destinos centrales DNS/NTP/TACACS/Syslog inventariados y en orden');
 return {
   site,status:blockers.length?'BLOCKED':'LAB_CANDIDATE',
   certified:false,deployable:false,blockers,
   sourceInterface:'ae2.30',sourceAddress:source,
   destinationCount:DESTS.length,destinations:[...DESTS],
   notice:'Rutas salientes generadas por el firewall; NO se validan por reglas de tráfico atravesando PA. Requieren pruebas en PAN-OS real.'
 };
}
function renderServiceRoutesCandidate(num,settings){
 const assessment=assessServiceRoutes(num,settings);
 if(assessment.blockers.length)throw Error(
   'SERVICE ROUTES PAN-OS NO GENERADAS:\n'+assessment.blockers.join('\n'));
 const lines=[
   '# CANDIDATO PAN-OS 11.1 — NO COMMIT AUTOMATICO NI CERTIFICACION',
   '# Rutas para tráfico ORIGINADO EN PA a siete servicios centrales específicos',
   '# Fuente ae2.30 '+assessment.sourceAddress+' — requiere gateway local y retorno de CM',
   '# Servicio de actualizaciones/licencias/WildFire NO tocado: conservar ruta actual',
   '# Comprobar Device > Setup > Services > Service Route Configuration y diff candidato'
 ];
 for(const dest of DESTS){
   const path='set deviceconfig system route destination '+dest+' source';
   lines.push(path+' interface ae2.30',
     path+' address '+assessment.sourceAddress);
 }
 lines.push(
   '# Para TACACS+ configurar y probar authentication profile separado, con cuenta local de emergencia',
   '# Para syslog configurar server profile, certificados y log forwarding aparte: sin secretos aqui',
   '# test authentication, test service-route, policy hits y commit validate segun versión real',
   '# No usar como prueba de operación hasta ver respuesta DNS/NTP/AAA/TLS desde el propio PA'
 );
 return lines.join('\n');
}
module.exports={DESTS,FLAGS,assessServiceRoutes,renderServiceRoutesCandidate};
