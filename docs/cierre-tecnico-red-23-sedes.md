# Cierre técnico — red de 23 sedes y aceptación física

**Fecha de diseño:** 16-10-2026. **Alcance:** 23 sedes, 650 PCs simulados, Cisco C8300 → Palo Alto PA-1410 L3 → Catalyst C9200L (2 miembros StackWise-80). No se modifica la topología ni se agregan switches OOB.

## 1. Qué está validado hoy

- **Simulador:** enlaces, rutas y failover modelados, LACP Po10 router↔PA y Po20 PA↔stack, gateway por VLAN en PA, aislamiento de invitados y servicios corporativos por políticas.
- **Plantillas candidatas:** direcciones VLAN, NAT WAN condicionado, OSPF condicionado a túneles, DHCP opcional para usuarios/voz/invitados, DNS/NTP, TACACS+ y Syslog TLS, con validaciones estáticas y pruebas del navegador.
- **NO certificado:** los fabricantes no han recibido un `commit validate` real; no hay imágenes licenciadas, routers, firewalls, switches, servidores, túneles, licencias ni contratos de los operadores conectados a este entorno. **Éxito en CI no es éxito sobre hardware.**

Para mostrar el estado verdadero:
```bash
node network/site-readiness-report.cjs
node network/site-readiness-report.cjs --json
```
El resultado debe indicar **23 modelos coherentes, 650 PCs, cero sedes certificadas físicamente y 16 puertas de aceptación pendientes por sede**. No cambia configuraciones.

## 2. Corregido: cómo administrar el PA-1410 de forma autorizada

El perfil existente `VLAN30-STACK` tiene HTTPS y SSH, pero inicialmente solo permite `10.70.N.162/32`, la **SVI del switch**. Eso no equivale a disponer de una computadora desde la que administrar el firewall. La interfaz de gestión en banda de PA es `ae2.30 = 10.70.N.161/28`; la administración MGT física permanece **independiente y no aprovisionada**.

Se preparó una opción de laboratorio para conectar una estación administrativa controlada al mismo **stack existente**, sin comprar otro switch, mediante uno de los puertos que no se asignan a los PCs: `GigabitEthernet1/0/35` o `GigabitEthernet2/0/35`. Debe tener una IP exclusiva entre `10.70.N.163` y `10.70.N.174`. Se agregarían **solo esa IP /32** a los permitted IP del perfil PAN-OS, preservando el origen `.162/32`.

```bash
node network/export-candidate.cjs s01 pa-admin ./admin-s01.json
```

El JSON debe incluir `adminHostIp`, `stackPort`, `operatorRef` (código de aprobación, sin identidad personal) y los siguientes campos solo después de verificarlos: `labChangeApproved`, `authorizedAdministratorVerified`, `physicalPortUnusedVerified`, `addressInventoryConfirmed`, `adminHostHardenedVerified`, `networkIsolationVerified`, `httpsCertificateReviewed`, `sshAuthorizationReviewed`, `accessRollbackTested`, `panosVersionVerified`, `stackConfigConfirmed`, `existingSshRiskAcknowledged`.

Una IP de usuarios VLAN10, los gateways `.161`, la SVI `.162`, direcciones fuera del /28 o un puerto ocupado no se admiten. **Importante:** el perfil actual permite SSH además de HTTPS; añadir un origen a él autoriza ambos protocolos. Una separación de protocolos requiere rediseñar el perfil/gestión en PAN-OS y probarla. Mantener consola/rollback antes de cualquier `commit`.

## 3. Corregido: tráfico originado por el propio Palo Alto

Las políticas `TRANSIT → USERS` del PA controlan sesiones que atraviesan el equipo, pero no prueban las conexiones que **inicia el propio firewall**. PAN-OS usa MGT por defecto para muchos servicios externos; una subred OOB sin gateway o enlace no da acceso automáticamente a DNS, NTP, TACACS+ y Syslog.

Se añadió una **plantilla condicionada de rutas de servicio por destino** con `ae2.30` y origen `10.70.N.161`, solo hacia:

| Servicio | Direcciones inventariadas |
|---|---|
| DNS | `10.70.0.110`, `10.70.0.111` |
| NTP | `10.70.0.116`, `10.70.0.117` |
| TACACS+ | `10.70.0.112`, `10.70.0.113` |
| Syslog | `10.70.0.100` |

```bash
node network/export-candidate.cjs s01 pa-services ./pa-servicios-s01.json
```

El JSON debe tener `interfaceName:"ae2.30"`, `sourceAddress:"10.70.1.161"`, `destinations` como lista exacta de las siete IP del cuadro en orden DNS, NTP, TACACS+, Syslog; `useMgtPort:false` y `overrideAllServices:false`. También requiere las banderas comprobadas: `labApprovalVerified`, `panosVersionVerified`, `dataInterfaceAe230Operational`, `selectedRoutesOnlyReviewed`, `localServicesOperational`, `collectorTlsCertificateVerified`, `tacacsAuthProfileVerified`, `panosLogForwardingProfileVerified`, `panosManagementAccessVerified`, `paConsoleRecoveryVerified`, `returnRoutesToSourceVerified` y `ospfIpsecToCmVerified` en sucursales.

No se cambian globalmente rutas de licencias, actualizaciones, WildFire ni DNS externo. El monitor `10.70.0.101` **no** se añade porque SNMPv3 y observabilidad aún no tienen configuración autorizada. El generador devuelve `LAB_CANDIDATE`, jamás `deployable:true`. Antes de implementar: verificar el comportamiento y sintaxis exactos en la versión PAN-OS, `commit validate`, rutas, autenticación, TLS y servidores.

Documentación PAN-OS:
- [Configure Service Routes](https://docs.paloaltonetworks.com/ngfw/networking/configure-service-routes)
- [Service Routes IPv4/IPv6](https://docs.paloaltonetworks.com/ngfw/help/11-1/device/device-setup-services/ipv4-and-ipv6-support-for-service-route-configuration)
- [Interface Management Profiles](https://docs.paloaltonetworks.com/ngfw/networking/configure-interfaces/configure-an-interface-management-profile)

## 4. Matriz de aceptaciones no sustituibles por CI

La herramienta `network/site-readiness-report.cjs` mantiene **16 bloqueos externos por sede**: inventario de equipos y módulos, versión/licencia y validación de configuración, cables de stack, contratos WAN, parámetros de peer IPsec/IKEv2/NAT-T, OSPF operativo, DNS/NTP, TACACS+ y fallback local, Syslog TLS/certificados, estación PA autorizada, rutas de servicios originados en firewall, DHCP o IP fija acordada, monitoreo SNMPv3 u otra solución probada, aplicaciones financieras autorizadas, fallos/restauración y acta/backup/rollback.

**También permanece un riesgo de arquitectura:** cada sede tiene **un solo C8300 y un solo PA-1410**. LACP y StackWise mitigan fallos de cable o miembro de switch, pero **no son alta disponibilidad del router ni del firewall**. Resolver su HA física exige una decisión de equipamiento y presupuesto; el simulador no debe inventar redundancia de equipos inexistentes.

## 5. Orden de aceptación del laboratorio

1. Obtener versiones, inventario y evidencia auténtica; revisar equipos, licencias, cables, uplinks y redes separadas de gestión.
2. Aprovisionar DNS/NTP, AAA, Syslog y certificados; documentar IP fijas o DHCP. Verificar respuestas locales de servidores.
3. Probar acceso administrativo a PA por estación autorizada y mecanismo de rescate; verificar service routes sin cambiar conexiones de actualización.
4. Parametrizar y contratar WAN/peers; confirmar IP, gateway, CGNAT, NAT-T, rutas por túnel, OSPF FULL y retorno a las VLAN.
5. Ejecutar casos negativos (denegar acceso de invitados, usuarios al plano de gestión, servicios no autorizados), pruebas de falla WAN/LACP/StackWise y restauración.
6. Registrar `show`/contadores/PCAP aprobados y `commit validate` real, incidentes, tiempos medidos y firmas de aceptación por sede.

**Pruebas implementadas:**
```bash
node tests/panos-admin-access.test.cjs
node tests/panos-service-routes.test.cjs
node tests/site-readiness.test.cjs
```

**No subir capturas reales sin sanitización, certificados, contraseñas ni PSK al repositorio.** Mantener archivos `evidencia-local/` excluidos de Git.
