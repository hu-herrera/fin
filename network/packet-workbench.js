/* Presentation view of the original site simulator and its Ping / Trace tab. */
(function(){
'use strict';

if(!window.ActiveProfile||!window.RedundantLab)return;
const $=id=>document.getElementById(id);
const state={stage:0,returnToStage:false};
const scenes=[
 {kicker:'01 / Presentación del avance',title:'Financiera Pacífico',
  description:'Proyecto de Título · Simulador interactivo de redes empresariales con infraestructura Cisco y Palo Alto. Revisión de avances del 16 de octubre de 2026.',
  facts:['23 sedes representadas','650 equipos de usuario modelados','Una página para explicar y demostrar'],
  time:'0:40',
  notes:'Buenas tardes, profesor. Nuestro Proyecto de Título es un simulador web de redes empresariales, basado en una financiera ficticia con 23 sedes y 650 computadores. La propuesta integra equipos Cisco y firewalls Palo Alto en un mismo entorno visual. Hoy mostraremos los avances desde la revisión anterior, lo que ya funciona, evidencias de las pruebas, los problemas que resolvimos y lo que todavía debemos desarrollar. No estamos presentando una red física instalada, sino un simulador académico.'},
 {kicker:'02 / Avances desde la última revisión',title:'Del diseño a la interacción',
  description:'Pasamos de diagramas y configuraciones candidatas a un modelo interactivo: enlaces LACP, stack, rutas, reglas de firewall y pruebas Ping / Trace en el navegador.',
  facts:['Topología Cisco C8300 → PA-1410 → StackWise','Ping / Trace incorporado','Regresiones de red automatizadas'],
  time:'1:00',
  notes:'Desde nuestra última revisión avanzamos en la arquitectura y en su comportamiento interactivo. Modelamos un Cisco C8300 conectado al PA-1410 por LACP, seguido de dos Catalyst C9200L unidos por StackWise. Integramos cuatro opciones WAN, sus prioridades y las VLAN de usuarios, voz, gestión e invitados. Mejoramos el Ping/Trace de la topología para mostrar el resultado, el recorrido lógico y el RTT estimado. Los cambios se verifican con pruebas automatizadas.'},
 {kicker:'03 / Estado actual e implementaciones',title:'Una red que responde',
  description:'La topología DESPUÉS está operativa en el modelo: se puede explorar cada sede, abrir consolas simuladas, revisar políticas, interrumpir enlaces y observar rutas alternativas.',
  facts:['LACP Po10 + Po20 y fabric StackWise','Gateway y segmentación en Palo Alto','Consolas IOS-XE y PAN-OS simplificadas'],
  time:'1:00',
  notes:'En su estado actual tenemos 23 sedes y 650 computadores representados. Cada sede incluye router Cisco, firewall Palo Alto, dos switches formando un stack lógico y cuatro rutas WAN modeladas. El firewall es la puerta de enlace de las VLAN 10, 20, 30 y 40. Las consolas aceptan un subconjunto educativo de comandos, y los cambios que representamos en ellas influyen en el estado de los enlaces y los paquetes. Es importante diferenciarlo de GNS3: nuestro navegador modela comportamientos de red; no ejecuta binarios reales de IOS-XE o PAN-OS.'},
 {kicker:'04 / Evidencias de trabajo',title:'La red demuestra lo que hace',
  description:'Demostración en vivo: comprobar el ping local de S01, explicar por qué el firewall bloquea ICMP hacia S02 y observar el cambio de WAN al simular una caída.',
  facts:['Ping local: respuesta y recorrido por switches','Ping intersede: regla de bloqueo visible','Fallos WAN y recuperación en el mismo modelo'],
  time:'1:40',
  notes:'Abrimos S01 y entramos a Ping / Trace. Primero dejamos Otro PC de esta sede y enviamos el ping: observamos la respuesta local, los pasos por switches y el RTT estimado. Después elegimos S02: la política actual bloquea ICMP entre sedes y el resultado identifica la regla del firewall. Podemos mostrar ese bloqueo en el mapa. Finalmente abrimos StackWise / LACP, interrumpimos Starlink y observamos el proveedor alternativo; al restaurar el escenario, la WAN principal se recupera. Son resultados del modelo educativo.'},
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
 const stageBtn=element('button','', '▣ Presentar');
 stageBtn.id='presentation-launch';stageBtn.type='button';stageBtn.title='Vista proyectable, sin diapositivas';
 stageBtn.addEventListener('click',()=>openStage());
 toolbar.append(stageBtn);
 // Ping / Trace utiliza la herramienta ya existente en la sede.

 const stage=element('div','stage-overlay');stage.id='presentation-overlay';stage.hidden=true;
 stage.setAttribute('role','dialog');stage.setAttribute('aria-label','Modo presentación');
 stage.setAttribute('aria-modal','true');
 stage.innerHTML=`<section class="stage-panel">
 <div class="stage-top"><span class="stage-kicker">FINANCIERA PACÍFICO · DEMO EN VIVO</span>
 <button class="stage-close" type="button" id="stage-close">✕ Volver al simulador</button></div>
 <div class="stage-content">
 <div><span class="stage-kicker" id="stage-kicker"></span><h2 id="stage-title"></h2>
 <p id="stage-description" class="stage-description"></p>
 <div class="stage-actions"><button class="packetlab-btn primary" type="button" id="stage-lab">Abrir Ping / Trace de S01 →</button>
 <button class="packetlab-btn" type="button" id="stage-notes-toggle" aria-pressed="false">Guion del expositor</button>
 <a class="packetlab-btn" id="stage-ci" href="https://github.com/hu-herrera/fin/actions/workflows/simulator-tests.yml" target="_blank" rel="noopener noreferrer">Ver evidencias CI ↗</a></div></div>
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
  if(ST.mode==='antes')toggleMode();
  openSedeModal('s01');
  smTab('ping',document.querySelector('#sm-tabs .sm-tab:nth-child(3)'));
 });
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
   // El modal de sede original maneja Esc primero (y marca defaultPrevented).
   // No cerrar la escena restaurada por el MISMO evento.
   if(e.defaultPrevented)return;
   if(state.returnToStage&&document.getElementById('sm-overlay')?.classList.contains('vis'))
     closeLab();
   else if(!$('presentation-overlay').hidden)closeStage();
  }else if(!$('presentation-overlay').hidden&&(e.key==='n'||e.key==='N')&&
     !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))toggleSpeakerNotes();
  else if(!$('presentation-overlay').hidden&&e.key==='ArrowRight')advance(1);
  else if(!$('presentation-overlay').hidden&&e.key==='ArrowLeft')advance(-1);
 });
 renderStage();
}
function detach(){}
function onSedeClosed(){
 if(state.returnToStage){
  state.returnToStage=false;
  $('presentation-overlay').hidden=false;
  renderStage();
  $('stage-next')?.focus();
 }
}
function closeLab(){
 if(state.returnToStage)closeSedeModal();
 else if(typeof SM_ID!=='undefined'&&SM_ID&&document.getElementById('sm-overlay')?.classList.contains('vis'))
  smTab('topo',document.querySelector('#sm-tabs .sm-tab'));
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
 $('stage-lab').textContent=state.stage===3?'Probar Ping / Trace de S01 →':'Abrir simulador interactivo →';
 $('stage-description').textContent=item.description;
 $('stage-progress').textContent=(state.stage+1)+' / '+scenes.length+' · '+item.time;
 $('stage-prev').disabled=state.stage===0;
 $('stage-next').disabled=state.stage===scenes.length-1;
 const cards=$('stage-facts');cards.replaceChildren();
 for(const fact of item.facts)cards.append(element('div','stage-fact',fact));
}
window.PacketWorkbench=Object.freeze({closeLab,detach,onSedeClosed,openStage,closeStage,get stage(){return state.stage;}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
})();
