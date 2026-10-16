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
test('Presentar abre una vista proyectable con 6 escenas y acceso al simulador',async({page})=>{
 await page.goto(url);
 await page.locator('#presentation-launch').click();
 await expect(page.locator('#presentation-overlay')).toBeVisible();
 await expect(page.locator('#stage-title')).toHaveText('23 sedes. Una red.');
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('#stage-title')).toHaveText('Cisco + Palo Alto');
 await page.locator('#stage-next').click();
 await expect(page.locator('#stage-title')).toHaveText('Cada flujo, una regla.');
 await page.locator('#stage-lab').click();
 await expect(page.locator('#packetlab-overlay')).toBeVisible();
 await expect(page.locator('#pl-result')).toContainText('BLOQUEADO');
 await expect(page.locator('#presentation-overlay')).toBeHidden();
 await page.keyboard.press('Escape');
 await expect(page.locator('#packetlab-overlay')).toBeHidden();
});
