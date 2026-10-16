# Corte técnico de arquitectura: del diseño actual a StackWise + Palo Alto L3

**Estado: migración COMPLETADA EN EL SIMULADOR, NO en equipos físicos.** La vista DESPUÉS publicada usa WAN → C8300 Po10 (2×10G) → PA-1410 Layer3 ae1/ae2 → C9200L StackWise-80 Po20 (4×1G), con los gateways VLAN en el PA y el diagrama SVG correspondiente. La vista ANTES conserva los comandos históricos para regresión. Quedan pendientes únicamente los parámetros físicos/contractuales y comprobaciones sobre IOS-XE/PAN-OS reales, además de seguridad y HA de equipo según presupuesto.

## Fuentes de fabricante y skill empleadas

- [CiscoDevNet Cisco IOS Patterns](https://github.com/CiscoDevNet/skills/blob/main/skills/ios/cisco-ios-patterns/SKILL.md): lectura pre/post, validación de interfaces/ACL/wildcards/rollback y guardado tras verificación.
- [Cisco StackWise-80 y MEC](https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-stackwise-architecture-cte-en.html): stack con 2 cables posteriores, MEC intermiembro.
- [PA-1410 hardware](https://origin-docs.paloaltonetworks.com/hardware/pa-1400-hardware-reference/pa-1400-series-overview/front-panel-1400-series): e1/1–8 1G; e1/19–22 1G/10G.
- [Palo Alto AE LACP](https://docs.paloaltonetworks.com/ngfw/help/11-1/network/network-interfaces/aggregate-ethernet-ae-interface): miembros con velocidad/tipo homogéneos.

## Artefactos ejecutables que ahora existen

- `network/redundant-model.cjs`: topología candidata con 2×10G Cisco–PA, 4×1G PA–MEC del stack, dos cables traseros de StackWise y 4 WAN independientes. Los estados separan **L2 local**, **gateway PA**, **ruta al Cisco** e **Internet**. Distingue además fallo de salida a Internet aguas arriba con el gateway ISP todavía alcanzable.
- `network/redundant-configs.cjs`: plantillas ilustrativas IOS-XE/PAN-OS, **bloqueadas para implementación productiva**, con direcciones por las 23 sedes. Usan `ae1`/`Po10` y `ae2`/`Po20`; la VLAN 30 tendrá un solo SVI de gestión en el stack. El generador también transforma los **650 accesos PC** de `Gi1/0/X` y `Gi2/0/X`, mantiene las troncales de AP e identifica zonas de seguridad PAN-OS por VLAN (sin políticas permisivas).
- `tests/redundant-model.test.cjs`: fallas de cables LACP, stack, equipos y WAN, por sede.
- `tests/redundant-configs.test.cjs`: incompatibilidades de puertos, redes, protocolos y plantillas por sede.
- `.github/workflows/simulator-tests.yml`: ejecuta el candidato además de las pruebas del simulador vigente.

## Decisión de L3/L2

**En el objetivo futuro:** las VLAN 10/20/30/40 y sus gateways `10.70.N.{1,129,161,177}` migran desde Cisco al Palo Alto; el stack Catalyst es capa 2 con una sola SVI `10.70.N.162/28`. Cisco usa `10.72.N.1/30` y PA `10.72.N.2/30` para la conexión L3 AE1. Cisco anuncia solo los cuatro prefijos LAN de su sede mediante `route-map` al overlay OSPF; no redistribuye default global.

### BLOQUEOS reales, antes de habilitar el objetivo

1. **PAN-OS:** finalizar zonas, VR, reglas específicas de permiso/denegación, perfiles de seguridad y rutas intersede. El firewall debe filtrar inter-VLAN; una política permisiva genérica invalida el objetivo.
2. **Gestión:** utilizar la VLAN30 de datos de gestión con políticas restringidas y AAA en los equipos existentes; asegurar consola y respaldo local durante el corte. La red OOB con hardware dedicado es una **mejora opcional**, no una compra requerida para las 23 sedes. No reutilizar MGT físico como si fuera una interfaz de datos Layer3.
3. **C8300:** redes e interfaces WAN configuradas según contrato. El diseño usa Gi0/0/0..3 para los 4 ISP (incluyendo gateway Ethernet de GTD), y Te0/0/4..5 para el PA; verificar conectores ópticos/DAC/SFP+; mapeo de fuentes IPsec; NAT/retorno; SSH/AAA.
4. **Switches:** validar cable StackWise/kit para cada C9200L y los troncales de 4 enlaces MEC a PA. La distribución de los 650 PCs ya está mapeada y probada en el generador (`Gi1/0/X` o `Gi2/0/X`), pero debe comprobarse físicamente en cada sede antes de desplegarla.
5. **VPN WAN:** peer central real accesible (los `203.0.113.x` son documentación), IKEv2/IPsec y OSPF verificados sobre IOS-XE con cuatro proveedores (CGNAT posible), sin afirmar rutas FULL ni túneles cifrados no probados.
6. **Alta disponibilidad equipos:** un PA único sigue siendo SPOF y no puede sobrevivir a caída del PA. La sede central con par de firewalls requerirá HA1/HA2, sincronización y pruebas de conmutación independientes.

## Cambios graduales seguros

1. Registrar snapshot del simulador y las 32 pruebas actuales (24 Playwright + 8 WAN); conservar URL y SHA estable para restauración.
2. Ejecutar los dos scripts de modelo candidato y comprobar cada sitio; generar diferencias por interfaz frente al inventario hardware de cada sede.
3. En laboratorio aislado, crear stack físico primero; configurar MEC `Po20` en ambos miembros y `ae2` en PA; verificar convergencia de enlace con un cable fuera.
4. Crear tránsito PA `ae1` ↔ C8300 `Po10`, confirmar negociación y conectividad de 10.72.N.1 ↔ .2 sin cambiar todavía gateways en producción.
5. Configurar seguridad y gestión VLAN30 protegida; migrar los cuatro gateways de VLAN, rutas estáticas/OSPF y NAT como **una unidad reversible**. Revisar ACL para invitados, gestión, DNS, telefonía y aplicaciones financieras.
6. Ensayos de fallas físicas: desconexión de cada miembro LACP, falla de SW1/SW2 (solo sobreviven usuarios del miembro restante), interrupción de un cable StackWise, pérdida de PA (caída esperada), ISP upstream caído pero gateway responde.
7. Sólo tras validar: sustituir el modelo del simulador activo, las consolas, los tests de versión vieja y al final la representación gráfica.
8. Guardar `startup-config` / commit PAN-OS con acceso de consola/rollback confirmado; OOB físico puede mejorar la recuperación, pero no es obligatorio para este diseño.

## Consulta de configuraciones candidatas por sede

El exportador `network/export-candidate.cjs` toma el inventario PC real del simulador, exige un identificador de sede válido y añade una advertencia de **no despliegue**. Comandos de lectura (no modifican dispositivos):

```bash
node network/export-candidate.cjs s01 router
node network/export-candidate.cjs s01 stack
node network/export-candidate.cjs s01 palo
node network/export-candidate.cjs cm stack
```

Las tres salidas se generan por sede sin claves reales, con interfaces y rutas del diseño futuro. Estas plantillas son *candidatos para revisión*, no la salida `show running-config` de un equipo físico ni configuraciones completas certificadas.

## Comprobación automática local o en CI

```bash
node tests/wan.test.cjs
node tests/redundant-model.test.cjs
node tests/redundant-configs.test.cjs
node network/export-candidate.cjs s01 stack
npx playwright test tests/browser.spec.cjs tests/configuration.spec.cjs --browser chromium
```

**Interpretación:** pruebas verdes verifican propiedades del *modelo candidato* y consistencia de strings y estados en el simulador, no negociación real de LACP, enlaces StackWise físicos, comandos aceptados por PAN-OS ni conectividad real entre 23 sitios. Para esas evidencias hace falta hardware, CML/EVE-NG/GNS3 con imágenes licenciadas, o laboratorio autorizado equivalente.

## Estado del candidato (octubre 2026)
- 23 sedes modeladas, 650 puertos PC mapeados a los miembros del stack, VLAN/AP y zonas PAN-OS preparadas.
- Pruebas Node integradas en GitHub Actions; **la vista DESPUÉS publicada ya opera con StackWise + Palo Alto Layer3; la vista ANTES conserva el diseño anterior para regresión**. Pasar un test de configuración en cadena no demuestra que PAN-OS acepte un commit ni que IOS-XE negocie un LAG físico.
- La configuración Palo Alto propuesta no está lista para despliegue: faltan reglas de seguridad aprobadas, gestión segura VLAN30, un camino de recuperación por consola y rutas WAN/VPN reales. OOB físico sigue siendo opcional. Las pruebas de salud upstream son estados lógicos, no IP SLA desplegado en interfaces reales.

## Interfaz de pruebas habilitada en la web
1. Abrir cualquier sede en la versión actual de GitHub Pages.
2. Elegir **🧪 StackWise / LACP**. Cada sede conserva sus fallas aisladas de las demás; el botón **Restaurar todos los enlaces** elimina las fallas del laboratorio.
3. Cortar individualmente los enlaces T1/T2, D1–D4 y STACK-A/B, o apagar SW1/SW2, C8300 y PA-1410.
4. Observar por separado el estado L2 de los PCs, el gateway PA, el camino hacia Cisco y la WAN. En WAN se prueba el estado de la interfaz, del gateway del ISP y de un supuesto destino aguas arriba.
5. Para comparar configuraciones, abrir la ventana Router/Firewall/Switch y elegir **🧪 Objetivo L3**. La vista DESPUÉS usa la CLI simulada StackWise/Layer3; las configuraciones reales de equipos no se han modificado.
6. Ejecutar `node network/build-browser-lab.cjs --check` cuando cambie el motor Node; regenerar con `node network/build-browser-lab.cjs` y someterlo a CI antes de publicarlo.

[Suite de navegador y motor candidato aprobados](https://github.com/hu-herrera/fin/actions/runs/38842086249): 28/28 Playwright + 8/8 WAN + 162 escenarios de falla + 2.237 comprobaciones de candidatos. La capa de laboratorio fue probada desde el navegador, **con arquitectura Layer3 activa únicamente dentro del simulador; el hardware real continúa sin validarse**.

## Requisitos WAN, NAT y servicios centrales antes del corte
- Confirmar para cada uno de los cuatro proveedores la IP WAN real, next-hop y dos destinos públicos ICMP permitidos por conexión. Referencia: [datos para generar IP SLA](wan-sla-datos-operadores.md).
- Cisco C8300: `routerNatCandidate` genera ACL y PAT asociados con `match interface`; `renderWanSlaCandidate` devuelve IP SLA + tracking + rutas host únicamente tras recibir ocho destinos sin duplicaciones. Validar NAT/CEF/VPN sobre la WAN elegida en laboratorio.
- Verificar y reservar DNS `10.70.0.110` y `.111`, TACACS `.112/.113`, NTP `.116/.117`, syslog `.100` y monitoreo `.101`. No se afirma que esas máquinas estén instaladas: deberán cotizarse y aprovisionarse, y lo ideal será migrar infraestructura a su VLAN segura si el alcance lo permite.
- Servicios de casa matriz deben contar con rutas de retorno, reglas PAN-OS interzona restrictivas, DNS/NTP autorizados, acceso de administración restringido y procedimientos de revocación de credenciales. OOB independiente es opcional.
- El despliegue solo se aprueba con pruebas **reales** de `show track`, `show ip nat translations`, `show ip ospf neighbor` y políticas/commit PAN-OS; la web es evidencia de coherencia del modelo, no del hardware.

## Gestión OOB y resiliencia de recuperación (fase aprobada en simulación)
- Se reservó una subred físicamente independiente **10.73.N.0/28** por sede, MGT PA-1410 **.2**, Mgmt-vrf Catalyst **.3**, gateway OOB **.1** y dirección **.4** reservada para C8300 sin inventar el nombre de su interfaz.
- [Configuración candidata OOB y presupuesto de hardware](oob-management-design.md). Generador: `network/oob-management.cjs`. CLI: `node network/export-candidate.cjs s01 oob`; nunca aplicar sin gateway/switch/cableado real.
- El motor simula fallo de gateway, switch, ruta NOC y cables MGT, independientemente de la caída de C8300, PA dataplane o switches de producción. Los escenarios no afirman que el hardware OOB esté instalado.
- CI aprobada: **31/31 Playwright**, 8/8 WAN, 185 escenarios de falla, 2.029 aserciones de redundancia, 2.536 verificaciones de candidatos, 911 de política, 1.162 IP SLA y **784 de OOB** sobre 23 sedes/650 PCs. [Ejecución](https://github.com/hu-herrera/fin/actions/runs/38856652658).
- **Bloqueos reales de migración:** gestión segura sobre los switches existentes, AAA, acceso de consola y rollback; completar políticas PAN-OS, contratos WAN/IPsec, OSPF y pruebas de corte. Los 23 caminos OOB independientes son una alternativa de alta resiliencia **opcional**, no equipos agregados al presupuesto base.

## Control de tráfico intersede — mínimo privilegio (diseño candidato)
- Las VLAN 10/20/30 de cada sede son anunciables por el C8300 mediante rutas estáticas hacia PA y redistribución filtrada a OSPF. La VLAN40 de invitados nunca se anuncia.
- Las sedes sólo solicitan DNS a `10.70.0.110`/`.111` y NTP de gestión a `10.70.0.116`/`.117`; el PA de casa matriz sólo admite consultas a esos destinos desde las subredes específicas de las 22 sucursales. Las respuestas pertenecen a la sesión permitida, sin abrir conexiones nuevas indiscriminadas desde TRANSIT.
- Todo tráfico corporativo hacia otras direcciones privadas a través de la zona TRANSIT se deniega **antes** de permisos generales web. Otros servicios financieros quedan bloqueados hasta disponer de una matriz de aplicaciones, orígenes y destinos aprobada.
- El generador de plantillas y las pruebas están en `network/redundant-configs.cjs` y `tests/intersite-routing.test.cjs`. Esta es una política de simulador, no una configuración ya aplicada en equipos físicos.

## Refinamiento funcional y pruebas de fallo — 16 octubre 2026

- **Switching local realista:** el trazado de PCs dentro de la misma VLAN no requiere router C8300, PA-1410 ni uplinks Po10/Po20. Sólo depende de puertos de acceso válidos y de StackWise si atraviesa los dos miembros. No se dibuja un salto LAN falso a través del PA Layer3.
- **CLI Cisco:** `Port-channel10` y el alias `Po10` apagan/restauran correctamente ambos enlaces físicos de tránsito y actualizan RIB/estado WAN; el gateway LAN puede continuar operativo en el PA.
- **CLI StackWise:** `Po20` es un único agregado distribuido y un `shutdown` desde cualquiera de las consolas afecta a sus cuatro miembros. Una interfaz `Gi2/0/X` se reconoce desde cualquiera de las consolas del stack.
- **Persistencia:** el perfil activo carga los estados `startup-config` guardados antes de computar rutas y topología, incluso antes de abrir la consola. Los controles de ping local usan disponibilidad L2 en vez de exigir el gateway.
- **Pruebas añadidas:** fallos de PA/C8300/Po20, pérdida de uno/dos cables StackWise, caída SW1, control administrativo de Po10, control lógico Po20 y cambios Gi2 desde la consola de otro miembro, en la suite de navegador `tests/active-topology.spec.cjs`.
- Las suites siguen siendo **pruebas del simulador**, no una ejecución de comandos sobre equipos Cisco o Palo Alto.
