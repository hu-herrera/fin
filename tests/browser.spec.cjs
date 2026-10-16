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

test('Escenarios E1-E7 cambian estados de red y respetan recuperación', async ({page}) => {
  await page.goto(url);
  const report=await page.evaluate(()=>{
    const issues=[];
    const initial=()=>{ST.mode='despues'; ST.cmActive='rtr1';ST.failback={};for(const site of SEDES){ST.links[site.id]={starlink:'activo',kuiper:'standby',g5:'standby',g4:'standby'};recompute(site.id)}};
    initial();sc_e1();
    if(activeLink('s08')!=='kuiper')issues.push('E1 no conmuta S08 a Leo');
    initial();sc_e2();
    for(const id of ['s15','s16','s17'])if(ST.links[id].kuiper!=='caido'||ST.links[id].g4!=='caido')issues.push('E2 no corta '+id);
    initial();sc_e3();
    if(ST.cmActive!=='rtr2')issues.push('E3 no conmuta router central');
    initial();ST.links.s19.starlink='caido';ST.failback.s19={pending:true,startedAt:Date.now()-6000,durationMs:5000};sc_e4();
    if(activeLink('s19')!==null||ST.failback.s19.pending)issues.push('E4 deja conectividad o recuperación pendiente');
    initial();sc_e5();
    if(SEDES.some(site=>ST.links[site.id].starlink!=='caido'))issues.push('E5 no corta Starlink global');
    initial();sc_e6();
    if(SEDES.some(site=>ST.links[site.id].starlink!=='caido'||ST.links[site.id].kuiper!=='caido'))issues.push('E6 no corta ambos satélites');
    sc_e7();
    const recovering=SEDES.filter(site=>ST.failback[site.id]?.pending);
    if(!recovering.length||recovering.some(site=>ST.links[site.id].starlink!=='recuperando'||activeLink(site.id)==='starlink'))issues.push('E7 conmuta antes de espera');
    for(const site of recovering)ST.failback[site.id].startedAt-=6000;
    runFailbackCountdown();
    if(recovering.some(site=>activeLink(site.id)!=='starlink'))issues.push('E7 no restaura primario');
    return {issues,scenarios:7};
  });
  expect(report.issues).toEqual([]);
});
test('CLI: ping, traceroute y configuración shutdown/no shutdown', async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.evaluate(()=>{
    ST.mode='despues';
    for(const site of SEDES){ST.links[site.id]={starlink:'activo',kuiper:'standby',g5:'standby',g4:'standby'};recompute(site.id)}
    const site=SEDES.find(s=>s.id==='s01');
    const host=document.createElement('div');host.innerHTML=genDeviceCLI(site,'router');document.body.appendChild(host);
  });
  const input=page.locator('#device-term-input'),out=page.locator('#device-term-out');
  const send=async cmd=>{await input.fill(cmd);await input.press('Enter')};
  await send('terminal length 0');
  await send('ping 10.70.1.10');
  await expect(out).toContainText('Success rate is 100 percent');
  await send('ping 203.0.113.250');
  await expect(out).toContainText('Success rate is 0 percent');
  await send('traceroute 203.0.113.250');
  await expect(out).toContainText('Tracing the route');
  await send('enable');await send('configure terminal');await send('interface GigabitEthernet0/0/1');await send('shutdown');await send('end');
  await send('show ip route');
  await expect(out).toContainText('100.64.1.5');
  await send('configure terminal');await send('interface GigabitEthernet0/0/1');await send('no shutdown');await send('end');
  await send('show ip route');
  const state=await page.evaluate(()=>activeLink('s01'));
  expect(state).toBe('starlink');
  expect(errors).toEqual([]);
});

test('Comandos de diagnóstico de router, switch y firewall sin excepciones', async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  const results=await page.evaluate(()=>{
    ST.mode='despues';
    const site=SEDES.find(s=>s.id==='s01');
    const checks={
      router:['show version','show ip interface brief','show ip route','show ip ospf neighbor','show ip protocols','show ip sla statistics','show crypto session','show running-config'],
      sw1:['show version','show vlan brief','show interfaces status','show mac address-table','show spanning-tree','show etherchannel summary','show running-config'],
      sw2:['show version','show vlan brief','show interfaces status','show running-config'],
      fw:['show system info','show routing route','show session info','show interface all','show running-config']
    };
    const issues=[];
    for(const [type,commands] of Object.entries(checks)){
      const session=deviceCliSession(site.id,type);
      for(const command of commands){
        const candidates=deviceCliCandidates(type,session);
        if(!candidates.includes(command))issues.push(type+': comando ausente del catálogo '+command);
      }
    }
    return {issues,count:Object.values(checks).reduce((n,commands)=>n+commands.length,0)};
  });
  expect(results.issues).toEqual([]);
  expect(results.count).toBeGreaterThanOrEqual(20);
  expect(errors).toEqual([]);
});

test('Switches independientes: configuración, EtherChannel, PoE y troncales', async ({page}) => {
  await page.goto(url);
  const audit=await page.evaluate(()=>{
    const issues=[];
    for(const site of SEDES){
      for(const swN of [1,2]){
        const type='sw'+swN;
        const config=genSwitchRunningConfig(site,swN);
        const ether=genSwitchDetail(site,type,'show etherchannel summary');
        const power=genSwitchDetail(site,type,'show power inline');
        const stack=genSwitchDetail(site,type,'show switch');
        const trunk=genSwitchDetail(site,type,'show interfaces trunk');
        if(!config.includes('interface Port-channel1')||
           !config.includes('channel-group 1 mode active')||
           !config.includes('interface GigabitEthernet1/0/46'))issues.push(site.id+type+' LACP ausente');
        if(!config.includes('spanning-tree vlan 10,20,30,40 priority '+(swN===1?24576:28672)))
          issues.push(site.id+type+' prioridad STP no determinista');
        if(!config.includes('interface GigabitEthernet1/0/45')||!config.includes(' switchport trunk allowed vlan 10,20,30,40'))issues.push(site.id+type+' troncal incorrecta');
        if(!ether.includes('Po1(SU)')||!ether.includes('LACP')||
           !ether.includes('Gi1/0/45(P)')||!ether.includes('Gi1/0/46(P)'))issues.push(site.id+type+' EtherChannel no operativo');
        if(power.includes('Used:186.4')||!power.includes('alimentación externa'))issues.push(site.id+type+' PoE ficticio');
        if(stack.includes('2 Standby'))issues.push(site.id+type+' stack ficticio');
        if(!trunk.includes('Po1 on')||trunk.includes('Gi1/0/45 on'))issues.push(site.id+type+' troncal debe ser Po1');
      }
    }
    return {issues,devices:SEDES.length*2};
  });
  expect(audit.devices).toBeGreaterThanOrEqual(46);
  expect(audit.issues).toEqual([]);
});
test('LACP: cada miembro soporta fallo individual; ambos caídos aíslan SW2', async ({page}) => {
  await page.goto(url);
  const audit=await page.evaluate(()=>{
    const issues=[];
    for(const site of SEDES){
      const one=deviceCliSession(site.id,'sw1');
      const two=deviceCliSession(site.id,'sw2');
      delete one.interfaces['Gi1/0/45'];
      delete one.interfaces['Gi1/0/46'];
      delete two.interfaces['Gi1/0/45'];
      delete two.interfaces['Gi1/0/46'];
      if(!isSwitchStackLinkAvailable(site.id))issues.push(site.id+': ambos cables deberían estar activos');
      one.interfaces['Gi1/0/45']={shutdown:true};
      if(!isSwitchStackLinkAvailable(site.id)||!isSwitchPathAvailable(site.id,2))issues.push(site.id+': no sobrevive caída de primer cable');
      const degraded=genSwitchDetail(site,'sw1','show etherchannel summary');
      if(!degraded.includes('Po1(SU)')||!degraded.includes('Gi1/0/45(D)')||!degraded.includes('Gi1/0/46(P)'))issues.push(site.id+': diagnóstico degradado erróneo');
      one.interfaces['Gi1/0/46']={shutdown:true};
      if(isSwitchStackLinkAvailable(site.id)||isSwitchPathAvailable(site.id,2))issues.push(site.id+': Po1 permanece disponible sin miembros');
      if(!genSwitchDetail(site,'sw2','show etherchannel summary').includes('Po1(SD)'))issues.push(site.id+': Po1 debería estar caído');
      delete one.interfaces['Gi1/0/45'];
      if(!isSwitchStackLinkAvailable(site.id)||!isSwitchPathAvailable(site.id,2))issues.push(site.id+': recuperación del enlace no ocurre');
      delete one.interfaces['Gi1/0/46'];
      two.interfaces['Gi1/0/46']={shutdown:true};
      if(!isSwitchStackLinkAvailable(site.id))issues.push(site.id+': fallo remoto derriba indebidamente Po1');
      delete two.interfaces['Gi1/0/46'];
      one.interfaces.Po1={shutdown:true};
      if(isSwitchStackLinkAvailable(site.id)||isSwitchPathAvailable(site.id,2))issues.push(site.id+': shutdown Port-channel1 no derriba el bundle');
      delete one.interfaces.Po1;
      if(!isSwitchStackLinkAvailable(site.id))issues.push(site.id+': no shutdown Port-channel1 no restaura el bundle');
    }
    return {sites:SEDES.length,issues};
  });
  expect(audit.sites).toBeGreaterThanOrEqual(23);
  expect(audit.issues).toEqual([]);
});

test('Consola switch real: configuración, comandos y persistencia local', async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.evaluate(()=>{
    ST.mode='despues';
    const site=SEDES.find(s=>s.id==='s01');
    const host=document.createElement('div');host.innerHTML=genDeviceCLI(site,'sw1');document.body.appendChild(host);
  });
  const input=page.locator('#device-term-input'),out=page.locator('#device-term-out');
  const send=async cmd=>{await input.fill(cmd);await input.press('Enter')};
  await send('terminal length 0');
  await send('show power inline');await expect(out).toContainText('alimentación externa');
  await send('show etherchannel summary');await expect(out).toContainText('Po1(SU)');
  await send('show interfaces trunk');await expect(out).toContainText('Po1 on 802.1q trunking 999');
  await send('enable');await send('configure terminal');
  await send('interface Port-channel1');await send('shutdown');await send('end');
  await send('show etherchannel summary');await expect(out).toContainText('Po1(SD)');
  await send('configure terminal');await send('interface Port-channel1');await send('no shutdown');await send('end');
  const recovered=await page.evaluate(()=>isSwitchStackLinkAvailable('s01'));
  expect(recovered).toBe(true);
  await send('show etherchannel summary');await expect(out).toContainText('Po1(SU)');
  await send('configure terminal');await send('hostname SW-LAB-TEST');await send('end');
  await send('write memory');
  await expect(out).toContainText('SW-LAB-TEST');
  const stored=await page.evaluate(()=>localStorage.getItem('financiera-pacifico-cli-v1:s01:sw1'));
  expect(stored).toContain('SW-LAB-TEST');
  expect(errors).toEqual([]);
});

test('Rutas filtradas muestran RIB coherente tras caída de WAN', async ({page}) => {
  await page.goto(url);
  const audit=await page.evaluate(()=>{
    ST.mode='despues';
    const site=SEDES.find(s=>s.id==='s01');
    const issues=[];
    ST.links.s01={starlink:'activo',kuiper:'standby',g5:'standby',g4:'standby'};recompute('s01');
    const connected=genShowBrief(site,'router','show ip route connected');
    const statics=genShowBrief(site,'router','show ip route static');
    if(!connected.includes('10.70.1.176/28'))issues.push('No aparece VLAN invitados en conectadas');
    if(!statics.includes('100.64.1.1'))issues.push('Ruta primaria no coincide');
    ST.links.s01.starlink='caido';recompute('s01');
    if(!genShowBrief(site,'router','show ip route static').includes('100.64.1.5'))issues.push('Ruta estática no conmuta a Leo');
    for(const key of PRIORITY)ST.links.s01[key]='caido';
    recompute('s01');
    if(genShowBrief(site,'router','show ip route static').includes('S* 0.0.0.0/0'))issues.push('Ruta estática inventada tras corte');
    return issues;
  });
  expect(audit).toEqual([]);
});
