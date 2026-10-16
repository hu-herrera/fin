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
