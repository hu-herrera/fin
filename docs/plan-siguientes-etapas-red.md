# Siguientes etapas — aceptación técnica de red

**Corte de revisión:** 16 octubre 2026. **Ámbito:** simulador de 23 sedes, 650 PCs, C8300 → PA-1410 Layer3 → C9200L StackWise-80. La vista DESPUÉS modela la arquitectura, NO certifica hardware, enlaces de Internet ni telefonía física.

## Etapa 1 — direccionamiento y DNS (candidato disponible, pendiente aprobación real)

- Usuarios VLAN10: se puede exportar el DHCP local PAN-OS con `node network/export-candidate.cjs s01 client-dhcp ./clientes-s01.json`. Su pool sigue el inventario real por sede (.10 a .(9+PCs)); **chocaría con PCs estáticos si no se migra o reserva primero**. No aplicar el ejemplo de documentación a producción.
- Voz VLAN20: DHCP local es opcional, requiere recuento real, configuración específica de fabricante (TFTP/Option 66/150 según corresponda) y máximo **29 teléfonos DHCP por /27**. En casa matriz 55 teléfonos hipotéticos no caben; revisar VLAN antes de contratar.
- Invitados VLAN40: candidato separado, 13 clientes máximo en .178–.190; DNS públicos autorizados y `probe-ip`.
- PAN-OS es el gateway y punto DHCP: NO usar `ip helper-address` en C8300 para esas VLAN.
- Switches: `ip dhcp snooping` global y VLAN 10,20,40; el único puerto/port-channel trusted es Po20 hacia PA. Verificar compatibilidad Option 82, bindings SSO y desconexión del uplink durante una ventana de laboratorio.
- DNS centrales **10.70.0.110/111** son reservas no desplegadas. Reglas mínimas de PAN-OS permiten exclusivamente consultas DNS de usuarios/voz/gestión desde sucursales, y las de VLAN20/VLAN30 locales de CM. Resto interzona RFC1918 bloqueado. Confirmar ida, retorno, puertos TCP/UDP 53 y logs antes de marcar operativo.
- Evidencia de cierre: capturas PAN-OS de concesiones reales, pruebas con PCs migrados y teléfonos del modelo contratado, comprobación `show ip dhcp snooping`, resolución de nombres con servidor real y sin conflictos de IP.

## Etapa 2 — autenticación, voz y servicios centrales

- Aprovisionar DNS, NTP, AAA, syslog, monitoring en las IP reservadas o aprobar cambios de esquema. No afirmar instalación si solo existe una etiqueta en el simulador.
- Definir telefonía: cantidad, fabricante, PBX/SIP, VLAN de señalización, DHCP options y DSCP/QoS reales. Sin ello no afirmar que VoIP funciona aunque el teléfono reciba IP.
- Matriz financiera: aplicación, origen, destino, protocolo, puerto, autenticación, logs y perfil de amenazas. Solo después agregar excepciones PAN-OS a la denegación por defecto.

## Etapa 3 — conectividad WAN e IPsec (bloqueo principal de operación intersede)

Se añadió un **preflight conservador** que no establece VPN ni simula SAs: `network/wan-ipsec-readiness.cjs`. Desde la raíz:

```bash
node network/export-candidate.cjs s01 wan-readiness ./evidencia-wan-s01.json
node tests/wan-ipsec-readiness.test.cjs
```

El JSON requiere un `hub` con `publicEndpoint`, declaración de alcanzabilidad, UDP/500 y UDP/4500, identidad IKEv2 aprobada y `behindCgnat`; además, cuatro entradas `wan` (`starlink`, `leo`, `entel5g`, `gtd4g`). Cada una declara `mode` (`static-public`, `dhcp-public`, `cgnat` o `unavailable`). Las disponibles exigen confirmaciones explícitas de contrato, gateway, MTU, NAT-T saliente, retorno, SA/peer, OSPF y dos sondas remotas.

**Advertencia:** las banderas `...Verified: true` son solamente declaraciones del operador de la prueba, no comprobaciones de red. Si falta algo, el resultado es `BLOCKED`; incluso sin bloqueos el máximo resultado es `CANDIDATE_FOR_LAB_REVIEW`, con `certified:false`. La herramienta **no solicita ni guarda PSK/secretos**. No utilizar direcciones o credenciales inventadas.

Para C8300 CM y cada sucursal, obtener por cada operador:
- Modo de entrega (DHCP, estático, bridge, CGNAT), dirección WAN/prefijo, gateway y MTU verdaderos.
- Dos destinos IP públicos de SLA alcanzables **por ese operador**, protocolos ICMP permitidos y plan de fallback si no responden.
- Peer/hub IPsec **realmente alcanzable** (IP pública/hostname, NAT-T y política IKEv2/ESP), credenciales entregadas por canal seguro y routing/OSPF sobre cada túnel.
- Probar renegociación, failover, retorno de WAN, asimetría de NAT y accesibilidad a servicios centrales tras cada fallo.
- **CGNAT:** un enlace satelital/móvil con IP compartida no sirve automáticamente para actuar como extremo entrante de VPN; CM/hub debe tener dirección alcanzable o gateway/overlay gestionado. No inventar que contratar un enlace en otro país habilita servicio global.
- Amazon Leo continúa marcado como **no operativo/no contratado** hasta que se confirme disponibilidad y contrato en Chile. No forzar estado UP como evidencia de servicio real.

## Etapa 4 — aceptación física y documentación final

- Cisco IOS-XE: validar `show version`, inventario, LACP Po10 2×10G, NAT, IP SLA, SA IKEv2/IPsec y adyacencias OSPF FULL.
- C9200L: verificar `show switch`, StackWise, Po20 4×1G, puertos trunk, DHCP snooping, pérdida de cable y fallo de miembro. Inventario de 46 kits mínimos C9200L-STACK-KIT, sujeto a verificar inclusión con fabricante/distribuidor.
- PA-1410: validar AE1/AE2, interfaces L3, rutas, DHCP, perfil de gestión VLAN30, políticas y `commit validate`, sin exportar contraseñas ni licencias.
- Ejecutar `node network/verify-lab-evidence.cjs s01 ./evidencia-local/s01` con capturas reales limpias de secretos. El resultado automatizado es **revisión pendiente**, no certificación de fabricante.
- Elaborar matriz PASS/BLOCKED por sede, responsable, fecha, versión firmware, comandos/hits y evidencia de recuperación. Un único C8300 y un PA por sede siguen siendo puntos únicos de falla; agregar HA física solo mediante decisión presupuestaria expresa.

**Criterio final de salida:** pruebas Node/Playwright verdes **Y** parámetros, servicios, licencias y fallas verificadas en hardware/laboratorio autorizado. Sin evidencia real, solo se afirma conformidad del simulador.

## Referencias

- [Configuración DHCP PAN-OS](https://docs.paloaltonetworks.com/ngfw/networking/dhcp/configure-an-interface-as-a-dhcp-server)
- [PAN-OS 11.1 CLI — DHCP Server](https://docs.paloaltonetworks.com/ngfw/pan-os-cli-quick-start/cli-command-hierarchy/pan-os-11-1-configure-cli-command-hierarchy)
- [Cisco DHCP Snooping Catalyst 9200](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/software/release/17-14/configuration_guide/ip/b_1714_ip_9200_cg/configuring_dhcp.html)
- [Skill Cisco IOS Patterns](https://github.com/CiscoDevNet/skills/blob/main/skills/ios/cisco-ios-patterns/SKILL.md)
- [Protocolo de aceptación IOS-XE/PAN-OS](protocolo-laboratorio-iosxe-panos.md)
- [DHCP, dirección física y material StackWise](dhcp-invitados-y-stackwise.md)
