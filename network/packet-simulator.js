'use strict';
// Deterministic educational packet-forwarding engine, same in Node and browser.
// Not an ICMP sender, DNS server or real network stack. No invented replies.
(function(root,factory){
 const value=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=value;
 if(root)root.PacketLab=value;
})(typeof window!=='undefined'?window:null,function(){
 const zones={10:'USERS',20:'VOICE',30:'MGMT-DATA',40:'GUESTS'};
 const values=new Set(['dns','ntp','ssl','web-browsing','ssh','icmp','aaa-tacacs','syslog-tls']);
 const wanLabels={starlink:'Starlink',leo:'Amazon Leo',entel5g:'Entel 5G',gtd4g:'GTD 4G'};
 function parseIpv4(ip){
  if(typeof ip!=='string'||!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip))return null;
  const a=ip.split('.').map(Number);
  return a.some(x=>x<0||x>255)?null:a;
 }
 function target(ip){
  const a=parseIpv4(ip);
  if(!a)return {kind:'invalid'};
  if(a[0]===10&&a[1]===70){
   if(a[2]>22)return {kind:'unknown-corporate'};
   const last=a[3],vlan=last>=1&&last<=126?10:
      last>=129&&last<=158?20:last>=161&&last<=174?30:
      last>=177&&last<=190?40:null;
   if(vlan===null)return {kind:'unassigned',siteNum:a[2]};
   return {kind:'corporate',siteNum:a[2],zone:zones[vlan],vlan};
  }
  if(a[0]===10||a[0]===172&&a[1]>=16&&a[1]<=31||
     a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||
     a[0]===127||a[0]===169&&a[1]===254||a[0]===0||a[0]>=224)
    return {kind:'private-other'};
  return {kind:'public'};
 }
 function trace(input,env){
  const hops=[],siteNum=input?.siteNum,zone=input?.zone||'USERS',member=input?.member||1;
  const source=input?.sourceIp,app=input?.application,dest=input?.destinationIp;
  const hop=(label,ok,detail)=>{hops.push({label,ok,detail});return ok;};
  const result=(allowed,reason,code,meta={})=>({
   allowed,status:allowed?'PERMITIDO':'BLOQUEADO',reason,code,
   hops,sourceIp:source,destinationIp:dest,application:app,
   ...meta,modelOnly:true,
   caveat:'Decisión simulada de forwarding y políticas, sin respuesta de servidor ni tráfico físico.'
  });
  if(!Number.isInteger(siteNum)||siteNum<0||siteNum>22||
     !Object.values(zones).includes(zone)||![1,2].includes(member)||
     !values.has(app)||!parseIpv4(source))
   return result(false,'Origen, protocolo o sede inválida.','BAD_INPUT');
  if(target(source).kind!=='corporate'||target(source).siteNum!==siteNum||
     target(source).zone!==zone)
   return result(false,'La IP de origen no corresponde a la VLAN y sede seleccionadas.','SOURCE_MISMATCH');
  const dst=target(dest);
  if(dst.kind==='invalid')return result(false,'IPv4 de destino inválida.','BAD_DEST');
  const sourceSite=env.site(siteNum);
  if(!sourceSite)return result(false,'No existe estado de origen para esta sede.','MISSING_SITE');
  const sourceUp=sourceSite.switchLocalL2?.[member]===true;
  if(!hop('Host · acceso al switch '+member,sourceUp,
     sourceUp?'VLAN '+zone+' disponible en miembro '+member:'Miembro de acceso apagado'))
   return result(false,'Sin enlace físico lógico desde el host al switch.','ACCESS_DOWN');
  if(dst.kind==='unassigned'||dst.kind==='unknown-corporate'||dst.kind==='private-other')
   return result(false,'Destino privado no asignado o no representado en la topología.','NO_ROUTE');
  const sameSite=dst.siteNum===siteNum;
  if(sameSite&&dst.zone===zone){
   const destMember=typeof env.destinationMember==='function'?
     env.destinationMember(siteNum,dest):member;
   const memberUp=sourceSite.switchLocalL2?.[destMember]===true;
   if(!hop('Destino local · VLAN '+dst.vlan,memberUp,memberUp?'Host en misma VLAN':'Switch destino apagado'))
    return result(false,'El switch del destino está apagado.','DEST_ACCESS_DOWN');
   if(destMember!==member&&!hop('Fabric StackWise',sourceSite.interMemberL2===true,
      'El tráfico intermiembro requiere fabric StackWise funcional'))
    return result(false,'No hay conmutación entre los miembros del stack.','STACK_PARTITION');
   return result(true,'Reenvío local de capa 2 permitido por el modelo.','LOCAL_L2',{route:'VLAN '+dst.vlan});
  }
  if(!hop('StackWise → PA-1410 · puerta de enlace',sourceSite.switchGateway?.[member]===true,
    'Salida por AE2/Po20 a gateway VLAN '+zone))
   return result(false,'Sin camino L2/L3 hacia el firewall.','GATEWAY_DOWN');
  const remote=dst.kind==='corporate'&&!sameSite;
  const srcTo=remote?'TRANSIT':sameSite?dst.zone:'TRANSIT';
  const ingress=env.policy(siteNum,zone,srcTo,app,dest,source);
  if(!hop('Palo Alto '+(siteNum===0?'CM':'S'+String(siteNum).padStart(2,'0'))+' · política',
       ingress?.action==='allow',
       (ingress?.action||'deny').toUpperCase()+' · '+(ingress?.rule||'regla inexistente')))
   return result(false,'El firewall de origen deniega este flujo.','POLICY_DENY',
     {rule:ingress?.rule||'interzone-default'});
  if(sameSite)
   return result(true,'El firewall permite el tráfico entre VLANs de la sede.','INTERVLAN',
      {rule:ingress.rule});
  if(!hop('Cisco C8300 · salida WAN',Boolean(sourceSite.transitUp),
    'Po10/AE1 transporte de red a Cisco C8300'))
   return result(false,'El enlace Cisco–Palo Alto está interrumpido.','TRANSIT_DOWN');
  if(!hop('Selección WAN / SLA',Boolean(sourceSite.activeWan),
      sourceSite.activeWan?wanLabels[sourceSite.activeWan]||sourceSite.activeWan:'Ningún operador con ruta sana'))
   return result(false,'Todas las rutas WAN están caídas o sin respuesta de sondas.','WAN_DOWN');
  if(!remote)
   return result(true,'Salida a Internet permitida por política y ruta WAN del modelo.','INTERNET',
     {wan:sourceSite.activeWan,rule:ingress.rule});
  if(dst.vlan===40)
   return result(false,'La VLAN de invitados no se anuncia entre sedes.','GUEST_NOT_ROUTED');
  if(!hop('Cisco C8300 · túnel lógico',env.overlay(siteNum)===true,
       'Tunnel del operador activo en el simulador; no representa IKEv2/IPsec real'))
   return result(false,'El túnel de origen está deshabilitado en el escenario.','TUNNEL_DOWN');
  const hub=env.site(0);
  if(!hop('Casa matriz · hub de tránsito',Boolean(hub&&hub.activeWan&&env.overlay(0)===true&&hub.transitUp),
       'La malla entre sucursales utiliza la casa matriz en este modelo'))
   return result(false,'El hub central no está disponible.','HUB_DOWN');
  const remoteStatus=env.site(dst.siteNum);
  if(!hop('Sede destino · WAN y túnel',Boolean(remoteStatus&&remoteStatus.activeWan&&
        remoteStatus.transitUp&&env.overlay(dst.siteNum)===true),
       'Red remota y enlace del firewall operativo'))
   return result(false,'La sede de destino no tiene túnel o WAN operativos.','REMOTE_DOWN');
  const incoming=env.policy(dst.siteNum,'TRANSIT',dst.zone,app,dest,source);
  if(!hop('Palo Alto destino · política',incoming?.action==='allow',
    (incoming?.action||'deny').toUpperCase()+' · '+(incoming?.rule||'interzone-default')))
   return result(false,'El firewall de destino rechaza la solicitud.','REMOTE_POLICY_DENY',
     {rule:incoming?.rule||'interzone-default'});
  if(!hop('Switch/servidor lógico destino',Boolean(remoteStatus.switchGateway?.[1]||
    remoteStatus.switchGateway?.[2]),'VLAN '+dst.vlan+' en sede '+dst.siteNum))
   return result(false,'No hay enlace desde el PA hacia los switches del destino.','DEST_GATEWAY_DOWN');
  return result(true,'Las políticas y rutas del escenario permiten el flujo; no se simula respuesta del servidor.','INTERSITE',
    {wan:sourceSite.activeWan,rule:incoming.rule,viaHub:true});
 }
 return Object.freeze({parseIpv4,target,trace,wanLabels,zones});
});
