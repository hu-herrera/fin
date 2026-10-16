'use strict';
// Verificador conservador de capturas READ-ONLY. Nunca se conecta a equipos,
// nunca acepta credenciales y NUNCA emite una certificación de fabricante.
const fs=require('node:fs');
const path=require('node:path');
const SITE=/^(?:cm|s(?:0[1-9]|1[0-9]|2[0-2]))$/;
function siteNumber(site){
 if(!SITE.test(site))throw new Error('Sede inválida: cm o s01..s22');
 return site==='cm'?0:Number(site.slice(1));
}
function inspectText(kind,content){
 if(typeof content!=='string'||!content.trim())return null;
 // Rechazar text dumps del simulador y plantillas candidatas; no son evidencia.
 if(/SIMULADOR|EMULACI[ÓO]N|modelled|LAB CANDIDATO|NO APTO PARA DESPLIEGUE|NO se ha hecho commit/i.test(content))return null;
 if(content.length>4*1024*1024)throw new Error('Captura demasiado grande');
 return content.replace(/\r/g,'');
}
function assess(site,captures={}){
 const n=siteNumber(site);
 const ip='10.72.'+n+'.',lan='10.70.'+n+'.';
 const checks=[];
 const values=Object.fromEntries(['router','stack','palo'].map(name=>
  [name,inspectText(name,captures[name])]));
 const check=(device,id,yes,reason)=>{
   let state;
   if(!values[device])state='BLOCKED';
   else state=yes(values[device])?'PASS':'BLOCKED';
   checks.push({device,id,state,reason:state==='PASS'?undefined:reason});
 };
 check('router','model',(t)=>/C8300(?:-2N2S-4T2X)?/i.test(t),
   'Falta evidencia show version/inventory de C8300');
 check('router','po10-bundle',(t)=>
   /Po10\s*\((?:RU|SU)\)/i.test(t)&&
   /Te(?:nGigabitEthernet)?0\/0\/4\s*\(P\)/i.test(t)&&
   /Te(?:nGigabitEthernet)?0\/0\/5\s*\(P\)/i.test(t),
   'Adjuntar show etherchannel summary: Po10 con dos enlaces bundled (P)');
 check('router','transit-ip',(t)=>new RegExp('(?:Po10|Port-channel10)\\s+'+ip.replace(/\./g,'\\.')+'1\\b','i').test(t) &&
   /(?:Po10|Port-channel10).*\bup\s+up\b/i.test(t),
   'Adjuntar show ip interface brief: Po10 '+ip+'1 up/up');
 check('router','lan-static-route',(t)=>
   t.includes(lan+'0/25')&&t.includes('via '+ip+'2'),
   'Adjuntar show ip route con ruta LAN vía el Palo Alto');
 check('router','ospf-neighbor',(t)=>/FULL\s*\/|\bFULL\b/i.test(t) &&
   /show ip ospf neighbor/i.test(t),
   'Adjuntar vecino OSPF FULL real (no presente en las plantillas)');
 check('router','ipsec-sa',(t)=>/show crypto ipsec sa/i.test(t) &&
   /#pkts encaps:\s*[1-9]\d*/i.test(t)&&/#pkts decaps:\s*[1-9]\d*/i.test(t),
   'Adjuntar SA IPsec con paquetes cifrados/descifrados >0, sin claves');
 check('stack','model',(t)=>/C9200L/i.test(t),
   'Falta show version/inventory de los C9200L');
 check('stack','two-ready',(t)=>
   /(?:^|\n)\s*\*?\s*1\s+.+Ready/mi.test(t)&&
   /(?:^|\n)\s*\*?\s*2\s+.+Ready/mi.test(t),
   'Adjuntar show switch detail con dos miembros Ready');
 check('stack','po20-bundle',(t)=>
   /Po20\s*\(SU\)/i.test(t)&&
   [1,2].every(m=>[45,46].every(p=>
     new RegExp('Gi'+m+'\\/0\\/'+p+'\\s*\\(P\\)','i').test(t))),
   'Adjuntar show etherchannel summary: Po20 cuatro puertos (P)');
 check('stack','management-svi',(t)=>
   new RegExp('Vlan30\\s+'+lan.replace(/\./g,'\\.')+'162\\b','i').test(t),
   'Adjuntar show ip interface brief con Vlan30 '+lan+'162');
 check('palo','model',(t)=>/\bPA-1410\b/i.test(t),
   'Adjuntar show system info con el modelo PA-1410');
 check('palo','ae1-transit',(t)=>new RegExp('\\bae1\\b.{0,120}'+ip.replace(/\./g,'\\.')+'2(?:\\/30)?','i').test(t),
   'Adjuntar show interface all con ae1 '+ip+'2/30');
 check('palo','ae2-mgmt',(t)=>new RegExp('ae2\\.30.{0,120}'+lan.replace(/\./g,'\\.')+'161(?:\\/28)?','i').test(t),
   'Adjuntar show interface all con ae2.30 '+lan+'161/28');
 check('palo','lacp-operational',(t)=>/show lacp aggregate-ethernet all/i.test(t)&&
   /ae1/i.test(t)&&/ae2/i.test(t)&&
   /ethernet1\/19/i.test(t)&&/ethernet1\/20/i.test(t)&&
   [3,4,5,6].every(p=>t.includes('ethernet1/'+p)),
   'Adjuntar show lacp aggregate-ethernet all con miembros de ae1/ae2');
 check('palo','default-route',(t)=>t.includes('0.0.0.0/0')&&t.includes(ip+'1'),
   'Adjuntar show routing route con default vía '+ip+'1');
 check('palo','minimum-policy',(t)=>
   /DENY-GUEST-TO-CORP/.test(t)&&/DENY-CORP-RFC1918-TRANSIT/.test(t),
   'Adjuntar show running security-policy con reglas restrictivas y logs');
 const missing=checks.filter(x=>x.state==='BLOCKED');
 return {site,mode:'READ_ONLY_EVIDENCE_CHECK',certified:false,
  status:missing.length?'INCOMPLETE':'READY_FOR_HUMAN_LAB_REVIEW',
  summary:{passed:checks.length-missing.length,blocked:missing.length,total:checks.length},
  checks,notice:'La coincidencia textual nunca demuestra por sí sola operación, licencias ni homologación de fabricante.'};
}
function fromDirectory(site,dir){
 const captures={};
 for(const k of ['router','stack','palo']){
  const file=path.join(dir,k+'.txt');
  if(fs.existsSync(file))captures[k]=fs.readFileSync(file,'utf8');
 }
 return assess(site,captures);
}
if(require.main===module){
 const site=process.argv[2],directory=process.argv[3];
 if(!site||!directory){
  process.stderr.write('Uso: node network/verify-lab-evidence.cjs s01 ./evidencia-local/s01\n');
  process.exitCode=2;
 }else{
  try{
   const report=fromDirectory(site,directory);
   process.stdout.write(JSON.stringify(report,null,2)+'\n');
   if(report.status!=='READY_FOR_HUMAN_LAB_REVIEW')process.exitCode=2;
  }catch(e){process.stderr.write(e.message+'\n');process.exitCode=2}
 }
}
module.exports={siteNumber,inspectText,assess,fromDirectory};
