/* Browser workstation, trace visualizer and presentation-stage shell.
 * Uses the existing ActiveProfile and StackWise lab as source of truth.
 * Not an emulator of real IOS-XE/PAN-OS binaries.
 */
(function(){
'use strict';
const traceEngine=window.PacketLab;
if(!traceEngine||!window.ActiveProfile||!window.RedundantLab)return;
const $=id=>document.getElementById(id);
const state={last:null,stage:0,returnToStage:false};
const scenes=[
 {kicker:'01 / Presentación del avance',title:'Financiera Pacífico',
  description:'Proyecto de Título · Simulador interactivo de redes empresariales con infraestructura Cisco y Palo Alto. Revisión de avances del 16 de octubre de 2026.',
  facts:['23 sedes representadas','650 equipos de usuario modelados','Una página para explicar y demostrar'],
  time:'0:40',
  notes:'Buenas tardes, profesor. Nuestro Proyecto de Título es un simulador web de redes empresariales, basado en una financiera ficticia con 23 sedes y 650 computadores. La propuesta integra equipos Cisco y firewalls Palo Alto en un mismo entorno visual. Hoy mostraremos los avances desde la revisión anterior, lo que ya funciona, evidencias de las pruebas, los problemas que resolvimos y lo que todavía debemos desarrollar. No estamos presentando una red física instalada, sino un simulador académico.'},
 {kicker:'02 / Avances desde la última revisión',title:'Del diseño a la interacción',
  description:'Pasamos de diagramas y configuraciones candidatas a un modelo interactivo: enlaces LACP, stack, rutas, reglas de firewall y pruebas de paquetes en el navegador.',
  facts:['Topología Cisco C8300 → PA-1410 → StackWise','Laboratorio de paquetes incorporado','Regresiones de red automatizadas'],
  time:'1:00',
  notes:'Desde nuestra última revisión avanzamos en la arquitectura y, especialmente, en convertirla en comportamiento interactivo. Modelamos un Cisco C8300 conectado al PA-1410 por LACP, seguido de dos Catalyst C9200L unidos por StackWise. Integramos cuatro opciones WAN, sus prioridades y las VLAN de usuarios, voz, gestión e invitados. También añadimos un laboratorio donde se pueden lanzar flujos simulados y conocer el dispositivo o la regla que permite o bloquea el paso. Estos cambios ya tienen pruebas en GitHub.'},
 {kicker:'03 / Estado actual e implementaciones',title:'Una red que responde',
  description:'La topología DESPUÉS está operativa en el modelo: se puede explorar cada sede, abrir consolas simuladas, revisar políticas, interrumpir enlaces y observar rutas alternativas.',
  facts:['LACP Po10 + Po20 y fabric StackWise','Gateway y segmentación en Palo Alto','Consolas IOS-XE y PAN-OS simplificadas'],
  time:'1:00',
  notes:'En su estado actual tenemos 23 sedes y 650 computadores representados. Cada sede incluye router Cisco, firewall Palo Alto, dos switches formando un stack lógico y cuatro rutas WAN modeladas. El firewall es la puerta de enlace de las VLAN 10, 20, 30 y 40. Las consolas aceptan un subconjunto educativo de comandos, y los cambios que representamos en ellas influyen en el estado de los enlaces y los paquetes. Es importante diferenciarlo de GNS3: nuestro navegador modela comportamientos de red; no ejecuta binarios reales de IOS-XE o PAN-OS.'},
 {kicker:'04 / Evidencias de trabajo',title:'La red demuestra lo que hace',
  description:'Demostración en vivo: desde S01 enviar DNS hacia casa matriz, comprobar SSH bloqueado y cortar Starlink para observar el cambio de enlace WAN.',
  facts:['DNS permitido entre sedes por las políticas','SSH no autorizado bloqueado','55 pruebas de navegador aprobadas en la última CI'],
  time:'1:40',
  notes:'La principal evidencia no es una captura, sino el funcionamiento de la página. Entramos al Laboratorio de paquetes desde S01. Primero enviamos una consulta DNS simulada al servidor reservado de casa matriz 10.70.0.110 y mostramos los saltos y las reglas permitidas. Después intentamos SSH hacia el mismo destino y la regla del Palo Alto lo bloquea. Finalmente bajamos Starlink: el modelo selecciona la siguiente WAN sana, Amazon Leo, y al recuperarlo vuelve a la ruta principal. Adicionalmente, GitHub Actions registró 55 pruebas de navegador aprobadas. Estas cifras corresponden a la versión verificada; no son pruebas de tráfico ni disponibilidad física.'},
 {kicker:'05 / Dificultades e inconvenientes',title:'Problemas que resolvimos',
  description:'Nos enfrentamos a rutas mal interpretadas, separación de funciones Cisco/Palo Alto, conexiones LACP/StackWise y pruebas que debían reflejar las fallas en el salto correcto.',
  facts:['Separar StackWise de LACP','Gateway VLAN en el PA, no en C8300','Diferenciar simulación de protocolo real'],
  time:'1:05',
  notes:'Una dificultad fue lograr que la topología y las configuraciones coincidieran. Un stack StackWise no son dos switches LACP independientes; tuvimos que modelarlo como un solo switch lógico y distinguir los enlaces del fabric de los Port-channel. También corregimos dónde viven los gateways: en el Palo Alto, no en el router Cisco. Al probar fallos vimos que una interrupción del firewall central debe detener el flujo en el hub, no en un salto posterior. Además, cuidamos no inventar certificados, sesiones IPsec ni servidores funcionando: esos elementos se describen como candidatos y limitaciones del modelo.'},
 {kicker:'06 / Pendientes y retroalimentación',title:'Próximo paso: pulir y presentar',
  description:'Queremos aumentar la fidelidad de los escenarios, mejorar la experiencia visual y documentar ensayos reproducibles antes de la entrega final. Hoy buscamos retroalimentación sobre alcance y prioridades.',
  facts:['Ampliar las simulaciones de servicios y fallos','Afinar interfaz y recorrido de demostración','Incorporar observaciones del profesor'],
  time:'0:55',
  notes:'Los siguientes pasos son seguir aumentando la fidelidad del simulador, incorporar más escenarios de fallos y servicios, pulir la interfaz y registrar pruebas de usuario y documentación. La plataforma ya incluye un modo Presentar para usar la web en lugar de PowerPoint; todavía estamos afinando el guion y las transiciones. No necesitamos comprar 23 routers para concluir el objetivo académico: tenemos que demostrar de manera reproducible qué modelamos y qué no. Nos interesa saber qué parte considera prioritario validar para la entrega final. Muchas gracias.'}
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
 <div class="stage-actions"><button class="packetlab-btn primary" type="button" id="stage-lab">Demostración en vivo →</button>
 <button class="packetlab-btn" type="button" id="stage-notes-toggle" aria-pressed="false">Guion del expositor</button>
 <a class="packetlab-btn" id="stage-ci" href="https://github.com/hu-herrera/fin/actions/runs/38964467044" target="_blank" rel="noopener noreferrer">Ver evidencias CI ↗</a></div></div>
 <div class="stage-facts" id="stage-facts"></div>
 </div>
 <aside class="stage-speaker-notes" id="stage-notes" hidden><strong>Guion sugerido (no proyectar durante la exposición):</strong><p id="stage-notes-text"></p></aside>
 <div class="stage-nav"><button class="packetlab-btn" type="button" id="stage-prev">← Anterior</button>
 <span class="stage-progress" id="stage-progress"></span>
 <button class="packetlab-btn primary" type="button" id="stage-next">Siguiente →</button></div>
 <footer class="stage-footer">Avance de Proyecto de Título · 16 de octubre 2026 · ← / → para navegar · N muestra/oculta el guion · Esc cierra</footer>
 </section>`;
 document.body.append(stage);
 stage.addEventListener('click',e=>{if(e.target===stage)closeStage();});
 $('stage-close').addEventListener('click',closeStage);
 $('stage-notes-toggle').addEventListener('click',toggleSpeakerNotes);
 $('stage-prev').addEventListener('click',()=>advance(-1));
 $('stage-next').addEventListener('click',()=>advance(1));
 $('stage-lab').addEventListener('click',()=>{
  state.returnToStage=true;
  closeStage();
  openLab();
  $('packetlab-close').textContent='← Volver a la exposición';
  // En la escena de evidencias siempre iniciamos una prueba reproducible,
  // sin dejar enlaces caídos ocultos de ensayos anteriores.
  $('pl-site').value='s01';refreshPcs();
  preset('dns');
 });
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
   if(!$('packetlab-overlay').hidden)closeLab();
   else if(!$('presentation-overlay').hidden)closeStage();
  }else if(!$('presentation-overlay').hidden&&(e.key==='n'||e.key==='N')&&
     !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))toggleSpeakerNotes();
  else if(!$('presentation-overlay').hidden&&e.key==='ArrowRight')advance(1);
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
 $('packetlab-close').textContent=state.returnToStage?'← Volver a la exposición':'✕ Cerrar';
 $('packetlab-overlay').hidden=false;
 if($('presentation-overlay'))$('presentation-overlay').hidden=true;
 run();
 $('pl-trace').focus();
}
function closeLab(){
 if($('packetlab-overlay'))$('packetlab-overlay').hidden=true;
 if(state.returnToStage){
  state.returnToStage=false;
  $('presentation-overlay').hidden=false;
  renderStage();
  $('stage-next').focus();
 }
}
function openStage(){
 state.returnToStage=false;closeLab();$('presentation-overlay').hidden=false;
 $('stage-notes').hidden=true;$('stage-notes-toggle').setAttribute('aria-pressed','false');
 state.stage=0;renderStage();$('stage-next').focus();
}
function toggleSpeakerNotes(){
 const notes=$('stage-notes');notes.hidden=!notes.hidden;
 $('stage-notes-toggle').setAttribute('aria-pressed',String(!notes.hidden));
}
function closeStage(){if($('presentation-overlay'))$('presentation-overlay').hidden=true;}
function advance(step){state.stage=Math.max(0,Math.min(scenes.length-1,state.stage+step));renderStage();}
function renderStage(){
 if(!$('stage-title'))return;
 const item=scenes[state.stage];
 $('stage-kicker').textContent=item.kicker;
 $('stage-title').textContent=item.title;
 $('stage-notes-text').textContent=item.notes;
 $('stage-ci').hidden=state.stage!==3;
 $('stage-lab').textContent=state.stage===3?'Probar DNS, SSH y WAN →':'Abrir simulador interactivo →';
 $('stage-description').textContent=item.description;
 $('stage-progress').textContent=(state.stage+1)+' / '+scenes.length+' · '+item.time;
 $('stage-prev').disabled=state.stage===0;
 $('stage-next').disabled=state.stage===scenes.length-1;
 const cards=$('stage-facts');cards.replaceChildren();
 for(const fact of item.facts)cards.append(element('div','stage-fact',fact));
}
window.PacketWorkbench=Object.freeze({openLab,closeLab,openStage,closeStage,run,preset,wanAction,
 get last(){return state.last;},get stage(){return state.stage;}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
})();
