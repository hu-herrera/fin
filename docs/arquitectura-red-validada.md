# Arquitectura acordada — Financiera Pacífico

Estado: arquitectura validada por el usuario el 15 de octubre de 2026, implementada en la vista **DESPUÉS** del simulador y cubierta por CI. **No certifica implementación sobre equipos físicos.** Las descripciones históricas de esta decisión más abajo deben leerse como requisitos de origen, no como trabajo todavía sin realizar en la web.

**Fuente activa:** `network/active-profile.js` (topología), `network/redundant-configs.cjs` (plantillas candidatas) y `tests/active-topology.spec.cjs` (pruebas de navegador). El diseño vigente es Cisco C8300 Po10 ↔ Palo Alto PA-1410 ae1 Layer3 ↔ ae2/Po20 MEC ↔ dos C9200L con StackWise-80; 23 sedes/650 PCs. La vista **ANTES** conserva la arquitectura legacy únicamente para comparación.

**Dependencias de despliegue no comprobadas:** contratos WAN/IPsec/OSPF reales; aprovisionamiento DNS/NTP/AAA; licencias/transceptores; 46 kits mínimos C9200L-STACK-KIT para los 23 stacks si no vienen incluidos; scopes DHCP o configuración IP estática de clientes físicos; validación PAN-OS/IOS-XE en laboratorio. Los equipos de gestión OOB adicionales siguen siendo opcionales. Ver [DHCP y StackWise](dhcp-invitados-y-stackwise.md), [protocolo de hardware](protocolo-laboratorio-iosxe-panos.md) y [auditoría de conformidad](auditoria-conformidad-dispositivos.md).

## Orden de tráfico
Proveedores WAN (Starlink / Amazon Leo / Entel 5G / GTD 4G) → Cisco C8300 (selección WAN, rutas y VPN) → Palo Alto PA-1410 (control perimetral y segmentación, modo operativo por validar) → switches Catalyst → usuarios.

## Conectividad física objetivo
- Dos cables Router ↔ Firewall.
- Dos cables Firewall ↔ SW1.
- Dos cables Firewall ↔ SW2.
- Dos cables SW1 ↔ SW2.
- El dibujo se actualizará al final, según petición explícita del usuario.

## Reglas técnicas obligatorias
- NO afirmar que dos cables equivalen automáticamente a EtherChannel, alta disponibilidad ni recuperación tras caída de equipo.
- LACP requiere agregación compatible en ambos extremos. Un port-channel no puede extenderse a dos Catalyst independientes sin una solución multichasis/stack admitida; validar modelos y licencias antes de elegir.
- Verificar modos PAN-OS: interfaces virtual-wire vs Layer3 y soporte efectivo de aggregate Ethernet/LACP; no inventar ni asumir una agregación entre firewall y dos switches independientes.
- Establecer política antibucles, distribución de VLAN, gateways y rutas antes de activar enlaces físicos adicionales.
- Probar por separado fallo de miembro LACP, fallo de switch, fallo del firewall, pérdida de salida ISP con gateway aún accesible y fallos IPsec/OSPF.
- NO inventar configuración operativa de fabricante ni afirmar pruebas físicas: el proyecto es un simulador web. Distinguir comandos objetivos, estado modelado y validación sobre hardware real.
- No sustituir claves de ejemplo por credenciales reales en el repositorio.

## Estado observado antes de correcciones
- index.html representa "Stack 10G" y a la vez genera switches independientes con solo Gi1/0/45 entre ellos.
- La CLI indica que no existe EtherChannel; las pruebas browser.spec.cjs verifican erróneamente esa ausencia.
- Router maneja gateways VLAN y Palo Alto virtual-wire: todavía NO se ha migrado a Layer 3.
- Hay discrepancias de failover WAN y peer/túneles IPsec que requieren auditoría.
- Seguimiento en issues #1 y #2.

## Orden de ejecución
1. Verificar compatibilidad real de modelos y definir topología lógica y esquema IP.
2. Implementar modelos de puertos, vínculos, agregaciones válidas, estados y fallas sin falsear comportamiento.
3. Ajustar configuraciones y CLI del router, Palo Alto y switches con controles de coherencia.
4. Añadir pruebas por sede y escenarios de fallo; no aceptar tests basados solamente en strings.
5. Revisar topología visual al final, tras concordancia funcional y documental.

## Avance implementado — 15 de octubre de 2026
- En `index.html`: Po1 SW1↔SW2 con LACP active en Gi1/0/45 y Gi1/0/46 de ambos Catalyst **independientes**, troncal VLAN 10,20,30,40 y native VLAN 999; gestión PA movida en el modelo de Gi1/0/46 a Gi1/0/44 en SW1. El grafo de conectividad acepta uno o dos miembros activos y cae solo cuando ambos miembros dejan de estar operativos.
- Diagnóstico dinámico: `show etherchannel summary` muestra `Po1(SU)` o `Po1(SD)` y el estado `(P)/(D)` de cada miembro; `show interfaces trunk` presenta el puerto lógico, y la consola permite `shutdown` de `interface Port-channel1`.
- `tests/browser.spec.cjs`: auditoría LACP y escenarios de fallo individual, corte total y recuperación para cada sede. Workflow `.github/workflows/validate-lan.yml` incorporado; **LAN/LACP aprobadas y suite general 17/17 aprobada** en commit `aed2e082` (GitHub Actions, 2026-10-16).
- **Límite de esta primera fase**: la redundancia de dos cables SW1↔SW2 NO protege ante la caída de SW1 ni ante la del único firewall. La topología visual todavía dice Stack 10G; se corregirá al final según lo pedido. Los dobles uplinks router/firewall/switches y el modo Layer 3 del PA siguen pendientes de implementación.

Referencias de fabricante:
- Cisco EtherChannel Catalyst 9200: https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/software/release/17-8/configuration_guide/lyr2/b_178_lyr2_9200_cg/configuring_etherchannels.html
- Cisco StackWise-80 C9200L: https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-stackwise-architecture-cte-en.html
- PAN-OS Aggregate Ethernet LACP y modos: https://docs.paloaltonetworks.com/ngfw/help/11-1/network/network-interfaces/aggregate-ethernet-ae-interface-group

## Restricción adicional verificada: puertos físicos C8300 y LACP al firewall
La ficha de Cisco para C8300-2N2S-4T2X especifica **4 puertos RJ45 de 1GbE y 2 puertos SFP+ de 10GbE**. El Cisco 8300 admite EtherChannel L3 (LACP) en puertos onboard, pero un mismo bundle debe tener miembros de velocidad compatible. Fuentes:
- https://www.cisco.com/c/en/us/products/collateral/routers/catalyst-8300-series-edge-platforms/cat-8300-8200-series-edge-plat-og.html
- https://www.cisco.com/c/en/us/products/collateral/networking/sdwan-routers/8000-series-secure-routers-faq.html

**Asignación modelada actual:** Gi0/0/0 = conexión LAN hacia PA; Gi0/0/1 Starlink, Gi0/0/2 Leo, Gi0/0/3 5G, Te0/0/4 4G. Por tanto, los puertos integrados no dejan otro 1GbE libre para un LACP 2x1GbE Router↔PA sin reasignación del cableado y/o un NIM adecuado. No agregar ficticiamente un segundo Gi0/0/x. Antes de migrar PA a Layer3, cerrar un plan de puertos que preserve cuatro WAN y dos enlaces a firewall, verificando transceptores, módulos y velocidades negociadas.

## Evidencia de integración automática
- Validación general (17/17): https://github.com/hu-herrera/fin/actions/runs/38827619114
- Validación LAN/LACP: https://github.com/hu-herrera/fin/actions/runs/38827619121
- Publicación GitHub Pages: https://github.com/hu-herrera/fin/actions/runs/38827617977
- Cobertura: verificación de simulación y consistencia, no pruebas sobre hardware físico ni garantía de disponibilidad ante fallos de un equipo completo.

## Auditoría adicional de consolas (2026-10-16)
- Se eliminaron afirmaciones no respaldadas de sesiones BGP, BFD, IPsec, HA Palo Alto, NTP sincronizado, estados de Threat Prevention/WildFire y MAC/counters inventados. La consola aclara cuándo muestra *modelo lógico de laboratorio* y no telemetría de equipos físicos.
- Diagnósticos OSPF, CEF, WAN y direccionamiento usan ahora interfaces concordantes con el perfil C8300: Gi0/0/0 LAN con VLAN 10,20,30,40; Gi0/0/1 Starlink, Gi0/0/2 Leo, Gi0/0/3 Entel, Te0/0/4 GTD. Los túneles son Tunnel100/200/300/400, no Tunnel0. Los OSPF vecinos reales, VPN SAs, latencias y contadores siguen **sin medición física**.
- Suite ampliada a pruebas de regresión sobre consistencia Cisco/PAN-OS. Ejecución 18/18 aprobada (commit `b5b801b1`): https://github.com/hu-herrera/fin/actions/runs/38827959974. Las nuevas verificaciones OSPF/CEF por sede se ejecutaron con éxito: **19/19 pruebas** en https://github.com/hu-herrera/fin/actions/runs/38828262310 (commit `8020272c`).

## Estado de la última validación (2026-10-16)
- Suite principal: **22/22 pruebas Playwright** y **8/8 WAN unitarias** aprobadas: https://github.com/hu-herrera/fin/actions/runs/38830771341
- Correcciones de STP, puertos administrativamente apagados, RIB WAN, distancias de backup, concentración CM, IKEv2 y estado IP SLA incluidas.
- Plan de redundancia *de equipos* compatible con modelos Cisco y Palo Alto: [docs/plan-puertos-redundancia-propuesto.md](plan-puertos-redundancia-propuesto.md). Es candidato pendiente de migración, no activo todavía. No confundir Po1 inter-switch vigente con el anillo físico StackWise.

## Validación posterior (2026-10-16)
- [GitHub Actions 24/24 PASS](https://github.com/hu-herrera/fin/actions/runs/38831383312) + WAN unitario: grafo intersede coherente con caída/restauración de casa matriz, AP trunks VLAN nativa y permitidas validadas en 46 switches.
- **No cambia** que la topología Layer3+StackWise del nuevo documento sea solo diseño candidato pendiente de migración integral.

## Laboratorio interactivo integrado (octubre de 2026)
- En `index.html`, pestaña por sede **🧪 StackWise / LACP**: utiliza el motor `network/redundant-browser.js`, generado desde `network/redundant-model.cjs` y `network/redundant-configs.cjs`.
- Se pueden simular fallos de C8300/PA/SW1/SW2, de Po10 (2×10G), Po20 (4×1G), de los dos cables StackWise y de ISP con distinción entre interfaz, gateway y salida real aguas arriba. Indicadores separados de conmutación VLAN, L2 local, gateway Palo Alto y conectividad al Cisco/Internet.
- Pestaña **🧪 Objetivo L3** dentro del dispositivo permite consultar las configuraciones candidatas Cisco/Palo Alto/StackWise junto a la consola histórica; no modifica running-config.
- CI: [28/28 pruebas Playwright](https://github.com/hu-herrera/fin/actions/runs/38842086249), 8/8 WAN unitarias, 162 escenarios de falla, 1.615 aserciones de redundancia, 23 sedes/650 PCs/2.237 verificaciones del plan.
- El **laboratorio candidato** está integrado en el sitio web; la **topología de operación principal** continúa siendo la antigua hasta que se completen administración segura VLAN30, políticas PAN-OS, IP SLA real, IPsec/OSPF y la migración de CLI y rutas. OOB físico con hardware adicional es opcional. El dibujo sigue reservado para el ajuste final.

## Ingeniería adicional sin activar el cambio físico
- Aislamiento lógico invitados: VLAN40 se excluye del OSPF entre sedes y se bloquea con política PAN-OS hacia redes RFC1918 por tránsito.
- Cisco NAT candidato: cuatro route-maps de traducción, uno por interfaz WAN, sin NAT indiscriminado de la VLAN de gestión.
- IP SLA candidato: ocho pruebas externas, dos por WAN con rutas estáticas /32 propias y objetos de seguimiento compuestos. **No se instala aún**: faltan gateway/máscara/targets permitidos por proveedor y confirmar conectividad en Chile.
- IPAM de casa matriz: ocho direcciones reservadas para DNS, TACACS, NTP y NOC sin colisionar con los 55 PCs; su existencia como servidores no está comprobada.
- Corrección de las salidas OSPF de diagnóstico que declaraban vecino FULL simulado como si fuera una adyacencia real.

## Rutas intersede autorizadas y política de seguridad (octubre 2026)
- C8300 anuncia por OSPF solo VLAN10/20/30 con prefix-list y ruta estática vía Palo Alto; VLAN40 invitados se mantiene fuera del overlay.
- PA-1410 en Layer3 conserva la ruta por defecto de cada sede hacia el Cisco `10.72.N.1`. Los flujos iniciados por sucursales hacia DNS y NTP de casa matriz tienen reglas específicas con origen, destino, aplicación y servicio restringidos; las respuestas de sesiones autorizadas siguen el estado del firewall.
- La casa matriz limita sus permisos de entrada a DNS `10.70.0.110`/`.111` desde las subredes de usuarios/gestión de las 22 sucursales y NTP `.116`/`.117` desde sus redes de gestión. Cualquier otra comunicación intersede queda bloqueada hasta aprobación de una matriz de aplicaciones.
- La gestión ordinaria usa los dos Catalyst existentes y VLAN30 protegida. El esquema OOB físico `10.73.N.0/28` es una **opción no incluida en equipos base**.

## Estado operativo del simulador — migración Layer3/StackWise completada (octubre 2026)

**La vista DESPUÉS ya usa el perfil StackWise/Layer3 como modelo principal.** La vista ANTES conserva el modelo histórico y sus pruebas para comparación.

- Cisco C8300: WAN separadas Gi0/0/0..3; Po10 L3 sobre Te0/0/4 y Te0/0/5 hacia PA. RIB con tránsito conectado `10.72.N.0/30` y VLAN 10/20/30/40 mediante rutas estáticas hacia `10.72.N.2`; ya no hay subinterfaces router-on-a-stick.
- PA-1410: Layer3 ae1 (2×10G) y ae2 (4×1G), gateways locales VLAN10/20/30/40, zonas y reglas intersede limitadas a servicios centrales. Gestión por VLAN30 y consola; MGT físico/OOB adicional **opcional**, no incluido como compra.
- C9200L: **un único stack lógico de dos miembros**, StackWise-80 con dos cables traseros, Po20 LACP distribuido sobre Gi1/0/45–46 y Gi2/0/45–46; los 650 PCs permanecen repartidos entre los miembros. La caída de SW1 no implica disponibilidad de PCs físicamente conectados a SW1, mientras SW2 conserva sus propios enlaces.
- Topología SVG corregida por completo: cuatro WAN, dos enlaces router–PA, cuatro enlaces PA–stack, dos cables StackWise independientes y PCs según inventario.
- El trazador de paquetes evalúa ahora las reglas PAN-OS **antes** de afirmar rutas intersede, por lo que ICMP entre equipos de sedes distintas no autorizados se bloquea aun cuando los enlaces WAN estén sanos.
- Datos reales no aportados: IP/gateway/MTU/probes de cada ISP, pares reales IPsec, claves, transceptores, PAN-OS licenciado, AAA, perfiles IPS y pruebas físicas de negociación. El simulador **no certifica** estos elementos ni transforma Amazon Leo en servicio contratado/operativo en Chile.

**Evidencia del código publicado:** [39/39 Playwright + 8/8 WAN unitarias](https://github.com/hu-herrera/fin/actions/runs/38865831814), 185 escenarios de redundancia, 2.029 aserciones, 2.536 validaciones Cisco/PAN/StackWise, 911 comprobaciones de política, 1.274 intersede, 1.162 IP SLA y 784 opcionales de OOB.

La base operativa usa `network/active-profile.js`, el modelo `network/redundant-model.cjs`, las configuraciones `network/redundant-configs.cjs` y las pruebas `tests/active-topology.spec.cjs`. **Los comandos son una representación de laboratorio**: no se ha conectado a routers, switches o firewalls físicos para ejecutar commit.
