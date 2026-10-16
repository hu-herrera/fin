'use strict';
// Optional, fail-closed PAN-OS 11.1 DHCPv4 server candidate for corporate PCs
// and optional voice. Nothing is applied to hardware or simulated static PCs.
// Gateways for VLAN10 and VLAN20 terminate on PA ae2.10 / ae2.20, not C8300.
const {checkSiteNum}=require('./redundant-model.cjs');
const {ipv4}=require('./wan-sla-candidate.cjs');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function pcInventory(){
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const match=html.match(/const PC_COUNT\\s*=\\s*(\\{[\\s\\S]*?\\});/);
 if(!match)throw new Error('Inventario PC_COUNT ausente');
 return vm.runInNewContext('('+match[1]+')');
}
const CENTRAL_DNS=Object.freeze(['10.70.0.110','10.70.0.111']);
const USER_FIRST=10, VOICE_FIRST=130, VOICE_LAST=158;

function clientDhcpAssessment(num,settings,pcCounts=pcInventory()){
 checkSiteNum(num);
 const key=num===0?'cm':'s'+String(num).padStart(2,'0');
 const pcCount=pcCounts[key];
 const issues=[];
 if(!Number.isInteger(pcCount)||pcCount<1||pcCount>60)
   issues.push('Inventario de PC inválido o incompatible con el plan de puertos');
 if(!settings||typeof settings!=='object'||Array.isArray(settings))
   return {issues:['Se requiere aprobación y plan de migración IP explícitos'],userCount:pcCount,voiceCount:0};

 if(settings.approvedClientDhcp!==true)
   issues.push('DHCP corporativo no aprobado');
 if(settings.staticAddressMigrationApproved!==true)
   issues.push('No se puede activar DHCP sin retirar o reservar antes las IP estáticas existentes de los PCs');
 if(settings.verifiedDnsReachability!==true)
   issues.push('Servidores DNS de casa matriz aún no verificados en la sede');
 if(settings.verifiedLanGateway!==true)
   issues.push('Gateway PAN-OS de VLAN10/VLAN20 no validado en laboratorio');

 const dns=settings.dns;
 if(!Array.isArray(dns)||dns.length!==2||dns.some(ip=>typeof ip!=='string')){
   issues.push('Se requieren dos DNS corporativos explícitos');
 } else {
   for(const ip of dns) {
     try{ipv4(ip);}catch(e){issues.push('DNS IPv4 inválido: '+ip);}
   }
   if(dns[0]===dns[1])issues.push('Los dos DNS corporativos no pueden ser iguales');
   if(!dns.every((ip,i)=>ip===CENTRAL_DNS[i]))
     issues.push('DNS deben coincidir con las reservas centrales 10.70.0.110/111 del diseño');
 }
 if(!Number.isInteger(settings.expectedUsers)||settings.expectedUsers!==pcCount)
   issues.push('El número de clientes migrados debe coincidir con los '+pcCount+' PCs del inventario para evitar un pool parcial');
 const userLast=USER_FIRST+pcCount-1;
 if(userLast>126)issues.push('Pool VLAN10 desborda 10.70.N.0/25');

 const voice=settings.voice;
 let voiceCount=0;
 if(voice!==undefined){
   if(!voice||typeof voice!=='object'||Array.isArray(voice)){
     issues.push('voice debe ser un objeto explícito');
   }else if(voice.enabled===true){
     voiceCount=voice.expectedPhones;
     if(voice.approvedVoiceDhcp!==true)issues.push('DHCP de voz no aprobado');
     if(voice.vendorOptionsReviewed!==true)
       issues.push('Falta revisar opciones DHCP del fabricante de teléfonos (p. ej. provisión/TFTP)');
     if(!Number.isInteger(voiceCount)||voiceCount<1||voiceCount>VOICE_LAST-VOICE_FIRST+1)
       issues.push('VLAN20 /27 solo permite 29 teléfonos DHCP (.130–.158), la .129 es gateway');
   }else if(voice.enabled!==false){
     issues.push('voice.enabled debe ser true o false');
   }
 }
 return {issues,userCount:pcCount,voiceCount:voice?.enabled===true?voiceCount:0,
   userRange:['10.70.'+num+'.'+USER_FIRST,'10.70.'+num+'.'+userLast],
   voiceRange:voice?.enabled===true?['10.70.'+num+'.'+VOICE_FIRST,'10.70.'+num+'.'+(VOICE_FIRST+voiceCount-1)]:null};
}

function renderClientDhcpCandidate(num,settings,inventory){
 const result=clientDhcpAssessment(num,settings,inventory);
 if(result.issues.length)
   throw new Error('DHCP CLIENTES NO GENERADO:\n'+result.issues.join('\n'));
 const pfx='10.70.'+num+'.',dns=settings.dns;
 const entries=[{
   vlan:10,mask:'255.255.255.128',gateway:pfx+'1',
   first:result.userRange[0],last:result.userRange[1],count:result.userCount
 }];
 if(result.voiceRange) entries.push({
   vlan:20,mask:'255.255.255.224',gateway:pfx+'129',
   first:result.voiceRange[0],last:result.voiceRange[1],count:result.voiceCount
 });
 const lines=[
   '# LABORATORIO — CANDIDATO PAN-OS 11.1 DHCP LOCAL, NUNCA COMMIT AUTOMÁTICO',
   '# DHCP local en PA-1410 ae2.10/ae2.20; C8300 no es gateway de estas VLAN',
   '# ALTO RIESGO SI YA EXISTEN IP ESTÁTICAS: migrar/reservar dispositivos antes de aplicar',
   '# DNS CM reservados; el operador declara verificación pero NO demuestra servidores instalados',
   '# Los 650 PCs del simulador conservan sus IP estáticas; esto NO modifica el navegador'
 ];
 for(const e of entries){
   const path='set network dhcp interface ae2.'+e.vlan+' server';
   lines.push('# VLAN'+e.vlan+' '+e.count+' concesiones previstas',
     path+' mode enabled',
     path+' probe-ip yes',
     path+' ip-pool [ '+e.first+'-'+e.last+' ]',
     path+' option gateway '+e.gateway,
     path+' option subnet-mask '+e.mask,
     path+' option dns primary '+dns[0],
     path+' option dns secondary '+dns[1]);
 }
 if(result.voiceRange)lines.push(
   '# Voz: no se simulan opciones vendor-specific 66/150, SIP, LLDP-MED ni provisión de teléfonos',
   '# Comprobar opciones necesarias según fabricante antes del commit.');
 lines.push('# NO COMMIT: probar VLAN, políticas DNS, leases, IP conflict detection y rollback.');
 return lines.join('\n');
}

module.exports={CENTRAL_DNS,clientDhcpAssessment,renderClientDhcpCandidate};
