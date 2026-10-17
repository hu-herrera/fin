const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
test.beforeEach(async({page})=>{await page.goto(url);await page.evaluate(()=>toggleMode());});
test('Inventario inicial: 650 pares, IP únicas y capacidad PoE por sede',async({page})=>{
 const r=await page.evaluate(()=>{
  const errors=[],ips=[];let pcs=0,phones=0,ports=0;
  for(const s of SEDES){const b=LegacyBaseline.site(s),p=getPCs(s),t=LegacyBaseline.phones(s);
   pcs+=p.length;phones+=t.length;ports+=b.access_ports_total;
   if(p.length!==b.pcs||t.length!==b.phones)errors.push(s.id+': cantidad');
   for(const x of p){ips.push(x.ip,x.phoneIp);if(x.port>b.access_ports_per_switch||(!s.isCM&&x.sw!==1))errors.push(s.id+': puerto');}
   if((renderTopoTab(s).match(/class="legacy-phone"/g)||[]).length!==p.length)errors.push(s.id+': dibujo');
  }return {errors,pcs,phones,ports,unique:new Set(ips).size};
 });expect(r).toEqual({errors:[],pcs:650,phones:650,ports:1104,unique:1300});
});
test('Diagnósticos del router y switch corresponden al inventario, sin métricas ficticias',async({page})=>{
 await page.evaluate(()=>{openSedeModal('s01');openDevice('router','s01');});
 await expect(page.locator('#dev-title')).toContainText('CISCO1921-SEC/K9');
 await expect(page.locator('#dev-body')).toContainText('2023-09-30');
 await expect(page.locator('#dev-body')).toContainText('Gi0/1.20 · 10.70.65.1/25');
 await expect(page.locator('#dev-body')).not.toContainText('uptime is');
 await page.evaluate(()=>openDevice('sw1','s01'));
 await page.locator('#dev-tabs button').filter({hasText:'Puertos'}).click();
 await expect(page.locator('#dev-body')).toContainText('TEL-S01-030');
 await expect(page.locator('#dev-body')).not.toContainText('Port-channel1');
});
test('Teléfono y PC abren información distinta desde la topología',async({page})=>{
 await page.evaluate(()=>openSedeModal('s01'));
 await page.locator('.legacy-phone').first().click();
 await expect(page.locator('#dev-title')).toContainText('TEL-S01-001');
 await expect(page.locator('#dev-body')).toContainText('10.70.65.10');
 await expect(page.locator('#dev-body')).toContainText('100 Mbps');
 await page.evaluate(()=>closeDevModal());
 await page.locator('.topo-pc').first().click();
 await expect(page.locator('#dev-body')).toContainText('10.70.1.10');
});
test('Ping local sobrevive al router y WAN caídos, pero no al switch apagado',async({page})=>{
 const r=await page.evaluate(()=>{const s=SEDES[1],p=getPCs(s);ST.mpls.s01='caido';LegacyBaseline.toggle('s01','router');
  const local=evaluatePCPing(s,p[0],p[1].ip),remote=evaluateMapPing('s01','s02');LegacyBaseline.toggle('s01','sw1');
  return {local:local.ok,remote:remote.ok,steps:local.route.map(n=>n.kind),off:evaluatePCPing(s,p[0],p[1].ip).ok,phone:LegacyBaseline.phones(s)[0].powered};});
 expect(r.local).toBe(true);expect(r.remote).toBe(false);expect(r.off).toBe(false);expect(r.phone).toBe(false);expect(r.steps).toEqual(['pc','phone','switch','phone','pc']);
});
test('Recorrido intersede incluye teléfonos, un ASA central y ningún firewall remoto',async({page})=>{
 const r=await page.evaluate(()=>{const p=evaluateMapPing('s01','s02');return {ok:p.ok,ids:p.route.map(n=>n.id)};});
 expect(r.ok).toBe(true);expect(r.ids).toContain('site:s01:phone:1');expect(r.ids).toContain('site:s02:phone:1');expect(r.ids.filter(n=>n.endsWith(':firewall'))).toEqual(['site:cm:firewall']);
});
test('MPLS nacional aísla solo las 20 continentales y conserva satélite supuesto',async({page})=>{
 const r=await page.evaluate(()=>{sc_antes_e2();return {down:SEDES.filter(s=>ST.mpls[s.id]==='caido').map(s=>s.id),land:evaluateMapPing('s01','s02').ok,sat:evaluateMapPing('s21','s22').ok,cm:evaluateMapPing('s21','cm').ok};});
 expect(r.down).toHaveLength(20);expect(r.down).not.toContain('s21');expect(r.land).toBe(false);expect(r.sat).toBe(true);expect(r.cm).toBe(true);
});
test('CM: un router conserva el modelo HA, ambos o el ASA impiden el tránsito',async({page})=>{
 const r=await page.evaluate(()=>{const ping=()=>evaluateMapPing('s01','s02').ok;LegacyBaseline.toggle('cm','router');const one=ping();LegacyBaseline.toggle('cm','router2');const both=ping();sc_reset();LegacyBaseline.toggle('cm','firewall');return {one,both,fw:ping(),local:evaluateMapPing('s01','s01','10.70.1.10','10.70.1.11').ok};});
 expect(r).toEqual({one:true,both:false,fw:false,local:true});
});
test('Datacenter: fallos de host afectan a sus servicios sin inventar respuestas ICMP',async({page})=>{
 const r=await page.evaluate(()=>{LegacyBaseline.toggle('cm','dc1');const first={app:LegacyBaseline.service('application').operational,db:LegacyBaseline.service('database').operational,voice:LegacyBaseline.service('call_control').operational,wan:evaluateMapPing('s01','s02').ok};LegacyBaseline.toggle('cm','dc2');return {first,voice:LegacyBaseline.service('call_control').operational,dns:LegacyBaseline.service('dns_ntp').operational,backup:LegacyBaseline.service('backup').operational,ping:evaluatePCPing(SEDES[0],getPCs(SEDES[0])[0],'10.70.200.10').ok};});
 expect(r).toEqual({first:{app:false,db:false,voice:true,wan:true},voice:false,dns:false,backup:true,ping:false});
});
test('CM muestra hosts, reservas de servicios y los 55 pares dentro del SVG',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.evaluate(()=>openSedeModal('cm'));
 await expect(page.locator('.legacy-phone')).toHaveCount(55);
 expect(await page.locator('.topo-svg').evaluate(s=>s.getBBox().height<=s.viewBox.baseVal.height)).toBe(true);
 await page.locator('.legacy-services button').filter({hasText:'Base de datos'}).click();
 await expect(page.locator('#dev-body')).toContainText('10.70.200.11');
 await expect(page.locator('#dev-body')).toContainText('DC-01');
 expect(errors).toEqual([]);
});
test('Configuraciones y fallos de DESPUÉS no contaminan ANTES',async({page})=>{
 const r=await page.evaluate(()=>{const s=SEDES[1];ST.mode='despues';const modern=genRouterRunningConfig(s),sw=getPCs(s).filter(p=>p.sw===2).length;getRedundantLabState('s01').nodes.switch1=false;
 ST.mode='antes';const before=evaluateMapPing('s01','s02').ok;LegacyBaseline.toggle('s01','sw1');ST.mode='despues';return {before,modernSame:modern===genRouterRunningConfig(s),modernSwitch:sw,modernState:getRedundantLabState('s01').nodes.switch1};});
 expect(r.before).toBe(true);expect(r.modernSame).toBe(true);expect(r.modernSwitch).toBeGreaterThan(0);expect(r.modernState).toBe(false);
});
test('Ping local y ping del mapa siguen disponibles en ANTES',async({page})=>{
 await page.evaluate(()=>{openSedeModal('s01');smTab('ping',document.querySelector('#sm-tabs .sm-tab:nth-child(3)'));});
 await page.locator('#ping-dest').selectOption('local');await page.evaluate(()=>runPing('s01'));
 await expect(page.locator('#ping-result')).toContainText('Respuesta ICMP simulada');
 await page.evaluate(()=>{closeSedeModal();runMapPing('s01','s02','10.70.1.10','10.70.2.10');});
 await expect(page.locator('#ping-trace-steps')).toContainText('TEL-S01-001');
});
test('Rueda anclada al cursor, arrastre del fondo y vista general completa',async({page})=>{
 await page.evaluate(()=>openSedeModal('cm'));
 await expect(page.locator('.topo-viewport')).toHaveAttribute('data-ready','1');
 const r=await page.evaluate(()=>{const w=document.querySelector('.topo-wrap'),v=w.querySelector('.topo-viewport'),rect=v.getBoundingClientRect(),before={...topologyState(w)},event=new WheelEvent('wheel',{deltaY:-100,clientX:rect.left+210,clientY:rect.top+180,bubbles:true,cancelable:true}),x=event.clientX-rect.left,y=event.clientY-rect.top;v.dispatchEvent(event);const after={...topologyState(w)};fitSedeTopology(w.querySelector('.topo-zoom button:last-child'));const fit=topologyState(w),svg=w.querySelector('svg');return {anchorX:(x-before.x)/before.scale-(x-after.x)/after.scale,anchorY:(y-before.y)/before.scale-(y-after.y)/after.scale,zoomed:after.scale>before.scale,fits:svg.clientHeight*fit.scale<=v.clientHeight&&svg.clientWidth*fit.scale<=v.clientWidth};});
 expect(r.zoomed).toBe(true);expect(r.anchorX).toBeCloseTo(0,6);expect(r.anchorY).toBeCloseTo(0,6);expect(r.fits).toBe(true);
 const v=page.locator('.topo-viewport');await v.scrollIntoViewIfNeeded();const rect=await v.boundingBox();const before=await page.evaluate(()=>({...topologyState(document.querySelector('.topo-wrap'))}));await page.mouse.move(rect.x+4,rect.y+180);await page.mouse.down();await page.mouse.move(rect.x+65,rect.y+210);await page.mouse.up();const after=await page.evaluate(()=>({...topologyState(document.querySelector('.topo-wrap'))}));expect(after.x-before.x).toBeCloseTo(61);expect(after.y-before.y).toBeCloseTo(30);
});
