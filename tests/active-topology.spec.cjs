const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
test('Perfil activo es StackWise Layer3 en 23 sedes y 650 PCs, sin virtual-wire/Po1',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 const result=await page.evaluate(()=>{
  const failures=[];let pcs=0;
  for(const site of SEDES){
   pcs+=getPCs(site).length;
   const n=site.num,router=genRouterRunningConfig(site),sw1=genSwitchRunningConfig(site,1),
     sw2=genSwitchRunningConfig(site,2),pa=genFWCommand(site,'show running-config'),rib=genRouterRoutes(site);
   const check=(x,msg)=>{if(!x)failures.push(site.id+': '+msg)};
   check(window.ActiveProfile.enabled(),'StackWise operational mode disabled');
   check(router.includes('interface Port-channel10'),'router transit Po10 missing');
   check(router.includes('TenGigabitEthernet0/0/5'),'router second 10G absent');
   check(!router.includes('GigabitEthernet0/0/0.10'),'router has legacy LAN gateway');
   check(!router.includes('virtual-wire'),'router still mentions vwire');
   check(sw1.includes('Port-channel20'),'stack Po20 missing');
   check(sw1.includes('Gi'+'gabitEthernet2/0/45'),'stack member 2 physical not provisioned');
   check(sw2.includes('switch 2 provision c9200l-48t-4g'),'SW2 does not show same logical stack');
   check(!sw1.includes('channel-group 1 mode active'),'legacy peer LACP not removed');
   check(pa.includes('aggregate-ethernet ae2 layer3'),'PA not Layer3');
   check(!pa.includes('virtual-wire'),'PA still vwire');
   check(!pa.includes('system ip-address 10.70.'+n+'.164'),'overlapping PA MGT and ae2.30');
   check(rib.includes('S 10.70.'+n+'.0/25 [1/0] via 10.72.'+n+'.2'),'router LAN route not via PA');
   check(rib.includes('C 10.72.'+n+'.0/30'),'Po10 connected subnet missing');
   check(!rib.includes('C 10.70.'+n+'.0/25'),'router falsely has directly connected LAN');
   check(genFWCommand(site,'show routing route').includes('10.72.'+n+'.1'),'PA lacks Cisco default route');
   check(genSwitchDetail(site,'sw1','show etherchannel summary').includes('Po20'),'LACP summary not Po20');
   check(genSwitchDetail(site,'sw2','show switch').includes('StackWise'),'SW2 no stack summary');
   check(genRouterDetail(site,'show ip interface brief').includes('TenGigabitEthernet0/0/5'),'interface status wrong');
  }
  return {failures,pcs,sites:SEDES.length};
 });
 expect(result.failures).toEqual([]);
 expect(result.pcs).toBe(650);
 expect(result.sites).toBe(23);
 expect(errors).toEqual([]);
});
test('Perfil activo: fallo de SW1 conserva SW2; fallo del C8300 conserva LAN y gestión PA',async({page})=>{
 await page.goto(url);
 const results=await page.evaluate(()=>{
  const failures=[],site=SEDES.find(s=>s.id==='s01'),pc1=getPCs(site).find(p=>p.sw===1),
    pc2=getPCs(site).find(p=>p.sw===2),lab=getRedundantLabState(site.id);
  const check=(x,msg)=>{if(!x)failures.push(msg)};
  check(isPCNetworkAvailable(site.id,pc1),'PC SW1 initial unreachable');
  check(isPCNetworkAvailable(site.id,pc2),'PC SW2 initial unreachable');
  window.RedundantLab.setNode(lab,'sw1',false);
  check(!isPCNetworkAvailable(site.id,pc1),'SW1 failed but PC1 marked online');
  check(isPCNetworkAvailable(site.id,pc2),'SW2 loses connectivity when SW1 fails');
  check(isSwitchPathAvailable(site.id,2),'SW2 path to PA lost');
  check(!isSwitchPathAvailable(site.id,1),'SW1 path stays up');
  window.RedundantLab.setNode(lab,'sw1',true);
  window.RedundantLab.setNode(lab,'router',false);
  check(isPCNetworkAvailable(site.id,pc2),'PC SW2 lost local gateway when router failed');
  check(!isSiteLanAvailable(site.id),'site falsely WAN reachable without Cisco router');
  check(genFWCommand(site,'show routing route').includes('unreachable'),'PA does not reflect router failure');
  const local=buildPacketRoute(site,site,true,pc1,pc2);
  check(local.length>0,'local PC-SW1 to PC-SW2 path should survive router failure');
  window.RedundantLab.setNode(lab,'router',true);
  window.RedundantLab.setLink(lab,'T1',false);
  check(isSiteLanAvailable(site.id),'Po10 failover lost after one cable');
  window.RedundantLab.setLink(lab,'T2',false);
  check(!isSiteLanAvailable(site.id),'Po10 both down still WAN available');
  check(isPCNetworkAvailable(site.id,pc2),'LAN gateway should survive both Po10 members down');
  window.RedundantLab.setLink(lab,'T1',true);
  check(isSiteLanAvailable(site.id),'Po10 not recovered');
  return failures;
 });
 expect(results).toEqual([]);
});
test('Perfil activo: falla de ambos StackWise aislada, Po20 distribuido y CLI por miembro',async({page})=>{
 await page.goto(url);
 const r=await page.evaluate(()=>{
  const failures=[],site=SEDES.find(s=>s.id==='s02'),lab=getRedundantLabState(site.id);
  const check=(x,msg)=>{if(!x)failures.push(msg)};
  let summary=genSwitchDetail(site,'sw2','show etherchannel summary');
  check(summary.includes('Gi2/0/45(P)'),'no active member2 LACP in Po20');
  window.RedundantLab.setLink(lab,'D1',false);
  window.RedundantLab.setLink(lab,'D2',false);
  check(isPCNetworkAvailable(site.id,getPCs(site).find(p=>p.sw===1)),
     'SW1 cannot reach PA via stack member2 when own Po20 cables fail');
  window.RedundantLab.setLink(lab,'D3',false);
  window.RedundantLab.setLink(lab,'D4',false);
  check(!isSiteLanAvailable(site.id),'Po20 all cables fail but site still reachable');
  window.RedundantLab.setLink(lab,'D4',true);
  check(isSiteLanAvailable(site.id),'Po20 cannot recover with one active cable');
  window.RedundantLab.setLink(lab,'STACK-A',false);
  check(isSwitchStackLinkAvailable(site.id),'single StackWise cable failure should retain connectivity');
  window.RedundantLab.setLink(lab,'STACK-B',false);
  check(!isSwitchStackLinkAvailable(site.id),'both StackWise cables down but stack still functional');
  check(!isPCNetworkAvailable(site.id,getPCs(site)[0]),
     'ambiguous partition should fail closed in gateway connectivity');
  check(genSwitchDetail(site,'sw1','show switch').includes('PARTITION'),'partition not diagnosed');
  window.RedundantLab.setLink(lab,'STACK-A',true);
  check(isSwitchStackLinkAvailable(site.id),'stack did not recover');
  return failures;
 });
 expect(r).toEqual([]);
});
test('Perfil anterior permanece disponible y aislado para comparar modelos',async({page})=>{
 await page.goto(url);
 const r=await page.evaluate(()=>{
  const site=SEDES.find(s=>s.id==='s01');
  const modern={router:genRouterRunningConfig(site),stack:genSwitchRunningConfig(site,1)};
  ST.mode='antes';
  const classic={router:genRouterRunningConfig(site),sw1:genSwitchRunningConfig(site,1)};
  ST.mode='despues';
  return {modern,classic,modernAgain:genRouterRunningConfig(site)};
 });
 expect(r.modern.router).toContain('Port-channel10');
 expect(r.modern.stack).toContain('Port-channel20');
 expect(r.classic.router).toContain('GigabitEthernet0/0/0.10');
 expect(r.classic.sw1).toContain('Port-channel1');
 expect(r.modernAgain).toBe(r.modern.router);
});

test('Dibujo físico de las 23 sedes usa Po10, ae1/ae2, Po20 y dos cables StackWise reales del modelo',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 const failures=await page.evaluate(()=>{
   const fails=[];
   for(const site of SEDES){
     const svg=renderTopoTab(site);
     const names=['Cisco Catalyst C8300','Palo Alto PA-1410','Port-channel10',
       'StackWise-80 · 2 cables traseros','Catalyst 9200L · miembro 1',
       'Catalyst 9200L · miembro 2','Gi1/0/45','Gi2/0/45',
       'Starlink Business','Amazon Leo','Entel 5G','GTD 4G','VLAN 30: gestión'];
     for(const term of names)if(!svg.includes(term))fails.push(site.id+': topología omite '+term);
     if(svg.includes('Stack 10G')||svg.includes('virtual-wire')||svg.includes('SW1-SW2 Po1'))
        fails.push(site.id+': etiqueta histórica incorrecta');
     if((svg.match(/class="topo-pc"/g)||[]).length!==PC_COUNT[site.id])
        fails.push(site.id+': puntos PC no coinciden con inventario');
   }
   return fails;
 });
 expect(failures).toEqual([]);
 await page.evaluate(()=>openSedeModal('s01'));
 await page.locator('#sm-tabs button').filter({hasText:/topolog/i}).click();
 const svg=page.locator('#sm-body .topo-svg');
 await expect(svg).toBeVisible();
 await expect(svg).toContainText('StackWise-80 · 2 cables traseros');
 await expect(svg).toContainText('Po10');
 await expect(svg).toContainText('Palo Alto PA-1410');
 await expect(svg.locator('g.topo-pc')).toHaveCount(30);
 expect(errors).toEqual([]);
});
test('Consolas principales no anuncian sesiones IPsec o licencias PA falsamente validadas',async({page})=>{
 await page.goto(url);
 const failures=await page.evaluate(()=>{
   const fails=[];
   for(const s of SEDES){
     const n=s.num,sw=genSwitchVersionFull(s,1),
       oldIke=genRouterDetail(s,'show crypto ikev2 sa'),
       fw=genFWThreat(s),policy=genFWCommand(s,'show rulebase security rules'),
       ifaces=genFWCommand(s,'show interface all');
     if(sw.includes('no hay StackWise'))fails.push(s.id+': switch reports independent members');
     if(!sw.includes('StackWise-80'))fails.push(s.id+': show version missing logical stack');
     if(!oldIke.includes('no established SA claimed'))fails.push(s.id+': router does not disclose unverified SAs');
     if(!fw.includes('NO verificados'))fails.push(s.id+': threat licenses are fabricated');
     if(!policy.includes('DENY-GUEST-TO-CORP'))fails.push(s.id+': PA zone rules missing');
     if(!ifaces.includes('ae2.30 10.70.'+n+'.161/28'))fails.push(s.id+': PA management L3 gateway incorrect');
     if(ifaces.includes('10.70.'+n+'.164/28'))fails.push(s.id+': PA MGT data overlap');
     if(!genRouterTrackOutput(s,'show track').includes('Two remote probes per ISP'))fails.push(s.id+': no IP SLA unverified warning');
   }
   return fails;
 });
 expect(failures).toEqual([]);
});

test('Los paquetes intersede no eluden las políticas PAN-OS aunque haya WAN operativa',async({page})=>{
 await page.goto(url);
 const r=await page.evaluate(()=>{
   const issues=[],cm=SEDES.find(s=>s.id==='cm'),s1=SEDES.find(s=>s.id==='s01'),
     s2=SEDES.find(s=>s.id==='s02');
   const p1=getPCs(s1)[0],p2=getPCs(s2)[0],pcCM=getPCs(cm)[0];
   const check=(x,msg)=>{if(!x)issues.push(msg)};
   check(isSiteLanAvailable(s1.id)&&isSiteLanAvailable(s2.id)&&isSiteLanAvailable(cm.id),
      'physical WAN should be available before the ACL check');
   const deny=packetPolicyDecision(s1,s2,p1,p2);
   check(deny.action==='deny','branch-to-branch ICMP not denied by PA');
   check(buildPacketRoute(s1,s2,true,p1,p2).length===0,'Packet graph routed unauthorized site-to-site ICMP');
   check(packetPolicyDecision(s1,cm,p1,pcCM).action==='deny','branch-to-CM PC ping should be denied');
   check(buildPacketRoute(s1,cm,true,p1,pcCM).length===0,'CM PC ping bypasses policy');
   check(buildPacketRoute(cm,s1,true,pcCM,p1).length===0,'CM-initiated ICMP bypasses policy');
   check(buildPacketRoute(s1,s1,true,p1,getPCs(s1)[1]).length>0,'local same-site connectivity improperly denied');
   const dns=window.RedundantLab.evaluateSitePanPolicy(1,'USERS','TRANSIT','dns',
      '10.70.0.110',p1.ip);
   const cmPolicy=window.RedundantLab.evaluateSitePanPolicy(0,'TRANSIT','USERS','dns',
      '10.70.0.110',p1.ip);
   check(dns.action==='allow'&&cmPolicy.action==='allow','explicit CM DNS exception was blocked');
   check(!getPCs(cm).some(pc=>pc.ip==='10.70.0.110'),
      'Central DNS address must remain reserved until a real server is provisioned');
   return issues;
 });
 expect(r).toEqual([]);
});

test('Conmutación local VLAN10 sobrevive a caída PA, Cisco y Po20; StackWise es el único L2 intermiembro',async({page})=>{
 test.setTimeout(90000);
 await page.goto(url);
 const issues=await page.evaluate(()=>{
   const problems=[],assert=(yes,msg)=>{if(!yes)problems.push(msg)};
   for(const site of SEDES){
     const pcs=getPCs(site),same=pcs.filter(pc=>pc.sw===1),
       other=pcs.find(pc=>pc.sw===2);
     const lab=getRedundantLabState(site.id);
     const local=(a,b)=>buildPacketRoute(site,site,false,a,b);
     const samePath=local(same[0],same[1]);
     const across=local(same[0],other);
     assert(samePath.length===3,site.id+': two hosts on same switch lack L2 path');
     assert(across.length===4,site.id+': stacked switches lack direct L2 path');
     assert(!across.some(n=>n.kind==='firewall'||n.kind==='router'),site.id+': L2 route crosses L3 gateway');
     window.RedundantLab.setNode(lab,'firewall',false);
     assert(!isPCNetworkAvailable(site.id,same[0]),site.id+': lost PA gateway still marked available');
     assert(local(same[0],same[1]).length===3,site.id+': local L2 incorrectly depends on PA');
     assert(local(same[0],other).length===4,site.id+': StackWise L2 incorrectly depends on PA');
     window.RedundantLab.setNode(lab,'firewall',true);
     window.RedundantLab.setNode(lab,'router',false);
     assert(local(same[0],other).length===4,site.id+': local L2 incorrectly depends on Cisco');
     window.RedundantLab.setNode(lab,'router',true);
     for(const id of ['D1','D2','D3','D4'])window.RedundantLab.setLink(lab,id,false);
     assert(local(same[0],other).length===4,site.id+': local L2 incorrectly depends on Po20');
     for(const id of ['D1','D2','D3','D4'])window.RedundantLab.setLink(lab,id,true);
     window.RedundantLab.setLink(lab,'STACK-A',false);
     assert(local(same[0],other).length===4,site.id+': one rear StackWise cable failure cut L2');
     window.RedundantLab.setLink(lab,'STACK-B',false);
     assert(local(same[0],other).length===0,site.id+': both StackWise cables failed but L2 crosses members');
     assert(local(same[0],same[1]).length===3,site.id+': local member L2 lost on stack partition');
     window.RedundantLab.setLink(lab,'STACK-A',true);
     window.RedundantLab.setLink(lab,'STACK-B',true);
     window.RedundantLab.setNode(lab,'sw1',false);
     assert(local(same[0],same[1]).length===0,site.id+': powered-down SW1 still routes L2');
     assert(local(other,pcs.filter(pc=>pc.sw===2)[1]).length===3,
       site.id+': SW2 hosts lost same-member L2 when SW1 died');
     window.RedundantLab.setNode(lab,'sw1',true);
   }
   return problems;
 });
 expect(issues).toEqual([]);
});
