# Evaluación de conformidad técnica por dispositivo — Financiera Pacífico

**Fecha:** 16 de octubre de 2026  
**Alcance:** 23 sedes (CM + S01–S22), 23 routers Cisco C8300, 23 firewalls Palo Alto PA-1410, 46 switches C9200L (23 stacks de dos miembros), 650 PCs modelados.  
**Versión base revisada:** `16700f0dda6868e59235bd5cd0fc836f40032530` de `hu-herrera/fin`.  
**Resultado formal:** **CONFORMIDAD DE MODELO / SIMULADOR: APROBADA EN LOS TESTS DEFINIDOS. CERTIFICACIÓN DE DISPOSITIVOS FÍSICOS: NO EMITIDA. CONFIGURACIONES PRODUCTIVAS: NO APTAS PARA DESPLIEGUE TODAVÍA.**

> El contenido de CiscoDevNet `cisco-ios-patterns` es una guía de revisión y de cambios seguros, no un mecanismo de certificación de fabricante. La aprobación de GitHub Actions no prueba que IOS-XE o PAN-OS hayan aceptado comandos, que se hayan negociado LACP/StackWise ni que existan circuitos, SA IPsec o licencias reales.

## Referencias normativas y evidencias

- [CiscoDevNet IOS Patterns skill](https://github.com/CiscoDevNet/skills/blob/main/skills/ios/cisco-ios-patterns/SKILL.md): capturar línea base, comparar comandos candidatos, validar ACL/wildcard, gestión, rollback, verificar antes de guardar.
- [Cisco C8300 datasheet](https://www.cisco.com/c/en/us/products/collateral/routers/catalyst-8300-series-edge-platforms/datasheet-c78-744088.html): 4 interfaces 1GbE y 2 interfaces 10GbE para `C8300-2N2S-4T2X`, no demuestra por sí sola que el port-channel negocie correctamente con la versión seleccionada.
- [Cisco C9200L StackWise-80](https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html): kit y cables StackWise específicos y compatibilidad de modelos/licencias.
- [Palo Alto PA-1410 puertos](https://docs.paloaltonetworks.com/hardware/pa-1400-hardware-reference/pa-1400-series-overview/front-panel-1400-series): e1/1–8 1G y e1/19–22 1/10G, según transceptores.
- [Palo Alto Aggregate Ethernet](https://docs.paloaltonetworks.com/ngfw/help/11-1/network/network-interfaces/aggregate-ethernet-ae-interface): comprobar homogeneidad de velocidad y tipo en cada AE, negociación LACP y validación de commit.
- [Cisco seguimiento IP SLA](https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-addressing/b-ip-addressing/m_iap-eot-xe.html): objetos track booleanos y estado real mediante `show track`.
- [CI versión revisada](https://github.com/hu-herrera/fin/actions/runs/38867164616): ejecución `success` de las pruebas de modelo, seguridad, WAN y Playwright. [Publicación](https://github.com/hu-herrera/fin/actions/runs/38867163967): `success`.

## Dictamen por clase de equipo

| Clase | Inventario de maqueta | Conforme según pruebas del simulador | Evidencia física pendiente / decisión |
|---|---:|---|---|
| Cisco C8300 | 23 | WAN 4×1G + Po10 2×10G, tránsito `10.72.N.1/30`, rutas estáticas VLAN hacia PA y filtrado OSPF de VLAN 40 | PID, versión IOS-XE, inventario de transceptores, aceptación de comandos, LACP/negociación, direccionamiento ISP, IKEv2/IPsec, NAT, rutas activas, OSPF vecino y SLA |
| Palo Alto PA-1410 | 23 | `ae1` 2×10G, `ae2` 4×1G, gateways `ae2.10/.20/.30/.40`, ruta al Cisco, zonas y políticas restrictivas del modelo | Versión PAN-OS, `commit validate`/commit real, LACP, rutas/sesiones, perfil de gestión, licencias, inspección, políticas de aplicaciones de negocio y logs |
| Catalyst C9200L-48T-4G | 46, en 23 stacks | StackWise-80 lógico, Po20 MEC distribuido, trunks nativa 999, VLAN 10/20/30/40, SVI de gestión única e inventario de 650 puertos de PC | Kit/cables StackWise por stack, licencias y versión, rol/estado miembros, vecinos LACP, estado STP/trunk, persistencia y fallos físicos |
| Gestión | VLAN30 base; OOB dedicado opcional | Propuesta protegida y simulación de fallos OOB aislada | AAA, acceso de consola y rollback disponibles antes del corte; si se elige OOB físico, requiere equipos y ruta independientes, no incluidos en el presupuesto base |

**Aclaración de alcance:** la caída de un firewall único o C8300 único corta servicios WAN de esa sede; duplicar los cables no crea alta disponibilidad de equipos. La salida de `network/export-candidate.cjs` incluye expresamente `NO APTO PARA DESPLIEGUE REAL`.

## Bloqueos que impiden certificar dispositivos reales

1. **WAN (bloqueante):** sin IP, máscara, gateway, MTU, modalidades DHCP/CGNAT, transceptores y dos destinos autorizados por ISP. El motor simula salud upstream, pero no hay sondas IOS-XE físicas. Amazon Leo es un enlace futuro, no contratado ni certificado en Chile.
2. **Overlay VPN (bloqueante):** no hay peers, credenciales, SA IKEv2/IPsec ni adyacencias OSPF medidas. Los túneles `Tunnel100/200/300/400` del diagnóstico son intención, no prueba de enlaces cifrados reales.
3. **Firewall (bloqueante):** pendiente validar sintaxis completa PAN-OS en versión real, política financiera autorizada, logs y perfiles de inspección, seguridad de gestión y `commit validate`. Las IP reservadas para DNS/NTP de CM no implican servidores desplegados.
4. **Stack y LAG físicos (bloqueante):** StackWise y MEC/Po10/ae1/ae2 deben demostrar negociación y recuperación ante pérdida de un cable; registrar módulos, velocidades, estado y errores.
5. **Operación segura (bloqueante):** capturar baseline, diferencias por equipo, backup, AAA, consola, control de cambios y plan de reversión. La skill exige no guardar configuraciones antes de comprobar el resultado.
6. **Disponibilidad de equipos (limitación de diseño):** un PA y un C8300 por sede siguen siendo puntos únicos de falla. Una eventual HA requiere hardware, cableado, licencias y diseño adicional; no es una falla de las pruebas de LACP.

## Siguiente plan de aceptación técnica

### Fase A — prevalidación reproducible sin equipos (inmediata)
- Congelar SHA de referencia, ejecutar CI de pruebas Node/Playwright y exportar `cm`, `s01` y demás sedes para `router|palo|stack`.
- Comparar por equipo modelo exacto, mapa de puertos, VLAN, gateways y máscaras, ACL con wildcards, rutas, OSPF/políticas PAN-OS, NAT, aislamiento y gestión. Emitir una matriz PASS/BLOCKED por sede, sin confundir cadenas de texto con parser de IOS-XE/PAN-OS.
- Marcar `PASS` de modelo solo en casos cubiertos; todo requisito que precise respuesta del fabricante/operador queda `BLOCKED`.

### Fase B — laboratorio autorizado (siguiente paso técnico prioritario)
1. Preparar versiones reales de IOS-XE y PAN-OS o laboratorio soportado, acceso de consola y backups; ejecutar primero consultas de **solo lectura**. No cargar la plantilla completa automáticamente.
2. Validar StackWise y Po20; probar caída de miembro y restablecimiento (sin prometer que sobrevivan PCs conectados al miembro caído).
3. Validar C8300 Po10 ↔ PA ae1 y PA ae2 ↔ stack: LACP, puertos, velocidad, subinterfaces 802.1Q, zonas, ACL y tabla de rutas.
4. Verificar gestión VLAN30, AAA y recuperación, luego pruebas autorizadas de políticas: invitados aislados, DNS/NTP centrales permitidos y resto de tráfico intersede denegado.
5. Parametrizar y ensayar WAN IP SLA por operador, NAT, IPsec/OSPF y failover upstream; no activar Amazon Leo como enlace operativo sin servicio disponible.
6. Repetir pruebas de cortes de cable/equipo, conservar evidencias y rollback.

### Captura mínima de evidencias de solo lectura (antes y después)
- **Cisco C8300:** `show version`, `show inventory`, `show ip interface brief`, `show etherchannel summary`, `show interfaces`, `show ip route`, `show ip prefix-list`, `show route-map`, `show ip ospf neighbor`, `show crypto ikev2 sa`, `show crypto ipsec sa`, `show ip sla statistics`, `show track`, `show ip nat translations`.
- **C9200L stack:** `show version`, `show inventory`, `show switch`, `show switch stack-ports`, `show etherchannel summary`, `show interfaces trunk`, `show vlan brief`, `show spanning-tree`, `show ip interface brief`.
- **PA-1410:** versión/PID/licencias, interfaz y AE LACP, zona, VR/rutas, configuración y hits de políticas, validación de commit y logs por GUI/CLI compatible con versión.

**Criterio de cierre:** únicamente cuando existen salidas reales, diferencias aprobadas, pruebas de seguridad/caída y reversión documentada puede declararse `VALIDADO EN LABORATORIO`; `VALIDADO EN HARDWARE` requiere pruebas sobre las plataformas físicas. No presentar esta acta como certificación Cisco/Palo Alto.

## Deuda documental identificada
Las secciones históricas de `docs/cutover-stackwise-layer3.md` aún describen la topología Layer3/StackWise como futura, aunque el encabezado y `docs/arquitectura-red-validada.md` confirman su activación en la vista DESPUÉS. Esta contradicción debe normalizarse antes de entregar el informe de tesis.
