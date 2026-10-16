# Corte técnico de arquitectura: del diseño actual a StackWise + Palo Alto L3

**Estado: preparación para laboratorio, NO cambio activo.** El simulador publicado conserva WAN → Cisco C8300 router-on-a-stick → PA-1410 virtual-wire → SW1 ↔ Po1 ↔ SW2 hasta que toda la migración esté coherente. El diagrama gráfico se actualizará al final, según lo solicitado.

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
2. **Gestión del PA:** cambiar la administración fuera de banda del actual `10.70.N.164/28` por una red física OOB dedicada, con gateway, puerto y mecanismo de acceso definido. No asignar la misma VLAN/subred al plano de gestión fuera de banda y a la interfaz de datos como solución improvisada.
3. **C8300:** redes e interfaces WAN configuradas según contrato. El diseño usa Gi0/0/0..3 para los 4 ISP (incluyendo gateway Ethernet de GTD), y Te0/0/4..5 para el PA; verificar conectores ópticos/DAC/SFP+; mapeo de fuentes IPsec; NAT/retorno; SSH/AAA.
4. **Switches:** validar cable StackWise/kit para cada C9200L y los troncales de 4 enlaces MEC a PA. La distribución de los 650 PCs ya está mapeada y probada en el generador (`Gi1/0/X` o `Gi2/0/X`), pero debe comprobarse físicamente en cada sede antes de desplegarla.
5. **VPN WAN:** peer central real accesible (los `203.0.113.x` son documentación), IKEv2/IPsec y OSPF verificados sobre IOS-XE con cuatro proveedores (CGNAT posible), sin afirmar rutas FULL ni túneles cifrados no probados.
6. **Alta disponibilidad equipos:** un PA único sigue siendo SPOF y no puede sobrevivir a caída del PA. La sede central con par de firewalls requerirá HA1/HA2, sincronización y pruebas de conmutación independientes.

## Cambios graduales seguros

1. Registrar snapshot del simulador y las 32 pruebas actuales (24 Playwright + 8 WAN); conservar URL y SHA estable para restauración.
2. Ejecutar los dos scripts de modelo candidato y comprobar cada sitio; generar diferencias por interfaz frente al inventario hardware de cada sede.
3. En laboratorio aislado, crear stack físico primero; configurar MEC `Po20` en ambos miembros y `ae2` en PA; verificar convergencia de enlace con un cable fuera.
4. Crear tránsito PA `ae1` ↔ C8300 `Po10`, confirmar negociación y conectividad de 10.72.N.1 ↔ .2 sin cambiar todavía gateways en producción.
5. Configurar seguridad y OOB; migrar los cuatro gateways de VLAN, rutas estáticas/OSPF y NAT como **una unidad reversible**. Revisar ACL para invitados, gestión, DNS, telefonía y aplicaciones financieras.
6. Ensayos de fallas físicas: desconexión de cada miembro LACP, falla de SW1/SW2 (solo sobreviven usuarios del miembro restante), interrupción de un cable StackWise, pérdida de PA (caída esperada), ISP upstream caído pero gateway responde.
7. Sólo tras validar: sustituir el modelo del simulador activo, las consolas, los tests de versión vieja y al final la representación gráfica.
8. Guardar `startup-config` / commit PAN-OS únicamente con respaldo OOB y plan de reversión confirmado.

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
- Pruebas Node integradas en GitHub Actions; **el simulador publicado sigue con el diseño viejo**. Pasar un test de configuración en cadena no demuestra que PAN-OS acepte un commit ni que IOS-XE negocie un LAG físico.
- La configuración Palo Alto propuesta no está lista para despliegue: sin gestión OOB, políticas de seguridad cerradas, ACL de aplicaciones y rutas WAN/VPN reales. Las pruebas de salud upstream son estados lógicos, no IP SLA desplegado en interfaces reales.

## Interfaz de pruebas habilitada en la web
1. Abrir cualquier sede en la versión actual de GitHub Pages.
2. Elegir **🧪 StackWise / LACP**. Cada sede conserva sus fallas aisladas de las demás; el botón **Restaurar todos los enlaces** elimina las fallas del laboratorio.
3. Cortar individualmente los enlaces T1/T2, D1–D4 y STACK-A/B, o apagar SW1/SW2, C8300 y PA-1410.
4. Observar por separado el estado L2 de los PCs, el gateway PA, el camino hacia Cisco y la WAN. En WAN se prueba el estado de la interfaz, del gateway del ISP y de un supuesto destino aguas arriba.
5. Para comparar configuraciones, abrir la ventana Router/Firewall/Switch y elegir **🧪 Objetivo L3**. La CLI vigente no cambia.
6. Ejecutar `node network/build-browser-lab.cjs --check` cuando cambie el motor Node; regenerar con `node network/build-browser-lab.cjs` y someterlo a CI antes de publicarlo.

[Suite de navegador y motor candidato aprobados](https://github.com/hu-herrera/fin/actions/runs/38842086249): 28/28 Playwright + 8/8 WAN + 162 escenarios de falla + 2.237 comprobaciones de candidatos. La capa de laboratorio fue probada desde el navegador, **sin convertir la topología actual en arquitectura Layer3 activa**.
