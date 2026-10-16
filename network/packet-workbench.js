/* Browser workstation, trace visualizer and presentation-stage shell.
 * Uses the existing ActiveProfile and StackWise lab as source of truth.
 * Not an emulator of real IOS-XE/PAN-OS binaries.
 */
(function(){
'use strict';
const traceEngine=window.PacketLab;
if(!traceEngine||!window.ActiveProfile||!window.RedundantLab)return;
const $=id=>document.getElementById(id);
const state={last:null,stage:0};
const scenes=[
 {kicker:'01 / El desafío',title:'23 sedes. Una red.',
  description:'Introducción al escenario: 650 computadores distribuidos y conectividad que debe resistir fallos sin perder segmentación.',
  facts:['23 sedes interconectadas','650 estaciones inventariadas','Mapa NOC interactivo']},
 {kicker:'02 / La arquitectura',title:'Cisco + Palo Alto',
  description:'Comparación visual de la red heredada y el rediseño: C8300, PA-1410 de capa 3 y StackWise-80 con EtherChannel.',
  facts:['Po10 · tránsito Cisco–PA','Po20 · Palo Alto–StackWise','VLAN 10 / 20 / 30 / 40']},
 {kicker:'03 / La seguridad',title:'Cada flujo, una regla.',
  description:'Demostración en vivo de DNS corporativo autorizado y de un intento SSH bloqueado por el Palo Alto.',
  facts:['DNS a casa matriz','SSH intersede denegado','Invitados aislados']},
 {kicker:'04 / La resiliencia',title:'La ruta se adapta.',
  description:'Desactivar Starlink en el laboratorio y observar que el modelo selecciona la siguiente WAN disponible sin prometer tiempos medidos.',
  facts:['Selección WAN condicionada','LACP y StackWise modelados','Prueba de recuperación']},
 {kicker:'05 / Evidencia de software',title:'Probar, no solo mostrar.',
  description:'Ejecutar los casos de laboratorio y revisar las pruebas automáticas: los estados y permisos cambian con los fallos.',
  facts:['Packet trace con decisiones','23 sedes / 650 PCs','CI y pruebas regresivas']},
 {kicker:'06 / Cierre',title:'Listo para demostrar.',
  description:'Resumen de alcances: simulación funcional en navegador y configuraciones candidatas revisables; no requiere comprar hardware para presentar.',
  facts:['Página web como soporte','Comparativa ANTES/DESPUÉS','Preguntas y demostración libre']}
];
function element(tag,cls,txt){
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(txt!==undefined)el.textContent=txt;
 return el;
}
function build(){
 const toolbar=document.getElementById('topbar');
 if(!toolbar)return;
 const b=element('button','', '⌁ Laboratorio de paquetes');
 b.id='packetlab-launch';b.type='button';b.title='Rutas, firewall y caída WAN del simulador';
 b.addEventListener('click',()=>openLab());
 const stageBtn=element('button','', '▣ Presentar');
 stageBtn.id='presentation-launch';stageBtn.type='button';stageBtn.title='Vista proyectable, sin diapositivas';
 stageBtn.addEventListener('click',()=>openStage());
 toolbar.append(b,stageBtn);
 const overlay=element('div','packetlab-overlay');overlay.id='packetlab-overlay';
 overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label','Laboratorio de paquetes');
 overlay.innerHTML=`<section class="packetlab-dialog">
 <header class="packetlab-heading"><div><span class="packetlab-kicker">SIMULADOR DE RED · TRÁFICO LÓGICO</span>
 <h2>Viaje de un paquete</h2><p class="packetlab-muted">Selecciona un origen y comprueba cada salto: stack, Palo Alto, Cisco, WAN y política de la sede remota.</p></div>
 <button id="packetlab-close" class="packetlab-close" type="button">✕ Cerrar</button></header>
 <div class="packetlab-controls">
 <label>Sede origen<select id="pl-site"></select></label>
 <label>VLAN origen<select id="pl-zone"><option value="USERS">VLAN10 · Usuarios</option><option value="VOICE">VLAN20 · Voz</option><option value="MGMT-DATA">VLAN30 · Gestión</option><option value="GUESTS">VLAN40 · Invitados</option></select></label>
 <label>PC de origen<select id="pl-pc"></select></label>
 <label>IP destino<input id="pl-dest" type="text" value="10.70.0.110" autocomplete="off" spellcheck="false" maxlength="15"></label>
 <label>Aplicación / App-ID<select id="pl-app"><option value="dns">DNS</option><option value="ssl">HTTPS / SSL</option><option value="ssh">SSH</option><option value="ntp">NTP</option><option value="icmp">ICMP</option><option value="web-browsing">HTTP</option></select></label>
 <label>Estado WAN actual<input id="pl-wan" type="text" readonly value="—"></label>
 </div>
 <nav class="packetlab-presets" aria-label="Escenarios de demostración">
 <button class="packetlab-btn primary" id="pl-trace" type="button">▶ Simular flujo</button>
 <button class="packetlab-btn" id="pl-dns" type="button">DNS permitido</button>
 <button class="packetlab-btn" id="pl-ssh" type="button">SSH bloqueado</button>
 <button class="packetlab-btn danger" id="pl-fail" type="button">↯ Cortar Starlink</button>
 <button class="packetlab-btn" id="pl-restore" type="button">↺ Recuperar Starlink</button>
 </nav>
 <section class="packetlab-result" id="pl-result" aria-live="polite">
 <div class="packetlab-result-title"><span id="pl-verdict">Selecciona una prueba</span><span id="pl-state">LAB</span></div>
 <p id="pl-reason" class="packetlab-muted"></p><div id="pl-hops" class="packetlab-trace"></div></section>
 <p class="packetlab-footnote">Simulación educativa del plano de datos y políticas. PERMITIDO significa que el modelo reenvía el flujo; no afirma que los servidores, contratos WAN o sesiones IPsec estén operativos físicamente. Los cambios de enlace afectan al escenario mostrado.</p>
 </section>`;
 overlay.addEventListener('click',e=>{if(e.target===overlay)closeLab();});
 document.body.append(overlay);
 $('packetlab-close').addEventListener('click',closeLab);
 const siteSelect=$('pl-site');
 for(const s of SEDES)siteSelect.add(new Option(s.code+' · '+s.city,s.id));
 siteSelect.value='s01';
 $('pl-site').addEventListener('change',()=>{refreshPcs();run();});
 $('pl-zone').addEventListener('change',()=>{refreshPcs();run();});
 $('pl-pc').addEventListener('change',run);
 $('pl-dest').addEventListener('change',run);
 $('pl-app').addEventListener('change',run);
 $('pl-trace').addEventListener('click',run);
 $('pl-dns').addEventListener('click',()=>preset('dns'));
 $('pl-ssh').addEventListener('click',()=>preset('ssh'));
 $('pl-fail').addEventListener('click',()=>wanAction(false));
 $('pl-restore').addEventListener('click',()=>wanAction(true));
 refreshPcs();
 const stage=element('div','stage-overlay');stage.id='presentation-overlay';stage.hidden=true;
 stage.setAttribute('role','dialog');stage.setAttribute('aria-label','Modo presentación');
 stage.setAttribute('aria-modal','true');
 stage.innerHTML=`<section class="stage-panel">
 <div class="stage-top"><span class="stage-kicker">FINANCIERA PACÍFICO · DEMO EN VIVO</span>
 <button class="stage-close" type="button" id="stage-close">✕ Volver al simulador</button></div>
 <div class="stage-content">
 <div><span class="stage-kicker" id="stage-kicker"></span><h2 id="stage-title"></h2>
 <p id="stage-description" class="stage-description"></p>
 <div style="margin-top:28px"><button class="packetlab-btn primary" type="button" id="stage-lab">Abrir demostración interactiva →</button></div></div>
 <div class="stage-facts" id="stage-facts"></div>
 </div>
 <div class="stage-nav"><button class="packetlab-btn" type="button" id="stage-prev">← Anterior</button>
 <span class="stage-progress" id="stage-progress"></span>
 <button class="packetlab-btn primary" type="button" id="stage-next">Siguiente →</button></div>
 <footer class="stage-footer">Modo exposición · misma página, sin PowerPoint · cambia escenas con ← / → · Esc para cerrar</footer>
 </section>`;
 document.body.append(stage);
 stage.addEventListener('click',e=>{if(e.target===stage)closeStage();});
 $('stage-close').addEventListener('click',closeStage);
 $('stage-prev').addEventListener('click',()=>advance(-1));
 $('stage-next').addEventListener('click',()=>advance(1));
 $('stage-lab').addEventListener('click',()=>{
  closeStage();
  openLab();
  if(state.stage===2)preset('ssh');
  else if(state.stage===3){preset('dns');wanAction(false);}
  else preset('dns');
 });
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
   if(!$('packetlab-overlay').hidden)closeLab();
   if(!$('presentation-overlay').hidden)closeStage();
  }else if(!$('presentation-overlay').hidden&&e.key==='ArrowRight')advance(1);
  else if(!$('presentation-overlay').hidden&&e.key==='ArrowLeft')advance(-1);
 });
 renderStage();
}
function refreshPcs(){
 const id=$('pl-site').value,site=SEDES.find(s=>s.id===id),zone=$('pl-zone').value;
 const chooser=$('pl-pc'),prev=chooser.value;
 chooser.replaceChildren();
 if(zone==='USERS'){
  for(const pc of getPCs(site))chooser.add(new Option(pc.id+' · '+pc.ip+' · SW'+pc.sw,pc.ip));
  chooser.disabled=false;
  if([...chooser.options].some(x=>x.value===prev))chooser.value=prev;
 }else{
  const ip='10.70.'+site.num+'.'+({VOICE:130,'MGMT-DATA':162,GUESTS:180}[zone]);
  chooser.add(new Option(ip+' · host lógico VLAN '+zone,ip));chooser.disabled=true;
 }
}
function environment(){
 return {
  site:num=>{const site=SEDES.find(s=>s.num===num);
   return site?window.ActiveProfile.status(site.id):null;},
  overlay:num=>{const site=SEDES.find(s=>s.num===num);
   return Boolean(site&&window.ActiveProfile.overlayInterfaceUp(site.id));},
  policy:(num,from,to,app,dst,src)=>window.RedundantLab.evaluateSitePanPolicy(
    num,from,to,app,dst,src),
  sourceReady:input=>{
   if(input.zone!=='USERS')return true;
   const site=SEDES.find(s=>s.num===input.siteNum);
   const pc=site&&getPCs(site).find(p=>p.ip===input.sourceIp);
   return Boolean(pc&&isSwitchPCPortAvailable(site.id,pc)&&isPCOnConfiguredVlan(site.id,pc));
  },
  destinationMember:(num,ip)=>{
   const site=SEDES.find(s=>s.num===num);
   const pc=site&&getPCs(site).find(p=>p.ip===ip);
   return pc?pc.sw:1;
  }
 };
}
function run(){
 if(!$('pl-site'))return null;
 const site=SEDES.find(s=>s.id===$('pl-site').value);
 if(!site)return null;
 const source=$('pl-pc').value;
 const pc=getPCs(site).find(p=>p.ip===source);
 const obj=window.ActiveProfile.status(site.id);
 $('pl-wan').value=obj.activeWan?(traceEngine.wanLabels[obj.activeWan]||obj.activeWan):'Sin ruta WAN';
 let result;
 if(ST.mode==='antes')
  result={allowed:false,status:'VISTA ANTES',reason:'Este laboratorio de paquetes utiliza el rediseño. Cambia a DESPUÉS para realizar las pruebas.',
   hops:[],code:'LEGACY',modelOnly:true};
 else result=traceEngine.trace({
  siteNum:site.num,zone:$('pl-zone').value,sourceIp:source,member:pc?.sw||1,
  destinationIp:$('pl-dest').value.trim(),application:$('pl-app').value
 },environment());
 state.last=result;
 const card=$('pl-result');
 card.className='packetlab-result '+(result.allowed?'allowed':'denied');
 $('pl-verdict').textContent=(result.allowed?'✓ ':'⊘ ')+result.status;
 $('pl-state').textContent=result.code||'SIMULACIÓN';
 $('pl-reason').textContent=result.reason;
 const steps=$('pl-hops');steps.replaceChildren();
 for(const h of result.hops){
  const box=element('div','packetlab-hop'+(h.ok?'':' blocked'));
  box.append(element('div','packetlab-hop-title',(h.ok?'✓ ':'✕ ')+h.label),
    element('div','packetlab-hop-detail',h.detail));
  steps.append(box);
 }
 return result;
}
function preset(kind){
 $('pl-zone').value='USERS';refreshPcs();
 $('pl-dest').value='10.70.0.110';
 $('pl-app').value=kind;
 run();
}
function wanAction(up){
 const id=$('pl-site').value;
 const lab=getRedundantLabState(id);
 window.RedundantLab.setWan(lab,'starlink',up);
 if(ST.links[id]){
  ST.links[id].starlink=up?'standby':'caido';
  recompute(id);
 }
 renderMap();updateMetrics();
 return run();
}
function openLab(){
 if(!$('packetlab-overlay'))return;
 $('packetlab-overlay').hidden=false;
 if($('presentation-overlay'))$('presentation-overlay').hidden=true;
 run();
 $('pl-trace').focus();
}
function closeLab(){if($('packetlab-overlay'))$('packetlab-overlay').hidden=true;}
function openStage(){
 closeLab();$('presentation-overlay').hidden=false;
 state.stage=0;renderStage();$('stage-next').focus();
}
function closeStage(){if($('presentation-overlay'))$('presentation-overlay').hidden=true;}
function advance(step){state.stage=Math.max(0,Math.min(scenes.length-1,state.stage+step));renderStage();}
function renderStage(){
 if(!$('stage-title'))return;
 const item=scenes[state.stage];
 $('stage-kicker').textContent=item.kicker;
 $('stage-title').textContent=item.title;
 $('stage-description').textContent=item.description;
 $('stage-progress').textContent=(state.stage+1)+' / '+scenes.length;
 $('stage-prev').disabled=state.stage===0;
 $('stage-next').disabled=state.stage===scenes.length-1;
 const cards=$('stage-facts');cards.replaceChildren();
 for(const fact of item.facts)cards.append(element('div','stage-fact',fact));
}
window.PacketWorkbench=Object.freeze({openLab,closeLab,openStage,closeStage,run,preset,wanAction,
 get last(){return state.last;},get stage(){return state.stage;}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
})();
