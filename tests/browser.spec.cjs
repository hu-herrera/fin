const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
test('Carga sin excepciones y topología disponible', async ({page}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await expect(page.locator('body')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => typeof SEDES !== 'undefined' && SEDES.length >= 23)).toBe(true);
  expect(errors).toEqual([]);
});
test('Escenarios WAN y rutas de consola reaccionan al fallo', async ({page}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  const result = await page.evaluate(() => {
    const site = SEDES.find(s => s.id === 's01');
    ST.mode = 'despues';
    for (const s of SEDES) {
      ST.links[s.id] = {starlink:'activo',kuiper:'standby',g5:'standby',g4:'standby'};
      ST.failback[s.id] = {pending:false};
    }
    recompute(site.id);
    const first = {link:activeLink(site.id), route:genRouterRoutes(site)};
    ST.links[site.id].starlink = 'caido'; recompute(site.id);
    const second = {link:activeLink(site.id), route:genRouterRoutes(site)};
    ST.links[site.id].kuiper = 'caido'; recompute(site.id);
    const third = {link:activeLink(site.id), route:genRouterRoutes(site)};
    ST.links[site.id].g5 = 'caido'; ST.links[site.id].g4 = 'caido'; recompute(site.id);
    const none = {link:activeLink(site.id), route:genRouterRoutes(site)};
    return {first,second,third,none};
  });
  expect(result.first.link).toBe('starlink');
  expect(result.first.route).toContain('100.64.1.1');
  expect(result.second.link).toBe('kuiper');
  expect(result.second.route).toContain('100.64.1.5');
  expect(result.third.link).toBe('g5');
  expect(result.third.route).toContain('100.85.1.1');
  expect(result.none.link).toBeNull();
  expect(result.none.route).toContain('Gateway of last resort is not set');
  expect(result.none.route).not.toContain('S* 0.0.0.0/0');
  expect(errors).toEqual([]);
});
test('Consolas usan subredes válidas y switches con IP distinta', async ({page}) => {
  await page.goto(url);
  const values = await page.evaluate(() => {
    const site=SEDES.find(s=>s.id==='s01');
    return {router:genRouterRunningConfig(site), sw1:genSwitchRunningConfig(site,1),sw2:genSwitchRunningConfig(site,2),routes:genRouterRoutes(site)};
  });
  for(const subnet of ['10.70.1.0/25','10.70.1.128/27','10.70.1.160/28','10.70.1.176/28']) expect(values.routes).toContain(subnet);
  expect(values.router).toContain('10.70.1.129 255.255.255.224');
  expect(values.router).toContain('10.70.1.161 255.255.255.240');
  expect(values.router).toContain('10.70.1.177 255.255.255.240');
  expect(values.sw1).toContain('10.70.1.162 255.255.255.240');
  expect(values.sw2).toContain('10.70.1.163 255.255.255.240');
});

test('Auditoría de todas las sedes: VLAN, gateways, switches y rutas sin enlaces', async ({page}) => {
  await page.goto(url);
  const audit = await page.evaluate(() => {
    const issues = [];
    const expected = [
      {network:0,mask:25,gateway:1},
      {network:128,mask:27,gateway:129},
      {network:160,mask:28,gateway:161},
      {network:176,mask:28,gateway:177}
    ];
    ST.mode='despues';
    for(const site of SEDES) {
      const n=site.num;
      ST.links[site.id]={starlink:'activo',kuiper:'standby',g5:'standby',g4:'standby'};
      ST.failback[site.id]={pending:false};
      recompute(site.id);
      const routes=genRouterRoutes(site);
      const config=genRouterRunningConfig(site);
      const sw1=genSwitchRunningConfig(site,1);
      const sw2=genSwitchRunningConfig(site,2);
      for(const vlan of expected) {
        if(!routes.includes(`10.70.${n}.${vlan.network}/${vlan.mask}`)) issues.push(`${site.id}: falta subred ${vlan.network}/${vlan.mask}`);
      }
      for(const [addr,mask] of [[1,'255.255.255.128'],[129,'255.255.255.224'],[161,'255.255.255.240'],[177,'255.255.255.240']]) {
        if(!config.includes(`10.70.${n}.${addr} ${mask}`)) issues.push(`${site.id}: gateway ${addr} inconsistente`);
      }
      if(!sw1.includes(`10.70.${n}.162 255.255.255.240`)) issues.push(`${site.id}: switch 1 sin gestión correcta`);
      if(!sw2.includes(`10.70.${n}.163 255.255.255.240`)) issues.push(`${site.id}: switch 2 sin gestión correcta`);
      if(getPCs(site).some(pc=>Number(pc.ip.split('.').at(-1))>=128)) issues.push(`${site.id}: PC fuera de VLAN 10`);
      for(const wan of ['starlink','kuiper','g5','g4']) ST.links[site.id][wan]='caido';
      recompute(site.id);
      const disconnected=genRouterRoutes(site);
      if(activeLink(site.id)!==null || disconnected.includes('S* 0.0.0.0/0')) issues.push(`${site.id}: ruta activa pese a corte total`);
    }
    return {sites:SEDES.length,issues};
  });
  expect(audit.sites).toBeGreaterThanOrEqual(23);
  expect(audit.issues).toEqual([]);
});

test('Terminal real: ejecutar comandos y comprobar cambios WAN', async ({page}) => {
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(url);
  await page.evaluate(() => {
    ST.mode='despues';
    const site=SEDES.find(s=>s.id==='s01');
    ST.links[site.id]={starlink:'activo',kuiper:'standby',g5:'standby',g4:'standby'};
    recompute(site.id);
    const host=document.createElement('div');
    host.id='test-cli-container';
    host.innerHTML=genDeviceCLI(site,'router');
    document.body.appendChild(host);
  });
  const input=page.locator('#test-cli-container #device-term-input');
  const output=page.locator('#test-cli-container #device-term-out');
  await input.fill('terminal length 0');
  await input.press('Enter');
  await input.fill('show ip route');
  await input.press('Enter');
  await expect(output).toContainText('100.64.1.1');
  await page.evaluate(() => {
    ST.links.s01.starlink='caido';
    recompute('s01');
  });
  await input.fill('show ip route');
  await input.press('Enter');
  await expect(output).toContainText('100.64.1.5');
  await input.fill('show running-config');
  await input.press('Enter');
  await expect(output).toContainText('10.70.1.129 255.255.255.224');
  await input.fill('show ip interface brief');
  await input.press('Enter');
  await expect(output).toContainText('GigabitEthernet');
  expect(errors).toEqual([]);
});
