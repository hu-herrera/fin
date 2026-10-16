# Plan de servicios centrales DNS y NTP — aceptación por etapas

**Última revisión:** 16-10-2026. **Arquitectura:** WAN → Cisco C8300 → Palo Alto PA-1410 Layer3 → Catalyst C9200L StackWise. **Estado:** reservados y modelados; **no hay DNS/NTP, hardware ni túneles IPsec declarados instalados**.

## Inventario lógico de casa matriz

Todas estas direcciones son **reservas** en VLAN10, `10.70.0.0/25`. Gateway PA `10.70.0.1`; los 55 PCs de CM usan `10.70.0.10`–`10.70.0.64`, por lo que no hay colisiones actuales:

| Función | Primario | Secundario | Estado real |
|---|---|---|---|
| DNS corporativo | 10.70.0.110 | 10.70.0.111 | Pendiente de desplegar/verificar |
| NTP corporativo | 10.70.0.116 | 10.70.0.117 | Pendiente de desplegar/verificar |
| TACACS+/AAA | 10.70.0.112 | 10.70.0.113 | Pendiente de diseño y licencias |
| Syslog | 10.70.0.100 | — | Pendiente de desplegar |
| Monitoreo | 10.70.0.101 | — | Pendiente de desplegar |

**No asignar ninguna de estas direcciones a PCs ni incluirlas en pools DHCP.** Los servidores requieren IP estática (o reserva controlada), inventario físico/virtual, DNS interno autorizado, respaldo y pruebas de recuperación. La VLAN de gestión de red es VLAN30 y no equivale a la VLAN10 donde están estas reservas de servicios.

## Política de acceso NTP para routers y stacks

El C8300 usa `Loopback0 10.70.100.x/32` como Router-ID y origen controlado de DNS/NTP. El origen de la casa matriz es `10.70.100.1`; las sucursales `s01..s22` usan `10.70.100.11..32`. El firewall CM solo admite desde estas **23 direcciones exactas** NTP hacia `.116`/`.117` y DNS hacia `.110`/`.111`, cada servicio con su propia regla App-ID y destino restringido; SSH y otros destinos siguen denegados.

Los Catalyst utilizan `Vlan30 10.70.N.162` como interfaz origen de NTP. Desde sucursales requieren que el PA local permita `MGMT-DATA → TRANSIT` y el PA de CM `TRANSIT → USERS`, ambos hacia los NTP. En CM se requiere `MGMT-DATA → USERS`. Las políticas actuales dan esas autorizaciones pero **no demuestran que exista un servidor o que funcione OSPF/IPsec**.

Para routers remotos, la Loopback0 /32 debe tener ruta de retorno por OSPF sobre un túnel cifrado establecido. NTP puede fallar aunque haya Internet si el túnel, el router hub o el servidor NTP están caídos. Una red satelital detrás de CGNAT no equivale a un concentrador VPN alcanzable.

## Exportación de candidatos de laboratorio

```bash
node network/export-candidate.cjs s01 mgmt-services ./servicios-s01.json
node tests/management-services.test.cjs
```

El archivo JSON se mantiene **privado** y declara: `approvedInLab`, `dnsServersOperational`, `ntpServersOperational`, `cmTimeSourceApproved`, `panosNtpPoliciesReviewed`, `stackManagementSviVerified`, `routerLoopbackRoutingVerified`, `vendorNtpSecurityReviewed` y `ospfOverlayVerified` en sucursales, todos `true` solamente tras verificación autorizada; `dns` debe ser `["10.70.0.110","10.70.0.111"]` y `ntp` `["10.70.0.116","10.70.0.117"]`.

**Las afirmaciones JSON no son evidencia:** los tests usan datos sintéticos para verificar validadores, no dispositivos en funcionamiento. Si falta alguna declaración, el candidato devuelve error `SERVICIOS CENTRALES NO GENERADOS`. Incluso completo, es **LAB_CANDIDATE / deployable:false / certified:false**. El resultado presenta por separado un bloque para router y otro para stack; **no pegar ambos en un solo dispositivo**.

El candidato utiliza:

- C8300: `ip domain lookup source-interface Loopback0` y `ntp server 10.70.0.116 source Loopback0 prefer` (más secundario `.117`).
- C9200L: `ip domain lookup source-interface Vlan30` y `ntp server 10.70.0.116 source Vlan30 prefer` (más secundario `.117`).

El origen explícito de DNS evita que los routers hagan consultas desde interfaces WAN/túneles no autorizadas. Verificar la sintaxis y el estado `up` de ambas interfaces origen según IOS-XE instalado.

**Seguridad NTP:** no se inventan claves de autenticación ni se genera configuración incompleta de cifrado. Validar funciones disponibles en la versión IOS-XE objetivo, origen de hora fiable, control de clientes, NTP autenticado cuando sea posible y fallos por desincronización. No habilitar NTP sin evaluación de seguridad.

## Comprobación real necesaria (lectura)

En cada C8300 y stack, previa captura de líneas base:

```text
show clock detail
show ntp associations
show ntp status
show ip route 10.70.0.116
show ip route 10.70.0.117
show running-config | include ntp
```

En C8300 remoto, también `show ip ospf neighbor`, `show crypto ikev2 sa`, `show crypto ipsec sa`. En el PA de CM, comprobar hit counters de las reglas NTP y logs de denegación, no solo que la regla exista. En los servidores reales, verificar respuestas NTP/UDP 123 y DNS TCP/UDP 53, sincronización con fuente externa autorizada, registros y recuperación del servicio.

**Criterio de aceptación:** servidores primario/secundario distintos, rutas simétricas, hostname/DNS reales cuando sean necesarios, sincronización NTP sostenida, permisos exactos, registro de cambios y recuperación probada. No marcar "funciona" solo porque el simulador muestre una dirección.

## Siguientes etapas

1. Aprovisionar DNS/NTP reales; decidir plataforma, dominio interno, fuente de hora, HA, backup, métricas y monitoreo sin inventar compras.
2. Integrar AAA/TACACS+, Syslog y observabilidad con credenciales y roles seguros, sin publicar secretos.
3. Contratar/parametrizar las WAN, configurar IKEv2/IPsec y comprobar vecinos OSPF y rutas sobre túneles.
4. Validar dispositivos reales según el [protocolo de aceptación](protocolo-laboratorio-iosxe-panos.md), con fallos de enlaces y restauración controlada.

## Referencias oficiales

- [Cisco IOS XE 17 — NTP source interface](https://www.cisco.com/c/en/us/td/docs/switches/lan/c9000/time-sync/ntp-configuration-guide/m-network-time-protocol.html)
- [Cisco IOS-XE — ip domain lookup source-interface](https://www.cisco.com/c/en/us/td/docs/routers/sl_using_policy/b-sl-using-policy/task_library.html)
- [CiscoDevNet skill IOS Patterns](https://github.com/CiscoDevNet/skills/blob/main/skills/ios/cisco-ios-patterns/SKILL.md)
- [Palo Alto App-ID application-default](https://docs.paloaltonetworks.com/ngfw/administration/app-id/application-default)
