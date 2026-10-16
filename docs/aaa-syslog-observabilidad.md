# Seguridad operativa: AAA/TACACS+, Syslog TLS y observabilidad

**16 de octubre de 2026.** Alcance: 23 sedes ficticias, 23 C8300, 23 stacks de dos C9200L, 23 PA-1410. La topología **DESPUÉS** está simulada; los servidores centrales y los túneles reales **no están desplegados ni certificados**.

## Direcciones centrales reservadas, no servicios operativos

| Función | Destino | Transporte propuesto | Estado |
|---|---|---|---|
| TACACS+ primario | `10.70.0.112` | TCP 49 | Reservado |
| TACACS+ secundario | `10.70.0.113` | TCP 49 | Reservado |
| Syslog central | `10.70.0.100` | TLS sobre TCP 6514 | Reservado |
| Monitor/observabilidad | `10.70.0.101` | **Ningún puerto abierto aún** | Reservado |
| DNS centrales | `10.70.0.110 / .111` | DNS | Reservado |
| NTP centrales | `10.70.0.116 / .117` | NTP | Reservado |

La ubicación de los servidores en la VLAN10 de CM está conservada para respetar el direccionamiento acordado; en un despliegue real se debería evaluar si requieren una zona DMZ/servidores específica, segmentación y alta disponibilidad. Los clientes de administración de red no son PCs de usuarios.

## Flujo permitido y mínimo privilegio

El C8300 inicia TACACS+ y Syslog desde `Loopback0 = 10.70.100.x/32`. El stack Catalyst usa `Vlan30 = 10.70.N.162/32`. La autorización hacia los servidores de CM pasa por políticas L3 en PA:

- **CM:** `TRANSIT → USERS` acepta únicamente las 23 Loopback0 autorizadas y las 22 IP de SVI de sucursales, con destino a los dos TACACS+ (TCP 49) o al colector Syslog (TCP 6514), según corresponda.
- **Sucursales:** `MGMT-DATA → TRANSIT` acepta únicamente el SVI `.162/32` local a los mismos servicios/puertos. Los C8300 tienen el camino hacia CM por túnel/OSPF propio, no atravesando su PA local como si fueran clientes de VLAN30.
- **CM local:** `MGMT-DATA → USERS` admite solo `10.70.0.162/32` hacia esos destinos. Se mantienen otras restricciones intranet.
- **Sin excepción de usuarios ni invitados.** El monitor `.101` no puede consultar switches por SNMP hasta que se apruebe un diseño SNMPv3 authPriv de mínimo privilegio, con zonas, fuentes y rutas de retorno. No se crean usuarios SNMP, communities, contraseñas ni perfiles ficticios.

El candidato PAN-OS usa **servicios TCP personalizados** (`SVC-TACACS-TCP49` y `SVC-SYSLOG-TLS-TCP6514`). El término `application any` queda limitado por estos servicios *y por las direcciones/zonas precisas*; no significa un permiso a cualquier puerto. No se presupone un nombre App-ID específico del fabricante. Validar las líneas reales en PAN-OS de la versión instalada con `commit validate` y `test security-policy-match`. No abrir UDP/514 al azar.

## Generador seguro para revisión

Desde la raíz del proyecto:

```bash
node network/export-candidate.cjs s01 netops-services ./netops-s01.json
node tests/netops-services.test.cjs
```

El JSON de parámetros es **privado**, sin contraseñas, e incluye: `approvedLabWindow`, `tacacsPrimaryVerified`, `tacacsSecondaryVerified`, `tacacsKeysInstalledSecurely`, `breakGlassLocalLoginTested`, `fallbackLoginVerified`, `roleAndAuthorizationReviewed`, `syslogTlsServerVerified`, `syslogTlsProfileInstalled`, `collectorCertChainReviewed`, `ntpClockSynchronized`, `managementFirewallRulesReviewed`, `monitoringAlertsDefined`, y para sucursales `ipsecOspfToCmVerified`. Son declaraciones booleanas de evidencias comprobadas, **no pruebas automáticas de un equipo real**. `snmpEnabled` debe ser `false`.

Se deben declarar literalmente:

```json
{
  "tacacs": ["10.70.0.112", "10.70.0.113"],
  "syslog": "10.70.0.100",
  "tlsProfile": "NETOPS-LOG-TLS",
  "snmpEnabled": false
}
```

Este fragmento **no es suficiente** para generar el candidato: faltan las verificaciones obligatorias. El nombre del perfil TLS es un identificador de ejemplo, **no un certificado instalado**. Se rechazan claves en el JSON (incluido el campo `secret`) y los parámetros incompletos.

El exportador produce dos bloques delimitados claramente: uno para C8300 y otro para **el stack único** de C9200L. Aunque todas las banderas sean `true`, el resultado permanece `LAB_CANDIDATE / deployable:false / certified:false`.

## AAA: orden obligatorio para evitar bloqueo

1. Capturar `show version`, `show running-config | section aaa`, `show running-config | section tacacs`, `show line`, estado SSH y consola. Proteger las salidas si contienen secretos.
2. Confirmar desde cada dirección origen rutas a ambos servidores (y retorno a los /32 de routers/SVI), que TCP/49 llega al servicio y que perfiles/roles del servidor están configurados.
3. Instalar **fuera del repositorio** secretos de TACACS+ y una identidad local de emergencia protegida, y probar el acceso por consola antes de modificar métodos de acceso remoto.
4. Probar autenticación, autorización, accounting y fallback durante desconexión de TACACS primario y secundario. **En IOS-XE el método `local` normalmente se usa cuando TACACS devuelve ERROR o no responde, no ante un rechazo de autenticación.**
5. Aplicar método de VTY **solo después** de una ventana y pruebas autorizadas; el candidato lo deja como instrucción, sin asignarlo automáticamente a `line vty`. Validar y guardar `startup-config` únicamente con comprobación positiva y rollback listo.

**Importante:** esta plantilla deliberadamente omite la clave de cada servidor. Los comandos de servidor y AAA no deben pegarse tal cual si no existe configuración de claves válida: estarían incompletos y podrían afectar el acceso remoto.

## Syslog con autenticidad y correlación

- El candidato configura `logging source-interface Loopback0` o `Vlan30`, marcas de tiempo con milisegundos, `logging trap informational` y `logging host 10.70.0.100 transport tls port 6514 profile ...`.
- Deben existir en IOS-XE un perfil TLS y certificados válidos **previos**; el colector debe autenticar la conexión y registrar nombre del equipo/sede, timestamp y severidad. Verificar si la imagen IOS-XE de C8300 y C9200L soporta exactamente ese perfil/sintaxis.
- Configurar retención, protección frente a saturación, horario uniforme y acceso a los registros. La reserva de un colector único sigue siendo un punto único de falla.
- **Palo Alto PA-1410:** su gestión Syslog, autenticación de administradores y *Service Route* pueden originarse en el puerto MGT en vez de `ae2.30`. Estos servicios requieren perfil, ruta, certificados y configuración PAN-OS **por separado**. El candidato Cisco no configura ni certifica la administración del firewall.

## Monitoreo: qué queda pendiente

El monitor central `10.70.0.101` está reservado, pero no crea tráfico ni sondea los dispositivos por sí mismo. El primer mecanismo verificable será **recibir eventos del Syslog TLS**. Para añadir sondeos SNMPv3 se requieren usuarios authPriv reales, políticas RO, origen exacto del colector, ACL/zonas en ambos firewalls, rutas OSPF y pruebas de respuesta. No se permite SNMP v1/v2c, `community public` ni apertura general de UDP/161-162.

**Estado técnico:** reglas y candidatos validados por tests de código; AAA, TLS, Syslog, monitor, conectividad IPsec y equipos reales están pendientes de implementación y aceptación.

## Documentación técnica consultada

- [Cisco IOS-XE AAA](https://netascode.cisco.com/docs/data_models/iosxe/device/aaa/)
- [Cisco IOS-XE Logging](https://netascode.cisco.com/docs/data_models/iosxe/device/logging/)
- [Cisco IOS-XE Hardening](https://sec.cloudapps.cisco.com/security/center/resources/IOS_XE_hardening)
- [PAN-OS Service Objects](https://docs.paloaltonetworks.com/network-security/security-policy/administration/objects/services)
- [PAN-OS Syslog TLS](https://docs.paloaltonetworks.com/ngfw/administration/monitoring/use-syslog-for-monitoring/configure-syslog-monitoring/configure-syslog-monitoring-pan-os)
- [Palo Alto TACACS+ Authentication](https://docs.paloaltonetworks.com/ngfw/administration/authentication/configure-tacacs-authentication)
- [Guía de aceptación de red](protocolo-laboratorio-iosxe-panos.md)
