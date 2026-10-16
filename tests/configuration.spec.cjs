const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;

async function setOperational(page){
 await page.goto(url);
 await page.evaluate(()=>{
   ST.mode='despues';
   for(const s of SEDES){
     ST.links[s.id]={starlink:'activo',kuiper:'standby',g5:'standby',g4:'standby'};
     ST.failback[s.id]={pending:false};
     recompute(s.id);
   }
 });
}

test('LLD por sede: máscaras, IP únicas, configuración Cisco y firewall consistentes',async({page})=>{
 await setOperational(page);
 const report=await page.evaluate(()=>{
   const failures=[],addresses=new Set();
   for(const s of SEDES){
     const n=s.num,r=genRouterRunningConfig(s),sw1=genSwitchRunningConfig(s,1),
       sw2=genSwitchRunningConfig(s,2),fw=genFWCommand(s,'show running-config');
     const check=(ok,msg)=>{if(!ok)failures.push(s.id+': '+msg)};
     for(const [suffix,mask] of [['1','255.255.255.128'],['129','255.255.255.224'],
       ['161','255.255.255.240'],['177','255.255.255.240']]){
       check(r.includes('ip address 10.70.'+n+'.'+suffix+' '+mask),'router gateway '+suffix+'/'+mask);
     }
     check(r.includes('GigabitEthernet0/0/0.10'),'troncal LAN router');
     check(r.includes('GigabitEthernet0/0/3'),'Ethernet Entel externo');
     check(r.includes('TenGigabitEthernet0/0/4'),'SFP GTD externo');
     check(!r.includes('Cellular0/1/'),'interfaces celulares integradas inexistentes');
     check(r.includes('permit 10.70.'+n+'.176 0.0.0.15'),'NAT VLAN40');
     check(r.includes('access-class MGMT-SOURCES in'),'ACL VTY de administración');
     check(!r.includes('MGMT-ACL in'),'ACL de administración que bloquearía VLAN30');
     check(!r.includes('md5 7 104D000A0618'),'OSPF MD5 heredado');
     check(sw1.includes('10.70.'+n+'.162 255.255.255.240'),'IP gestión SW1');
     check(sw2.includes('10.70.'+n+'.163 255.255.255.240'),'IP gestión SW2');
     check(sw1.includes('interface GigabitEthernet1/0/44')&&sw1.includes('description Management PA-1410'),'puerto de gestión del PA-1410');
     check(sw1.includes('ip default-gateway 10.70.'+n+'.161'),'gateway gestión de switch');
     check(sw1.includes('no ip routing'),'switch de acceso L2');
     check(sw2.includes('RESERVADO-SIN-ENLACE-ROUTER'),'SW2 sin segundo uplink ficticio');
     check(sw1.includes('interface Port-channel1')&&
       (sw1.match(/channel-group 1 mode active/g)||[]).length===2,'Port-channel1 SW1 incompleto');
     check(sw2.includes('interface Port-channel1')&&
       (sw2.match(/channel-group 1 mode active/g)||[]).length===2,'Port-channel1 SW2 incompleto');
     check(fw.includes('10.70.'+n+'.164'),'PA en VLAN gestión 30');
     check(!fw.includes('10.70.'+n+'.178'),'PA en subred invitados por error');
     check(!fw.includes('set network ike gateway'),'IPsec duplicado en PA');
     check(genFWIfaces(s).includes('virtual-wire'),'tipo de firewall');
     check(genIfBrief(s).includes('GigabitEthernet0/0/0.10'),'show interface brief coincide con configuración');
     check(genRouterVLAN(s).includes('10.70.'+n+'.1/25'),'show vlan coincide con máscara');
     for(const pc of getPCs(s)){
       const oct=Number(pc.ip.split('.').at(-1));
       check(oct>=2&&oct<=126,'PC fuera de /25: '+pc.ip);
       check(!addresses.has(pc.ip),'IP de PC duplicada '+pc.ip);
       addresses.add(pc.ip);
     }
     for(const host of [1,129,161,162,163,164,177]){
       const ip='10.70.'+n+'.'+host;
       check(!addresses.has(ip),'IP equipo coincide con otra PC: '+ip);
     }
   }
   return {failures,sites:SEDES.length,pcs:addresses.size};
 });
 expect(report.sites).toBe(23);
 expect(report.pcs).toBeGreaterThan(500);
 expect(report.failures).toEqual([]);
});

test('Conmutación LAN: Po1 sobre dos cables, uplink SW1 y recuperación',async({page})=>{
 await setOperational(page);
 const report=await page.evaluate(()=>{
   const id='s01',a=deviceCliSession(id,'sw1'),b=deviceCliSession(id,'sw2');
   const issues=[],check=(ok,msg)=>{if(!ok)issues.push(msg)};
   a.interfaces={};b.interfaces={};
   check(isSwitchPathAvailable(id,1)&&isSwitchPathAvailable(id,2),'estado inicial');
   check(isSiteLanAvailable(id),'LAN inicial');
   b.interfaces['Gi1/0/45']={shutdown:true};
   check(isSwitchPathAvailable(id,1),'SW1 debe continuar conectado');
   check(isSwitchPathAvailable(id,2),'SW2 debe sobrevivir gracias a Gi46');
   check(genSwitchDetail(SEDES.find(s=>s.id===id),'sw2','show etherchannel summary').includes('Gi1/0/45(D)'),'Miembro Gi45 debe indicar caída');
   b.interfaces['Gi1/0/46']={shutdown:true};
   check(!isSwitchPathAvailable(id,2),'SW2 debe desconectarse cuando cae el segundo miembro');
   check(isSwitchPathAvailable(id,1),'SW1 sigue conectado al firewall');
   b.interfaces['Gi1/0/45']={shutdown:false};
   check(isSwitchPathAvailable(id,2),'SW2 debe recuperar el servicio por Gi45');
   b.interfaces['Gi1/0/46']={shutdown:false};
   a.interfaces['Gi1/0/1']={shutdown:true};
   check(!isSwitchPathAvailable(id,1)&&!isSwitchPathAvailable(id,2),'sin uplink SW1, ambos aislados');
   check(!isSiteLanAvailable(id),'LAN debe indicarse caída');
   a.interfaces['Gi1/0/1']={shutdown:false};
   check(isSwitchPathAvailable(id,1)&&isSwitchPathAvailable(id,2),'restauración uplink');
   a.interfaces={};b.interfaces={};
   return issues;
 });
 expect(report).toEqual([]);
});

test('ACL y segmentación: invitados aislados, DNS explícito y gestión sólo desde VLAN30 central',async({page})=>{
 await setOperational(page);
 const report=await page.evaluate(()=>{
   const errors=[];
   for(const s of SEDES){
     const cfg=genRouterRunningConfig(s);
     const guest=cfg.indexOf('ip access-list extended GUEST-ACL');
     const deny=cfg.indexOf('deny ip any 10.70.0.0 0.0.255.255',guest);
     const dns=cfg.indexOf('permit udp any any eq 53',guest);
     const web=cfg.indexOf('permit tcp any any eq 443',guest);
     if(!(guest>=0&&deny>guest&&dns>deny&&web>dns))errors.push(s.id+' GUEST ACL orden');
     if(!cfg.includes('permit 10.70.0.160 0.0.0.15'))errors.push(s.id+' MGMT SOURCES');
     if(!cfg.includes('ip access-group GUEST-ACL in'))errors.push(s.id+' ACL en entrada VLAN40');
     if(!cfg.includes('ip nat inside'))errors.push(s.id+' NAT inside ausente');
     if(cfg.includes('permit ip any any'))errors.push(s.id+' ACL excesivamente permisiva');
   }
   return errors;
 });
 expect(report).toEqual([]);
});

test('Consola operativa router, switch y NGFW coincide con topología y estados',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await setOperational(page);
 const testCmd=async(type,commands)=>{
   await page.evaluate(type=>{
     document.getElementById('audit-cli')?.remove();
     const host=document.createElement('div');host.id='audit-cli';
     host.innerHTML=genDeviceCLI(SEDES.find(s=>s.id==='s01'),type);
     document.body.appendChild(host);
   },type);
   const input=page.locator('#audit-cli #device-term-input');
   const output=page.locator('#audit-cli #device-term-out');
   if(type!=='fw'){await input.fill('terminal length 0');await input.press('Enter')}
   else{await input.fill('set cli pager off');await input.press('Enter')}
   for(const [cmd,expected] of commands){
     await input.fill(cmd);await input.press('Enter');
     await expect(output).toContainText(expected);
   }
 };
 await testCmd('router',[
   ['show ip interface brief','GigabitEthernet0/0/0.10'],
   ['show ip ospf neighbor','Tunnel100'],
   ['show ip bgp summary','BGP is not configured'],
   ['show standby brief','HSRP no configurado']
 ]);
 await testCmd('sw1',[
   ['show ip interface brief','10.70.1.162'],
   ['show interfaces trunk','Po1 on 802.1q trunking 999'],
   ['show power inline','alimentación externa']
 ]);
 await testCmd('sw2',[
   ['show ip interface brief','10.70.1.163'],
   ['show etherchannel summary','Po1(SU)']
 ]);
 await testCmd('fw',[
   ['show system info','10.70.1.164'],
   ['show routing route','Virtual wire'],
   ['show vpn ike-sa','No local PAN-OS IKEv2 SA'],
   ['show security policy','VLAN 40 Invitados']
 ]);
 expect(errors).toEqual([]);
});

test('Tablas de rutas OSPF cambian en todas las sedes ante caída y no inventan /24',async({page})=>{
 await setOperational(page);
 const issues=await page.evaluate(()=>{
   const issues=[];
   for(const site of SEDES){
     const n=site.num,route=genRouterRoutes(site);
     if(route.includes('S* 0.0.0.0/0')===false)issues.push(site.id+' default primaria');
     if(route.includes('O IA 10.70.'))issues.push(site.id+' sumarización /24 no configurada');
     const peer=SEDES.find(s=>s.id!==site.id);
     if(!route.includes('O 10.70.'+peer.num+'.0/25'))issues.push(site.id+' OSPF remoto users');
     if(!route.includes('O 10.70.'+peer.num+'.160/28'))issues.push(site.id+' OSPF remoto gestión');
     ST.links[site.id].starlink='caido';recompute(site.id);
     if(activeLink(site.id)!=='kuiper')issues.push(site.id+' failover Leo');
     ST.links[site.id].kuiper='caido';ST.links[site.id].g5='caido';ST.links[site.id].g4='caido';
     recompute(site.id);
     if(genRouterRoutes(site).includes('S* 0.0.0.0/0'))issues.push(site.id+' default sin WAN');
     ST.links[site.id]={starlink:'activo',kuiper:'standby',g5:'standby',g4:'standby'};recompute(site.id);
   }
   return issues;
 });
 expect(issues).toEqual([]);
});


test('Diagnósticos Cisco y PAN-OS no inventan vecinos BGP ni sesiones VPN',async({page})=>{
 await setOperational(page);
 const result=await page.evaluate(()=>{
   const site=SEDES.find(s=>s.id==='s01');
   const issues=[];
   const bgp=genShowBrief(site,'router','show ip bgp summary');
   const sla=genShowBrief(site,'router','show ip sla configuration');
   const bfd=genShowBrief(site,'router','show bfd neighbors');
   const sa=genShowBrief(site,'router','show crypto ikev2 sa');
   const ike=genShowBrief(site,'fw','show vpn ike-sa');
   const ha=genShowBrief(site,'fw','show high-availability state');
   const sessions=genShowBrief(site,'fw','show session all filter');
   if(!bgp.includes('BGP is not configured')||bgp.includes('Established'))issues.push('BGP ficticio');
   for(const gateway of ['100.64.1.1','100.64.1.5','100.85.1.1','100.92.1.1'])if(!sla.includes(gateway))issues.push('IP SLA incoherente '+gateway);
   if(!bfd.includes('No BFD sessions'))issues.push('BFD no configurado declarado activo');
   if(sa.includes('ESTABLISHED'))issues.push('IKEv2 falsamente establecido');
   if(ike.includes('Active'))issues.push('PAN-OS IKE SA falsa');
   if(ha.includes('Sync: complete'))issues.push('HA PAN-OS sin par');
   if(sessions.includes('Session 1'))issues.push('Sesiones inspeccionadas inexistentes');
   return issues;
 });
 expect(result).toEqual([]);
});

test('Diagnósticos OSPF, CEF y puertos Cisco reflejan interfaces configuradas en las 23 sedes',async({page})=>{
 await setOperational(page);
 const result=await page.evaluate(()=>{
   const issues=[];
   for(const site of SEDES){
     const n=site.num;
     const ospf=genShowBrief(site,'router','show ip ospf interface brief');
     const cef=genShowBrief(site,'router','show ip cef');
     const protocols=genShowBrief(site,'router','show ip protocols');
     const description=genShowBrief(site,'router','show interfaces description');
     const neighbors=genShowBrief(site,'router','show ip ospf neighbor');
     const ntp=genShowBrief(site,'router','show ntp status');
     if(!ospf.includes('Gi0/0/0.10')||!ospf.includes('10.70.'+n+'.1/25'))issues.push(site.id+': OSPF LAN incorrecta');
     if(ospf.includes('Tunnel0 ')||ospf.includes('Gi0/0/2.10')||ospf.includes('10.70.'+n+'.1/24'))issues.push(site.id+': OSPF interfaces obsoletas');
     if(!cef.includes('Gi0/0/0.10')||cef.includes('Gi0/0/2.10'))issues.push(site.id+': CEF LAN incorrecto');
     if(!cef.includes('GigabitEthernet0/0/1'))issues.push(site.id+': CEF WAN principal ausente');
     if(!protocols.includes(routerIdentity(site).loopback))issues.push(site.id+': router ID OSPF incorrecto');
     if(!description.includes('GigabitEthernet0/0/0')||!description.includes('TenGigabitEthernet0/0/4'))issues.push(site.id+': inventario WAN LAN incompleto');
     if(neighbors.includes('Tunnel0')||neighbors.includes('FULL/ -'))issues.push(site.id+': vecindad OSPF fabricada');
     if(ntp.includes('Clock is synchronized'))issues.push(site.id+': estado NTP fabricado');
   }
   return issues;
 });
 expect(result).toEqual([]);
});


test('Spanning Tree y estados físicos de switches coherentes en las 23 sedes', async ({page}) => {
  await setOperational(page);
  const issues = await page.evaluate(() => {
    const issues = [];
    for(const site of SEDES){
      const a=deviceCliSession(site.id,'sw1'), b=deviceCliSession(site.id,'sw2');
      delete a.interfaces['Gi1/0/45']; delete a.interfaces['Gi1/0/46'];
      delete b.interfaces['Gi1/0/45']; delete b.interfaces['Gi1/0/46'];
      delete a.interfaces.Po1; delete b.interfaces.Po1;
      const sw1=genSwitchDetail(site,'sw1','show spanning-tree');
      const sw2=genSwitchDetail(site,'sw2','show spanning-tree');
      if(!sw1.includes('Po1 Desg FWD') || sw1.includes('Gi1/0/1 Root FWD'))
        issues.push(site.id+': SW1 raíz STP incorrecta');
      if(!sw2.includes('Po1 Root FWD'))
        issues.push(site.id+': SW2 Po1 no es root port');
      const brief=genShowBrief(site,'sw2','show ip interface brief');
      if(!brief.includes('GigabitEthernet1/0/1') || !brief.includes('administratively down'))
        issues.push(site.id+': SW2 informa Gi1/0/1 activo, aunque está reservado y shutdown');
      b.interfaces['Gi1/0/45']={shutdown:true};
      if(!isSwitchStackLinkAvailable(site.id)) issues.push(site.id+': la caída Gi45 no debe derribar Po1');
      const degraded=getSwitchPortRecords(site,2).find(row=>row.port===45);
      if(degraded.status==='connected') issues.push(site.id+': Gi45 remoto caído figura conectado');
      b.interfaces['Gi1/0/46']={shutdown:true};
      if(isSwitchStackLinkAvailable(site.id)) issues.push(site.id+': ambos miembros caídos');
      if(genSwitchDetail(site,'sw2','show spanning-tree').includes('Po1 Root FWD'))
        issues.push(site.id+': SW2 conserva root port desconectado');
      delete b.interfaces['Gi1/0/45'];delete b.interfaces['Gi1/0/46'];
    }
    return issues;
  });
  expect(issues).toEqual([]);
});


test('RIB Cisco: subredes WAN físicas, distancias de backup y caída del concentrador', async ({page})=>{
 await setOperational(page);
 const issues=await page.evaluate(()=>{
   const issues=[];
   const cm=SEDES.find(s=>s.id==='cm');
   const s=SEDES.find(site=>site.id==='s01'),id=s.id;
   const state={...ST.links[id]},cmState={...ST.links.cm};
   const route=()=>genRouterRoutes(s);
   let rib=route();
   for(const net of ['100.64.1.0/30','100.64.1.4/30','100.85.1.0/30','100.92.1.0/30'])
     if(!rib.includes(net))issues.push('RIB omite subred WAN conectada '+net);
   if(!rib.includes('S* 0.0.0.0/0 [1/0]'))issues.push('distancia primaria incorrecta');
   ST.links[id].starlink='caido';recompute(id);rib=route();
   if(!rib.includes('S* 0.0.0.0/0 [10/0]'))issues.push('distancia de Leo no coincide con running-config');
   ST.links[id].kuiper='caido';recompute(id);rib=route();
   if(!rib.includes('S* 0.0.0.0/0 [20/0]'))issues.push('distancia de 5G no coincide');
   ST.links[id].g5='caido';recompute(id);rib=route();
   if(!rib.includes('S* 0.0.0.0/0 [30/0]'))issues.push('distancia de 4G no coincide');
   ST.links[id]={...state};recompute(id);
   if(!route().includes('O 10.70.2.0/25'))issues.push('faltan rutas remotas iniciales');
   ST.links.cm={starlink:'caido',kuiper:'caido',g5:'caido',g4:'caido'};recompute('cm');
   rib=route();
   if(rib.includes('O 10.70.2.0/25'))issues.push('rutas de sucursales continúan instaladas tras caída total del concentrador');
   if(!rib.includes('S* 0.0.0.0/0'))issues.push('salida a Internet sucursal cae indebidamente con el hub');
   ST.links.cm={...cmState};recompute('cm');
   if(!route().includes('O 10.70.2.0/25'))issues.push('rutas overlay no recuperan tras reconexión del hub');
   return issues;
 });
 expect(issues).toEqual([]);
});


test('Cisco IKEv2 AES-GCM y SLA responden correctamente al shutdown WAN', async ({page})=>{
 await setOperational(page);
 const failures=await page.evaluate(()=>{
   const failures=[];
   for(const site of SEDES){
     const config=genRouterRunningConfig(site);
     const begin=config.indexOf('crypto ikev2 proposal IKEV2-PROP');
     const end=config.indexOf('crypto ikev2 policy',begin);
     const proposal=config.slice(begin,end);
     if(!proposal.includes('encryption aes-gcm-256') || !proposal.includes('prf sha256'))
       failures.push(site.id+': IKEv2 carece de PRF AES-GCM');
     if(proposal.includes('integrity sha256'))
       failures.push(site.id+': no se debe exigir integrity SHA en AES-GCM IKEv2');
     const session=deviceCliSession(site.id,'router');
     session.interfaces['GigabitEthernet0/0/1']={shutdown:true};
     const stats=genShowBrief(site,'router','show ip sla statistics');
     if(!stats.includes('100.64.'+site.num+'.1 Unreachable'))
       failures.push(site.id+': IP SLA declara alcanzable una WAN administrativamente apagada');
     delete session.interfaces['GigabitEthernet0/0/1'];
     if(!genShowBrief(site,'router','show ip sla statistics').includes('100.64.'+site.num+'.1 Reachable'))
       failures.push(site.id+': IP SLA no recupera tras no shutdown');
   }
   return failures;
 });
 expect(failures).toEqual([]);
});


test('Tráfico entre sucursales respeta caída del hub CM tanto en grafo como en RIB', async ({page})=>{
 await setOperational(page);
 const report=await page.evaluate(()=>{
  const failures=[];
  const source=SEDES.find(s=>s.id==='s01'), target=SEDES.find(s=>s.id==='s02');
  const srcPc=getPCs(source)[0], dstPc=getPCs(target)[0];
  const cmLinks={...ST.links.cm};
  for(const s of [source,target]){
    ST.links[s.id]={starlink:'caido',kuiper:'caido',g5:'activo',g4:'standby'};
    recompute(s.id);
  }
  const before=buildPacketRoute(source,target,true,srcPc,dstPc);
  if(!before.length) failures.push('No existe ruta intersede inicial vía 5G');
  ST.links.cm={starlink:'caido',kuiper:'caido',g5:'caido',g4:'caido'};recompute('cm');
  const after=buildPacketRoute(source,target,true,srcPc,dstPc);
  if(after.length)failures.push('El simulador permite tráfico a través del hub desconectado');
  if(genRouterRoutes(source).includes('O 10.70.2.0/25'))
    failures.push('La RIB anuncia rutas OSPF tras caída del concentrador');
  ST.links.cm=cmLinks;recompute('cm');
  if(!buildPacketRoute(source,target,true,srcPc,dstPc).length)
    failures.push('El tráfico no se recupera al restaurar el hub');
  return failures;
 });
 expect(report).toEqual([]);
});


test('Troncales de AP respetan VLAN 10/40 y native 999 en todas las sedes',async({page})=>{
 await setOperational(page);
 const failures=await page.evaluate(()=>{
  const failures=[];
  for(const site of SEDES)for(const swN of [1,2]){
   const cfg=genSwitchRunningConfig(site,swN);
   const trunk=genSwitchDetail(site,'sw'+swN,'show interfaces trunk');
   for(const port of [33,34]){
    const start=cfg.indexOf('interface GigabitEthernet1/0/'+port);
    const end=cfg.indexOf('interface ',start+1);
    const section=cfg.slice(start,end<0?undefined:end);
    if(!section.includes('switchport mode trunk') ||
       !section.includes('switchport trunk native vlan 999') ||
       !section.includes('switchport trunk allowed vlan 10,40'))
       failures.push(site.id+'/SW'+swN+'/Gi'+port+': running-config AP trunk incorrecta');
    if(!trunk.includes('Gi1/0/'+port+' 10,40'))
       failures.push(site.id+'/SW'+swN+'/Gi'+port+': salida show trunk inventa VLAN');
   }
  }
  return failures;
 });
 expect(failures).toEqual([]);
});

test('IPAM: DNS, TACACS, NTP y monitoreo CM sin colisiones con PCs ni gateways',async({page})=>{
 await setOperational(page);
 const results=await page.evaluate(()=>{
   const issues=[],cm=SEDES.find(site=>site.id==='cm');
   const ipToRole=Object.entries(CENTRAL_SERVICES).map(([role,ip])=>({role,ip}));
   const occupied=new Set(getPCs(cm).map(pc=>pc.ip));
   const gatewayIps=new Set(['10.70.0.1','10.70.0.129','10.70.0.161','10.70.0.177','10.70.0.162','10.70.0.163','10.70.0.164']);
   const used=new Set();
   for(const {role,ip} of ipToRole){
     if(used.has(ip))issues.push(role+': dirección de infraestructura repetida');
     used.add(ip);
     if(occupied.has(ip))issues.push(role+': dirección colisiona con un PC');
     if(gatewayIps.has(ip))issues.push(role+': dirección colisiona con un gateway o equipo');
     const octet=Number(ip.split('.')[3]);
     if(!ip.startsWith('10.70.0.')||octet<=1||octet>=127)issues.push(role+': dirección fuera del segmento 10.70.0.0/25');
   }
   for(const site of SEDES){
     const router=genRouterRunningConfig(site);
     const sw=genSwitchRunningConfig(site,1);
     const fw=genFWCommand(site,'show running-config');
     const ntp=genShowBrief(site,'router','show ntp status');
     if(!router.includes('ip name-server '+CENTRAL_SERVICES.dns1)||
        !router.includes('ip name-server '+CENTRAL_SERVICES.dns2))issues.push(site.id+': DNS Cisco incorrectos');
     if(!router.includes('address ipv4 '+CENTRAL_SERVICES.tacacs1)||
        !router.includes('address ipv4 '+CENTRAL_SERVICES.tacacs2))issues.push(site.id+': TACACS Cisco incorrectos');
     if(!sw.includes('ntp server '+CENTRAL_SERVICES.ntp1)||
        !sw.includes('address ipv4 '+CENTRAL_SERVICES.tacacs1))issues.push(site.id+': infraestructura SW incorrecta');
     if(!fw.includes('dns-setting servers primary '+CENTRAL_SERVICES.dns1)||
        !fw.includes('ntp-servers primary-ntp-server '+CENTRAL_SERVICES.ntp1))issues.push(site.id+': servicios PA incorrectos');
     if(!ntp.includes(CENTRAL_SERVICES.ntp1)||!ntp.includes(CENTRAL_SERVICES.ntp2))issues.push(site.id+': diagnóstico NTP inconsistente');
   }
   return {issues,hosts:ipToRole.length,cmPcs:getPCs(cm).length,sites:SEDES.length};
 });
 expect(results.issues).toEqual([]);
 expect(results.hosts).toBe(8);
 expect(results.cmPcs).toBe(55);
 expect(results.sites).toBe(23);
});
