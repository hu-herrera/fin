'use strict';
// Red OOB física PROPUESTA y reservada. Requiere gateway y switch dedicado
// de gestión por sede; no fingir que existen y nunca reemplazar acceso
// consola/rollback antes del corte.
// C9200L: interfaz de gestión Gi0/0 y Mgmt-vrf (documentado por Cisco).
// Palo Alto PA-1410: MGT físico separado del dataplane.
// No presumir nombre de interfaz MGMT C8300 sin "show inventory".
const {checkSiteNum,VLAN,candidateAddressing}=require('./redundant-model.cjs');
const PREFIX=[10,73];
function oobAddressing(site){
  checkSiteNum(site);
  const base=PREFIX.join('.')+'.'+site+'.';
  return Object.freeze({
    network:base+'0/28', netmask:'255.255.255.240',
    gateway:base+'1',firewallMgt:base+'2',stackMgt:base+'3',
    routerMgtReserved:base+'4',jumpHostReserved:base+'5',
    broadcast:base+'15',
    gatewayProvisioned:false,routerManagementInterfaceVerified:false,
    managementNetworkDedicated:false,
  });
}
function validateOobPlan(site){
  const p=oobAddressing(site),problems=[],subnet=candidateAddressing(site);
  const assignments=['gateway','firewallMgt','stackMgt','routerMgtReserved','jumpHostReserved'];
  const addresses=assignments.map(k=>p[k]);
  if(new Set(addresses).size!==addresses.length)problems.push('Dirección OOB duplicada');
  for(const [k,value] of assignments.map((name,i)=>[name,addresses[i]])){
    if(!value.startsWith('10.73.'+site+'.'))problems.push(k+': fuera de red OOB');
    const octet=Number(value.split('.')[3]);
    if(octet<1||octet>14)problems.push(k+': host OOB inválido');
  }
  const forbidden=new Set([...Object.values(subnet.vlanGateways).map(v=>v.split('/')[0]),
    subnet.switchStackManagement.split('/')[0],subnet.transitRouter.split('/')[0],subnet.transitFirewall.split('/')[0]]);
  for(const value of addresses)if(forbidden.has(value))problems.push('OOB colisiona con dataplane '+value);
  for(const v of VLAN)if(v.id===30&&p.network.startsWith('10.70.'))problems.push('OOB no es red independiente de VLAN30');
  return problems;
}
function oobCandidate(site){
  if(validateOobPlan(site).length)throw new Error('OOB inválida: '+validateOobPlan(site).join('; '));
  const p=oobAddressing(site);
  return {
    addressing:p,deployable:false,
    firewall:[
      '# SOLO LAB - puerto MGT del PA-1410 físicamente separado',
      '# Gateway/switch OOB por cotizar, configurar y comprobar antes del cambio',
      'set deviceconfig system ip-address '+p.firewallMgt,
      'set deviceconfig system netmask '+p.netmask,
      'set deviceconfig system default-gateway '+p.gateway,
      '# Restringir acceso administrativo a jump hosts autorizados y a protocolos necesarios',
      '# Validar acceso a MGT, DNS/NTP, rutas de servicio y rollback ANTES de commit'
    ].join('\n'),
    stack:[
      '! SOLO LAB - puerto físico de gestión C9200L del stack',
      '! Interfaz Gi0/0 Mgmt-vrf: puerto de miembro activo; conectar OOB a ambos miembros',
      'interface GigabitEthernet0/0',
      ' vrf forwarding Mgmt-vrf',
      ' ip address '+p.stackMgt+' '+p.netmask,
      ' no shutdown',
      'ip route vrf Mgmt-vrf 0.0.0.0 0.0.0.0 '+p.gateway,
      '! No inyectar Mgmt-vrf en OSPF de datos; verificar aislamiento de retorno',
      '! Verificar show ip interface brief vrf Mgmt-vrf y show ip route vrf Mgmt-vrf'
    ].join('\n'),
    router:[
      '! SOLO RESERVA: Cisco C8300 MGT '+p.routerMgtReserved+' (sin interfaz fabricada)',
      '! Confirmar PID exacto, inventario, puerto MGMT / VRF e IOS XE compatible',
      '! No aplicar configuración Cisco C8300 OOB sin nombre físico validado'
    ].join('\n'),
    requiredHardware:[
      '1 gateway OOB independiente y seguro por sede (mínimo un enlace de gestión propio)',
      '1 switch de gestión OOB por sede; conectar MGT PA y Gi0/0 de ambos miembros C9200L',
      'acceso serial/consola de recuperación, control AAA y registro',
      'validar camino de NOC/jump host a cada subred OOB'
    ],
    blockers:[
      'gateway y switch OOB no aprovisionados','acceso de NOC a red OOB sin medir',
      'Puerto/VRF de gestión C8300 no confirmado','permitted IP y AAA de PA sin revisión'
    ]
  };
}
module.exports={oobAddressing,validateOobPlan,oobCandidate};
