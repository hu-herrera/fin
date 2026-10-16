# Financiera Pacífico — Simulador WAN / NOC

**Estado de la entrega: simulación y pruebas de software. No certificación de hardware.**

Este repositorio modela una red corporativa ficticia con **23 sedes y 650 PCs**, para estudio, auditoría y demostración. La vista **DESPUÉS** usa Cisco C8300 → PA-1410 de capa 3 → un stack lógico de dos C9200L (StackWise-80), con LACP Po10 y Po20. Se conserva la vista **ANTES** para comparación. No se crearon switches OOB adicionales.

## Meta académica — simulador primero, presentación después

**Fase A: simulador funcional e interactivo en esta página.** Topología simulada, VLAN/rutas, aislamiento, fallos, candidatos IOS-XE/PAN-OS, servicios modelados y un **laboratorio de paquetes** que evalúa saltos y políticas entre Cisco, Palo Alto y StackWise. Se puede cortar Starlink, comprobar failover, inspeccionar decisiones del firewall y restaurar la red sin comprar equipamiento. La suite GitHub Actions verifica las regresiones. A diferencia de ejecutar IOS-XE/PAN-OS virtualizados en GNS3/CML, el motor es JavaScript determinista con un subconjunto de comportamientos de red; **no ejecuta imágenes de Cisco o Palo Alto ni protocolos de red reales**.

**Fase B: presentación desde la misma página.** El botón **Presentar** abre una vista proyectable de seis escenas que sirve como estructura; el discurso, la secuencia final y los tiempos de la exposición serán la siguiente tarea. No se necesita PowerPoint.

**Laboratorio físico: opcional, fuera del alcance requerido por el trabajo académico.** No hay obligación de adquirir 23 routers/firewalls ni de contratar operadores. Documentos de hardware y candidatos están disponibles como anexos para explicar cómo se validaría un despliegue real, no como condición para presentar el simulador.

## Qué probar

Abrir [index.html](index.html) en un navegador compatible. Utiliza **⌁ Laboratorio de paquetes** en la cabecera para simular DNS, SSH, salida WAN y cortes de Starlink; **▣ Presentar** para el esqueleto de exposición sin diapositivas. Son partes de la misma página y están disponibles en GitHub Pages. Consulta la [guía de demostración](docs/guia-demostracion-simulador.md).

Para comprobaciones reproducibles desde la raíz con Node.js:

```bash
node network/build-browser-lab.cjs --check
node tests/packet-simulator.test.cjs
node tests/financial-policy.test.cjs
node tests/snmpv3-monitoring.test.cjs
node tests/site-readiness.test.cjs
node network/site-readiness-report.cjs --json
```

La CI de GitHub además ejecuta Playwright/Chromium y el resto de las pruebas de redes y genera el artefacto **`acceptance-23-sites.json`**, con el estado de cada sede y bloqueos de aceptación física. Esta matriz nunca afirma una certificación no observada.

## Candidatos opcionales; no desplegar directamente

Todos requieren un JSON privado de parámetros y confirmaciones reales. Si faltan datos, fallan de manera controlada:

```bash
node network/export-candidate.cjs s01 router
node network/export-candidate.cjs s01 stack
node network/export-candidate.cjs s01 palo
node network/export-candidate.cjs s01 wan-readiness ./wan-real-s01.json
node network/export-candidate.cjs s01 client-dhcp ./clientes-aprobados-s01.json
node network/export-candidate.cjs s01 guest-dhcp ./invitados-aprobados-s01.json
node network/export-candidate.cjs s01 mgmt-services ./dns-ntp-verificados-s01.json
node network/export-candidate.cjs s01 netops-services ./aaa-syslog-verificados-s01.json
node network/export-candidate.cjs s01 pa-admin ./estacion-admin-verificada-s01.json
node network/export-candidate.cjs s01 pa-services ./rutas-servicio-verificadas-s01.json
node network/export-candidate.cjs s01 financial-app ./aplicacion-financiera-aprobada-s01.json
node network/export-candidate.cjs s01 snmpv3-plan ./monitoreo-autorizado-s01.json
```

Las plantillas **no contienen secretos reales** ni crean túneles WAN, usuarios AAA/SNMPv3 o aplicaciones bancarias inexistentes. El ejemplo `financial-app` exige IP origen de un PC real del inventario, servidor autorizado no reservado, puerto TCP, App-ID y perfil de seguridad; entrega las dos reglas para sucursal y CM con orden de evaluación explícito. `snmpv3-plan` exige `authPriv`, RO y el colector central `10.70.0.101/32`, pero no añade usuarios o claves por defecto.

## Documentación de referencia

- [Cierre técnico y riesgos de implantación](docs/cierre-tecnico-red-23-sedes.md)
- [Plan de servicios, WAN y próximos hitos](docs/plan-siguientes-etapas-red.md)
- [DNS y NTP centrales](docs/servicios-centrales-dns-ntp.md)
- [AAA, TLS Syslog y observabilidad](docs/aaa-syslog-observabilidad.md)
- [DHCP y BOM StackWise](docs/dhcp-invitados-y-stackwise.md)
- [Validación de hardware real](docs/validacion-laboratorio-real.md)
- [Protocolo de aceptación IOS-XE/PAN-OS](docs/protocolo-laboratorio-iosxe-panos.md)
- [Evidencia y matrices de cierre](docs/entrega-final-simulador.md)

### Nota de seguridad

Este trabajo es una **herramienta de laboratorio y enseñanza**; ninguna de sus salidas debe pegarse directamente en un router o firewall de una entidad financiera. Confirmar imagen/versión, puertos, funciones soportadas, rutas, permisos, respaldos, ventana de cambio y recuperación por consola. No subir credenciales, capturas sensibles, certificados ni contraseñas al repositorio.
