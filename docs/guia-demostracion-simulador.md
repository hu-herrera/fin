# Guía del simulador web — demostración y presentación de avances

**Objetivo del trabajo:** construir un simulador educativo de topologías empresariales Cisco + Palo Alto para **23 sedes y 650 PCs**, interactivo y visual, que pueda demostrarse en una página web. **No exige comprar routers ni certificar una instalación real.**

## Qué tipo de simulador es

La página integra tres niveles de comportamiento:

1. **Topología y fallos de infraestructura:** dos miembros de Catalyst C9200L con StackWise-80, LACP hacia el PA-1410 (Po20), LACP Cisco C8300–PA (Po10), cuatro WAN con prioridad, caída de un ISP, fallo de gateway/upstream, switch, firewall y partición del fabric.
2. **Encaminamiento y políticas:** VLAN10 usuarios, VLAN20 voz, VLAN30 gestión, VLAN40 invitados. Direcciones/gateways, rutas y acceso intersede vía casa matriz, reglas de seguridad PAN-OS simuladas y decisiones de allow/deny. No se publican invitados hacia otras sedes.
3. **Consolas y Ping / Trace:** CLI interactiva de **subconjuntos** de comandos Cisco/PAN-OS y una prueba ICMP entre sedes desde la pestaña existente. El resultado muestra respuesta o timeout, ruta lógica y RTT estimado; la animación del mapa es una vista del mismo ping.

**Importante:** a diferencia de GNS3/EVE-NG/Cisco CML, el navegador no ejecuta máquinas virtuales ni el sistema operativo auténtico de los fabricantes. Tampoco abre sockets TCP reales hacia los servidores simulados. Un resultado `PERMITIDO` indica forwarding permitido por el modelo, no una respuesta de un servidor DNS/banco ni una SA IPsec establecida. Es un simulador determinista de escenarios con interactividad; no un reemplazo de emulación de imagen IOS-XE/PAN-OS.

## Entradas nuevas de la interfaz

- **Ping / Trace dentro del simulador original:** seleccionar una sede, pulsar el botón amarillo **Ver topología interna completa** y abrir **📡 Ping / Trace** (o pulsar **📡 Probar Ping / Trace** en la barra de topología). Elegir una sede destino y pulsar **Enviar ping**. El resultado queda visible en la misma ventana y presenta los saltos lógicos y el RTT estimado. El botón de mapa anima ese mismo ping.
- **↯ Cortar Starlink / ↺ Recuperar:** modifica la WAN de la sede en el escenario; la selección pasa a Amazon Leo mientras el resto de enlaces estén sanos. No significa que Amazon Leo esté contratado o disponible comercialmente.
- **Puertos de PC:** si el puerto de acceso de un PC es deshabilitado desde la CLI Cisco simulada, el trazador debe señalar `ACCESS_DOWN`, hasta restaurarlo.
- **▣ Presentar:** ventana proyectable sobre **la misma web**. El botón de demostración abre el modal de S01 en la pestaña Ping / Trace. Seis escenas navegables con flechas de teclado, notas por escena (**N**) y retorno a la escena después de cerrar la sede. El guion de avance está en [Presentación 16 de octubre](presentacion-avances-16-octubre-2026.md).

No es necesario PowerPoint. El [guion de seis escenas](presentacion-avances-16-octubre-2026.md) incluye los cinco puntos exigidos por el profesor, tiempos, secuencia de clics y preguntas probables. El guion se puede revisar después de recibir retroalimentación.

## Ensayos de demostración recomendados

| Ejercicio | Entrada | Resultado del modelo |
|---|---|---|
| Ping entre sedes | Ping local en S01 | Destino “Otro PC de esta sede” | Respuesta simulada, saltos de switching y RTT estimado visibles sin cerrar la ventana |
| Bloqueo intersede | Elegir S02 desde S01 | ICMP bloqueado por la política del PA-1410; la regla se indica en pantalla |
| Ver el bloqueo | Desde la denegación intersede, abrir el mapa | El mapa marca el ping como descartado |
| Todos los enlaces WAN caídos | Simular caída WAN desde StackWise / LACP | BLOQUEADO: WAN_DOWN |
| Caída Po10 | Cortar T1 y T2 del enlace C8300–PA | BLOQUEADO: TRANSIT_DOWN |
| Fabric StackWise partido | Cortar STACK-A y STACK-B | No se garantiza gateway ni L2 entre miembros |
| Inter-VLAN no autorizada | Usuarios hacia gestión VLAN30 | Política denegada |
| Acceso a invitados remotos | VLAN40 cruzando sedes | No se anuncia por OSPF |

## Estado actual y pruebas

- `node tests/packet-simulator.test.cjs`: forwarding simulado, reglas PAN-OS, pérdidas WAN, fallos de C8300/PA y StackWise.
- `npx playwright test tests/packet-workbench.spec.cjs --browser chromium`: pruebas del Ping / Trace original y seis escenas del modo presentación.
- `node network/site-readiness-report.cjs --json`: comprobación del inventario de 23 sedes, 650 PCs y limitaciones de configuración física, útil como anexo técnico, no como requisito para presentar.

El trabajo está **preparado para elaborar el speech** cuando la última suite CI esté verde. El mapa, la topología, Ping / Trace y la presentación pertenecen a una única página. El documento [insumos físicos](insumos-fase-fisica.md) es optativo, para una empresa que realmente fuera a desplegar la red.

## Qué todavía no pretende simular

No existe un sistema IOS-XE/PAN-OS virtual completo, negociación criptográfica IKEv2, paquetes Ethernet binarios, temporizadores de convergencia física, sesiones reales DNS/TACACS/HTTPS, DHCP sobre red real ni métricas medidas desde operadores. Esas son ampliaciones diferentes de este proyecto educativo y no deberían afirmarse en la exposición.

La prioridad ahora es **coherencia, interacción, belleza visual, explicación técnica y pruebas reproducibles**.
