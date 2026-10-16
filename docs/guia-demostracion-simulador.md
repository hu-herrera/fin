# Guía del simulador web — demostración y próximo speech

**Objetivo del trabajo:** construir un simulador educativo de topologías empresariales Cisco + Palo Alto para **23 sedes y 650 PCs**, interactivo y visual, que pueda demostrarse en una página web. **No exige comprar routers ni certificar una instalación real.**

## Qué tipo de simulador es

La página integra tres niveles de comportamiento:

1. **Topología y fallos de infraestructura:** dos miembros de Catalyst C9200L con StackWise-80, LACP hacia el PA-1410 (Po20), LACP Cisco C8300–PA (Po10), cuatro WAN con prioridad, caída de un ISP, fallo de gateway/upstream, switch, firewall y partición del fabric.
2. **Encaminamiento y políticas:** VLAN10 usuarios, VLAN20 voz, VLAN30 gestión, VLAN40 invitados. Direcciones/gateways, rutas y acceso intersede vía casa matriz, reglas de seguridad PAN-OS simuladas y decisiones de allow/deny. No se publican invitados hacia otras sedes.
3. **Consolas y laboratorio de paquetes:** CLI interactiva de **subconjuntos** de comandos Cisco/PAN-OS con estados de interfaz simulados; motor de trazado de paquetes que interpreta esas interfaces, la ruta activa y las políticas del firewall. Muestra en cada salto si el paquete avanza o por qué se descarta.

**Importante:** a diferencia de GNS3/EVE-NG/Cisco CML, el navegador no ejecuta máquinas virtuales ni el sistema operativo auténtico de los fabricantes. Tampoco abre sockets TCP reales hacia los servidores simulados. Un resultado `PERMITIDO` indica forwarding permitido por el modelo, no una respuesta de un servidor DNS/banco ni una SA IPsec establecida. Es un simulador determinista de escenarios con interactividad; no un reemplazo de emulación de imagen IOS-XE/PAN-OS.

## Entradas nuevas de la interfaz

- **⌁ Laboratorio de paquetes:** aparece en la barra superior. Seleccionar sede y PC concreto, VLAN de origen, aplicación y dirección destino. Pulsar *Simular flujo* para ver host → switch → gateway PA → regla → C8300 → WAN → túnel lógico → hub CM → firewall de destino.
- **DNS permitido:** usa destino `10.70.0.110` y aplicación DNS. La política modelada debe permitirlo desde una sucursal con conectividad.
- **SSH bloqueado:** el mismo destino por SSH debe fallar en la primera política restrictiva de Palo Alto.
- **↯ Cortar Starlink / ↺ Recuperar:** modifica la WAN de la sede en el escenario; la selección pasa a Amazon Leo mientras el resto de enlaces estén sanos. No significa que Amazon Leo esté contratado o disponible comercialmente.
- **Puertos de PC:** si el puerto de acceso de un PC es deshabilitado desde la CLI Cisco simulada, el trazador debe señalar `ACCESS_DOWN`, hasta restaurarlo.
- **▣ Presentar:** ventana proyectable sobre **la misma web**. Seis escenas navegables con flechas de teclado; la escena de seguridad lleva a SSH denegado y la de resiliencia a una caída de Starlink. **Este modo es una estructura visual, no el speech definitivo.**

No es necesario PowerPoint. Para la siguiente tarea de presentación, desarrollaremos el discurso, las transiciones, los tiempos, qué clicks mostrar y qué preguntas del profesor contestar.

## Ensayos de demostración recomendados

| Ejercicio | Entrada | Resultado del modelo |
|---|---|---|
| Conectividad a DNS CM | S01, PC `10.70.1.10`, DNS a `10.70.0.110` | PERMITIDO por ambas reglas PAN-OS, si WAN/hub/stack están bien |
| Acceso indebido a servicio central | S01, mismo PC, SSH a `10.70.0.110` | BLOQUEADO por política RFC1918 |
| Enlace WAN primario caído | Pulsar Cortar Starlink y repetir DNS | Otro enlace sano (Leo, si habilitado) seleccionado |
| Todos los enlaces WAN caídos | Bajar las 4 WAN desde el laboratorio existente | BLOQUEADO: WAN_DOWN |
| Caída Po10 | Cortar T1 y T2 del enlace C8300–PA | BLOQUEADO: TRANSIT_DOWN |
| Fabric StackWise partido | Cortar STACK-A y STACK-B | No se garantiza gateway ni L2 entre miembros |
| Inter-VLAN no autorizada | Usuarios hacia gestión VLAN30 | Política denegada |
| Acceso a invitados remotos | VLAN40 cruzando sedes | No se anuncia por OSPF |

## Estado actual y pruebas

- `node tests/packet-simulator.test.cjs`: forwarding simulado, reglas PAN-OS, pérdidas WAN, fallos de C8300/PA y StackWise.
- `npx playwright test tests/packet-workbench.spec.cjs --browser chromium`: interfaz de laboratorio, pruebas visuales de fallos y seis escenas del modo presentación.
- `node network/site-readiness-report.cjs --json`: comprobación del inventario de 23 sedes, 650 PCs y limitaciones de configuración física, útil como anexo técnico, no como requisito para presentar.

El trabajo está **preparado para elaborar el speech** cuando la última suite CI esté verde. El mapa, el laboratorio y la presentación pertenecen a una única página. El documento [insumos físicos](insumos-fase-fisica.md) es optativo, para una empresa que realmente fuera a desplegar la red.

## Qué todavía no pretende simular

No existe un sistema IOS-XE/PAN-OS virtual completo, negociación criptográfica IKEv2, paquetes Ethernet binarios, temporizadores de convergencia física, sesiones reales DNS/TACACS/HTTPS, DHCP sobre red real ni métricas medidas desde operadores. Esas son ampliaciones diferentes de este proyecto educativo y no deberían afirmarse en la exposición.

La prioridad ahora es **coherencia, interacción, belleza visual, explicación técnica y pruebas reproducibles**.
