# Auditoría de red — Financiera Pacífico
**Fecha:** 15 de octubre de 2026  
**Ámbito:** simulador HTML/JavaScript del repositorio `hu-herrera/fin`.  
**Clasificación:** modelo didáctico de topología y failover; **no es una configuración homologada para un despliegue real**.

## 1. Estado de revisión
La revisión de funciones JavaScript se realizó contra la [skill comunitaria Cisco IOS Patterns](https://github.com/CiscoDevNet/skills/blob/main/skills/ios/cisco-ios-patterns/SKILL.md) de CiscoDevNet. Su procedimiento requiere comprobar estado inicial, jerarquía de configuración, máscaras wildcard, dirección de ACL, rutas y verificación tras cambios.

Se ejecutó una auditoría local de la lógica JavaScript en un entorno aislado (no un router real): **23 sedes, 650 PC simulados y 650 IP únicas**, sin errores encontrados en las comprobaciones realizadas de máscaras LAN, gateways, salidas de consola, datos de gestión y camino de switches. Esta validación lógica **no reemplaza Playwright, pruebas físicas, PAN-OS ni un emulador de IOS-XE**.

Pruebas del repositorio:
- `tests/wan.test.cjs`: 8 pruebas unitarias WAN.
- `tests/browser.spec.cjs`: 12 pruebas de navegador.
- `tests/configuration.spec.cjs`: 12 pruebas de auditoría técnica de red Cisco/PAN-OS.
- `.github/workflows/simulator-tests.yml`: ejecuta las 3 suites. **Resultado confirmado:** 24/24 pruebas de navegador y 8/8 unitarias WAN aprobadas en GitHub Actions (commit `862aeba9`, [ejecución](https://github.com/hu-herrera/fin/actions/runs/38830771341)). Las pruebas validan el simulador, no hardware Cisco/PAN-OS.

## 2. Direccionamiento aprobado para el simulador

Por cada sede `10.70.N.0/24` (CM N=0; sucursales N=1..22):

| Red | VLAN | Gateway / referencia | Capacidad |
|---|---:|---|---:|
| `10.70.N.0/25` | 10 Usuarios | `10.70.N.1` | 126 hosts |
| `10.70.N.128/27` | 20 Voz | `10.70.N.129` | 30 hosts |
| `10.70.N.160/28` | 30 Gestión | `10.70.N.161` | 14 hosts |
| `10.70.N.176/28` | 40 Invitados | `10.70.N.177` | 14 hosts |
| `10.70.N.192/26` | Reserva | Sin gateway | No implementado |

SW1 `.162`, SW2 `.163` y gestión Palo Alto `.164` están en VLAN30. Los PC simulados tienen direcciones `10.70.N.10` en adelante y no coinciden con los gateways.

**Diferencia documental pendiente:** el archivo `Entregable-4.md` en el repositorio de entregables finales aún define una plantilla distinta (7 VLAN con /26 inicial). **Debe actualizarse al plan de esta sección antes de presentar el proyecto**. No se debe afirmar que documento y simulador están sincronizados mientras esa diferencia permanezca.

## 3. Topología física definida para la maqueta

```text
Starlink -------- Gi0/0/1      (acceso primario)
Amazon Leo ------ Gi0/0/2      (futuro, sin servicio local verificado)
Entel 5G -------- Gi0/0/3      (gateway Ethernet externo)
GTD 4G ---------- Te0/0/4      (gateway externo, SFP+ / adaptador pendiente)
                         Cisco C8300
                  Gi0/0/0 (trunk VLAN 10,20,30,40)
                         |
                 PA-1410 ethernet1/1
                 Virtual wire L2 transparente
                 PA-1410 ethernet1/2
                         |
                 SW1 Gi1/0/1
                 SW1 Gi1/0/45 ==== SW2 Gi1/0/45
                 SW1 Gi1/0/46 ==== SW2 Gi1/0/46  (Po1 LACP, 2 miembros)
                 SW1 Gi1/0/44 ---- Puerto management del PA (VLAN30)
```

La conexión virtual-wire permite inspección transparente de VLAN sin crear gateways L3 adicionales en el Palo Alto. El software debe configurar zonas/subinterfaces y políticas adecuadas: véase [Palo Alto — Virtual Wire](https://docs.paloaltonetworks.com/ngfw/networking/configure-interfaces/virtual-wire-interfaces/layer-2-and-layer-3-packets-over-a-virtual-wire) y [Virtual Wire Subinterfaces](https://docs.paloaltonetworks.com/ngfw/networking/configure-interfaces/virtual-wire-interfaces/virtual-wire-subinterfaces).

En el modelo implementado, el segundo switch **no tiene uplink directo al firewall/router**; depende de SW1, aunque Po1 soporta la caída de cualquiera de sus dos cables. Esto **no constituye redundancia completa de la capa LAN**. El Palo Alto de sucursal y SW1 son puntos únicos de falla. No anunciar alta disponibilidad total de sucursales.

## 4. Routing y seguridad del modelo

- WAN preferida: Starlink → Amazon Leo → Entel 5G → GTD 4G. La cobertura y contratación real son supuestos a verificar por sede; Amazon Leo **no se declara operativo en Chile**.
- Rutas LAN conectadas según máscaras /25, /27, /28, /28. La distribución de rutas remotas /25,/27,/28 es una representación lógica: **no se ha ejecutado OSPF real**.
- Direcciones privadas de túneles por sucursal: `172.16.N.{0,4,8,12}/30`, direcciones de router `.1/.5/.9/.13`; terminadores y recursos de CM deben definirse para las 22 sucursales.
- Direcciones `100.64/10` y `100.85/100.92` representan direccionamiento de laboratorio/CGNAT, **no IP contratadas**. Las direcciones públicas de destino `203.0.113.x` están reservadas para documentación y **no se enrutan en Internet**. No sirven como peers VPN reales.
- ACL VTY: fuentes administrativas de `10.70.0.160/28`; VLAN invitados deniega `10.70.0.0/16` antes de permitir DNS/HTTPS. La NAT de invitados se modela, pero no acredita aislamiento total de un firewall instalado.
- OSPF, IP SLA, QoS, IPsec y PAN-OS en el navegador son **representaciones didácticas**, no negociaciones, mediciones ni reglas de hardware.

## 5. Bloqueadores para afirmar que la red está lista para implementar

1. **CM HA:** configurar realmente ambos C8300, ambos PA-1410 y conexiones redundantes; comprobar conmutación y estados, no solo un selector UI.
2. **Overlay VPN central:** asignar concentradores, IP de peer público accesible, políticas NAT-T, claves/certificados, licencias y modelo de hasta 22×4 túneles por lado; comprobar OSPF vecino por vecino y rutas a/desde CM.
3. **Firewall PAN-OS:** crear el objeto virtual wire, subinterfaces de VLAN, zonas, reglas por App-ID, perfiles Threat Prevention/WildFire y alta disponibilidad de CM. Las salidas de consola indican qué **no está medido ni aplicado**.
4. **DHCP y servicios:** definir servidores DHCP, DNS, VoIP, NTP, AAA, SIEM y rutas centrales; las IP de PC del prototipo son estáticas. No existe un DHCP real respaldado por el HTML.
5. **Equipamiento físico:** validar interfaces IOS-XE y nomenclatura exacta según versión, transceptor SFP+ y gateway Ethernet, alimentación externa de puntos de acceso (C9200L-48T-4G-E no es PoE), licencias y presupuestos.
6. **Operadores:** confirmar contrato, cobertura, direccionamiento entregado, NAT, latencia, diversidad de backhaul y SLA por sucursal. Entel 5G en Base Frei no garantiza backhaul físicamente independiente.
7. **Disponibilidad:** 99,95% sedes, 99,99% core y RTO ≤5 min son **objetivos**, no mediciones. El failback de 5 segundos es una aceleración del laboratorio.
8. **Pruebas de fabricante:** las plantillas Cisco y PAN son ilustrativas. Falta ejecutar `show running-config`, `show ip route`, `show ip ospf neighbor`, `show track`, `show crypto ikev2 sa`, `show crypto ipsec sa`, `show interfaces trunk`, `show vlan brief` y consultas PAN-OS sobre equipamiento o laboratorio compatible.

## 6. Criterio de aceptación para la defensa

Se puede afirmar: **«El simulador modela un diseño LAN/WAN con 23 sedes, 650 PC y escenarios de conmutación; se sometió a pruebas automatizadas de coherencia».**  
No se debe afirmar: **«Las 23 sedes están instaladas», «el cifrado se verificó en Cisco/Palo Alto», «hay disponibilidad garantizada», «Amazon Leo presta servicio en Chile» o «la HA central se validó en hardware».**

Esta distinción permite defender el proyecto sin presentar como medidos resultados que el prototipo no produce.

## 7. Actualización de ingeniería (2026-10-16)

- Suite de integración actual: **24/24 PASS**, suite WAN **8/8 PASS**, workflow LAN/LACP aprobado. [Evidencia de CI](https://github.com/hu-herrera/fin/actions/runs/38830771341).
- RIB: muestra redes WAN físicas conectadas y distancias administrativas 1/10/20/30. Si la casa matriz pierde todos los enlaces, se retiran las rutas OSPF de sucursales, manteniendo la ruta local a Internet de cada sucursal.
- Cisco IKEv2: propuesta AES-GCM con `prf sha256` en lugar de un algoritmo de integridad separado. Diagnóstico IP SLA considera `shutdown` de la interfaz WAN.
- STP: SW1 raíz, Po1 en rol designado; SW2 Po1 como puerto raíz. Las interfaces reservadas apagadas no se muestran conectadas.
- **Diseño recomendado para tolerancia a fallo de switch completo, todavía NO migrado**: C8300 de 4×1G WAN + 2×10G a PA Layer3; PA con 4×1G distribuidos entre un stack C9200L StackWise-80 de dos miembros. Consultar [plan de puertos candidato](docs/plan-puertos-redundancia-propuesto.md). StackWise utiliza dos cables traseros dedicados, **no** los mismos Gi45/Gi46 usados en Po1 del diseño provisional.
- Queda sin resolver la nueva subred de gestión OOB del PA si migra el gateway de VLAN30 desde el Cisco al PA. Un segundo PA para HA de equipo completo y las cotizaciones necesarias siguen pendientes.

## 8. Últimos controles automatizados

- **24/24 Playwright aprobadas**: [GitHub Actions, commit `f09d005a`](https://github.com/hu-herrera/fin/actions/runs/38831383312), además de las 8 pruebas unitarias WAN de la suite general.
- Nuevos casos: bloqueo de tráfico entre sucursales al perder el hub CM (también en la ruta gráfica), normalización de native VLAN 999 y VLAN permitidas 10/40 de los AP, roles STP/puertos reservados, conectadas WAN y distancias administrativas de backup, propuesta IKEv2 PRF AES-GCM y SLA ante interfaz apagada.
- Permanecen pendientes: prueba extremo-a-extremo de Internet por proveedor con gateway local arriba, configuración real de pares IPsec, migración física a StackWise/LACP del plan nuevo, modos y políticas PA Layer3, subred de gestión OOB y HA del firewall. No confundir estas pruebas verdes con validación de esos elementos aún no implementados.
