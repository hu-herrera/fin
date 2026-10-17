# Propuesta C4 — cuatro WAN y alta disponibilidad

**17-10-2026 · Financiera Pacífico · diseño físico preferido.** Sustituye el plano B de dos WAN como propuesta de trabajo. No modifica todavía el perfil DESPUÉS del simulador ni constituye compra, contrato o certificación de rendimiento.

[Entradas y precios](entradas-propuesta-cuatro-wan.json) · [plano por las 23 ubicaciones y BOM](propuesta-cuatro-wan-2026-10-17.json). Reproducir con `node network/four-wan-design.cjs`; comprobar con `--check` y `node tests/four-wan-design.test.cjs`.

## 1. Decisión de arquitectura

| Ámbito | Diseño preferido |
|---|---|
| Cada una de las 22 sucursales | Dos **PA-540** A/P, dos C9200L-24P-4G-E en StackWise y cuatro entregas WAN separadas |
| Casa central | Dos **PA-1410** A/P, dos C9200L-48P-4X-E y cuatro entregas WAN; switching de servidores pendiente de su ampliación |
| WAN de cada ubicación | Starlink, Amazon Leo, Entel 5G y GTD 4G como escenario académico |
| Puestos | 650 teléfonos SIP-T33G preferidos, con soporte/PBX pendientes; teléfono → PC comparte puerto PoE |
| Funciones de borde | Routing, NAT, inspección y VPN en el par de firewalls; sin un router corporativo adicional en serie |

Se extiende la consolidación también a CM: **los dos C8221-G2 dejan de ser compra base**, pues el par NGFW recibe las cuatro WAN y concentra VPN. Quedan como alternativa si surge un requisito de borde que justifique una función adicional concreta. Cisco permanece en switching; los módems/CPE de los proveedores siguen siendo necesarios y pueden incluir funciones de router. No se atribuye un ahorro monetario a equipos centrales que todavía estaban sin precio.

Los 92 CPE/terminales y cuatro servicios por sede son cantidades de diseño, no contratos disponibles. Amazon Leo se considera disponible por decisión ficticia del proyecto. La cobertura y diversidad de los cuatro accesos en todas las ubicaciones, incluidas las especiales, son **premisas académicas**, no una comprobación de cobertura o de infraestructura independiente por competir comercialmente.

Internet de usuarios sale **localmente en cada sucursal**, inspeccionado por su NGFW. Core financiero, gestión autorizada y telefonía central circulan por VPN. Eso reduce la concentración de navegación en CM. La resolución DNS debe distinguir zonas corporativas y públicas, con caché/forwarding local autorizado y sin enviar nombres privados a un resolver público por defecto. No basta cambiar la ruta por defecto y conservar DNS exclusivamente central.

## 2. Por qué cambia el firewall remoto

PA-510 tiene ocho puertos de datos. Cuatro WAN + dos LAN + HA1 + HA2 + HA2 backup requieren nueve; no caben manteniendo ese plano. El PA-520 tampoco aporta más RJ45. El **PA-540 tiene ocho RJ45 y dos SFP de 1 Gbps**, además de MGT separado [F1]. El medio de los dos uplinks importa: no se dibujan como cobre ni 10G.

Otra ingeniería podría usar PA-510 sin HA2 backup, agotando sus ocho puertos y ocupando cobre del acceso; no es la selección de este plano. PA-540 se prefiere por las interfaces, la reserva y el respaldo de sincronización. La prestación criptográfica/inspección con las funciones y versión elegidas todavía debe probarse; no se convierte un puerto Gigabit en rendimiento garantizado.

### Interfaces de cada PA-540, iguales en ambos miembros

| Interfaz | Rol |
|---|---|
| ethernet1/1 | Starlink |
| ethernet1/2 | Amazon Leo |
| ethernet1/3 | Entel 5G |
| ethernet1/4 | GTD 4G |
| ethernet1/5 | HA1 directo al peer |
| ethernet1/6 | HA2 directo al peer |
| ethernet1/7 | HA2 backup, por otro enlace directo |
| ethernet1/8 | Reserva |
| ethernet1/9, SFP 1G | LAN al miembro 1 del stack |
| ethernet1/10, SFP 1G | LAN al miembro 2 del stack |
| MGT, separado | Gestión local y heartbeat backup entre peers |

Un agregado LAN **por firewall**: FWA → Po21 del stack, FWB → Po22. No se mezclan ambos firewalls en un solo LAG. FWA conecta a Gi1/1/1 y Gi2/1/1; FWB a Gi1/1/2 y Gi2/1/2. Configurar/validar LACP pre-negotiation, enlaces del pasivo y seguimiento de rutas/links con la versión final. Recuperar el preferido de forma controlada, evitando preemption innecesaria.

### Interfaces de cada PA-1410 central

Cuatro WAN en ethernet1/1–4; LAN de 10G en ethernet1/19–20 hacia los dos miembros del stack; HA1-A y HA1-B dedicados conectados; HA2 por HSCI directo de 10G y HA2 backup en ethernet1/8. MGT queda para gestión, **no como puerto HA1** [F2]. El respaldo HA2 de 1G tiene menor capacidad que el principal: validar sincronización bajo carga, no suponer equivalencia.

Los dos switches centrales tienen cuatro uplinks 10G cada uno: dos se reservan a FWA/FWB y dos a los dos hosts con doble enlace propuesto. No quedan uplinks 10G para añadir arbitrariamente almacenamiento, BKP-01 o más hosts. Antes de elevar el backup de 1G o agregar servidores debe seleccionarse más capacidad de switching de datacenter; su costo no está escondido en este plano WAN.

## 3. Entrega de cada proveedor a ambos firewalls

Cada CPE debe permitir llegar a FWA y FWB en el mismo dominio de su WAN. No se usan un cable en Y ni un único switch para concentrar los cuatro proveedores.

Se reserva **un distribuidor pequeño por proveedor**, separado de los switches PoE de acceso: hasta 92 unidades C1300-8T-E-2G. Ese modelo tiene ocho GE y dos combo, con VLAN y gestión; se usa como L2, sin routing [F3]. Es una reserva conservadora, **no instrucción de comprar 92 unidades**: se elimina por enlace si el CPE ofertado demuestra dos entregas equivalentes y comportamiento correcto ante HA. Un C1200 u otro equipo más económico puede sustituirlo tras verificar funciones/soporte; no se inventa su precio.

| Puerto del distribuidor | Uso | VLAN |
|---|---|---|
| GE1 | CPE del proveedor correspondiente | 201, 202, 203 o 204 |
| GE2 | WAN de FWA | La misma WAN |
| GE3 | WAN de FWB | La misma WAN |
| GE4 | Gestión hacia el stack interno | 130, aislada de la WAN |
| Restantes | Sin uso, administrativamente cerrados | Sin acceso de usuario |

No hay SVI de enrutamiento entre WAN y gestión ni una troncal pública que arrastre VLAN internas. Restringir SSH/SNMP/administración a TI y deshabilitar servicios de administración en las interfaces WAN del firewall. La gestión de un distribuidor no constituye un camino alternativo para navegar cuando su CPE está caído.

Para direccionamiento estático/dinámico o NAT del CPE deben validarse VIP/MAC del HA, leases, NAT-T, UDP 500/4500, MTU/MSS, DPD, rekey y cambios de IP. PAN-OS sincroniza determinados datos DHCP según versiones; no afirmar que todos los estados IKE o NAT de terceros se conserven [F4]. Los endpoints públicos de CM y su estabilidad son requisitos contractuales abiertos; CGNAT no se resuelve por dibujar un túnel.

## 4. Gestión separada y puertos de puestos

La gestión local candidata usa VLAN130, `10.80.N.0/27`: gateway del stack `.1`, MGT de FWA/FB `.10/.11` y distribuidores `.20–.23`. El tránsito de routing de gestión hacia el firewall usa **otra subred**, VLAN131 `10.80.N.64/29`, stack `.65` y dirección de datos HA `.66`. MGT130 no se incluye en el trunk de datos del firewall: así se evita poner la misma red en su interfaz MGT y en una interfaz de datos.

Es gestión dedicada local, **no OOB remoto independiente**. Si cae todo el borde WAN/NGFW, no se promete administración remota por esa misma infraestructura. Rutas de retorno, ACL del stack y políticas de tránsito deben limitar la gestión a administradores/servicios autorizados antes de exportar configuraciones.

Los cuatro uplinks LAN de los firewalls usan SFP del stack, liberando cobre. Por remota quedan ocho puertos de infraestructura reservados entre ambos miembros: dos MGT de firewall, cuatro MGT de distribuidores y dos para otra infraestructura. Una remota de 30 puestos, con crecimiento a 36, conserva **cuatro puertos de cobre libres**. Los dos switches de 24 siguen alcanzando, sin inventar que teléfonos y PCs usan dos puertos de acceso distintos.

Ópticas de LAN: **176 módulos 1G para remotas y ocho 10G para CM**, 92 enlaces de fibra en total, más un DAC HSCI central. Validar ópticas calificadas por cada fabricante, medio/distancia y presupuesto óptico. Los kits y dos cables de anillo StackWise por pareja siguen separados de LACP.

## 5. Energía y dominios de falla

Se proponen dos dominios UPS A/B por ubicación, con ambos firewalls y ambos switches de acceso alimentados desde los dos dominios mediante sus fuentes apropiadas. Se deben añadir/confirmar adaptadores y PSU secundarios; no se presumen incluidos en los precios del chasis.

Los CPE/distribuidores de Starlink y Entel se asignan a A, los de Leo/GTD a B. Una caída de una UPS no elimina los cuatro accesos. Son grupos de diseño, no circuitos independientes verificados. Autonomía, picos de consumo, tierra y ambiente requieren cálculo; no se reutiliza automáticamente el dimensionamiento eléctrico de la red antigua, que tenía menos equipos.

El objetivo es 46 UPS en las 23 ubicaciones; cuántas se compran depende de reutilización/estado y no se fija como 46 compras nuevas. Los PCs conservan su dependencia de alimentación propia y de su único switch de acceso. El stack no mueve físicamente un teléfono/PC a otro switch cuando su miembro falla. Aplicación/BD/edificio siguen necesitando su propio diseño de continuidad.

## 6. Routing, VPN y capacidad de CM

La base propone routing monitorizado y balanceo por **sesión**, pendiente de validar el motor de routing y versión final. ECMP no une cuatro enlaces en un solo flujo: PAN-OS contempla hasta cuatro rutas de igual costo en FIB y opciones de balanceo; `Strict Source Path` evita que el tráfico IKE/IPsec salga por la interfaz incorrecta [F5]. Convergencia y distribución reales necesitan pruebas, en ambos sentidos.

Se reservan **16 combinaciones de túnel por sucursal** (cuatro WAN remotas × cuatro endpoints centrales): 352 inicialmente, 448 para 28 remotas futuras. Son candidatos lógicos, no 16 rutas ECMP simultáneas hacia un destino, sesiones ni SAs. El pasivo no duplica el número. Límites de túneles, OSPF, pesos, filtros y selección de los cuatro caminos activos deben cerrarse por versión/modelo antes de generar configuración.

La selección dinámica por latencia/jitter/pérdida y aplicación queda como alternativa **Advanced SD-WAN** con licencia/gestión propias [F6]. No se vende ICMP o ECMP como SD-WAN. La referencia opcional de licencia permite comparar el costo, pero no autoriza asumir compatibles todas las versiones o automatizar Auto VPN sin verificarlo.

### Capacidad: cuatro accesos no prueban continuidad completa

Se conservan las referencias del modelo (180/130/300/60 Mbps), no como caudales garantizados. Con Internet local remoto, la envolvente hacia CM se estima con datos corporativos, voz y margen provisional del 10% para transporte cifrado; el margen no sustituye un cálculo de paquetes/MTU. Se añade tráfico local de CM y llamadas externas para el conjunto central.

| Hipótesis | 23 ubicaciones actuales | Futuro ilustrativo: seis remotas × 30 PCs |
|---|---:|---:|
| Envolvente de VPN corporativa/voz | 246,708 Mbps | 321,156 Mbps |
| Conjunto central de referencia | 282,908 Mbps | 357,356 Mbps |
| Capacidad de un único proveedor para ese conjunto, al 70% | **404,154 Mbps** | **510,509 Mbps** |

La suma nominal ideal es 670 Mbps; su presupuesto al 70% es 469. No representa bonding ni capacidad real demostrada. Al perder Entel, quedan 370 nominales y 259 de presupuesto: hoy cabe la envolvente corporativa, pero no todo el conjunto con ese margen; en el futuro tampoco cabe esa envolvente corporativa. Con solo un proveedor superviviente, ninguna de las cuatro referencias mantiene todo el conjunto con el margen elegido.

**La continuidad/capacidad central permanece abierta.** Deben cotizarse perfiles centrales mayores o definir un mínimo operativo por servicio con QoS, prioridades y restricciones de tráfico no esencial. No se reduce silenciosamente la demanda ni se promete continuidad completa a 29 ubicaciones por sumar cuatro antenas. La selección de capacidad central exige demostrar el escenario de fallas comprometido, no solo encender cuatro interfaces. Los cálculos son límites de planificación; no son caídas observadas ni disponibilidad histórica.

## 7. Presupuesto actualizado y comparación comercial

Se conservan USD supuesto a CLP1.000 y factor 1,19 ilustrativo, redondeando la unidad al peso antes de multiplicar. No es tipo de cambio vigente ni una oferta tributaria/importadora. Se mezclan referencias minoristas y de lista, identificadas por partida; no se presume descuento de proyecto ni de peer HA.

| Partida con referencia | Cant. | Parcial CLP ilustrativo |
|---|---:|---:|
| PA-540, USD3.394,80 hardware [P1] | 44 | $177.751.728 |
| ATP PA-540 cinco años, lista USD4.016,25 [P2] | 44 | $210.290.872 |
| C9200L-24P-4G-E, referencia anterior | 44 | $125.664.000 |
| SIP-T33G, referencia anterior | 650 | $59.626.450 |
| PA-1410 central, referencia anterior | 2 | $27.096.300 |
| ATP PA-1410 cinco años, referencia anterior | 2 | $30.523.500 |
| Kits de stack, referencia anterior | 46 | $41.820.808 |
| **Subtotal parcial C4 con referencia** | | **$672.773.658** |

Advanced SD-WAN opcional, cinco años: lista de USD3.570 por PA-540 y USD13.500 por PA-1410 [P2], **$219.055.200 adicionales** con el mismo supuesto de conversión y licencias completas de ambos peers. El parcial con esa alternativa sería **$891.828.858**, sin gestión ni resto de faltantes. Validar bundles, elegibilidad HA2 y soporte; no cobrar ATP u otra función dos veces si una oferta los agrupa.

El distribuidor C1300 tiene una publicación local de **$508.960 por transferencia** [P3]. IVA/bundle por confirmar: **excluida del subtotal**. Para 92 reservas mostraría $46.824.320 antes de homologar condiciones; no constituye compra ni valor definitivo. No se toma el texto comercial sobre sistema operativo como una plantilla IOS-XE certificada.

Siguen sin precio incorporado: switches CM, ópticas/fibras/cobre, CPE/terminales y planes/datos, soporte local, seguridad complementaria, sexto año, gestión, PSU/UPS, datacenter/DR/PBX, montaje, migración, flete e importación y contingencia. El precio público no acredita stock de toda la flota, canal autorizado o soporte por seis años desde implantación. Total completo y ahorro neto continúan en **null**. El nuevo parcial no es comparable como incremento neto contractual frente a B: cambia hardware, alcance y la fuente de suscripción.

### Contraste necesario con la alternativa de routers separados

La referencia histórica A con los mismos teléfonos SIP suma CLP **524.360.778** en sus partidas valorizadas, frente a los **672.773.658** de C4: diferencia referencial de **148.412.880** a favor del parcial A. No son ofertas homologadas: A tiene licencias Cisco criptográficas/routing y adaptación de medios/gestión sin precio; C4 usa una suscripción de otro modelo y referencia comercial. No se puede presentar C4 como ahorro demostrado por eliminar routers.

A sigue siendo alternativa válida para oferta comparable: dos C8211 por remota con cuatro WAN y dos enlaces hacia PA-510; en el firewall dos enlaces a routers, dos LAN y tres HA caben en ocho puertos. La gestión de routers añade dos puertos por pareja; cobre/SFP y puertos del stack deben recalcularse, no copiar las ocho reservas de C4. Falta validar que cada C8211 tenga las seis interfaces requeridas utilizables en el modo/licencia seleccionado, además del cifrado de 300 Mbps. Esto no es un plano A adjudicado ni validación de sus plantillas.

**C4 es la preferencia física de esta revisión, no un ganador financiero confirmado.** La simplicidad de operar menos funciones duplicadas debe contrastarse con su prima de precio y el TCO; no justifica por sí sola gastar más. Se deben comparar ambas alternativas con el mismo soporte, seguridad, medios, plazos, pruebas y capacidad bajo falla antes de comprar.

El [cierre complementario de capacidad](cierre-capacidad-y-comparacion.md) incorpora carga exigente, crecimiento simultáneo de sedes existentes y pérdida de grupos UPS. Sus requisitos centrales son superiores a la sensibilidad normal inicial; no se reinterpretan los cuatro planes nominales como contratos capaces de cumplirlos.

## 8. Qué ya se valida y qué sigue

El módulo C4 genera los 23 planos y comprueba puertos sin repetición, medios 1G/10G, separación WAN/gestión, capacidad de cobre e IPs de gestión. Su inspección de fallas diferencia acceso físico de continuidad del negocio: pérdida de un CPE/distribuidor quita solo su WAN; pérdida de FWA selecciona FWB; ambos firewalls caídos no apagan switching local; perder HA2 y backup degrada sincronización sin fingir que apaga Internet; una UPS no debe quitar todas las WAN.

Son pruebas del **candidato**, no conmutación real, sesiones preservadas, QoS real ni resultados de uptime. ANTES queda intacto y DESPUÉS sigue ejecutando su perfil anterior C8300 → PA-1410 único → stack. Para migrarlo deben cambiar juntos dibujo, estados HA, selección de WAN, ping interno/mapa, terminales/exportadores e IPAM. No renombrar el dibujo y conservar el motor viejo como si ya ejecutara C4.

Antes de esa migración: cerrar el escenario de capacidad central y gestión de rutas/túneles; validar entregas CPE y SKU/versión/licencias; completar medios/energía y precios; y ejecutar el piloto de una remota con CM. Aplicaciones y recuperación de datos se cierran en su propio alcance.

## Referencias consultadas el 17-10-2026

- **F1:** [Palo Alto, panel PA-520/PA-540](https://docs.paloaltonetworks.com/hardware/pa-500-hardware-reference/pa-500-series-firewall-overview/pa-500-series-firewall-components/pa-520-pa-540-components).
- **F2:** [Palo Alto, panel PA-1400 y HA](https://docs.paloaltonetworks.com/hardware/pa-1400-hardware-reference/pa-1400-series-overview/front-panel-1400-series).
- **F3:** [Cisco, ficha Catalyst 1300/1300X](https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-1300-series-switches/nb-06-cat1300-ser-data-sheet-cte-en.html).
- **F4:** [PAN-OS, sincronización HA](https://docs.paloaltonetworks.com/ngfw/administration/high-availability/reference-ha-synchronization).
- **F5:** [PAN-OS, logical router y ECMP](https://docs.paloaltonetworks.com/ngfw/networking/advanced-routing/configure-a-logical-router).
- **F6:** [PAN-OS, About SD-WAN](https://docs.paloaltonetworks.com/sd-wan/getting-started/about-sd-wan).
- **P1:** [Network Devices, PAN-PA-540](https://networkdevicesinc.com/products/pan-pa-540). Hardware sin soporte contratado.
- **P2:** [CDW, catálogo julio 2026](https://webobjects2.cdw.com/is/content/CDW/cdw/on-domain-ca/pdfs/palo-alto-cag-quebec-msrp-aug-2026.pdf), columna **PRIX USD**, páginas PDF 13 y 2. No confundir con la columna CAD ni con un descuento local.
- **P3:** [SP Digital, C1300-8T-E-2G](https://www.spdigital.cl/cisco-catalyst-1300-8-port-ge-ext-ps/). Referencia observada, tributación/bundle pendientes.
