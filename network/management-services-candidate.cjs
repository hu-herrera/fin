'use strict';
// Offline design + lab candidate only: no remote connectivity or deployment.
// NTP sources: C8300 Loopback0 /32; C9200L Vlan30; PA gateways remain L3.
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {checkSiteNum}=require('./redundant-model.cjs');
const {CM_SERVICES,ROUTER_NTP_SOURCES,evaluateSitePanPolicy,routerCandidate}=require('./redundant-configs.cjs');

function centralReservations(){
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const services=html.match(/const CENTRAL_SERVICES\s*=\s*Object\.freeze\((\{[\s\S]*?\})\);/);
 const counts=html.match(/const PC_COUNT\s*=\s*(\{[\s\S]*?\});/);
 if(!services||!counts)throw new Error('Falta catálogo CENTRAL_SERVICES o PC_COUNT');
 const catalog=vm.runInNewContext('('+services[1]+')');
 const pcs=vm.runInNewContext('('+counts[1]+')');
 return {catalog:{...catalog},pcs:{...pcs}};
}
function addressReview(){
 const {catalog,pcs}=centralReservations();
 const issues=[],ips=Object.values(catalog);
 const expected={dns1:CM_SERVICES.dns[0],dns2:CM_SERVICES.dns[1],
   ntp1:CM_SERVICES.ntp[0],ntp2:CM_SERVICES.ntp[1]};
 for(const [name,ip] of Object.entries(expected))
   if(catalog[name]!==ip)issues.push(name+' does not match PAN-OS source of truth');
 if(new Set(ips).size!==ips.length)issues.push('Central service address collision');
 const lastPC=9+pcs.cm;
 for(const [name,ip] of Object.entries(catalog)){
   const parts=String(ip).split('.').map(Number);
   if(parts.length!==4||parts.some(n=>!Number.isInteger(n))||
      parts[0]!==10||parts[1]!==70||parts[2]!==0||
      parts[3]<2||parts[3]>126)
     issues.push(name+' lies outside corporate CM VLAN10 host range');
   if(parts[3]>=10&&parts[3]<=lastPC)
     issues.push(name+' overlaps static CM PC inventory 10.70.0.10–'+lastPC);
 }
 if(pcs.cm!==55)issues.push('CM PC count differs from agreed 55; revisit reservations');
 return {issues,reservations:catalog,staticCmPcEnd:'10.70.0.'+lastPC};
}
function policyReview(num){
 checkSiteNum(num);
 const problems=[],loop=ROUTER_NTP_SOURCES[num];
 const ntp=CM_SERVICES.ntp;
 const test=(ok,msg)=>{if(!ok)problems.push(msg)};
 const matches=(n,from,to,app,dest,source,expected)=>
   evaluateSitePanPolicy(n,from,to,app,dest,source).action===expected;
 test(routerCandidate(num).includes(' ip address '+loop+' 255.255.255.255'),
   'Cisco Loopback0 /32 does not match NTP source');
 for(const address of CM_SERVICES.dns){
   test(matches(0,'TRANSIT','USERS','dns',address,loop,'allow'),
     'CM firewall blocks router Loopback0 DNS '+address);
   test(matches(0,'TRANSIT','USERS','ssh',address,loop,'deny'),
     'CM firewall improperly permits router SSH to DNS '+address);
   const swSource='10.70.'+num+'.162';
   test(matches(num,'MGMT-DATA',num===0?'USERS':'TRANSIT',
     'dns',address,swSource,'allow'),
     'Local site firewall blocks StackWise management DNS '+address);
   if(num!==0)test(matches(0,'TRANSIT','USERS','dns',address,swSource,'allow'),
     'CM firewall blocks branch StackWise DNS '+address);
 }
 for(const address of ntp){
   test(matches(0,'TRANSIT','USERS','ntp',address,loop,'allow'),
     'CM firewall blocks router Loopback0 NTP '+address);
   test(matches(0,'TRANSIT','USERS','ssh',address,loop,'deny'),
     'CM firewall improperly permits router SSH to NTP '+address);
   const swSource='10.70.'+num+'.162';
   test(matches(num,num===0?'MGMT-DATA':'MGMT-DATA',num===0?'USERS':'TRANSIT',
     'ntp',address,swSource,'allow'),
     'Local site firewall blocks StackWise management NTP '+address);
   if(num!==0)test(matches(0,'TRANSIT','USERS','ntp',address,swSource,'allow'),
     'CM firewall blocks branch StackWise NTP '+address);
 }
 return problems;
}
function assessManagementServices(num,settings){
 checkSiteNum(num);
 const blockers=[...addressReview().issues,...policyReview(num)];
 if(!settings||typeof settings!=='object'||Array.isArray(settings))
   return {status:'BLOCKED',deployable:false,certified:false,blockers:[
     ...blockers,'Falta evidencia aprobada de servidores, rutas y cambio de sincronización']};
 const flags={
   approvedInLab:'Aprobación explícita de ejecución en laboratorio',
   dnsServersOperational:'DNS centrales .110/.111 sin comprobación de consultas',
   ntpServersOperational:'NTP centrales .116/.117 sin sincronización verificada',
   cmTimeSourceApproved:'Origen upstream NTP y precisión no aprobados',
   panosNtpPoliciesReviewed:'Excepciones PAN-OS NTP no aceptadas/validadas',
   stackManagementSviVerified:'SVI Vlan30 .162 y camino al gateway no verificados',
   routerLoopbackRoutingVerified:'Router Loopback0 /32 no verificadas para retorno',
   vendorNtpSecurityReviewed:'Falta decisión sobre autenticación NTP y limitación de clientes'
 };
 if(num!==0)flags.ospfOverlayVerified='VPN/OSPF a CM no se ha comprobado con vecinos y rutas reales';
 for(const [name,message] of Object.entries(flags))if(settings[name]!==true)blockers.push(message);
 if(!Array.isArray(settings.dns)||settings.dns.length!==2||
    settings.dns.some((ip,i)=>ip!==CM_SERVICES.dns[i]))
   blockers.push('DNS deben coincidir exactamente con las reservas centrales .110/.111');
 if(!Array.isArray(settings.ntp)||settings.ntp.length!==2||
    settings.ntp.some((ip,i)=>ip!==CM_SERVICES.ntp[i]))
   blockers.push('NTP deben coincidir exactamente con las reservas centrales .116/.117');
 return {status:blockers.length?'BLOCKED':'LAB_CANDIDATE',
   deployable:false,certified:false,blockers,
   site:num===0?'cm':'s'+String(num).padStart(2,'0'),
   routerSource:ROUTER_NTP_SOURCES[num],
   stackSource:'10.70.'+num+'.162',
   notice:'Afirmaciones del JSON no prueban servicios ni acceso al hardware; se exige ensayo real y seguridad NTP.'};
}
function renderManagementServicesCandidate(num,settings){
 const assessment=assessManagementServices(num,settings);
 if(assessment.blockers.length)
   throw new Error('SERVICIOS CENTRALES NO GENERADOS:\n'+assessment.blockers.join('\n'));
 const [d1,d2]=CM_SERVICES.dns,[n1,n2]=CM_SERVICES.ntp;
 return [
   '! SOLO LABORATORIO: perfil de clientes DNS/NTP para C8300 y StackWise',
   '! Las declaraciones del JSON NO son evidencia física ni aceptación de seguridad',
   '! C8300 RTR sede '+assessment.site+' — origen 10.70.100.x, OSPF debe transportar su /32',
   'ip name-server '+d1,
   'ip name-server '+d2,
   'ip domain lookup source-interface Loopback0',
   'ntp server '+n1+' source Loopback0 prefer',
   'ntp server '+n2+' source Loopback0',
   '! VERIFICAR C8300: DNS desde Loopback0, ruta, show ntp associations; show ntp status',
   '! INICIO DE BLOQUE SEPARADO EN C9200L STACK — NO PEGAR TODO EN UN SOLO DISPOSITIVO',
   'ip name-server '+d1,
   'ip name-server '+d2,
   'ip domain lookup source-interface Vlan30',
   'ntp server '+n1+' source Vlan30 prefer',
   'ntp server '+n2+' source Vlan30',
   '! VERIFICAR STACK: show ip route '+n1+'; show ntp associations; show ntp status',
   '! No se crean claves NTP ni se habilita autenticación sin material de claves aprobado',
   '! NO DESPLEGABLE: comprobación de versión IOS-XE, NTP auth, backups y rollback pendiente'
 ].join('\n');
}
module.exports={centralReservations,addressReview,policyReview,assessManagementServices,renderManagementServicesCandidate};
