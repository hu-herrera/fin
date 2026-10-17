# Guía del simulador web — demostración y presentación de avances

**Objetivo del trabajo:** construir un simulador educativo de topologías empresariales Cisco + Palo Alto para **23 sedes y 650 PCs**, interactivo y visual, que pueda demostrarse en una página web. **No exige comprar routers ni certificar una instalación real.**

## Qué tipo de simulador es

La página integra tres niveles de comportamiento:

1. **Topología y fallos de infraestructura:** dos miembros de Catalyst C9200L con StackWise-80, LACP hacia el PA-1410 (Po20), LACP Cisco C8300–PA (Po10), cuatro WAN con prioridad, caída de un ISP, fallo de gateway/upstream, switch, firewall y partición del fabric.
2. **Encaminamiento y políticas:** VLAN10 usuarios, VLAN20 voz, VLAN30 gestión, VLAN40 invitados. Direcciones/gateways, rutas y acceso intersede vía casa matriz, reglas de seguridad PAN-OS simuladas y decisiones de allow/deny. No se publican invitados hacia otras sedes.
3. **Consolas y Ping / Trace:** CLI interactiva de **subconjuntos** de comandos Cisco/PAN-OS y pruebas ICMP locales o entre sedes desde la pestaña existente. El resultado distingue respuesta local, bloqueo por política y falta de ruta. La LAN muestra los pasos por switches y un RTT estimado; estos pasos no equivalen a saltos IP de un traceroute.

**Importante:** a diferencia de GNS3/EVE-NG/Cisco CML, el navegador no ejecuta máquinas virtuales ni el sistema operativo auténtico de los fabricantes. Tampoco abre sockets TCP reales hacia los servidores simulados. Un resultado `PERMITIDO` indica forwarding permitido por el modelo, no una respuesta de un servidor DNS/banco ni una SA IPsec establecida. Es un simulador determinista de escenarios con interactividad; no un reemplazo de emulación de imagen IOS-XE/PAN-OS.

## Entradas nuevas de la interfaz

- **Ping / Trace dentro del simulador original:** seleccionar una sede, pulsar **Ver topología interna completa** y abrir **📡 Ping / Trace**. Dejar **Otro PC de esta sede** para la prueba local y elegir los PCs origen y destino. El recorrido se anima sobre la misma topología, con ida y respuesta; con movimiento reducido queda resaltado sin animación. Elegir otra sede para observar el bloqueo ICMP de la política actual. El resultado permanece en la misma ventana y el bloqueo puede mostrarse sobre el mapa.
- **StackWise / LACP:** los controles de cable WAN, gateway ISP y salida aguas arriba afectan al mismo modelo que el mapa, las métricas y las consolas. Al fallar Starlink, se selecciona Amazon Leo si está sano en el escenario. Esto no supone un servicio comercial contratado.
- **Puertos y consolas del stack:** ambas consolas comparten la configuración de interfaces. Un puerto apagado deja de ser utilizable por el modelo y desaparece de su tabla MAC; se puede recuperar desde cualquiera de las dos consolas. `write memory` guarda un único startup-config del stack en este navegador.
- **Restaurar:** recupera los equipos, cables y fallos WAN del escenario; conserva los comandos y configuraciones CLI. Una interfaz con `shutdown` requiere `no shutdown`.
- **E3 Router CM:** simula la caída y recuperación del único router de casa matriz. No hay un segundo C8300 ni HSRP en el perfil activo; la conmutación local de una misma VLAN sigue disponible cuando el router cae.
- **▣ Presentar:** ventana proyectable sobre **la misma web**. El botón de demostración abre el modal de S01 en la pestaña Ping / Trace. Seis escenas navegables con flechas de teclado, notas por escena (**N**) y retorno a la escena después de cerrar la sede. El guion de avance está en [Presentación 16 de octubre](presentacion-avances-16-octubre-2026.md).

No es necesario PowerPoint. El [guion de seis escenas](presentacion-avances-16-octubre-2026.md) incluye los cinco puntos exigidos por el profesor, tiempos, secuencia de clics y preguntas probables. El guion se puede revisar después de recibir retroalimentación.

## Navegación del mapa y terminales de PC

La rueda acerca y aleja alrededor del punto del cursor, también en los márgenes de la vista país. Arrastrar mueve el mapa desde el fondo, una sede, una antena o un satélite; un arrastre no abre el equipo. Un clic selecciona sin cambiar el zoom; doble clic acerca al punto indicado. **País** restablece el encuadre y **RM** centra Santiago. Los controles y el listado del ping conservan sus propios clics y desplazamiento.

Los 650 PCs de las 23 sedes tienen IPv4 única por sede (`PC 001 → 10.70.<sede>.10`, `PC 002 → 10.70.<sede>.11`, etc.), máscara `/25` (`255.255.255.128`) y gateway `10.70.<sede>.1`. En DESPUÉS ese gateway es el Palo Alto. La configuración del PC identifica el miembro y puerto correctos de StackWise; una IP configurada no garantiza que su puerto o gateway estén activos.

Al pulsar un PC de la topología se abren **Config** y **Terminal**. Comandos: `help`, `hostname`, `ipconfig`, `ipconfig /all`, `ping <IP>`, `tracert <IP>` / `traceroute <IP>`, `route print`, `arp -a`, `clear` / `cls` y flechas de historial. El ping usa los mismos hosts y políticas que la herramienta de la sede: la LAN puede seguir funcionando sin gateway y no se inventan respuestas de Internet. ARP muestra PCs locales aprendidos durante esta sesión; el recorrido es lógico, sin TTL medidos.

Desde el PC 001, `console router`, `console sw1`, `console sw2` o `console fw` abre el mismo motor de comandos de los equipos mediante un **cable local simulado de laboratorio**. Se pueden consultar y cambiar las configuraciones existentes; **Volver al terminal del PC**, Escape o salir de EXEC de usuario vuelve al PC conservando su historial. Una consola local no depende de la conectividad Ethernet, pero el equipo destino debe estar encendido. La configuración interactiva de dispositivos se realiza en DESPUÉS.

Esto no crea acceso SSH desde usuarios a gestión. Los PCs están en VLAN 10 y no tienen autorización para administrar los equipos por red. El comando `ssh` ya no salta los controles ni confunde el gateway del Palo Alto con el router. Telnet no está habilitado. El navegador simula un conjunto de comandos; no ejecuta sistemas Windows, IOS-XE, PAN-OS ni servicios SSH reales.

## Ping entre sedes desde el mapa principal

No hace falta abrir la topología. Usa **Seleccionar origen → destino** y pulsa las dos sedes sobre el mapa, o **Ping / Trace entre sedes** para elegir también los PCs exactos. Al enviar desde el formulario se cierra esa ventana y se muestra el mapa.

La tarjeta identifica los PCs, las IPs y la política. Si ICMP está denegado, indica la regla y resalta el tramo hasta el firewall de origen; no muestra una llegada al destino. **Permitir solo este par ICMP y repetir** aplica la misma excepción temporal del ping interno. **Quitar excepción ICMP y repetir** restaura el bloqueo.

En una ruta permitida, el punto amarillo avanza con la solicitud y el azul vuelve con la respuesta. **Pausar**, **Continuar**, **Siguiente paso** y **Repetir** permiten explicar cada tramo, incluyendo el hub de Casa Matriz y la WAN activa. **Ver recorrido paso a paso** identifica dispositivos y tramos; los elementos internos del operador son ilustrativos, no saltos TTL medidos. Con movimiento reducido se muestra directamente el resultado y el recorrido estático.

El resultado permanece visible hasta **Ocultar** o una nueva prueba. Un cambio de red lo marca como **Interrumpido**; hay que repetir para evaluar el estado actual. La respuesta solo se registra al finalizar, y no se conserva un callback de éxito después de una caída.

## Ensayos de demostración recomendados

| Ejercicio | Entrada | Resultado del modelo |
|---|---|---|
| Ping local en S01 | Destino “Otro PC de esta sede” | Respuesta simulada, pasos de switching y RTT estimado visibles sin cerrar la ventana |
| Bloqueo intersede | Elegir S02 desde S01 | ICMP bloqueado por la política del PA-1410; la regla se indica en pantalla |
| Permitir solo dos PCs | Elegir S02, pulsar **Permitir solo este par ICMP**, enviar ping | Respuesta si los puertos, VLAN, gateway, hub y WAN están sanos; solo se permite ICMP del origen /32 al destino /32 elegido |
| Volver al bloqueo | Pulsar **Quitar excepción ICMP** y enviar ping | La política original vuelve a denegar ICMP |
| Ver el bloqueo | Desde la denegación intersede, abrir el mapa | El mapa marca el ping como descartado |
| Todos los enlaces WAN caídos | Simular caída WAN desde StackWise / LACP | WAN sin servicio; los hosts de la misma VLAN aún pueden comunicarse localmente |
| Caída Po10 | Cortar T1 y T2 del enlace C8300–PA | Sin salida al router; la LAN y el gateway del Palo Alto siguen disponibles |
| Fabric StackWise partido | Cortar STACK-A y STACK-B | No se garantiza gateway ni L2 entre miembros |
| Inter-VLAN no autorizada | Usuarios hacia gestión VLAN30 | Política denegada |
| Acceso a invitados remotos | VLAN40 cruzando sedes | No se anuncia por OSPF |

La excepción `LAB-ICMP-HOST-PAIR` es una regla educativa temporal aplicada por el evaluador de paquetes a ambos extremos. No se guarda, no se exporta como configuración PAN-OS, no habilita otros PCs ni aplicaciones y no recupera enlaces caídos. Se elimina con **Reset**, al recargar la página o al pulsar **Quitar excepción ICMP**. Solo admite PCs de VLAN 10. El mapa usa los mismos PCs elegidos en Ping / Trace.

## Estado actual y pruebas

- `node tests/packet-simulator.test.cjs`: forwarding simulado, reglas PAN-OS, pérdidas WAN, fallos de C8300/PA y StackWise.
- `npx playwright test tests/packet-workbench.spec.cjs --browser chromium`: pruebas del Ping / Trace original y seis escenas del modo presentación.
- `node network/site-readiness-report.cjs --json`: comprobación del inventario de 23 sedes, 650 PCs y limitaciones de configuración física, útil como anexo técnico, no como requisito para presentar.

El trabajo está **preparado para elaborar el speech** cuando la última suite CI esté verde. El mapa, la topología, Ping / Trace y la presentación pertenecen a una única página. El documento [insumos físicos](insumos-fase-fisica.md) es optativo, para una empresa que realmente fuera a desplegar la red.

## Qué todavía no pretende simular

No existe un sistema IOS-XE/PAN-OS virtual completo, negociación criptográfica IKEv2, paquetes Ethernet binarios, temporizadores de convergencia física, sesiones reales DNS/TACACS/HTTPS, DHCP sobre red real ni métricas medidas desde operadores. Esas son ampliaciones diferentes de este proyecto educativo y no deberían afirmarse en la exposición.

La prioridad ahora es **coherencia, interacción, belleza visual, explicación técnica y pruebas reproducibles**.


## Base ANTES consolidada (17-10-2026)

Las 23 ubicaciones usan MPLS cableado como premisa académica, incluidas Hanga Roa y Antártica; no hay respaldo satelital/móvil. Los 100 Mbps remotos son capacidad nominal supuesta. CM conserva dos ISP distintos del MPLS, dos routers, stack y ASA único. Ver [definición y procedencia](escenario-original-consolidado.md).

- Cortar MPLS nacional: las 22 sucursales pierden acceso central; reset restaura también S21/S22.
- Abrir CM y cortar el acceso MPLS central: se aíslan las remotas, sin apagar automáticamente los hosts ni la LAN local.
- Apagar SW1 de CM: DC-01 y BKP-01 siguen encendidos pero pierden su enlace único; SW2 conserva DC-02 y sus dependencias. Apagar SW2 afecta telefonía/DNS/NMS. No hay clúster ni NIC redundante supuestos.
- El mapa y Ping/Trace interno comparten esas decisiones. Ningún ping demuestra registro telefónico, aplicación, respaldo restaurable o disponibilidad contractual.
