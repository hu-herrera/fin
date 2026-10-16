const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;

// This is the ORIGINAL user workflow: select a site, press its yellow button,
// and work inside the same site topology/console modal. No second simulator.
async function openOriginalSite(page,id='s01'){
 await page.goto(url);
 await page.evaluate(siteId=>renderDetail(siteId),id);
 await page.locator('#detail-panel button').filter({hasText:'Ver topología interna completa'}).click();
 await expect(page.locator('#sm-overlay')).toHaveClass(/vis/);
 await expect(page.locator('#sm-body .topo-svg')).toBeVisible();
}
async function openPacketFromTopology(page){
 await page.locator('#topo-packet-tool').click();
 await expect(page.locator('#sm-tab-packet')).toHaveClass(/active/);
 await expect(page.locator('#sm-packet-host .packetlab-dialog')).toBeVisible();
}
test('El botón amarillo abre nuestro simulador ORIGINAL; trazado y consolas en la misma ventana',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await openOriginalSite(page);
 await expect(page.locator('#packetlab-launch')).toHaveCount(0);
 await expect(page.locator('#sm-tabs .sm-tab')).toHaveCount(7);
 await openPacketFromTopology(page);
 await expect(page.locator('#pl-site')).toHaveValue('s01');
 await expect(page.locator('#pl-site')).toBeDisabled();
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
 await expect(page.locator('#pl-hops .packetlab-hop')).toHaveCount(10);
 await page.locator('#pl-ssh').click();
 await expect(page.locator('#pl-result')).toContainText('BLOQUEADO');
 await expect(page.locator('#pl-result')).toContainText('DENY-CORP-RFC1918-TRANSIT');
 expect(await page.evaluate(()=>PacketWorkbench.last.modelOnly)).toBe(true);
 await page.locator('#packetlab-close').click();
 await expect(page.locator('#sm-body .topo-svg')).toBeVisible();
 await page.locator('#sm-tabs .sm-tab').filter({hasText:'Comandos'}).click();
 await expect(page.locator('#sm-tabs .sm-tab').filter({hasText:'Comandos'})).toHaveClass(/active/);
 await page.locator('#sm-tab-packet').click();
 await expect(page.locator('#pl-result')).toBeVisible();
 expect(errors).toEqual([]);
});
test('Failover WAN sucede dentro de la topología existente, no en un simulador nuevo',async({page})=>{
 await openOriginalSite(page);
 await openPacketFromTopology(page);
 await page.locator('#pl-fail').click();
 await expect(page.locator('#pl-wan')).toHaveValue('Amazon Leo');
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
 await page.evaluate(()=>{
  const site=getRedundantLabState('s01');
  for(const k of ['leo','entel5g','gtd4g'])RedundantLab.setWan(site,k,false);
 });
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-result')).toContainText('WAN_DOWN');
 await page.evaluate(()=>{
  const site=getRedundantLabState('s01');
  for(const k of ['leo','entel5g','gtd4g'])RedundantLab.setWan(site,k,true);
 });
 await page.locator('#pl-restore').click();
 await expect(page.locator('#pl-wan')).toHaveValue('Starlink');
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
 await page.locator('#packetlab-close').click();
 await expect(page.locator('#sm-body .topo-svg')).toBeVisible();
});
test('El laboratorio existente StackWise/LACP y el trazador comparten el mismo estado',async({page})=>{
 await openOriginalSite(page);
 await page.evaluate(()=>{
  const st=getRedundantLabState('s01');
  RedundantLab.setLink(st,'T1',false);
  RedundantLab.setLink(st,'T2',false);
 });
 await openPacketFromTopology(page);
 await expect(page.locator('#pl-result')).toContainText('TRANSIT_DOWN');
 await page.evaluate(()=>{
  const st=getRedundantLabState('s01');
  RedundantLab.setLink(st,'T1',true);
  RedundantLab.setLink(st,'T2',true);
  RedundantLab.setLink(st,'STACK-A',false);
  RedundantLab.setLink(st,'STACK-B',false);
 });
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-result')).toContainText('GATEWAY_DOWN');
 await page.locator('#sm-tabs .sm-tab').filter({hasText:'StackWise / LACP'}).click();
 await expect(page.locator('#sm-tabs .sm-tab').filter({hasText:'StackWise / LACP'})).toHaveClass(/active/);
});
test('Modo Presentar abre la sede original S01, permite demostración y regresa a la escena',async({page})=>{
 await page.goto(url);
 await page.locator('#presentation-launch').click();
 await expect(page.locator('#stage-title')).toHaveText('Financiera Pacífico');
 await expect(page.locator('#stage-notes')).toBeHidden();
 const titles=['Del diseño a la interacción','Una red que responde','La red demuestra lo que hace',
  'Problemas que resolvimos','Próximo paso: pulir y presentar'];
 for(const title of titles){
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#stage-title')).toHaveText(title);
 }
 await page.keyboard.press('ArrowLeft');
 await page.keyboard.press('n');
 await expect(page.locator('#stage-notes')).toBeVisible();
 await page.keyboard.press('n');
 await expect(page.locator('#stage-notes')).toBeHidden();
 await page.keyboard.press('ArrowLeft');
 await expect(page.locator('#stage-title')).toHaveText('La red demuestra lo que hace');
 await page.locator('#stage-lab').click();
 await expect(page.locator('#sm-overlay')).toHaveClass(/vis/);
 await expect(page.locator('#sm-tab-packet')).toHaveClass(/active/);
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
 await page.locator('#pl-ssh').click();
 await expect(page.locator('#pl-result')).toContainText('BLOQUEADO');
 await page.keyboard.press('Escape');
 await expect(page.locator('#sm-overlay')).not.toHaveClass(/vis/);
 await expect(page.locator('#presentation-overlay')).toBeVisible();
 await expect(page.locator('#stage-title')).toHaveText('La red demuestra lo que hace');
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('#stage-title')).toHaveText('Problemas que resolvimos');
});
test('Bajar un puerto real de PC mediante consola simulada bloquea trazado en la sede',async({page})=>{
 await openOriginalSite(page);
 await openPacketFromTopology(page);
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
 await page.evaluate(()=>{
  deviceCliSession('s01','sw1').interfaces['Gi1/0/3']={shutdown:true};
 });
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-result')).toContainText('ACCESS_DOWN');
 await page.evaluate(()=>{deviceCliSession('s01','sw1').interfaces['Gi1/0/3']={shutdown:false};});
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
});

test('Simular flujo actualiza cada ejecución aun sin cambiar los valores',async({page})=>{
 await openOriginalSite(page);
 await openPacketFromTopology(page);
 const before=await page.locator('#pl-execution').innerText();
 const hops=await page.locator('#pl-hops .packetlab-hop').count();
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-execution')).not.toHaveText(before);
 await expect(page.locator('#pl-execution')).toContainText('EJECUCIÓN #2');
 await expect(page.locator('#pl-hops .packetlab-hop')).toHaveCount(hops);
 await expect(page.locator('#pl-result')).toHaveClass(/packetlab-updated/);
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-execution')).toContainText('EJECUCIÓN #3');
 await page.locator('#pl-dest').fill('999.999.999.999');
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-result')).toContainText('BLOQUEADO');
 await expect(page.locator('#pl-result')).toContainText('BAD_DEST');
 await expect(page.locator('#pl-execution')).toContainText('EJECUCIÓN #4');
});
test('Cambio de sede recicla la interfaz sin conservar el PC de la sede previa',async({page})=>{
 await openOriginalSite(page,'s01');
 await openPacketFromTopology(page);
 await expect(page.locator('#pl-pc')).toHaveValue('10.70.1.10');
 await page.evaluate(()=>closeSedeModal());
 await page.evaluate(()=>openSedeModal('s02'));
 await page.locator('#sm-tab-packet').click();
 await expect(page.locator('#pl-site')).toHaveValue('s02');
 await expect(page.locator('#pl-pc')).toHaveValue('10.70.2.10');
 await expect(page.locator('#pl-result')).toContainText('PERMITIDO');
 await page.locator('#pl-trace').click();
 await expect(page.locator('#pl-execution')).toContainText('10.70.2.10');
});
test('Estado verde, tarjetas y botones no pisan otros textos en escritorio y móvil',async({page})=>{
 for(const width of [1366,768,390]){
  await page.setViewportSize({width,height:800});
  await openOriginalSite(page);
  await openPacketFromTopology(page);
  await page.locator('#pl-trace').click();
  const violations=await page.evaluate(()=>{
   const ids=['pl-verdict','pl-state','pl-execution','pl-reason','pl-hops'];
   const nodes=ids.map(id=>document.getElementById(id));
   const rects=nodes.map(el=>el.getBoundingClientRect());
   const collision=(a,b)=>a.left<b.right-2&&a.right>b.left+2&&
     a.top<b.bottom-2&&a.bottom>b.top+2;
   const errors=[];
   if(collision(rects[0],rects[1]))errors.push('green status overlaps code label');
   if(collision(rects[2],rects[3]))errors.push('execution label overlaps reason');
   if(collision(rects[3],rects[4]))errors.push('reason overlaps hop cards');
   for(const hop of document.querySelectorAll('#pl-hops .packetlab-hop')){
    if(hop.scrollWidth>hop.clientWidth+2)errors.push('card overflows horizontally');
   }
   const host=document.querySelector('#sm-packet-host');
   if(host.scrollWidth>host.clientWidth+3)errors.push('packet tab overflow horizontally');
   return errors;
  });
  expect(violations,'Viewport '+width).toEqual([]);
  await page.evaluate(()=>closeSedeModal());
 }
});
