# Fase 2 — dimensionamiento y selección de la propuesta

**Revisión:** 17-10-2026, v0.2. **Resultado:** propuesta técnica y comparación económica para revisión; no orden de compra ni cotización formal. Parte del [inventario ANTES](base-infraestructura-antes.json) y amplía la [investigación preliminar](investigacion-equipamiento-2026-10-17.md). Los [cálculos por sede y partidas](dimensionamiento-propuesta-2026-10-17.json) acompañan este documento.

## 1. Recomendación de trabajo

Mantener como **variante A** dos routers Cisco equivalentes, dos firewalls iguales en activo/pasivo y dos switches PoE por ubicación. Comparar dos equipos de gama adecuada frente al esquema de un principal muy grande y un respaldo pequeño: el superviviente debe soportar la carga comprometida, las funciones y las licencias. El modelo más barato solo sirve si cumple ese mismo mínimo bajo falla.

Para acceso, **dos switches de 24 puertos en cada remota y dos de 48 en CM** cubren el reparto actual con teléfono → PC. La cantidad de teléfonos no obliga a duplicar puertos físicos. El datacenter se dimensiona por interfaces, tráfico y almacenamiento: no justifica por sí solo un tercer switch de acceso.

La lista corta se mantiene condicionada a verificaciones concretas:

| Rol | Candidato prioritario para oferta | Cantidad inicial | Motivo y condición de selección |
|---|---|---:|---|
| Router remoto | C8211-G2; contrastar C8221-G2 cuando falten interfaces/margen | 44 | Puertos WAN/flex/LAN y licencia criptográfica deben admitir el plano físico completo; el chasis solo no acredita esa capacidad operativa |
| Firewall remoto | PA-510, par del mismo modelo | 44 | Ocho puertos de datos más gestión; reservar HA y exigir rendimiento con inspección real [F3] |
| Switch remoto | C9200L-24P-4G-E | 44 | PoE y StackWise-80; conservar IOS-XE evita una migración adicional de sistema operativo [F2] |
| Router CM | C8221-G2, con escalamiento sujeto a carga e interfaces | 2 | Comparar agregación, túneles, medios ópticos y licencia. C8355 no se declara necesario por ser mayor |
| Firewall CM | PA-1410, par activo/pasivo | 2 | Cuatro puertos de datos 10G por equipo permiten separar tránsito y LAN; dimensionar el superviviente [F6] |
| Switch CM | C9200L-48P-4X-E | 2 | 96 puertos de cobre y ocho uplinks 10G en el conjunto; el uso de servidores puede agotar esos uplinks |
| Teléfono de puesto | DP-9841-K9= | 650 | Puerto compartido Gigabit, VLAN de voz y PoE clase 2. PBX, firmware, seguridad y licencias deben ser compatibles [F4] |
| Hosts/backup | Auditar dos hosts y repositorio existentes; comparar ampliación o sustitución | Sin compra de hosts fijada | No se asigna CPU/RAM/IOPS de la aplicación financiera sin sus requisitos; dos hosts no constituyen automáticamente un clúster |

**Totales de la variante A:** 46 routers, 46 firewalls, 46 switches y 650 teléfonos. Son cantidades objetivo de la propuesta, distintas del inventario antiguo. Los seis sitios futuros agregan 12 routers, 12 firewalls y 12 switches; sus usuarios y teléfonos no tienen una cantidad definitiva. No se reparten allí los 650 actuales.

## 2. Dimensionamiento de acceso y PoE

Se adopta para revisión un **20% de crecimiento de puestos dentro de las sedes existentes**, ocho puertos de cobre reservados para otros usos por remota y 16 en CM. Son reservas de ingeniería para APs, impresoras, gestión/UPS y otros equipos: no cantidades acreditadas ni compras nuevas de esos dispositivos.

`Puertos libres = 2 × puertos por switch − ceil(PCs × 1,20) − reserva de otros usos`.

| Grupo | Sedes | Pares actuales por sede | Puertos del par | Puestos con 20% de crecimiento | Reserva adicional | Libres tras crecimiento |
|---|---:|---:|---:|---:|---:|---:|
| CM | 1 | 55 | 96 | 66 | 16 | 14 |
| S01–S05 | 5 | 30 | 48 | 36 | 8 | 4 |
| S06–S20 | 15 | 28 | 48 | 34 | 8 | 6 |
| S21 | 1 | 17 | 48 | 21 | 8 | 19 |
| S22 | 1 | 8 | 48 | 10 | 8 | 30 |

Los puertos traseros StackWise y los uplinks SFP se cuentan aparte del cobre; un uplink RJ-45 sí consume cobre. En la remota con PA-510, los ocho puertos reservados incluyen cuatro terminaciones LAN de los firewalls, dos de gestión de los peers y dos para otros usos. Como distribución candidata, puertos 23/24 de cada miembro para FW-A/FW-B, 22 para gestión y 21 para otro uso; el resto admite hasta 20 puestos por miembro. Más impresoras/APs/UPS exigirán ampliar la reserva y recalcular. No se reutilizan Gi1/0/45–46 del switch antiguo de 48 puertos en uno de 24.

Para PoE se presupuesta **7 W por teléfono** como asignación de ingeniería de clase 2, más 60 W de otros consumidores por miembro y 20% de margen. No representa consumo medido ni autonomía. Con puestos crecidos repartidos de forma equilibrada, el caso remoto mayor requiere `ceil((18×7+60)×1,20) = 224 W` por switch; CM requiere `ceil((33×7+60)×1,20) = 350 W`. Las referencias del fabricante con una fuente son 370 W en el 24P-4G y 740 W en el 48P-4X [F2]. Verificar presupuesto efectivo con el SKU/fuentes y perfiles LLDP/CDP finales. Los 60 W son una reserva de potencia, no una cantidad de APs instalada: cualquier dispositivo adicional debe caber también en el presupuesto de puertos.

El 9841 mantiene Gigabit en la salida hacia el PC. El 9811, aunque pertenece a la misma familia, usa 10/100: no es una sustitución equivalente si queremos eliminar ese límite [F4]. Un cable o un teléfono averiado todavía puede dejar sin red a su PC. Distribuir puestos críticos entre miembros y definir servicio mínimo durante reparación; no presentar el stack como doble conexión de cada puesto.

Para un anillo de dos miembros se presupuestan cuatro adaptadores y dos cables de stack: **dos kits por sede**, cada uno con dos adaptadores y un cable según la ficha. Total inicial: 46 kits, 92 adaptadores y 46 cables. Comprobar lo ya incluido en el bundle para no facturarlo dos veces [F2, F7].

## 3. Carga central: un objetivo verificable, no una medición inventada

Para dimensionar una oferta inicial se usa un ejercicio de sensibilidad: 595 puestos remotos; 30% de PCs concurrentes a 2 Mbps; 10% de teléfonos en llamada, redondeados hacia arriba; 0,16 Mbps por llamada y por dirección como reserva conservadora que debe verificarse con códec/encapsulación. Se divide la carga por 0,70 para reservar capacidad. No son mediciones del cliente ni una predicción de consumo.

| Escenario ilustrativo | Puestos remotos | Datos + voz | Capacidad requerida al 70% |
|---|---:|---:|---:|
| Reparto actual | 595 | 366,60 Mbps | 523,71 Mbps |
| Seis futuras de 30 puestos, solo para sensibilidad | 775 | 477,48 Mbps | 682,11 Mbps |
| Futuro exigente: 50% a 4 Mbps, 20% en llamada | 775 | 1.574,80 Mbps | 2.249,71 Mbps |

Como punto de cotización, estudiar **dos accesos centrales independientes de 1 Gbps**, cada uno capaz de sostener el escenario de referencia bajo falla. No se asignan a los satélites de sucursal ni se afirma cobertura/caudal contratado. La tabla excluye tráfico propio de CM, copias, replicación, actualizaciones y crecimiento no previsto: hay que agregarlos antes de fijar capacidad. Si la demanda se aproxima al escenario exigente, el objetivo de 1G superviviente debe aumentar y revisarse el plano de interfaces, router y firewall.

El rendimiento debe verificarse con IPsec, paquetes mixtos, inspección/TLS, QoS y sesiones. No se suman velocidades de dos firewalls activo/pasivo ni cuatro máximos de proveedores como si fueran capacidad garantizada del enlace superviviente.

Para el caso máximo lógico de cuatro WAN por cada uno de dos routers remotos hacia ambos routers centrales: cada nodo de CM tendría hasta `22×2×4 = 176` túneles iniciales y `28×2×4 = 224` con expansión. Total de relaciones hacia ambos nodos: 352/448. No es el número de SAs IPsec ni prueba de que las cuatro WAN estén disponibles; es una envolvente de dimensionamiento. Revisar identidades IKE, NAT-T, MTU y rutas de retorno.

## 4. Licencias y versiones: corrección necesaria de la comparación anterior

La matriz de Cisco publica **P2P IPsec hasta 250 Mbps de cifrado agregado en OS Essentials** [F1]. Por tanto, el precio de un C8211-G2 sin entitlement adicional no demuestra 300 Mbps cifrados. Cotizar explícitamente Routing Advantage/OS Advantage u otra licencia admitida por el SKU y modo, con su cobertura, rendimiento autorizado y soporte. No habilitar cifrado sin licencia ni atribuir 3 Gbps de ficha al equipo entregado sin verificarla. La matriz sitúa también Object Tracking entre las funciones avanzadas: verificar la licencia de la lógica de failover, no solo del cifrado.

No duplicar automáticamente licencias de inspección de amenazas de Cisco y Palo Alto: en la variante separada el NGFW presta esa función; la licencia Cisco debe cubrir sus funciones de routing/VPN/gestión. SD-WAN gestionada es otra modalidad con suscripciones y operación propias, no un cambio gratuito de nombre [F1, F5].

Hay una discrepancia documental a resolver: la ficha actual del C8211-G2 cita IOS XE 26.2.1 o posterior, mientras la FAQ cita 26.1.2 [F5, F8]. La propuesta exige confirmar imagen por modelo, modo y funciones con matriz/release notes y proveedor. Las plantillas 17.9 del simulador no se trasladan sin adaptación a estos routers. Igualmente, las licencias perpetuas del switch y su suscripción comercial deben desglosarse: no suponer que un anuncio de hardware incluye todos los derechos y el plazo requerido.

Los dos peers Palo Alto deben cotizarse con suscripciones compatibles y soporte. Se contabiliza ATP en ambos para un parcial conservador; cualquier SKU/descuento HA2 debe quedar acreditado. ATP no equivale al paquete completo de URL, DNS, WildFire, soporte o gestión central.

## 5. Plano físico que deberá aprobarse antes de migrar DESPUÉS

### Remota — variante separada

| Equipo / función | Reserva de interfaces | Verificación pendiente |
|---|---|---|
| Cada router | 4 accesos WAN + 1 tránsito hacia FW-A + 1 hacia FW-B = 6 interfaces de datos | C8211 tiene 2 WAN, 2 flex y 2 LAN; demostrar el modo requerido en todas. Sin margen físico: usar C8221 si no cumple o si hace falta una interfaz adicional [F5] |
| Cada PA-510 | e1/1 hacia R-A; e1/2 hacia R-B; e1/3–4 a los dos miembros del stack, un LAG por firewall; e1/5 HA1; e1/6 HA2; e1/7–8 reservados | Gestión separada; validar HA1 de respaldo/heartbeat, split-brain y el mapeo final [F3] |
| Stack | Dos cables traseros; enlaces desde cada FW hacia ambos miembros | Un LAG distinto por firewall, no unir ambos peers HA en el mismo LAG; comprobar LACP pasivo/activo y conmutación |
| Cada proveedor | Entrega utilizable desde ambos routers | Doble entrega o CPE con dos conexiones/segmento admitido, direcciones y permisos MAC. Si solo hay un puerto, distribución WAN redundante cotizada aparte |

No hacer un LACP distribuido entre routers independientes. Los tránsitos deben usar rutas independientes, con adyacencias y retirada de rutas acordes a HA; no poner tráfico de una misma sesión por firewalls distintos. HSRP no copia sesiones IPsec. La elección OSPF/BFD/seguimiento necesita pruebas de interoperabilidad y seguridad; esta tabla no es una configuración IOS/PAN-OS aprobada.

No hay un switch WAN único gratuito oculto. Si cada proveedor falla como un dominio independiente, la red puede seguir por otro; un único CPE o distribuidor común a todos los caminos no cumple ese criterio. Las cuatro etiquetas del simulador siguen siendo alternativas sujetas a cobertura por sitio, especialmente S21/S22.

### CM — presupuesto de uplinks

En cada PA-1410 reservar e1/19–20 (10G) para los dos routers y e1/21–22 (10G) para LAN/stack. HA1-A y HA1-B se conectan/configuran; HSCI directo entre peers para HA2. MGT no se reutiliza como HA1 [F6]. Cada C8221 reservaría sus dos SFP+ para los firewalls y los accesos de 1G en cobre/flex según el diseño validado. Ópticas/DAC compatibles se cotizan aparte.

En cada switch CM, cuatro uplinks 10G permiten provisionalmente dos enlaces a los firewalls y uno a cada host físico: **los ocho uplinks del par quedan ocupados**. El repositorio de respaldo podría usar cobre 1G solo si cumple su ventana; no se asume suficiente. Almacenamiento compartido 10/25G, un tercer host o más servidores obliga a revisar switching de datacenter. Se elige entonces una pareja de switches de servidores o una plataforma con más puertos, no un tercer switch arbitrario sin función.

Dos hosts y backup se auditan antes de comprar. Primarios/secundarios de DNS/NTP/AAA deben residir en dominios de falla distintos; aplicación y base de datos necesitan su propio diseño de recuperación. Quorum/testigo, almacenamiento y copia externa/DR no quedan resueltos por encender dos VMs. TACACS+ administra accesos de red, no almacena los datos de clientes.

## 6. Partidas económicas revalidadas

**Supuestos de conversión:** USD 1 = CLP 1.000, factor ilustrativo 1,19 para referencias USD; redondear cada unidad al peso antes de multiplicar. No es tipo de cambio vigente ni liquidación tributaria de importación. El precio KSM ya declara IVA incluido. No se presuponen descuentos de volumen, fletes o stock de toda la flota.

| Partida | Cant. | Referencia unitaria de origen | Parcial CLP ilustrativo | Fuente |
|---|---:|---:|---:|---|
| C8211-G2 remoto | 44 | USD 2.161,99 | $113.201.792 | P1 |
| PA-510 | 44 | USD 1.138,50 | $59.611.860 | P2 |
| PA-510 ATP 5 años | 44 | USD 1.276,09 | $66.816.068 | P3 |
| C9200L-24P-4G-E | 44 | CLP 2.856.000, IVA incluido | $125.664.000 | P4 |
| DP-9841-K9= | 650 | USD 185,99 | $143.863.200 | P5 |
| PA-1410 CM | 2 | USD 11.385,00 | $27.096.300 | P6 |
| PA-1410 ATP 5 años | 2 | USD 12.825,00 | $30.523.500 | P7 |
| Kit C9200L, factory sealed | 46 | USD 763,99 | $41.820.808 | P8 |
| **Subtotal de partidas con referencia** | | | **$608.597.528** | **No es total de proyecto** |

Los routers de CM, sus licencias, los switches CM y otros faltantes quedan **sin precio incorporado**, no a costo cero. SP Digital muestra CLP 9.314.770 por C9200L-48P-4X-E por transferencia, pero falta confirmar IVA, bundle y derechos: se registra aparte, excluido del subtotal comparable [P9]. Se descarta el valor CLP 999.999.999 con estado agotado de otra publicación como referencia presupuestaria [P10]. El anuncio de kit local observado tampoco acredita por su descripción el mismo contenido del kit oficial; no sustituir un cable por el kit completo.

P4 declara solo cuatro unidades en stock; P5 es pedido especial y P8 muestra dos unidades factory sealed. Precio público no acredita suministro de 44/650/46 unidades ni canal autorizado. La garantía comercial del vendedor no equivale a soporte/registro del fabricante en Chile.

| Sensibilidad — mismas partidas | Subtotal CLP |
|---|---:|
| USD supuesto a $900 | $560.304.036 |
| USD supuesto a $1.000 | $608.597.528 |
| USD supuesto a $1.100 | $656.891.064 |

Con las partidas ya valorizadas, la variante A excede el presupuesto de CLP 160 millones en $448.597.528 **antes de completar los faltantes**. Sin reemplazar teléfonos, esas mismas partidas de red suman $464.734.328; reutilizarlos no resuelve por sí solo el desfase ni elimina su obsolescencia.

**Alternativa B para comparar:** WAN/VPN en el par NGFW, conservando Cisco en switching y en CM. Quitar los 44 routers remotos reduce esta suma a $495.395.736 antes de nuevas licencias, distribución y trabajo de rediseño. No es ahorro neto garantizado ni autorización para retirar Cisco del alcance. En PA-510, cuatro WAN + dos LAN + dos HA agotan los ocho puertos: sin margen; comparar PA-520 si hacen falta más. La alternativa debe demostrar routing, VPN, QoS, gestión y recuperación equivalentes. No se aplica en la web en esta fase.

Seis remotas futuras con la misma plantilla A añaden un parcial de red de **$110.535.336**, sin teléfonos, usuarios, CPE/WAN, energía, soporte, implementación o CM adicional. Los 30 puestos por futura solo se usaron para sensibilidad de carga, no para fijar 180 compras.

**Faltantes obligatorios:** licencias criptográficas Cisco; soporte y reposición locales; suscripciones de seguridad/gestión adicionales; sexto año; fuentes secundarias/UPS y autonomía; CPE/distribución WAN; ópticas/DAC y cableado; rack; servidores/almacenamiento y software; PBX/SIP; copia externa/DR; instalación/migración; contingencia y costos WAN recurrentes. Presupuestar CAPEX y servicios prepagados separados de OPEX por año. Cinco años de ATP no cubren seis años desde puesta en servicio.

### Comparación concreta de telefonía de menor costo

Se incorpora **Yealink SIP-T33G** como candidato comparativo: la ficha oficial publica doble Ethernet Gigabit, PoE, VLAN, TLS 1.3 y SRTP [F10]. AltaSistemas publica **CLP 91.733 IVA incluido** [P11]. Para 650 terminales son **$59.626.450**, frente a $143.863.200 de la referencia Cisco convertida: diferencia de **$84.236.750 solo en terminales**. Las condiciones de soporte, importación, licencias y canal no son necesariamente equivalentes.

| Mismas partidas, cambiando solo esta hipótesis | Subtotal referencial CLP |
|---|---:|
| A con teléfonos SIP-T33G | $524.360.778 |
| B consolidada con teléfonos SIP-T33G | $411.158.986 |

No se certifica el SIP-T33G para seis años: falta fechar soporte, verificar revisión/firmware, PBX, licencias, provisión segura y pruebas. Sus funciones publicadas no prueban que estén habilitadas correctamente. No se ha reemplazado el Cisco en la BOM base ni en la topología; esta oferta alternativa aporta una opción trazable de ahorro para el siguiente cierre comercial.

## 7. Cómo contener gasto sin desarmar la continuidad

1. Solicitar oferta comparable de A y B, con todas las partidas anteriores y los mismos criterios de aceptación. Elegir por costo total y funciones bajo falla, no solo precio de appliance.
2. Exigir descuento de proyecto como oferta documentada; no descontar un porcentaje imaginario. Comparar también C1300X como opción de switching más económica, contabilizando cambio de OS/plantillas y soporte.
3. Comparar telefonía SIP Gigabit empresarial compatible con la PBX, con ciclo de vida y seguridad verificables, antes de adjudicar 650 terminales Cisco. El 9841 es candidato, no una obligación de marca en todos los escritorios.
4. Si el límite presupuestario se mantiene, desarrollar un alcance por etapas: protección/recuperación central, piloto de sucursal, despliegue por lotes y expansión separada. Los puestos/equipos todavía antiguos quedan identificados y con fecha de renovación; no se declara cumplimiento final antes de terminar.
5. Conservar los 650 PCs; no se propone renovarlos sin inventario y necesidad. Auditar hosts/backup existentes antes de sumar servidores físicos por función o por sede.

## 8. Pruebas para cerrar la selección y pasar al simulador

| Condición | Evidencia exigible |
|---|---|
| Cada router superviviente | Carga cifrada objetivo, licencia válida, MTU/NAT-T, todos los proveedores y túneles hacia ambos concentradores |
| Cada firewall superviviente | Inspección y TLS acordados; HA con sesiones/llamadas; pérdida de HA1/HA2, prevención de split-brain y recuperación |
| Pérdida de miembro de stack | Puestos afectados identificados y mínimo operativo demostrado; uplinks restantes y PoE suficientes |
| Fuentes/UPS | Fuentes alimentadas desde dominios apropiados; medición de autonomía con PoE y CPE, sin sumar potencias nominales como consumo real |
| Core financiero | RTO/RPO por aplicación y prueba de restauración/consistencia, incluida pérdida de host o edificio |
| Telefonía | Registro, llamadas internas/externas, QoS y comportamiento ante caída WAN/host; plataforma y licencias compatibles |
| Ciclo de vida | Carta/oferta con soporte durante 5 años y sexto separado desde implantación, SKU, software, reposición y cobertura geográfica |
| IPAM | Voz /25 y zona de servidores propagadas a DHCP, gateways, firewall, OSPF y pruebas; no reutilizar la /27 insuficiente de la propuesta anterior |

Los criterios de la ficha son core 99,99% y sucursal 99,95%. Disponibilidad se define por servicio, período y medición; una prueba de ping o el MTBF de un equipo no acredita esos objetivos. Mantenimiento y actualizaciones deben contabilizarse según el alcance pactado.

**Estado de implementación:** ANTES continúa con su base integrada. DESPUÉS conserva el perfil anterior hasta cerrar arquitectura, SKU/licencias, presupuesto y plano de conexiones; este documento evita convertir una lista corta incompleta en una compra o una configuración definitiva.

## Fuentes de especificaciones

- **F1:** Cisco, matriz de licencias routing/WAN: https://www.cisco.com/c/m/en_us/products/software/wan-routing-licensing-feature-matrix.html
- **F2:** Cisco, ficha Catalyst 9200, tablas de puertos, potencia y stacking: https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html
- **F3:** Palo Alto, PA-500 componentes y puertos HA: https://docs.paloaltonetworks.com/hardware/pa-500-hardware-reference/pa-500-series-firewall-overview/pa-500-series-firewall-components ; https://docs.paloaltonetworks.com/compatibility-matrix/reference/supported-os-releases-by-model/ha-port-and-processor-support
- **F4:** Cisco, teléfonos 9800: https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/ip-phones/desk-phone-9800-series-ds.html
- **F5:** Cisco, ficha 8200 Secure G2, actualizada 14-10-2026: https://www.cisco.com/site/us/en/products/collateral/networking/sdwan-routers/8000-secure-routers/8200-series-secure-routers-ds.html
- **F6:** Palo Alto, panel PA-1400 y restricciones HA: https://docs.paloaltonetworks.com/hardware/pa-1400-hardware-reference/pa-1400-series-overview/front-panel-1400-series
- **F7:** Cisco, arquitectura StackWise 9200: https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-stackwise-architecture-cte-en.html
- **F8:** Cisco, FAQ 8000 Secure Routers: https://www.cisco.com/c/en/us/products/collateral/networking/sdwan-routers/8000-series-secure-routers-faq.html
- **F10:** Yealink, ficha SIP-T33G: https://support.yealink.com/es-es/docs/sip-t33p-g/ficha-tecnica-yealink-sip-t33g/469b3c31217a48d1b17f5f52e6c2844a
- **F9:** Cisco, guía de compra: https://www.cisco.com/c/en/us/products/collateral/networking/sdwan-routers/8000-secure-routers/8000-secure-router-og.html

Las referencias P1–P9 están vinculadas por partida en el JSON adjunto. **P10**, valor excluido: https://www.tecnomas.cl/producto/cisco-catalyst-9200l-network-essentials-conmutador-l3-gestionado-48-x-10-100-1000-poe-4-x-10-gigabit-sfp-montaje-en-rack-poe . Consulta 17-10-2026; los precios requieren revalidación al emitir oferta.

**P11**, teléfono alternativo, precio de categoría: https://altasistemas.cl/product-category/telefonia-megafonia/telefono-ip/ . No acredita disponibilidad de 650 unidades.
