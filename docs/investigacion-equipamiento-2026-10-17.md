# Equipamiento y continuidad — investigación preliminar

**Fecha de consulta:** 17 de octubre de 2026. **Proyecto:** Financiera Pacífico. **Estado:** arquitectura candidata y precios públicos referenciales; no cotización formal, compra ni migración aplicada.

**Actualización posterior:** la [fase 2 de dimensionamiento](fase-2-dimensionamiento-y-seleccion.md) incorpora los 650 teléfonos acordados en fase 1, presupuesto por sede, límites de licencia criptográfica y comparación económica ampliada. Los parciales de este informe conservan su alcance original.

## Resultado y recomendación

La variante de referencia conserva separación de funciones: **dos routers Cisco, dos firewalls Palo Alto en activo/pasivo y dos switches de acceso PoE por sucursal**. Es una alternativa sólida para estudiar, no una demostración de que seis equipos sean la solución óptima en toda ubicación. La casa matriz también requiere redundancia; su diferencia es capacidad, conectividad y zona de servidores, no prescindir de pares.

La investigación de ciclo de vida cambia la selección: no conviene cerrar una compra nueva a seis años de C8300-2N2S-4T2X, C8200-1N-4T/C8200L o PA-440/450 sin estudiar sus sucesores. La compra completa nueva de los pares estudiados tampoco se puede presentar como cubierta por CLP 160 millones: los escenarios parciales de sucursales ya exceden ese importe.

Mantener dos opciones comparables: **A, funciones separadas**, prioritaria para preservar el diseño; **B, integración de WAN/VPN en una pareja de NGFW**, únicamente si demuestra los mismos requisitos y un ahorro total. B implica rediseñar y probar rutas, túneles y recuperación: no se aplica al simulador mediante este documento.

## Alcance y requisitos de dimensionamiento

| Dato | Base de trabajo |
|---|---|
| Ubicaciones iniciales del simulador | 23: CM/datacenter y 22 remotas; incluye Isla de Pascua y Antártica |
| Crecimiento | Seis nuevas; total 29 ubicaciones. S23 San Pedro de Atacama; otras cinco candidatas según bitácora |
| PCs actuales | 650; CM 55; S01–S05 30 cada una; S06–S20 28; S21 17; S22 8 |
| Presupuesto de referencia | CLP 160 millones; alcance tributario, gastos recurrentes e incremento negociable pendientes |
| Horizonte | Excel: cinco años. Preferencia del usuario: cinco a seis años desde puesta en servicio |
| Recuperación de sucursal | RTO <=5 minutos en el caso académico; medir por aplicación, no solo por ping |
| Disponibilidad de la ficha | Core 99,99%; sucursal 99,95%; objetivos, no resultados medidos |
| WAN de sucursal del modelo | Una activa, hasta 300 Mbps nominales; cuatro alternativas no equivalen a cuatro enlaces sumados |
| Pendientes de carga | Demanda de core financiero, simultaneidad, tamaño de datos, inspección TLS, voz y crecimiento de PCs/teléfonos |

El Excel original declara 22 sedes: las 23 del simulador son una adaptación que debe explicarse al docente. No modificar la ficha original para ocultar la diferencia. La fase 1 posterior fijó 650 teléfonos como supuesto académico, uno por PC; no redistribuir los 650 entre futuras sedes.

## Ciclo de vida: hallazgo que impide comprar por nombre de familia

| Equipo evaluado | Evidencia oficial | Consecuencia |
|---|---|---|
| C8300-2N2S-4T2X, C8200-1N-4T, C8200L-1N-4T | Cisco EOL15955, anunciado 27-07-2026: venta hasta 31-07-2027; mantenimiento de software hasta 31-07-2028; seguridad y soporte elegible hasta 31-07-2032 [S1] | No cubren seis años completos desde 17-10-2026; soporte contractual no equivale a mantenimiento general de software. No primera elección para una renovación nueva a seis años |
| PA-440/450 y otros PA-400 listados | Venta hasta 22-03-2027; fin de vida 21-03-2032. La tabla diferencia soporte estándar del SO y extendido [S2] | Podrían encajar en cinco años desde hoy bajo condiciones verificadas, pero no en seis; estudiar PA-500 nuevos |
| C9200L-24P-4G-E / 48P-4G-E | No se encontró aviso específico de retiro de esos chasis en el listado oficial consultado [S3] | Ausencia de aviso no garantiza cobertura hasta 2032/2033: exigir verificación al contratar |

No confundir **Catalyst C8200-1N-4T** con **Cisco 8200 Series Secure Routers G2**, ni el antiguo PA-500 retirado con la nueva familia PA-500 de modelos PA-501/505/510/520 y superiores.

## Lista corta de candidatos

| Función | Candidato | Por qué merece cotización | Condiciones antes de seleccionar |
|---|---|---|---|
| Router de sucursal | **2 × C8211-G2** | Seis interfaces de datos: dos combo GE y cuatro RJ45 GE; referencia oficial de IPsec 3 Gbps con paquetes de 512 B [S4] | Confirmar funciones WAN/LAN de cada puerto, enrutamiento/HA, SKU/licencias, imagen admitida, rendimiento mixto y operación de cuatro proveedores. Seis interfaces físicas no prueban por sí solas que el cableado completo sea viable |
| Router alternativo | **2 × C8221-G2** | Mayor margen de puertos y candidato si C8211 limita conexión o crecimiento [S4] | Precio local y justificación del margen; no comprar por capacidad máxima si no se necesita |
| Firewall de sucursal | **2 × PA-510**; comparar PA-520 si el conteo de puertos o carga lo requiere | PA-510 tiene ocho RJ45 y HA; PA-500 incorporada en versiones recientes de PAN-OS [S5, S6] | Inspección con carga real, licencias iguales en ambos peers [S7], puertos consumidos por HA, número de zonas y soporte. PA-505 solo como alternativa condicionada: siete puertos pueden resultar insuficientes |
| Acceso empresarial | **2 × C9200L-24P-4G-E** en sucursales normales | PoE, continuidad con IOS-XE y arquitectura de stack ya documentada [S8] | Puertos reales para PCs, teléfonos, impresoras/APs y crecimiento; kits/cables StackWise, fuentes y soporte por separado |
| Acceso de menor costo | **2 × C1300X-24P-4X** | 24 puertos PoE+, 385 W publicados y stacking frontal [S9] | Sistema operativo distinto de IOS-XE: plantillas y pruebas actuales no son trasladables. Revisar soporte, reposición, AAA, seguridad y comportamiento de stack. No sustituye automáticamente a C9200L |
| CM, routers | Comparar **C8221-G2/C8225-G2** con **C8355-G2** | Dimensionar por tráfico agregado, interfaces y número de túneles; familia 8300 Secure documentada [S4, S10] | Selección abierta; no se afirma que el C8355 sea necesario ni se cotiza su capacidad como demanda del cliente |
| CM, firewall | **2 × PA-1410**, conservado como candidato, frente a PA-500 superior | Revisar capacidad conjunta de Internet, intersede y servidores | Sin selección cerrada ni precio aprobado; comprobar soporte y carga TLS/amenazas/este-oeste |
| CM, switching | Evaluar pares de acceso PoE de 48 puertos y switching de servidores separado si la carga lo exige | CM ya supera la capacidad de dos switches de 24 puertos para 55 PCs incluso sin teléfonos | Determinar reutilización, 10/25G, capacidad y redundancia de NICs/almacenamiento; no comprar más switches solo por dibujarlos |
| Telefonía nueva | **Cisco Desk Phone 9841**, tras evaluar los existentes | Terminal de puesto candidato; plataforma de llamadas compatible obligatoria [S11] | Cantidades, PBX, soporte, firmware y licencias pendientes. No requiere pantalla avanzada o videoteléfono en todos los escritorios |

Los máximos de fabricante usan condiciones de prueba particulares: no se suman IPsec y Threat Prevention ni se asume que sean simultáneos. El rendimiento del equipo superviviente debe cubrir la operación prevista con margen. Las series nuevas requieren confirmar versiones recomendadas y defectos conocidos, no solo una fecha de lanzamiento reciente.

## Conexión y continuidad: brechas que hay que cerrar

1. **WAN accesible por ambos routers.** Solicitar al proveedor doble entrega o diseñar distribución WAN redundante y segmentada. Un terminal o switch único compartido sigue siendo dependencia común. No suponer duplicados gratuitos, dos IP públicas ni usar un divisor de cable.
2. **Conexión router–firewall con rutas independientes.** No extender un LACP entre dos routers independientes. El diseño físico completo debe escoger enlaces enrutados y sus adyacencias o un segmento de tránsito redundante; HSRP necesita el segmento apropiado y no crea sincronización de sesiones/VPN por sí solo.
3. **HA de firewall.** Reservar enlaces de control y sesiones; los modelos pequeños pueden consumir puertos de datos [S6]. Dibujar ambos firewalls conectados a ambos caminos necesarios y probar pérdida de enlace, equipo y sincronización.
4. **Stack y terminales.** Dos switches mantienen conectividad en el miembro superviviente. No mantienen conectado un teléfono/PC que dependía del miembro apagado; el puerto PC del teléfono no es una segunda conexión redundante. Distribuir puestos esenciales entre miembros y definir el servicio mínimo durante contingencia. La supervivencia total de todos los puestos requeriría otra solución de acceso.
5. **Capacidad de acceso.** 48 puertos entre dos switches de 24 pueden cubrir una sucursal de 28–30 PCs si teléfonos compatibles comparten puerto mediante su switch interno y existe margen para otros equipos. Con puertos separados, 30 PCs +30 teléfonos exceden 48: no darlo por resuelto sin inventario.
6. **Voz.** Rediseñar capacidad de VLAN20 si se necesitan más de 29 teléfonos por sede; PoE y UPS, PBX/SIP, QoS, llamadas simultáneas y supervivencia local deben formar parte de la compra. SRST requiere compatibilidad y licencia y no crea una salida telefónica externa [S12].
7. **CM y VPN.** Los enlaces nominales de CM no deben copiarse de una sucursal sin dimensionar tráfico agregado. Resolver alcance de IP pública/CGNAT para concentradores, túneles hacia ambos nodos, rutas de retorno y fallo del edificio. Dos routers en CM no resuelven la pérdida del datacenter.
8. **Energía.** Separar alimentación de pares, dimensionar UPS con PoE, terminales WAN y autonomía; documentar dependencias eléctricas comunes. Cotizar fuentes/adaptadores secundarios donde se admitan.
9. **Proveedores reales.** Comprobar disponibilidad, contrato, velocidad y latencia por ubicación, especialmente Isla de Pascua/Antártica. Las cuatro WAN del simulador no acreditan cobertura comercial.

## Precios públicos observados

Son precios unitarios de consulta, no ofertas adjudicadas. Stock, canal autorizado, derechos de licencia, soporte en Chile, cantidad disponible e importación requieren confirmación. No se ha contactado a proveedores.

| Referencia | Precio publicado | Alcance del valor | Fuente |
|---|---:|---|---|
| C8211-G2 | USD 2.161,99 | Hardware; licencias y soporte no acreditados como incluidos | CDW [P1] |
| PA-510 | USD 1.138,50 | Solo appliance; vendedor exige contrato de soporte salvo ESA aplicable | Network Devices [P2] |
| PA-510 ATP 5 años | USD 1.276,09 | Solo Advanced Threat Prevention; no hardware, soporte ni paquete completo | Network Devices [P3] |
| C9200L-24P-4G-E | CLP 2.856.000 IVA incluido | Publicación etiquetada nuevo; verificar licencia, accesorios y soporte | KSM [P4] |
| C9200L-24P-4G-E, contraste | CLP 3.189.990 transferencia | Precio mostrado; tratamiento tributario y paquete a confirmar | SP Digital [P5] |
| C1300X-24P-4X | USD 1.562,99 | Hardware; accesorios y soporte pendientes | CDW [P6] |
| Desk Phone 9841 | USD 185,99 | Terminal nuevo, pedido especial; flete y plataforma aparte | IP Phone Warehouse [P7] |
| PA-510 en Chile | Consultar | Proveedor local identificado; sin precio público | Neuronet [P8] |

Se excluye como precio base la publicación KSM de CLP 1.428.000 para C9200L: no acredita condición nueva como la publicación de CLP 2.856.000. Tampoco se toman precios de equipos LAB/NFR, usados o sin licencias como equivalentes a equipo productivo nuevo. Se observaron discrepancias entre especificaciones de comercios; usar fichas oficiales para capacidad.

### Escenarios parciales para detectar escala de presupuesto

**Supuesto ilustrativo, no tipo de cambio cotizado:** USD 1 = CLP 1.000; factor tributario 1,19 sobre referencias USD. El IVA aplicado es una hipótesis de presupuesto, no liquidación tributaria de importación. No incluye flete, aranceles u otros cargos. Valores CLP de KSM ya incluyen IVA y no se multiplican otra vez. Redondear unidades a pesos antes de extender cantidades.

| Escenario por sucursal | Parcial por sucursal | 22 remotas iniciales | Seis futuras, aparte |
|---|---:|---:|---:|
| A: 2 C8211 +2 PA-510 +2 ATP 5 años +2 C9200L-24P | $16.604.260 | $365.293.720 | $99.625.560 |
| B: igual a A, con 2 C1300X-24P | $14.612.176 | $321.467.872 | $87.673.056 |
| C: 2 PA-510 con WAN/VPN +2 ATP 5 años +2 C1300X; sin routers separados | $9.466.640 | $208.266.080 | $56.799.840 |

**No son totales de proyecto ni comparaciones de prestaciones equivalentes.** C es una hipótesis técnica pendiente de aceptación de funciones, puertos y carga; no una solución seleccionada. Se aplica una plantilla de sucursal a las 22 para estimar escala, sin validar aún que sea apropiada para las dos ubicaciones especiales. Casa matriz queda completamente fuera de estos parciales.

Faltan: soporte Cisco/Palo Alto y licencias Cisco requeridas; seguridad adicional al ATP; gestión central; adaptadores/ópticas, kits de stacking y rack; distribución WAN; energía y UPS; telefonía/PBX/SIP; servidores/almacenamiento/respaldo; implementación y migración; contingencia; contratos WAN; operación y cobertura del sexto año. Los descuentos por volumen no se presuponen.

La alternativa C tampoco prueba encaje en CLP 160 millones. Antes de ampliar presupuesto, cotizar reutilización compatible, volumen, ejecución por etapas y comparar otra plataforma NGFW si el cliente autoriza ampliar marcas. No reducir cifrado, auditoría ni recuperación comprometida para que cierre una suma.

## Servidores y datos: alcance que sí podemos definir ahora

Primero inventariar el datacenter existente. Para servicios de red evaluar **dos hosts de virtualización** con capacidad para mantener los servicios esenciales al perder uno; no comprar un host por TACACS, DNS o monitoreo. Separar VMs y ubicaciones del primario/secundario, respaldo externo y acceso administrativo de emergencia. Quorum/testigo, almacenamiento y capacidad bajo fallo se resuelven según la plataforma; dos hosts solos no acreditan un clúster.

Como referencia de clase de hardware se identificó HPE ProLiant DL325 Gen11, que admite alimentación redundante [S13], pero **no se ha seleccionado ni cotizado una configuración**. Comparar generaciones actuales, CPU/RAM/SSD/red/garantía con las cargas y activos reales antes de comprar. No extender una referencia genérica a dimensionamiento del core financiero.

Para aplicaciones financieras hacen falta requisitos del proveedor de software: recursos, IOPS, latencia, base de datos, licencias, RPO/RTO y replicación. Para registros: eventos/segundo y retención. Para nube: región, recursos, VPN, transferencia/egreso, respaldo y recuperación. No se dispone de estas cargas para afirmar que un servidor o un costo mensual AWS sea suficiente. Un servidor por sucursal solo se justificaría por una necesidad local específica.

## Matriz de cierre antes de selección definitiva

| Pendiente | Evidencia necesaria |
|---|---|
| Inventario existente | Modelo/SKU, cantidades, estado de soporte, capacidad, puertos, licencias y condición de reutilización |
| Telefonía | Teléfonos por sede, plataforma, firmware, llamadas simultáneas y contingencia |
| Compra | Oferta por volumen de equipos nuevos, registro de licencias, impuestos y entrega en Chile |
| Soporte a seis años | Cobertura desde puesta en servicio, fechas EOL/SO, renovación y SLA de reposición local |
| Conexión física | Tabla puerto a puerto, medios y ópticas compatibles; reserva de HA y stacking |
| Capacidad | Tráfico por aplicación, TLS/IPsec, sesiones, CPU/memoria, puertos y PoE bajo fallo |
| Pruebas | Router/firewall/enlace apagado, recuperación de VPN y sesiones, switch miembro, telefonía y restauración |
| Presupuesto | CAPEX/OPEX separados, cinco años base y sexto adicional, CM y expansión desglosadas |

## Fuentes verificadas

- **S1** Cisco EOL15955: https://www.cisco.com/c/en/us/products/collateral/networking/sdwan-routers/catalyst-8000-edge-platforms/catalyst-c8300-2n2s-4t2x-6t-1n-4t-c8200l-eol.html
- **S2** Palo Alto, fechas de hardware: https://www.paloaltonetworks.com/services/support/end-of-life-announcements/hardware-end-of-life-dates
- **S3** Cisco C9200, avisos: https://www.cisco.com/c/en/us/products/switches/catalyst-9200-series-switches/eos-eol-notice-listing.html
- **S4** Cisco 8200 Secure G2: https://www.cisco.com/site/us/en/products/collateral/networking/sdwan-routers/8000-secure-routers/8200-series-secure-routers-ds.html
- **S5** Palo Alto, incorporación PA-500 y versiones: https://docs.paloaltonetworks.com/ngfw/release-notes/12-1/features-introduced-in-pan-os/hardware-features
- **S6** Palo Alto, puertos HA: https://docs.paloaltonetworks.com/compatibility-matrix/reference/supported-os-releases-by-model/ha-port-and-processor-support
- **S7** Requisitos HA: https://docs.paloaltonetworks.com/ngfw/administration/high-availability/set-up-activepassive-ha
- **S8** Cisco C9200: https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html
- **S9** Cisco 1300/X: https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-1300-series-switches/nb-06-cat1300-ser-data-sheet-cte-en.html
- **S10** Cisco 8300 Secure: https://www.cisco.com/c/dam/en/us/products/collateral/routers/secure-routers/8300-series-secure-routers-ds.pdf
- **S11** Cisco teléfonos 9800: https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/ip-phones/desk-phone-9800-series-ds.html
- **S12** Cisco SRST: https://www.cisco.com/c/en/us/products/collateral/unified-communications/unified-survivable-remote-site-telephony/data-sheet-c78-744126.html
- **S13** HPE DL325 Gen11 QuickSpecs: https://www.hpe.com/psnow/doc/a50004297enw
- **P1** https://www.cdw.com/product/cisco-8200-series-router-desktop/9186404
- **P2** https://networkdevicesinc.com/products/pan-pa-510
- **P3** https://networkdevicesinc.com/collections/new-collection/products/pan-pa-510-atp-5yr
- **P4** https://www.ksmtec.cl/producto/switches/switch-catalyst-c9200l-24p-4g-e-2/
- **P5** https://www.spdigital.cl/switch-cisco-gigabit-ethernet-catalyst-9200l-24-puertos-poe-4x1g-no-administrable/
- **P6** https://www.cdw.com/product/cisco-catalyst-1300x-24p-4x-switch-24-ports-managed-rack-mountable/9193163
- **P7** https://www.ipphone-warehouse.com/cisco-9841-voip-desk-phone-dp-9841-k9/
- **P8** https://neuronet.cl/producto/palo-alto-pa-510/

Apoyo de revisión técnica: [Cisco IOS Patterns, CiscoDevNet](https://github.com/CiscoDevNet/skills/blob/main/skills/ios/cisco-ios-patterns/SKILL.md). No certifica una BOM ni reemplaza fichas, compatibilidad o pruebas de hardware.

**Documentos relacionados:** [bitácora](bitacora-proyecto.md), [servicios centrales](servicios-centrales-dns-ntp.md), [AAA y observabilidad](aaa-syslog-observabilidad.md). No se han modificado las configuraciones, el Excel ni los entregables anteriores mediante este informe.
