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
