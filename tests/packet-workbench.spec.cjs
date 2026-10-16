const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;

async function openOriginalSite(page,id='s01'){
 await page.goto(url);
 await page.evaluate(siteId=>renderDetail(siteId),id);
 await page.locator('#detail-panel button').filter({hasText:'Ver topología interna completa'}).click();
 await expect(page.locator('#sm-overlay')).toHaveClass(/vis/);
 await expect(page.locator('#sm-body .topo-svg')).toBeVisible();
}
async function openPingTab(page){
 await page.locator('#sm-tabs button').filter({hasText:/Ping \/ Trace/}).click();
 await expect(page.locator('#ping-dest')).toBeVisible();
}

test('La topología original tiene un solo Ping / Trace, sin la pestaña duplicada',async({page})=>{
 await openOriginalSite(page);
 await expect(page.locator('#sm-tabs .sm-tab')).toHaveCount(6);
 await expect(page.locator('#sm-tab-packet')).toHaveCount(0);
 await expect(page.locator('#topo-packet-tool')).toHaveCount(0);
 await page.locator('#topo-ping-tool').click();
 await expect(page.locator('#ping-dest')).toBeVisible();
 await expect(page.locator('#ping-result')).toContainText('Listo para probar ICMP');
});

test('El ping local muestra respuesta, saltos y RTT sin cerrar la sede',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await openOriginalSite(page,'s01');
 await openPingTab(page);
 await page.locator('#ping-dest').selectOption('local');
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#sm-overlay')).toHaveClass(/vis/);
 await expect(page.locator('#ping-result')).toContainText('RESPUESTA SIMULADA');
 await expect(page.locator('#ping-result')).toContainText('RTT estimado 2 ms');
 await expect(page.locator('#ping-result .ping-table tbody tr').first()).toContainText('10.70.1.');
 await expect(page.locator('#ping-result .ping-table tbody tr').last()).toContainText('10.70.1.');
 expect(errors).toEqual([]);
});

test('El ping intersede explica el bloqueo PAN-OS y lo puede mostrar en el mapa',async({page})=>{
 await openOriginalSite(page,'s01');
 await openPingTab(page);
 await page.locator('#ping-dest').selectOption('s02');
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('BLOQUEADO por la política del firewall');
 await expect(page.locator('#ping-result')).toContainText('DENY-CORP-RFC1918-TRANSIT');
 await page.locator('#ping-result button').click();
 await expect(page.locator('#sm-overlay')).not.toHaveClass(/vis/);
 await expect(page.locator('#ping-trace-card')).toHaveClass(/vis/);
 await expect(page.locator('#ping-trace-state')).toContainText('Descartado');
 await expect(page.locator('#ping-trace-route')).toContainText('S01');
 await expect(page.locator('#ping-trace-route')).toContainText('S02');
});

test('El modo Presentar abre el Ping original y vuelve a la escena tras la prueba',async({page})=>{
 await page.goto(url);
 await page.locator('#presentation-launch').click();
 await expect(page.locator('#stage-title')).toHaveText('Financiera Pacífico');
 for(const title of ['Del diseño a la interacción','Una red que responde','La red demuestra lo que hace']){
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#stage-title')).toHaveText(title);
 }
 await page.locator('#stage-lab').click();
 await expect(page.locator('#sm-overlay')).toHaveClass(/vis/);
 await expect(page.locator('#sm-tabs button').filter({hasText:/Ping \/ Trace/})).toHaveClass(/active/);
 await expect(page.locator('#sm-tab-packet')).toHaveCount(0);
 await page.locator('#ping-dest').selectOption('local');
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('RESPUESTA SIMULADA');
 await page.keyboard.press('Escape');
 await expect(page.locator('#sm-overlay')).not.toHaveClass(/vis/);
 await expect(page.locator('#presentation-overlay')).toBeVisible();
 await expect(page.locator('#stage-title')).toHaveText('La red demuestra lo que hace');
});

test('Escape cierra la consola superior y conserva la sede antes de volver a Presentar',async({page})=>{
 await page.goto(url);
 await page.locator('#presentation-launch').click();
 await page.locator('#stage-lab').click();
 await page.evaluate(()=>openDevice('router','s01'));
 await expect(page.locator('#dev-overlay')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#dev-overlay')).toBeHidden();
 await expect(page.locator('#sm-overlay')).toBeVisible();
 await expect(page.locator('#presentation-overlay')).toBeHidden();
 await page.keyboard.press('Escape');
 await expect(page.locator('#presentation-overlay')).toBeVisible();
});

test('Comparativa y Ping global se abren sin depender de otras ventanas ocultas',async({page})=>{
 await page.goto(url);
 await page.evaluate(()=>openComparativa());
 await expect(page.locator('#modal-comp')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.evaluate(()=>openDashboardPing());
 await expect(page.locator('#modal')).toBeHidden();
 await expect(page.locator('#dashboard-ping-modal')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#dashboard-ping-modal')).toBeHidden();
});

test('Un cambio de red cancela el resultado pendiente de ping',async({page})=>{
 await openOriginalSite(page);await openPingTab(page);
 await page.evaluate(()=>{runPing('s01');toggleRedundantLab('s01','node','sw1');});
 await expect(page.locator('#ping-result')).toContainText('El estado de la red cambió');
 // Superar el plazo de la respuesta anterior comprueba que su callback no reaparezca.
 await page.waitForTimeout(500);
 await expect(page.locator('#ping-result')).not.toContainText('RESPUESTA SIMULADA');
});

test('La demostración inicia el rediseño aunque el usuario estuviera en ANTES',async({page})=>{
 await page.goto(url);await page.evaluate(()=>toggleMode());
 await page.locator('#presentation-launch').click();await page.locator('#stage-lab').click();
 expect(await page.evaluate(()=>ST.mode)).toBe('despues');
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('RESPUESTA SIMULADA');
});

test('El selector Ping y su resultado caben en una pantalla estrecha',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openOriginalSite(page);await openPingTab(page);
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('RESPUESTA SIMULADA');
 const overflow=await page.locator('#sm-body').evaluate(el=>el.scrollWidth-el.clientWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test('Los PCs elegidos cruzan StackWise en la topología original y un puerto caído no se sustituye',async({page})=>{
 await openOriginalSite(page);await openPingTab(page);
 const hosts=await page.evaluate(()=>getPCs(SEDES.find(s=>s.id==='s01')));
 const source=hosts.find(p=>p.sw===1),target=hosts.find(p=>p.sw===2);
 await page.locator('#ping-source-host').selectOption(source.ip);
 await page.locator('#ping-target-host').selectOption(target.ip);
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('4 pasos lógicos');
 await expect(page.locator('.ping-local-topology svg')).toBeVisible();
 await expect(page.locator('.ping-local-topology animateMotion')).toHaveAttribute('keyPoints','0;1;0');
 await expect(page.locator('#ping-result .ping-table tbody tr').last()).toContainText(target.ip);
 await page.evaluate(()=>toggleRedundantLab('s01','node','sw2'));
 await expect(page.locator('#ping-result')).toContainText('El estado de la red cambió');
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('Tiempo agotado');
 await expect(page.locator('#ping-target-host')).toHaveValue(target.ip);
});

test('La excepción ICMP solo permite el par exacto, respeta las fallas y se puede revocar',async({page})=>{
 await openOriginalSite(page);await openPingTab(page);
 await page.locator('#ping-dest').selectOption('s02');
 await page.getByRole('button',{name:'Permitir solo este par ICMP',exact:true}).click();
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('RESPUESTA SIMULADA');
 await expect(page.locator('#ping-result')).toContainText('LAB-ICMP-HOST-PAIR');
 const decisions=await page.evaluate(()=>{
  const src=SEDES.find(s=>s.id==='s01'),dst=SEDES.find(s=>s.id==='s02');
  const a=getPCs(src)[0],b=getPCs(dst)[0];
  return [packetPolicyDecision(src,dst,a,b,'ssl').action,
   packetPolicyDecision(src,dst,a,getPCs(dst)[1]).action,
   packetPolicyDecision(dst,src,b,a).action];
 });
 expect(decisions).toEqual(['deny','deny','deny']);
 await page.evaluate(()=>toggleRedundantLab('cm','node','router'));
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('Tiempo agotado');
 await page.evaluate(()=>toggleRedundantLab('cm','node','router'));
 await page.getByRole('button',{name:'Quitar excepción ICMP',exact:true}).click();
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('BLOQUEADO');
 await page.getByRole('button',{name:'Permitir solo este par ICMP',exact:true}).click();
 await page.evaluate(()=>sc_reset());
 expect(await page.evaluate(()=>PING_DIAGNOSTIC_RULE)).toBeNull();
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('BLOQUEADO');
});

test('El mapa conserva los hosts elegidos y la excepción no persiste al recargar',async({page})=>{
 await openOriginalSite(page);await openPingTab(page);
 await page.locator('#ping-dest').selectOption('s02');
 await page.locator('#ping-source-host').selectOption('10.70.1.11');
 await page.locator('#ping-target-host').selectOption('10.70.2.12');
 await page.getByRole('button',{name:'Permitir solo este par ICMP',exact:true}).click();
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('RESPUESTA SIMULADA');
 await page.locator('#ping-result button').click();
 await expect(page.locator('#ping-trace-state')).toContainText('En tránsito');
 await page.reload();
 expect(await page.evaluate(()=>PING_DIAGNOSTIC_RULE)).toBeNull();
});
