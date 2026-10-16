const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;

test('Laboratorio StackWise integrado: falla de enlaces, switch, PA y WAN',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.evaluate(()=>openSedeModal('s01'));
  await page.locator('#sm-tabs button[onclick*="smTab(\'lab\'"]').click();
  const panel=page.locator('#sm-body');
  await expect(panel).toContainText('LABORATORIO AISLADO');
  await expect(panel).toContainText('SW1 · 15 PCs · L2 local');
  await expect(panel).toContainText('SW2 · 15 PCs · L2 local');

  const read=()=>page.evaluate(()=>window.RedundantLab.inspect(getRedundantLabState('s01')));
  let state=await read();
  expect(state.transitMembers).toEqual(['T1','T2']);
  expect(state.paStackMembers).toEqual(['D1','D2','D3','D4']);
  expect(state.switchInternet[1]).toBe(true);
  expect(state.switchInternet[2]).toBe(true);

  await panel.locator('button[onclick*="\'link\',\'T1\'"]').click();
  expect((await read()).transitUp).toBe(true);
  await panel.locator('button[onclick*="\'link\',\'T2\'"]').click();
  state=await read();
  expect(state.transitUp).toBe(false);
  expect(state.switchGateway[1]).toBe(true);
  expect(state.switchInternet[1]).toBe(false);
  await panel.locator('button[onclick*="\'link\',\'T2\'"]').click();

  await panel.locator('button[onclick*="\'node\',\'sw1\'"]').click();
  state=await read();
  expect(state.switchInternet[1]).toBe(false);
  expect(state.switchInternet[2]).toBe(true);
  expect(state.switchLocalL2[1]).toBe(false);
  await panel.locator('button[onclick*="\'node\',\'sw1\'"]').click();

  await panel.locator('button[onclick*="\'upstream\',\'starlink\'"]').click();
  state=await read();
  expect(state.activeWan).toBe('leo');
  expect((await page.evaluate(()=>getRedundantLabState('s01'))).wanGateway.starlink).toBe(true);
  await panel.locator('button[onclick*="\'node\',\'firewall\'"]').click();
  state=await read();
  expect(state.switchGateway[1]).toBe(false);
  expect(state.switchLocalL2[1]).toBe(true);

  await panel.locator('button[onclick*="resetRedundantLab"]').click();
  state=await read();
  expect(state.activeWan).toBe('starlink');
  expect(state.transitMembers.length).toBe(2);
  expect(state.switchInternet[1]).toBe(true);

  await expect(panel).toContainText('GigabitEthernet2/0/45');
  await expect(panel).toContainText('set zone GUESTS network layer3 ae2.40');
  expect(errors).toEqual([]);
});

test('23 laboratorios aislados usan mismo motor Node y browser y no contaminan simulador vigente',async({page})=>{
  await page.goto(url);
  const result=await page.evaluate(()=>{
    const errors=[];
    if(!window.RedundantLab||typeof window.RedundantLab.siteCandidate!=='function')errors.push('Motor no cargado');
    const model=window.RedundantLab;
    const codes=['cm',...Array.from({length:22},(_,i)=>'s'+String(i+1).padStart(2,'0'))];
    let mapped=0;
    for(const id of codes){
      const site=SEDES.find(s=>s.id===id);
      const base=renderRedundantLabTab(site);
      const lab=getRedundantLabState(id);
      const result=model.inspect(lab);
      mapped+=PC_COUNT[id];
      if(!base.includes('LABORATORIO AISLADO')||!base.includes('Po10'))errors.push(id+': panel incompleto');
      if(!result.switchInternet[1]||!result.switchInternet[2])errors.push(id+': estado inicial inválido');
      if(!model.siteCandidate(site.num,PC_COUNT[id]).stack.includes('interface GigabitEthernet2/0/45'))errors.push(id+': puerto stack ausente');
    }
    model.setLink(getRedundantLabState('s01'),'T1',false);
    if(getRedundantLabState('s02').links.T1===false)errors.push('Estados compartidos entre sedes');
    if(!genSwitchRunningConfig(SEDES.find(s=>s.id==='s01'),1).includes('channel-group 1 mode active'))
      errors.push('Perfil anterior de consola mutado sin completar migración');
    resetRedundantLab('s01');
    return {errors,mapped,sites:codes.length};
  });
  expect(result.errors).toEqual([]);
  expect(result.sites).toBe(23);
  expect(result.mapped).toBe(650);
});


test('StackWise doblemente cortado: aislamiento entre miembros sin inventar caída de PCs locales',async({page})=>{
  await page.goto(url);
  await page.evaluate(()=>openSedeModal('s03'));
  await page.locator('#sm-tabs button[onclick*="smTab(\'lab\'"]').click();
  const panel=page.locator('#sm-body');
  const read=()=>page.evaluate(()=>window.RedundantLab.inspect(getRedundantLabState('s03')));
  expect((await read()).interMemberL2).toBe(true);
  await panel.locator('button[onclick*="\'link\',\'STACK-A\'"]').click();
  expect((await read()).interMemberL2).toBe(true);
  await panel.locator('button[onclick*="\'link\',\'STACK-B\'"]').click();
  const partitioned=await read();
  expect(partitioned.stackPartitioned).toBe(true);
  expect(partitioned.interMemberL2).toBe(false);
  expect(partitioned.switchLocalL2[1]).toBe(true);
  expect(partitioned.switchLocalL2[2]).toBe(true);
  expect(partitioned.switchGateway[1]).toBe(false);
  await expect(panel).toContainText('Conmutación VLAN10 SW1 ↔ SW2');
  await expect(panel).toContainText('AISLADOS');
  await panel.locator('button[onclick*="\'link\',\'STACK-B\'"]').click();
  const restored=await read();
  expect(restored.stackPartitioned).toBe(false);
  expect(restored.switchGateway[1]).toBe(true);
  expect(restored.interMemberL2).toBe(true);
});


test('Los tres fabricantes muestran configuraciones objetivo sin alterar las CLI vigentes',async({page})=>{
  await page.goto(url);
  for(const [kind,needle] of [
    ['router','interface Port-channel10'],
    ['fw','set network interface aggregate-ethernet ae1 layer3'],
    ['sw1','interface Port-channel20'],
    ['sw2','interface GigabitEthernet2/0/45']]){
    await page.evaluate(kind=>openDevice(kind,'s03'),kind);
    await page.locator('#dev-tabs button', {hasText:'Objetivo L3'}).click();
    const content=page.locator('#dev-body');
    await expect(content).toContainText('Configuración candidata, NO instalada');
    await expect(content).toContainText(needle);
    await expect(content).toContainText('gestión OOB');
  }
  const report=await page.evaluate(()=>{
    const site=SEDES.find(s=>s.id==='s03');
    return {
      classicRouter:genRouterRunningConfig(site),
      classicFirewall:genFWCommand(site,'show running-config'),
      classicSwitch:genSwitchRunningConfig(site,2),
    };
  });
  expect(report.classicRouter).toContain('GigabitEthernet0/0/0.10');
  expect(report.classicFirewall).toContain('virtual wire');
  expect(report.classicSwitch).toContain('channel-group 1 mode active');
});

test('Palo Alto: políticas inter-VLAN protegen invitados y gestión, permiten web controlada',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.evaluate(()=>openSedeModal('s01'));
  await page.locator('#sm-tabs button').filter({hasText:'StackWise / LACP'}).click();
  const policy=page.locator('#lab-pan-policy');
  await expect(policy.locator('#lab-policy-result')).toContainText('DENY · DENY-GUEST-TO-CORP');
  await policy.locator('select[aria-label="to"]').selectOption('TRANSIT');
  await policy.locator('select[aria-label="application"]').selectOption('ssl');
  await expect(policy.locator('#lab-policy-result')).toContainText('ALLOW · ALLOW-GUESTS-WEB-OUT');
  await policy.locator('select[aria-label="destinationIp"]').selectOption('10.70.0.20');
  await expect(policy.locator('#lab-policy-result')).toContainText('DENY · DENY-GUEST-RFC1918-TRANSIT');
  await policy.locator('select[aria-label="destinationIp"]').selectOption('172.16.3.1');
  await expect(policy.locator('#lab-policy-result')).toContainText('DENY · DENY-GUEST-RFC1918-TRANSIT');
  await policy.locator('select[aria-label="destinationIp"]').selectOption('8.8.8.8');
  await expect(policy.locator('#lab-policy-result')).toContainText('ALLOW · ALLOW-GUESTS-WEB-OUT');
  await policy.locator('select[aria-label="application"]').selectOption('ssh');
  await expect(policy.locator('#lab-policy-result')).toContainText('DENY · interzone-default');
  await policy.locator('select[aria-label="from"]').selectOption('USERS');
  await policy.locator('select[aria-label="to"]').selectOption('MGMT-DATA');
  await expect(policy.locator('#lab-policy-result')).toContainText('DENY · DENY-USERS-TO-MGMT');
  await policy.locator('select[aria-label="from"]').selectOption('GUESTS');
  await expect(policy.locator('#lab-policy-result')).toContainText('DENY · DENY-GUEST-TO-CORP');
  const integrity=await page.evaluate(()=>{
    const s=SEDES.find(site=>site.id==='s01');
    const cfg=window.RedundantLab.routerCandidate(s.num);
    return {guestDenied:cfg.includes('ip prefix-list SITE-LAN-1 seq 400 deny 10.70.1.176/28'),
      guestExported:cfg.includes('permit 10.70.1.176/28'),
      panos:window.RedundantLab.paloCandidate(s.num),
      current:genRouterRunningConfig(s)};
  });
  expect(integrity.guestDenied).toBe(true);
  expect(integrity.guestExported).toBe(false);
  expect(integrity.panos).toContain('set rulebase security rules DENY-GUEST-TO-CORP');
  expect(integrity.current).toContain('GigabitEthernet0/0/0.10');
  expect(errors).toEqual([]);
});
