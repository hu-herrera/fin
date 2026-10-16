'use strict';
// Modelo aislado de la arquitectura FUTURA: C8300 -> PA-1410 L3 -> StackWise-80.
// No reemplaza la topologia actualmente publicada hasta migracion integral.
const PORTS=Object.freeze({
  wan: Object.freeze({
    starlink:'GigabitEthernet0/0/0', leo:'GigabitEthernet0/0/1',
    entel5g:'GigabitEthernet0/0/2', gtd4g:'GigabitEthernet0/0/3'
  }),
  transit: Object.freeze([
    Object.freeze({id:'T1',router:'TenGigabitEthernet0/0/4',firewall:'ethernet1/19',speedMbps:10000}),
    Object.freeze({id:'T2',router:'TenGigabitEthernet0/0/5',firewall:'ethernet1/20',speedMbps:10000})
  ]),
  distribution: Object.freeze([
    Object.freeze({id:'D1',firewall:'ethernet1/3',switch:'GigabitEthernet1/0/45',member:1,speedMbps:1000}),
    Object.freeze({id:'D2',firewall:'ethernet1/4',switch:'GigabitEthernet1/0/46',member:1,speedMbps:1000}),
    Object.freeze({id:'D3',firewall:'ethernet1/5',switch:'GigabitEthernet2/0/45',member:2,speedMbps:1000}),
    Object.freeze({id:'D4',firewall:'ethernet1/6',switch:'GigabitEthernet2/0/46',member:2,speedMbps:1000})
  ]),
  stack: Object.freeze(['STACK-A','STACK-B'])
});
const WAN_ORDER=Object.freeze(['starlink','leo','entel5g','gtd4g']);
const VLAN=Object.freeze([
  Object.freeze({id:10,offset:1,mask:'255.255.255.128',prefix:25,network:0,name:'USUARIOS'}),
  Object.freeze({id:20,offset:129,mask:'255.255.255.224',prefix:27,network:128,name:'VOZ'}),
  Object.freeze({id:30,offset:161,mask:'255.255.255.240',prefix:28,network:160,name:'GESTION'}),
  Object.freeze({id:40,offset:177,mask:'255.255.255.240',prefix:28,network:176,name:'INVITADOS'})
]);
function checkSiteNum(num){
  if(!Number.isInteger(num)||num<0||num>22) throw new RangeError('Sede fuera de 0..22');
  return num;
}
function candidateAddressing(num){
  checkSiteNum(num);
  return {
    transitRouter:'10.72.'+num+'.1/30',
    transitFirewall:'10.72.'+num+'.2/30',
    vlanGateways:Object.fromEntries(VLAN.map(v=>[v.id,'10.70.'+num+'.'+v.offset+'/'+v.prefix])),
    switchStackManagement:'10.70.'+num+'.162/28',
    firewallOobManagement:'PENDIENTE: red OOB dedicada, no usar VLAN30 de datos como OOB'
  };
}
function makeScenario(siteNum){
  checkSiteNum(siteNum);
  return {
    siteNum, nodes:{router:true,firewall:true,sw1:true,sw2:true},
    links:Object.fromEntries([...PORTS.transit,...PORTS.distribution].map(p=>[p.id,true]).concat(PORTS.stack.map(id=>[id,true]))),
    wan:Object.fromEntries(WAN_ORDER.map(k=>[k,true]))
  };
}
function setLink(s,id,up){
  if(!Object.prototype.hasOwnProperty.call(s.links,id))throw new RangeError('Enlace inexistente: '+id);
  s.links[id]=Boolean(up);return s;
}
function setNode(s,id,up){
  if(!Object.prototype.hasOwnProperty.call(s.nodes,id))throw new RangeError('Equipo inexistente: '+id);
  s.nodes[id]=Boolean(up);return s;
}
function setWan(s,id,up){
  if(!Object.prototype.hasOwnProperty.call(s.wan,id))throw new RangeError('WAN inexistente: '+id);
  s.wan[id]=Boolean(up);return s;
}
function inspect(s){
  const n=s.nodes;
  const transit=PORTS.transit.filter(p=>s.links[p.id]&&n.router&&n.firewall);
  const dist=PORTS.distribution.filter(p=>s.links[p.id]&&n.firewall&&n['sw'+p.member]);
  const alive=[1,2].filter(member=>n['sw'+member]);
  // Con ambos miembros encendidos y sin ningun cable StackWise, no garantizar
  // master election ni forwarding: fallo seguro (particion).
  const partitioned=alive.length===2&&!PORTS.stack.some(id=>s.links[id]);
  const stackFunctional=alive.length>0&&!partitioned;
  const routeToFirewall=stackFunctional&&transit.length>0&&dist.length>0;
  const memberL2={
    1:Boolean(n.sw1&&routeToFirewall),
    2:Boolean(n.sw2&&routeToFirewall)
  };
  const activeWan=WAN_ORDER.find(id=>s.wan[id])||null;
  return {
    transitUp:transit.length>0,
    transitMembers:transit.map(p=>p.id),
    stackFunctional,stackPartitioned:partitioned,
    activeStackMembers:alive,
    paStackMembers:dist.map(p=>p.id),
    switchLan:{...memberL2},
    switchInternet:{
      1:memberL2[1]&&Boolean(activeWan),
      2:memberL2[2]&&Boolean(activeWan)
    },
    activeWan,
    lossOfEntireFirewall:!n.firewall
  };
}
function validatePortPlan(){
  const problems=[];
  const usedRouter=[...Object.values(PORTS.wan),...PORTS.transit.map(p=>p.router)];
  const usedFirewall=[...PORTS.transit,...PORTS.distribution].map(p=>p.firewall);
  const usedSwitch=PORTS.distribution.map(p=>p.switch);
  for(const [label,ports] of [['Router',usedRouter],['PA',usedFirewall],['Stack',usedSwitch]]){
    if(new Set(ports).size!==ports.length)problems.push(label+' asigna puerto fisico duplicado');
  }
  if(PORTS.transit.some(p=>p.speedMbps!==10000))problems.push('ae1 contiene velocidades heterogeneas');
  if(PORTS.distribution.some(p=>p.speedMbps!==1000))problems.push('ae2 contiene velocidades heterogeneas');
  if(new Set(PORTS.distribution.map(p=>p.member)).size!==2)problems.push('ae2 no distribuye miembros entre los dos switches');
  if(PORTS.stack.length!==2)problems.push('anillo StackWise sin dos cables dedicados');
  for(const p of PORTS.distribution){
    if(!/^GigabitEthernet[12]\/0\/(?:45|46)$/.test(p.switch))problems.push('puerto stack invalido '+p.switch);
  }
  return problems;
}
module.exports={PORTS,WAN_ORDER,VLAN,checkSiteNum,candidateAddressing,makeScenario,setLink,setNode,setWan,inspect,validatePortPlan};
