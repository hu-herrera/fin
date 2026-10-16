'use strict';
// CLI para inspeccionar candidatos SIN desplegarlos ni modificar el simulador.
// node network/export-candidate.cjs s01 router|stack|palo
const fs=require('node:fs');
const vm=require('node:vm');
const {siteCandidate}=require('./redundant-configs.cjs');
function pcInventory(){
  const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
  const match=html.match(/const PC_COUNT\s*=\s*(\{[\s\S]*?\});/);
  if(!match)throw new Error('Inventario de PC_COUNT ausente');
  return vm.runInNewContext('('+match[1]+')');
}
function exportCandidate(site,device){
  const key=String(site).toLowerCase();
  if(!/^(cm|s(?:0[1-9]|1[0-9]|2[0-2]))$/.test(key)){
    throw new Error('Sede desconocida; usar cm o s01..s22');
  }
  if(!['router','stack','palo'].includes(device)){
    throw new Error('Equipo desconocido; usar router, stack o palo');
  }
  const num=key==='cm'?0:Number(key.slice(1)),counts=pcInventory();
  if(!Number.isInteger(counts[key]))throw new Error('Sin inventario de PCs para '+key);
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
    process.stdout.write(exportCandidate(process.argv[2],process.argv[3])+'\n');
  }catch(error){
    process.stderr.write('Error: '+error.message+'\n');
    process.exitCode=1;
  }
}
module.exports={exportCandidate,pcInventory};
