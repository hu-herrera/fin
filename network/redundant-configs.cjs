'use strict';
// Plantillas PREVIAS AL CUTOVER: no ejecutar sobre hardware sin revision IOS-XE/PAN-OS.
// Redundancia validada estructuralmente; configuracion WAN/VPN, OOB, NAT y politicas
// requieren parametros de los operadores, PAN-OS real y pruebas de acceso.
const {PORTS,VLAN,candidateAddressing,checkSiteNum}=require('./redundant-model.cjs');
function routerCandidate(num){
  checkSiteNum(num);
  const a=candidateAddressing(num);
  const prefix='10.70.'+num+'.';
  const lines=[
    '! LAB CANDIDATO C8300 - NO PEGAR EN PRODUCCION',
    '! Router C8300: enlaces WAN en Gi0/0/0..3, transito L3 LACP Te0/0/4..5',
    'interface Port-channel10',
    ' description TRANSIT-TO-PA1410-AE1',
    ' ip address 10.72.'+num+'.1 255.255.255.252',
    ' ip nat inside',
    ' no shutdown'
  ];
  for(const p of PORTS.transit){
    lines.push('interface '+p.router,' description TO-PA1410-'+p.firewall,
      ' no ip address',' channel-group 10 mode active',' no shutdown');
  }
  for(const [type,port] of Object.entries(PORTS.wan)){
    lines.push('interface '+port,' description WAN-'+type+' - IP/MTU/ISP REQUIERE-CONTRATO',
      ' ip nat outside',' no shutdown');
  }
  for(const v of VLAN) {
    lines.push('ip route '+prefix+v.network+' '+v.mask+' 10.72.'+num+'.2');
  }
  // Redistribuir SOLO rutas LAN de esta sede; nunca una default aprendida.
  const pfx='SITE-LAN-'+num;
  for(const v of VLAN)lines.push('ip prefix-list '+pfx+' seq '+(v.id*10)+
    ' permit '+prefix+v.network+'/'+v.prefix);
  lines.push('route-map EXPORT-SITE-LAN permit 10',
    ' match ip address prefix-list '+pfx,
    'router ospf 1',
    ' passive-interface default',
    ' redistribute static subnets route-map EXPORT-SITE-LAN',
    '! conservar Tunnel100/200/300/400 y revisar adyacencias y costes reales',
    '! FALTAN: WAN IP/MTU y SLA extremo-a-extremo por ISP; VPN peers autenticos',
    '! FALTAN: NAT ACL, ruta por defecto rastreada, QoS, AAA/OOB y rollback');
  return lines.join('\n');
}
function stackCandidate(num){
  checkSiteNum(num);
  const lines=[
    '! LAB CANDIDATO C9200L STACKWISE-80 - NO PEGAR EN PRODUCCION',
    '! Instalar 2 adaptadores StackWise por miembro y dos cables traseros en anillo',
    'hostname STACK-S'+String(num).padStart(2,'0'),
    'switch 1 provision c9200l-48t-4g',
    'switch 2 provision c9200l-48t-4g',
    'spanning-tree mode rapid-pvst',
    'spanning-tree vlan 10,20,30,40 priority 24576',
    'vlan 10',' name DATOS-USUARIOS',
    'vlan 20',' name VOZ',
    'vlan 30',' name GESTION',
    'vlan 40',' name INVITADOS',
    'vlan 999',' name NATIVE-ISOLATED',
    'interface Port-channel20',
    ' description MEC-TO-PA1410-AE2',
    ' switchport mode trunk',
    ' switchport trunk native vlan 999',
    ' switchport trunk allowed vlan 10,20,30,40',
    ' ip dhcp snooping trust',
    ' no shutdown'
  ];
  for(const p of PORTS.distribution){
    lines.push('interface '+p.switch,' description MEC-TO-PA1410-'+p.firewall,
      ' switchport mode trunk',
      ' switchport trunk native vlan 999',
      ' switchport trunk allowed vlan 10,20,30,40',
      ' channel-group 20 mode active',' no shutdown');
  }
  lines.push('interface Vlan30',
    ' ip address 10.70.'+num+'.162 255.255.255.240',
    ' no shutdown',
    'ip default-gateway 10.70.'+num+'.161',
    'no ip routing',
    '! FALTAN: puertos de PCs/AP y su asignacion Gi1/Gi2, DHCP snooping y STP',
    '! FALTAN: NTP/AAA y cableado StackWise real; NO configurar Po1 entre switches',
    '! VERIFICAR: show switch; show switch stack-ports; show etherchannel summary');
  return lines.join('\n');
}
function paloCandidate(num){
  checkSiteNum(num);
  const lines=[
    '# LAB CANDIDATO PA-1410 Layer3 - NO COMMIT SIN POLITICAS',
    '# AE1 2x10G hacia C8300; AE2 4x1G hacia stack unificado',
    'set network interface aggregate-ethernet ae1 layer3 lacp enable yes',
    'set network interface aggregate-ethernet ae1 layer3 lacp mode active',
    'set network interface aggregate-ethernet ae1 layer3 ip 10.72.'+num+'.2/30',
    'set network interface aggregate-ethernet ae2 layer3 lacp enable yes',
    'set network interface aggregate-ethernet ae2 layer3 lacp mode active'
  ];
  for(const p of PORTS.transit.concat(PORTS.distribution)){
    const ae=p.id.startsWith('T')?'ae1':'ae2';
    lines.push('set network interface ethernet '+p.firewall+' aggregate-group '+ae);
  }
  for(const v of VLAN){
    const u='ae2.'+v.id;
    lines.push('set network interface aggregate-ethernet ae2 layer3 units '+u+' tag '+v.id,
      'set network interface aggregate-ethernet ae2 layer3 units '+u+' ip 10.70.'+num+'.'+v.offset+'/'+v.prefix);
  }
  lines.push('set network virtual-router default interface [ ae1 ae2.10 ae2.20 ae2.30 ae2.40 ]',
    'set network virtual-router default routing-table ip static-route DEFAULT destination 0.0.0.0/0',
    'set network virtual-router default routing-table ip static-route DEFAULT interface ae1',
    'set network virtual-router default routing-table ip static-route DEFAULT nexthop ip-address 10.72.'+num+'.1',
    '# FALTAN: zonas PAN-OS y reglas default-deny para TODAS las VLAN, App-ID, IPS',
    '# FALTAN: rutas remotas y servicios aprobados, gestion fuera de banda separada',
    '# FALTAN: rutas estaticas del Cisco hacia las VLAN y verificacion de NAT/VPN',
    '# FALTAN: commit validate y rollback desde consola fuera de banda');
  return lines.join('\n');
}
function siteCandidate(num){
 return {siteNum:num,addressing:candidateAddressing(num),
   cisco:routerCandidate(num),stack:stackCandidate(num),palo:paloCandidate(num),
   deployable:false,
   blockers:['politicas PAN-OS no instaladas','management OOB sin gateway',
   'WAN/VPN no parametrizados','configuracion de puertos de usuarios pendiente',
   'sin laboratorio de hardware']};
}
module.exports={routerCandidate,stackCandidate,paloCandidate,siteCandidate};
