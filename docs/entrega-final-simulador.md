# Entrega consolidada — fin de la fase de software

**Fecha:** 16 de octubre de 2026.

## Resultado y alcance

El proyecto ficticio modela **23 sedes y 650 PCs**, con Cisco C8300, PA-1410 capa 3 y dos Catalyst C9200L por sede unidos por StackWise-80, sin nuevos switches OOB. Las pruebas automáticas de Node/Playwright revisan la estructura del escenario y numerosos casos de red; **ninguna prueba certifica la puesta en producción real**.

Hay **dos fases principales**, no una fase nueva por cada corrección:

1. **Software y diseño verificables por CI.** Incluye el simulador, plantillas y su suite de regresión, exportadores de DHCP opcional, AAA/TLS Syslog, NTP/DNS, políticas restrictivas, SNMPv3 condicional, aplicaciones financieras aprobadas por host, WAN/IPsec preflight, gestión PA y auditoría. El repositorio puede completar esta fase sin contratar proveedores.
2. **Implementación y aceptación en laboratorio físico/virtual licenciado.** Requiere recursos externos que no existen en la ejecución de CI: C8300/C9200L/PA-1410 o imágenes compatibles, versiones/licencias, conexiones/contratos, alcance IPsec real, servidores corporativos, certificados/credenciales seguros y evaluación de los resultados de recuperación. Esta fase no debe marcarse finalizada sin evidencia.

## Matriz de entrega automática (23 sedes)

Generar `node network/site-readiness-report.cjs --json`. El workflow principal también publica en cada ejecución aprobada el artefacto **`acceptance-23-sites.json`**, con una fila por sede y los **16 criterios externos** pendientes. La salida indica explícitamente `physicallyCertified:0`, que es lo correcto cuando no se han conectado equipos reales.

El verificador adicional `node network/verify-lab-evidence.cjs s01 ./evidencia-local/s01` analiza resultados de comandos *show* reales. Incluso si cumplen todos los patrones, solo devuelve `READY_FOR_HUMAN_LAB_REVIEW`: **certified:false**. No inventar capturas ni probar a partir del simulador.

## Nuevos entregables de política financiera y SNMPv3

### Flujo financiero de un host a un servidor

```bash
node network/export-candidate.cjs s01 financial-app ./aplicacion-financiera-aprobada-s01.json
node tests/financial-policy.test.cjs
```

Requiere campos de identidad `sourceIp` (PC de la sucursal dentro del inventario), `destinationIp` (servidor real de casa matriz que no sea un PC ni servicio reservado), `tcpPort`, `applicationId` (App-ID validado), `securityProfile`, `approvalRef` y **aprobación/evidencia explícita**: `authorizedChange`, `financialApplicationOwnerApproved`, `sourceAssetVerified`, `destinationAssetVerified`, `applicationIdVerified`, `appIdentityReviewed`, `tcpServicePortVerified`, `securityProfileVerified`, `routeAndReturnVerified`, `loggedDenyBaselineCaptured`, `testedWithApplication`, `rollbackAndConsoleVerified`, todos solamente `true` después de una comprobación real.

Genera dos reglas PAN-OS distintas, una en sucursal y otra en CM, usando un servicio TCP de puerto exacto, App-ID, origen y destino /32, y grupo de perfil de seguridad, con `move rulebase security rules` para ubicarlas antes de cualquier denegación que bloquearía el flujo. **El control `true` escrito en JSON no instala la aplicación ni verifica realmente sus perfiles.** Se mantiene denegación por defecto; sin datos reales se rechaza la exportación.

Palo Alto documenta que el orden del rulebase y la primera coincidencia determinan el resultado: [Security Policy](https://docs.paloaltonetworks.com/pan-os/11-1/pan-os-admin/policy/security-policy), [Move CLI](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA10g000000ClcRCAS).

### Monitoreo de equipos, sin comunidades SNMP débiles

```bash
node network/export-candidate.cjs s01 snmpv3-plan ./monitoreo-autorizado-s01.json
node tests/snmpv3-monitoring.test.cjs
```

La propuesta parte del monitor central `10.70.0.101/32` y exige `version:3`, `securityLevel:"authPriv"`, `permission:"read-only"`, `trapsEnabled:false`, `includePaloAltoManagement:false`. Requiere además que se declaren `true` los requisitos de `network/snmpv3-monitoring-candidate.cjs` (aprobación, credenciales instaladas fuera del repositorio, compatibilidad SHA/AES, vista MIB RO, rutas, políticas PAN-OS y rollback). Nunca genera `snmp-server user` con claves ni configura SNMPv1/v2c. Los traps UDP162 son otro diseño, no quedan encendidos.

El candidato de PAN-OS limita polling UDP161 al monitor /32, al router Loopback0 y al SVI del stack; añade órdenes de posicionamiento de políticas en CM y sucursal, **todavía por validar y aplicar en un PA real**. El ACL Cisco solo autoriza al monitor; la instalación de usuarios autenticados/cifrados requiere gestión segura de secretos. [Cisco SNMPv3](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/snmp/configuration/xe-17-x/snmp-xe-17-book/nm-snmp-cfg-snmp-support.html).

## Única recopilación necesaria para la fase física

La **[hoja única de datos externos](insumos-fase-fisica.md)** indica todos los elementos que ninguna modificación a GitHub puede sustituir. No enviar claves por la conversación ni al repositorio; usar un gestor de secretos y canales del fabricante.

La fase de hardware comprende 16 criterios por sede y debe culminar con una tabla por sitio firmada/aceptada y evidencias: versiones e inventario, licencias y cables, parámetros WAN y SLA, IPsec+NAT-T, vecinos OSPF, rutas, DHCP/servicios, AAA fallback, Syslog TLS, acceso PA, SNMPv3 real, flujos financieros aprobados, pruebas de LACP/StackWise, fallos WAN, backup y restauración.

**Riesgos no eliminados por el software:** un único C8300 y un único PA por sede siguen siendo puntos únicos de fallo. StackWise y LACP no sustituyen HA de firewall/router. También hay advertencia de voz en CM si se pretende un teléfono por los 55 PCs usando VLAN20 /27 de 29 leases previstos.

## Salida de la fase 1

La fase 1 se considera **terminada solamente con el último workflow verde**, artefacto de aceptación generado y revisión de los cambios. No hay evidencia de equipamiento físico; la fase 2 permanece pendiente hasta contar con los recursos correspondientes.
