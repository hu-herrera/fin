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
