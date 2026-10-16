'use strict';
// CLI para inspeccionar candidatos SIN desplegarlos ni modificar el simulador.
// node network/export-candidate.cjs s01 router|stack|palo
// node network/export-candidate.cjs s01 wan-sla ./monitores-s01.json
const fs=require('node:fs');
const vm=require('node:vm');
const {siteCandidate}=require('./redundant-configs.cjs');
const {renderWanSlaCandidate}=require('./wan-sla-candidate.cjs');
const {oobCandidate}=require('./oob-management.cjs');
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
  if(!['router','stack','palo','wan-sla','oob'].includes(device)){
    throw new Error('Equipo desconocido; usar router, stack, palo, wan-sla u oob');
  }
  const num=key==='cm'?0:Number(key.slice(1)),counts=pcInventory();
  if(!Number.isInteger(counts[key]))throw new Error('Sin inventario de PCs para '+key);
  if(device==='wan-sla'){
    // Sin parámetros de contrato no se emite configuración potencialmente inservible.
    return '# LABORATORIO, VALIDAR CON OPERADOR ANTES DE APLICAR\n'+
      '# Sede '+key.toUpperCase()+' - pruebas WAN autorizadas\n'+
      renderWanSlaCandidate(wanSettings);
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
    const isWan=process.argv[3]==='wan-sla';
    if(isWan&&!process.argv[4])throw new Error('Especifica un JSON con contrato WAN y dos objetivos ICMP por ISP');
    const config=isWan?JSON.parse(fs.readFileSync(process.argv[4],'utf8')):undefined;
    process.stdout.write(exportCandidate(process.argv[2],process.argv[3],config)+'\n');
  }catch(error){
    process.stderr.write('Error: '+error.message+'\n');
    process.exitCode=1;
  }
}
module.exports={exportCandidate,pcInventory};
