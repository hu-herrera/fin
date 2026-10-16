'use strict';
// Cisco IOS-XE 17.x. Generador condicional: exige gateways, IP WAN y dos
// destinos ICMP autorizados/verificados por operador. NUNCA autocompleta
// valores para producción ni debe aplicarse sin OOB/rollback.
const {PORTS,WAN_ORDER}=require('./redundant-model.cjs');
const WAN_KEYS=Object.freeze(['starlink','leo','entel5g','gtd4g']);
const DISTANCE=Object.freeze({starlink:1,leo:10,entel5g:20,gtd4g:30});
function ipv4(value){
  if(typeof value!=='string'||!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value))
    throw new Error('IPv4 no válida: '+value);
  const oct=value.split('.').map(Number);
  if(oct.some(n=>n>255))throw new Error('Octeto IPv4 fuera de rango');
  return oct;
}
function ipNum(ip){return ipv4(ip).reduce((a,n)=>(a*256+n)>>>0,0)>>>0}
function isReservedTarget(ip){
  const [a,b,c,d]=ipv4(ip);
  return a===0||a===10||a===127||a>=224||a===169&&b===254||
    a===172&&b>=16&&b<=31||a===192&&b===168||
    a===100&&b>=64&&b<=127||
    a===192&&b===0&&c===2||
    a===198&&b===51&&c===100||
    a===203&&b===0&&c===113||
    a===198&&b>=18&&b<=19||
    a===255||(a===255&&b===255&&c===255&&d===255);
}
function validateWanSettings(settings){
  if(!settings||typeof settings!=='object')return ['Se requieren cuatro contratos WAN y monitores autorizados'];
  const usedTargets=new Set();
  const issues=[];
  for(const type of WAN_KEYS){
    const v=settings[type];
    if(!v||typeof v!=='object'){issues.push(type+': faltan parámetros de proveedor');continue}
    try{
      const ip=ipNum(v.address),gw=ipNum(v.gateway);
      const prefix=v.prefix;
      if(!Number.isInteger(prefix)||prefix<1||prefix>30)issues.push(type+': prefijo inválido');
      else{
        const mask=(0xffffffff << (32-prefix))>>>0;
        if((ip&mask)!==(gw&mask)||ip===gw)issues.push(type+': gateway fuera del segmento WAN');
      }
    }catch(e){issues.push(type+': '+e.message)}
    if(!Array.isArray(v.monitors)||v.monitors.length!==2){issues.push(type+': exige dos destinos de monitoreo');continue}
    for(const [i,host] of v.monitors.entries()){
      try{
        ipv4(host);
        if(isReservedTarget(host))issues.push(type+': monitor '+host+' no es dirección pública apta');
        if(host===v.gateway||host===v.address)issues.push(type+': monitor coincide con next-hop/IP del router');
        if(usedTargets.has(host))issues.push(type+': monitor duplicado '+host+' (ruta /32 ambigua)');
        usedTargets.add(host);
      }catch(e){issues.push(type+' monitor '+i+': '+e.message)}
    }
  }
  return issues;
}
function renderWanSlaCandidate(settings){
  const issues=validateWanSettings(settings);
  if(issues.length)throw new Error('WAN SLA NO GENERADO:\n'+issues.join('\n'));
  const lines=[
    '! SOLO LABORATORIO: monitoreo extremo a extremo IOS-XE, NO PEGAR SIN VALIDACION',
    '! Requiere que ambos hosts remotos de cada ISP respondan ICMP por su enlace',
    '! Rutas /32 fijadas al gateway evitan que el backup oculte una WAN caída'
  ];
  for(const [index,type] of WAN_KEYS.entries()){
    const w=settings[type],port=PORTS.wan[type],track=index+1;
    for(const [j,destination] of w.monitors.entries()){
      const sla=101+index*10+j;
      lines.push('ip route '+destination+' 255.255.255.255 '+w.gateway+' name SLA-'+type.toUpperCase()+'-'+(j+1),
        'ip sla '+sla,
        ' icmp-echo '+destination+' source-interface '+port,
        ' frequency 10',
        ' timeout 2000',
        'ip sla schedule '+sla+' life forever start-time now',
        'track '+sla+' ip sla '+sla+' reachability');
    }
    lines.push('track '+track+' list boolean or',
      ' object '+(101+index*10),
      ' object '+(102+index*10),
      ' delay up 300 down 10',
      'ip route 0.0.0.0 0.0.0.0 '+w.gateway+' '+DISTANCE[type]+' track '+track);
  }
  lines.push('! Verificar: show ip sla statistics, show track, show ip route 0.0.0.0',
    '! Probar: cable abajo, upstream caído con gateway vivo, retorno primario y VPN',
    '! ICMP puede estar filtrado por proveedor; obtener destinos aceptados antes de usar.');
  return lines.join('\n');
}
module.exports={WAN_KEYS,DISTANCE,ipv4,isReservedTarget,validateWanSettings,renderWanSlaCandidate};
