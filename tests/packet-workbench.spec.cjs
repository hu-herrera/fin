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

test('La topología original conserva un solo Ping / Trace y elimina el flujo duplicado',async({page})=>{
 await openOriginalSite(page);
 await expect(page.locator('#sm-tabs .sm-tab')).toHaveCount(6);
 await expect(page.locator('#sm-tab-packet')).toHaveCount(0);
 await expect(page.locator('#topo-packet-tool')).toHaveCount(0);
 await page.locator('#topo-ping-tool').click();
 await expect(page.locator('#ping-dest')).toBeVisible();
 await expect(page.locator('#ping-result')).toContainText('Listo para probar');
});

test('Enviar ping muestra respuesta y ruta sin cerrar la ventana de la sede',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await openOriginalSite(page,'s01');
 await openPingTab(page);
 await page.locator('#ping-dest').selectOption('s02');
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#sm-overlay')).toHaveClass(/vis/);
 await expect(page.locator('#ping-result')).toContainText('RESPUESTA SIMULADA');
 await expect(page.locator('#ping-result')).toContainText('RTT estimado');
 await expect(page.locator('#ping-result .ping-table tbody tr').first()).toContainText('10.70.1.');
 await expect(page.locator('#ping-result .ping-table tbody tr').last()).toContainText('10.70.2.');
 await expect(page.locator('#ping-result button')).toHaveText(/animación del ping en el mapa/);
 expect(errors).toEqual([]);
});

test('El ping de una sede conserva el mapa animado existente cuando se solicita',async({page})=>{
 await openOriginalSite(page,'s01');
 await openPingTab(page);
 await page.locator('#ping-dest').selectOption('s02');
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('RESPUESTA SIMULADA');
 await page.locator('#ping-result button').click();
 await expect(page.locator('#sm-overlay')).not.toHaveClass(/vis/);
 await expect(page.locator('#ping-trace-card')).toHaveClass(/vis/);
 await expect(page.locator('#ping-trace-route')).toContainText('S01');
 await expect(page.locator('#ping-trace-route')).toContainText('S02');
});

test('El modo Presentar abre el Ping / Trace original y permite volver a la escena',async({page})=>{
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
 await page.locator('#ping-dest').selectOption('s02');
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('RESPUESTA SIMULADA');
 await page.keyboard.press('Escape');
 await expect(page.locator('#sm-overlay')).not.toHaveClass(/vis/);
 await expect(page.locator('#presentation-overlay')).toBeVisible();
 await expect(page.locator('#stage-title')).toHaveText('La red demuestra lo que hace');
});

test('Una ruta sin enlace da un resultado visible de timeout en el Ping original',async({page})=>{
 await openOriginalSite(page,'s01');
 await openPingTab(page);
 await page.evaluate(()=>{
  const site=SEDES.find(item=>item.id==='s01');
  for(const key of Object.keys(ST.links[site.id]))ST.links[site.id][key]='caido';
 });
 await page.locator('#ping-dest').selectOption('s02');
 await page.getByRole('button',{name:'Enviar ping'}).click();
 await expect(page.locator('#ping-result')).toContainText('Tiempo agotado');
});
