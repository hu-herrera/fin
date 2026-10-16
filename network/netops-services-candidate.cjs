'use strict';
// TACACS+/Syslog TLS network-device configuration for REVIEW ONLY.
// No usernames, PSKs, TACACS keys, SNMP credentials, TLS certificates or
// physical-server reachability are inferred or exported.
const {checkSiteNum}=require('./redundant-model.cjs');
const {CM_SERVICES,NETOPS_SERVICES,ROUTER_NTP_SOURCES,evaluateSitePanPolicy,paloCandidate}=require('./redundant-configs.cjs');
const {addressReview}=require('./management-services-candidate.cjs');
const TACACS=CM_SERVICES.tacacs,SYSLOG=CM_SERVICES.syslog[0],MONITOR=CM_SERVICES.monitor[0];
function validatePolicy(num){
  checkSiteNum(num);
  const srcRouter=ROUTER_NTP_SOURCES[num];
  const srcStack='10.70.'+num+'.162';
  const errors=[...addressReview().issues];
  const check=(ok,why)=>{if(!ok)errors.push(why)};
  const decision=(site,from,to,app,dest,src,action)=>evaluateSitePanPolicy(
    site,from,to,app,dest,src).action===action;
  const verifyPaths=(app,servers)=>{
    for(const dest of servers){
      check(decision(0,'TRANSIT','USERS',app,dest,srcRouter,'allow'),
        'CM denies router '+app+' '+srcRouter+' -> '+dest);
      check(decision(0,num===0?'MGMT-DATA':'TRANSIT','USERS',app,dest,srcStack,'allow'),
        'CM denies stack '+app+' '+srcStack+' -> '+dest);
      if(num!==0)check(decision(num,'MGMT-DATA','TRANSIT',app,dest,srcStack,'allow'),
        'Branch denies stack '+app+' '+srcStack+' -> '+dest);
      check(decision(0,'TRANSIT','USERS','ssh',dest,srcRouter,'deny'),
        'Router could SSH to sensitive service host');
      check(decision(0,'TRANSIT','USERS','web-browsing',dest,srcRouter,'deny'),
        'Router could browse sensitive service host');
      if(num!==0)check(decision(num,'USERS','TRANSIT',app,dest,'10.70.'+num+'.10','deny'),
        'Corporate user improperly allowed AAA/logging');
      if(num!==0)check(decision(num,'GUESTS','TRANSIT',app,dest,'10.70.'+num+'.180','deny'),
        'Guest improperly allowed AAA/logging');
    }
  };
  verifyPaths('aaa-tacacs',TACACS);
  verifyPaths('syslog-tls',[SYSLOG]);
  const cm=paloCandidate(0),branch=paloCandidate(num);
  check(cm.includes('set service '+NETOPS_SERVICES['aaa-tacacs'].object+' protocol tcp port 49'),
    'CM PAN service object TCP49 missing');
  check(cm.includes('set service '+NETOPS_SERVICES['syslog-tls'].object+' protocol tcp port 6514'),
    'CM PAN service object TCP6514 missing');
  for(const cfg of [cm,branch])
    check(!cfg.includes('CM-IN-SYSLOG-NETOPS service any') &&
      !cfg.includes('BRANCH-STACK-TACACS service any'),
      'Unrestricted PAN service any in sensitive network operations rules');
  check(cm.includes('set address CM-TACACS-1 ip-netmask '+TACACS[0]+'/32') &&
        cm.includes('set address CM-TACACS-2 ip-netmask '+TACACS[1]+'/32'),
        'Missing TACACS address hosts');
  check(cm.includes('set address CM-SYSLOG-1 ip-netmask '+SYSLOG+'/32'),
    'Missing syslog host');
  check(cm.includes('set address CM-MONITOR-1 ip-netmask '+MONITOR+'/32'),
    'Missing reserved monitoring host');
  return errors;
}
function assessNetops(num,settings){
  checkSiteNum(num);
  const blockers=[...validatePolicy(num)];
  if(!settings||typeof settings!=='object'||Array.isArray(settings))
    return {site:num===0?'cm':'s'+String(num).padStart(2,'0'),
      status:'BLOCKED',deployable:false,certified:false,
      blockers:[...blockers,'Se requieren parámetros explícitos y verificaciones de laboratorio']};
  const requirements={
    approvedLabWindow:'Sin ventana y aprobación de pruebas',
    tacacsPrimaryVerified:'TACACS+ primario sin prueba TCP49',
    tacacsSecondaryVerified:'TACACS+ secundario sin prueba TCP49',
    tacacsKeysInstalledSecurely:'No hay secretos TACACS+ válidos instalados por un canal seguro',
    breakGlassLocalLoginTested:'Falta cuenta local de emergencia verificada en consola',
    fallbackLoginVerified:'No se ha ensayado fallback local durante caída de ambos TACACS+',
    roleAndAuthorizationReviewed:'Roles AAA, autorización y accounting no revisados',
    syslogTlsServerVerified:'Servidor Syslog TLS/6514 no operativo o no accesible',
    syslogTlsProfileInstalled:'Perfil TLS/certificados para IOS-XE no verificado',
    collectorCertChainReviewed:'Validación de certificados del colector no verificada',
    ntpClockSynchronized:'NTP y marcas de tiempo no comprobados',
    managementFirewallRulesReviewed:'Políticas de PAN-OS pendientes de aceptación',
    monitoringAlertsDefined:'Sin alarmas y criterios de observabilidad validados'
  };
  if(num!==0)requirements.ipsecOspfToCmVerified='OSPF/IPsec a CM no comprobado en hardware';
  for(const [flag,error] of Object.entries(requirements))
    if(settings[flag]!==true)blockers.push(error);
  if(settings.snmpEnabled===true){
    const required={
      snmpv3AuthPrivVerified:'SNMPv3 authPriv sin validación',
      snmpv3ReadOnlyAclVerified:'Restricción del colector SNMPv3 pendiente',
      snmpv3CredentialsInstalledSecurely:'Credenciales SNMPv3 sin instalación segura',
      snmpv3PollingReturnRouteVerified:'Rutas de monitoreo de vuelta no verificadas'
    };
    for(const [flag,error] of Object.entries(required))
      if(settings[flag]!==true)blockers.push(error);
    blockers.push('SNMPv3 necesita diseño separado de alcance/rutas/ACL PAN-OS: no emitir comandos automáticos');
  }else if(settings.snmpEnabled!==false)
    blockers.push('snmpEnabled debe ser false hasta que exista diseño SNMPv3 autenticado y acotado');
  if(settings.tacacs&&
    (settings.tacacs.length!==2||settings.tacacs.some((ip,i)=>ip!==TACACS[i])))
    blockers.push('Direcciones TACACS+ fuera de reservas .112/.113');
  if(!Array.isArray(settings.tacacs))
    blockers.push('Se exige declaración exacta de dos TACACS+ reservados');
  if(settings.syslog!==SYSLOG)blockers.push('El destino TLS Syslog debe ser .100');
  const tlsProfile=settings.tlsProfile;
  if(typeof tlsProfile!=='string'||!/^[A-Z][A-Z0-9_-]{2,31}$/.test(tlsProfile))
    blockers.push('Se requiere nombre de perfil TLS instalado y validado (solo A-Z, 0-9, _ y -)');
  for(const forbidden of ['secret','password','tacacsKey','snmpPassword','privateKey']){
    if(Object.prototype.hasOwnProperty.call(settings,forbidden))
      blockers.push('Se prohíben credenciales en el JSON de exportación ('+forbidden+')');
  }
  return {site:num===0?'cm':'s'+String(num).padStart(2,'0'),
    status:blockers.length?'BLOCKED':'LAB_CANDIDATE',
    deployable:false,certified:false,blockers,
    routerSource:ROUTER_NTP_SOURCES[num],stackSource:'10.70.'+num+'.162',
    syslogTransport:'TLS/TCP6514',monitoring:'LOG_INGEST_ONLY_SNMPV3_NOT_CONFIGURED',
    disclaimer:'Indicadores booleanos son declaraciones, no evidencia ni certificación de equipos.'};
}
function renderNetopsCandidate(num,settings){
  const report=assessNetops(num,settings);
  if(report.blockers.length)
    throw new Error('AAA/SYSLOG NO GENERADO:\n'+report.blockers.join('\n'));
  const routerSource='Loopback0',stackSource='Vlan30';
  const block=(name,source)=>{
    const group='NETOPS-TACACS';
    return [
      '! BLOQUE '+name+' (SOLO LABORATORIO, PEGAR UNICAMENTE EN ESTE DISPOSITIVO)',
      '! Identidades y claves TACACS+ deben existir antes de ejecutar estas instrucciones',
      'aaa new-model',
      'tacacs server NETOPS-AAA-PRIMARY',
      ' address ipv4 '+TACACS[0],
      ' timeout 5',
      '! NO KEY EN ESTE ARCHIVO; clave ya instalada por canal privado y comprobada',
      'tacacs server NETOPS-AAA-SECONDARY',
      ' address ipv4 '+TACACS[1],
      ' timeout 5',
      '! NO KEY EN ESTE ARCHIVO; clave ya instalada por canal privado y comprobada',
      'aaa group server tacacs+ '+group,
      ' server name NETOPS-AAA-PRIMARY',
      ' server name NETOPS-AAA-SECONDARY',
      ' ip tacacs source-interface '+source,
      'aaa authentication login NETOPS-VTY group '+group+' local',
      'aaa authorization exec NETOPS-VTY group '+group+' local',
      'aaa accounting exec NETOPS-VTY start-stop group '+group,
      '! PRECAMBIO: ensayar consola y usuario break-glass; local se usa ante ERROR/no respuesta, no ante rechazo AAA',
      '! line vty / método de login: integrar sólo tras verificar versión, ssh, fallback y camino de reversión',
      'service timestamps log datetime msec show-timezone',
      'logging trap informational',
      'logging origin-id hostname',
      'logging source-interface '+source,
      'logging host '+SYSLOG+' transport tls port 6514 profile '+settings.tlsProfile,
      '! PRUEBAS: show logging; show aaa servers; show tacacs; show ntp status',
      '! ADVERTENCIA: TLS necesita perfil real y el collector debe validar el certificado',
    ].join('\n');
  };
  return [
    '! CANDIDATO IOS-XE NETOPS — NO CERTIFICADO Y NO APTO PARA PEGAR TAL CUAL',
    '! El simulador no establece TACACS ni TLS; el monitor .101 es reserva, NO SNMP operativo',
    block('C8300',routerSource),
    '! ===== CAMBIO DE EQUIPO; NO APLICAR EL BLOQUE C8300 AL STACK =====',
    block('C9200L STACK LOGICO',stackSource),
    '! ===== FIN DE LOS DOS BLOQUES =====',
    '! No se configuran usuarios, contraseñas, claves, SNMP community ni SNMPv3 antes de validación.',
    '! Cisco AAA/Logging: ejecutar por etapas y verificar consola/rollback ANTES de guardar startup-config'
  ].join('\n\n');
}
module.exports={validatePolicy,assessNetops,renderNetopsCandidate};
