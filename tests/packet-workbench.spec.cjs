const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
test('Laboratorio de paquetes es visible, responde y no inventa servidores reales',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 await expect(page.locator('#packetlab-launch')).toBeVisible();
 await page.locator('#packetlab-launch').click();
 await expect(page.locator('#packetlab-overlay')).toBeVisible();
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
 await expect(page.locator('#pl-result')).toContainText('DNS');
 await expect(page.locator('#pl-hops .packetlab-hop')).toHaveCount(10);
 await page.locator('#pl-ssh').click();
 await expect(page.locator('#pl-result')).toContainText('BLOQUEADO');
 await expect(page.locator('#pl-result')).toContainText('DENY-CORP-RFC1918-TRANSIT');
 const noReal=await page.evaluate(()=>PacketWorkbench.last.modelOnly&&
   PacketWorkbench.last.caveat.includes('sin respuesta de servidor'));
 expect(noReal).toBe(true);
 await page.locator('#packetlab-close').click();
 await expect(page.locator('#packetlab-overlay')).toBeHidden();
 expect(errors).toEqual([]);
});
test('Caída de Starlink produce failover a Leo, caída total bloquea, recuperación restaura',async({page})=>{
 await page.goto(url);
 await page.locator('#packetlab-launch').click();
 await page.locator('#pl-fail').click();
 await expect(page.locator('#pl-wan')).toHaveValue('Amazon Leo');
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
 await page.evaluate(()=>{
  const site=getRedundantLabState('s01');
  for(const k of ['leo','entel5g','gtd4g'])window.RedundantLab.setWan(site,k,false);
 });
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-result')).toContainText('BLOQUEADO');
 await expect(page.locator('#pl-result')).toContainText('WAN_DOWN');
 await page.evaluate(()=>{
  const site=getRedundantLabState('s01');
  for(const k of ['leo','entel5g','gtd4g'])window.RedundantLab.setWan(site,k,true);
 });
 await page.locator('#pl-restore').click();
 await expect(page.locator('#pl-wan')).toHaveValue('Starlink');
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
});
test('Laboratorio refleja corte Po10 y separación StackWise sin recargar la página',async({page})=>{
 await page.goto(url);
 await page.locator('#packetlab-launch').click();
 await page.evaluate(()=>{
  const st=getRedundantLabState('s01');
  window.RedundantLab.setLink(st,'T1',false);
  window.RedundantLab.setLink(st,'T2',false);
 });
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-result')).toContainText('TRANSIT_DOWN');
 await page.evaluate(()=>{
  const st=getRedundantLabState('s01');
  window.RedundantLab.setLink(st,'T1',true);
  window.RedundantLab.setLink(st,'T2',true);
  window.RedundantLab.setLink(st,'STACK-A',false);
  window.RedundantLab.setLink(st,'STACK-B',false);
 });
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-result')).toContainText('GATEWAY_DOWN');
});
test('Presentar cubre 5 requisitos del profesor y expone demo sin PPT',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 await page.locator('#presentation-launch').click();
 await expect(page.locator('#presentation-overlay')).toBeVisible();
 await expect(page.locator('#stage-title')).toHaveText('Financiera Pacífico');
 await expect(page.locator('#stage-notes')).toBeHidden();
 const titles=[
  'Del diseño a la interacción',
  'Una red que responde',
  'La red demuestra lo que hace',
  'Problemas que resolvimos',
  'Próximo paso: pulir y presentar'
 ];
 for(const title of titles){
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#stage-title')).toHaveText(title);
 }
 await expect(page.locator('#stage-progress')).toContainText('6 / 6');
 await page.keyboard.press('ArrowLeft');
 await expect(page.locator('#stage-title')).toHaveText('Problemas que resolvimos');
 await page.keyboard.press('n');
 await expect(page.locator('#stage-notes')).toBeVisible();
 await expect(page.locator('#stage-notes-text')).toContainText('StackWise');
 await page.keyboard.press('n');
 await expect(page.locator('#stage-notes')).toBeHidden();
 await page.keyboard.press('ArrowLeft');
 await expect(page.locator('#stage-title')).toHaveText('La red demuestra lo que hace');
 await expect(page.locator('#stage-ci')).toBeVisible();
 await expect(page.locator('#stage-ci')).toHaveAttribute('href',/github.com\/hu-herrera\/fin\/actions\/runs\/38964467044/);
 await page.locator('#stage-lab').click();
 await expect(page.locator('#packetlab-overlay')).toBeVisible();
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
 await page.locator('#pl-ssh').click();
 await expect(page.locator('#pl-result')).toContainText('BLOQUEADO');
 await expect(page.locator('#presentation-overlay')).toBeHidden();
 await page.keyboard.press('Escape');
 await expect(page.locator('#packetlab-overlay')).toBeHidden();
 await expect(page.locator('#presentation-overlay')).toBeVisible();
 await expect(page.locator('#stage-title')).toHaveText('La red demuestra lo que hace');
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('#stage-title')).toHaveText('Problemas que resolvimos');
 await page.keyboard.press('Escape');
 await expect(page.locator('#presentation-overlay')).toBeHidden();
 expect(errors).toEqual([]);
});

test('Puerto Cisco de PC deshabilitado impide el flujo y al levantarlo vuelve a permitirlo',async({page})=>{
 await page.goto(url);
 await page.locator('#packetlab-launch').click();
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
 await page.evaluate(()=>{
  const cfg=deviceCliSession('s01','sw1');
  cfg.interfaces['Gi1/0/3']={shutdown:true};
 });
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-result')).toContainText('ACCESS_DOWN');
 await page.evaluate(()=>{deviceCliSession('s01','sw1').interfaces['Gi1/0/3']={shutdown:false};});
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
});
