# Fase 1 — problema e infraestructura inicial

**Financiera Pacífico · corte de diagnóstico: 17-10-2026.** Definición del escenario ANTES, previa a modificar las topologías. Los modelos y cantidades de hardware se establecen como supuestos académicos autorizados por el usuario; no constituyen un inventario levantado en una empresa real.

**Base consolidada:** el [escenario original](escenario-original-consolidado.md) fija MPLS cableado en las 23 ubicaciones, incluidos S21/S22, y distingue decisiones académicas de parámetros no medidos. Inventario y motor ANTES ya reflejan esa definición.

## 1. Problema que se busca resolver

La infraestructura permite la operación cotidiana de Financiera Pacífico, el acceso al core financiero y la telefonía corporativa en condiciones normales. Sin embargo, los equipos de red y teléfonos seleccionados para representar la base han superado sus fechas oficiales de soporte; las sucursales dependen de una única conexión y un único router y switch, y los cambios se realizan manualmente. Casa matriz tiene redundancia parcial, pero mantiene un firewall único y dependencias centrales. La organización necesita renovar y estandarizar la infraestructura, reducir el impacto de las interrupciones y preparar seis sucursales adicionales.

El problema no es que la red esté permanentemente caída. Se trata de una plataforma operativa con riesgos de mantenimiento, seguridad, reposición y recuperación que dificultan garantizar los requisitos futuros. El RTO de cinco minutos y las metas de disponibilidad son requisitos a validar, no incumplimientos ya medidos.

## 2. Origen de los datos y límites

| Clasificación | Contenido |
|---|---|
| Confirmado en la ficha del caso | Core financiero y VoIP; datacenter; doble ISP en HQ; MPLS único en sucursales; OSPF; firewall/VPN; NMS central; cambios manuales; ausencia de contingencia en sucursales |
| Requisitos de la ficha | RTO sucursal <=5 minutos, cifrado y auditoría; seis nuevas sucursales; horizonte de cinco años; CLP 160 millones; objetivos 99,99% core y 99,95% sucursal |
| Adaptación ya acordada | 23 ubicaciones iniciales del simulador, incluidas Isla de Pascua y Antártica; total futuro de 29. El Excel parte de 22, no de 23 |
| Distribución existente en el simulador | 650 PCs distribuidos en las 23 ubicaciones |
| Supuestos fijados en esta fase | Equipos antiguos indicados abajo; 650 teléfonos, uno por PC; conexión switch → teléfono → PC también en la base; dos hosts físicos centrales; MPLS cableado también en S21/S22; 100 Mbps remotos como supuesto; navegación centralizada |
| Información no acreditada | Inventario físico original, contratos, mediciones, versiones de software/licencias, capacidad de servidores y cobertura de operadores |

Los 780 trabajadores del caso no se transforman automáticamente en 780 PCs o teléfonos. Los 650 pares representan puestos informáticos del escenario. No se inventan equipos de colaboradores fuera de ese inventario.

La fecha 2014 que aparece en la interfaz se interpretará como período de referencia de la instalación, un supuesto; las fechas de soporte se evalúan en 2026. El inventario JSON alimenta ahora la vista ANTES. Los hosts y teléfonos representan supuestos del escenario, no equipos o aplicaciones reales.

## 3. Equipos de la base y soporte verificado

| Función | Modelo elegido para representar la base | Cantidad | Último soporte del fabricante | Evidencia |
|---|---|---:|---|---|
| Router remoto | CISCO1921-SEC/K9 | 22 | 30-09-2023 | Cisco EOL12141 [R1] |
| Routers de CM | CISCO2911-SEC/K9 | 2 | 31-12-2022 | Aviso ISR 2900 [R2] |
| Switch CM | WS-C3750X-48P-S | 2 | 31-10-2021 | Aviso 3560-X/3750-X [R3] |
| Switch sucursales continentales | WS-C2960S-48LPS-L, 48 puertos PoE+ | 20 | 30-11-2020 | Aviso 2960-S [R4] |
| Switch sedes especiales | WS-C2960S-24PS-L, 24 puertos PoE+ | 2 | 30-11-2020 | Aviso 2960-S [R4] |
| Firewall central | ASA5512-K9 / ASA 5512-X | 1 | 31-08-2022 | Aviso ASA 5512-X [R5] |
| Teléfono de puesto | CP-7942G | 650 | 31-01-2021 | Aviso teléfonos 7942 [R6] |

**Total del escenario:** 24 routers, 24 switches, un firewall central, 650 teléfonos y 650 PCs. Son activos existentes ficticios: no se recomienda comprarlos hoy ni se suman a la inversión de equipos nuevos como si hubiese que adquirirlos otra vez.

Fin de venta, fin de mantenimiento de software y último soporte son hitos distintos. Se consigna el último soporte del hardware para evitar el rótulo impreciso de «6–9 años sin soporte» usado por la interfaz anterior. Un equipo sin soporte puede seguir funcionando; su condición no prueba una avería o vulnerabilidad explotada.

### Telefonía y puertos

El CP-7942G dispone de dos conexiones Ethernet 10/100 [R7]. Permite teléfono → PC con un solo puerto de acceso, pero limita ese camino del puesto a 100 Mbps nominales, aunque el switch sea Gigabit. No se atribuye 1 Gbps a ese PC a través del teléfono.

Los modelos 2960-S escogidos sí son PoE+; el modelo de 48 puertos y el de 24 publican presupuesto PoE de 370 W [R8]. El 3750-X escogido es PoE+ [R9]. La potencia disponible no equivale a autonomía ante un corte eléctrico: potencias de UPS se asumen en el dimensionamiento de operación; autonomía y estado de fuentes/baterías siguen sin verificar.

No se mantiene el 2960-24TT-L de la vista anterior: no es la base PoE elegida, y sus 24 puertos tampoco cubrirían una sucursal de 28–30 puestos. CM usa 96 puertos entre dos switches de 48: 55 pares PC/teléfono no requieren 110 puertos cuando se conectan en cascada.

## 4. Fichas de las 23 ubicaciones

Todas las filas representan supuestos de equipamiento, conservando las ciudades y el reparto de PCs del simulador. Cada teléfono alimentado por PoE tiene a su PC conectado por la salida secundaria. Las seis futuras no forman parte del inventario inicial.

| Sede | Ubicación | PCs / teléfonos | Router | Switches PoE | Puertos / libres* | WAN |
|---|---|---:|---|---|---:|---|
| CM | Santiago Centro | 55 / 55 | 2 × 2911 | 2 × WS-C3750X-48P-S | 96 / 41 | MPLS + 2 ISP |
| S01 | Providencia | 30 / 30 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 18 | MPLS único |
| S02 | Las Condes | 30 / 30 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 18 | MPLS único |
| S03 | Maipú | 30 / 30 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 18 | MPLS único |
| S04 | Puente Alto | 30 / 30 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 18 | MPLS único |
| S05 | La Florida | 30 / 30 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 18 | MPLS único |
| S06 | Arica | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S07 | Iquique | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S08 | Antofagasta | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S09 | Copiapó | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S10 | La Serena | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S11 | Valparaíso | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S12 | Rancagua | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S13 | Talca | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S14 | Chillán | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S15 | Concepción | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S16 | Temuco | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S17 | Valdivia | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S18 | Puerto Montt | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S19 | Coyhaique | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S20 | Punta Arenas | 28 / 28 | 1 × 1921 | 1 × WS-C2960S-48LPS-L | 48 / 20 | MPLS único |
| S21 | Hanga Roa (Isla de Pascua) | 17 / 17 | 1 × 1921 | 1 × WS-C2960S-24PS-L | 24 / 7 | MPLS cableado único |
| S22 | Antártica Chilena | 8 / 8 | 1 × 1921 | 1 × WS-C2960S-24PS-L | 24 / 16 | MPLS cableado único |

\* «Libres» descuenta solo los puestos. Antes de asignar puertos hay que descontar enlaces a routers/firewall, servidores, impresoras y otros dispositivos. Los enlaces físicos, fuentes y módulos no se presuponen instalados por figurar un chasis en esta tabla. No hay un segundo switch de respaldo en las sucursales de esta base.

### Casa matriz

Se conservan dos routers con HSRP y dos switches de 48 puertos en un stack físico StackWise Plus, como redundancia parcial asumida del escenario. Se cambia el router de referencia 2901 a 2911 para definir un modelo central concreto con tres GE; la asignación física definitiva de entregas WAN/tránsito sigue pendiente. No se declara StackWise-80 en estos equipos ni se confunde una troncal Ethernet con cables de stack.

La sede mantiene doble ISP de Internet y terminación de la red privada MPLS. No se reemplaza «doble ISP» por dos MPLS de proveedores inventados, como muestra actualmente el dibujo antiguo. Operadores, contratos y entregas físicas quedan sin confirmar. Se adoptan 1 Gbps MPLS y 300 Mbps por ISP como hipótesis nominales del [dimensionamiento de operación](dimensionamiento-operacion-original.md), sin acreditar rendimiento de los equipos. HSRP no prueba que ambos routers dispongan de todos los servicios WAN.

El ASA central aplica el filtrado perimetral del escenario y sigue siendo único. Los dos ISP se conectan al ASA, separados del borde MPLS de dos routers; la navegación remota se centraliza en CM. El tránsito de routers a ASA usa una VLAN aislada en el stack existente. Este es el plano lógico académico; interfaces, CPE compartido y puertos se verifican aparte. Las sucursales no tienen un appliance firewall dedicado: esto no significa ausencia de toda seguridad, pues la ficha ya incluye firewall/VPN y pueden existir ACL en los routers. No se inventan reglas permisivas o cifras de ataques para agravar el problema.

### Sucursales S01–S22

Un router, un switch PoE y una conexión MPLS por ubicación. La terminación LAN de datos/voz se plantea en subinterfaces del router remoto; los switches son acceso L2. Se mantiene el encaminamiento corporativo OSPF como función de la ficha, con configuración real/licencias por verificar.

La pérdida del router o switch único detiene la conectividad de esa sede. La pérdida de MPLS impide acceder a servicios centrales sin otro camino. Los switches escogidos cubren los puestos actuales sin inventar una falta de puertos; la justificación de renovación es soporte, resiliencia y estandarización, no fingir que hoy no caben los PCs.

### S21 y S22: adaptación geográfica

Hanga Roa y Antártica forman parte de la base por decisión del proyecto. **Ambas tienen MPLS por cable como premisa académica explícita del usuario**, igual que las demás sucursales. No es una afirmación sobre infraestructura geográfica real. No hay satélite, acceso móvil o respaldo WAN en ANTES.

Se asumen 100 Mbps por remota, sin proveedor, SLA, mediciones ni precios inventados. El corte MPLS nacional afecta a las 22 remotas y el corte del acceso central afecta también a S21/S22. La logística de soporte requiere estudio; no se asignan tiempos o probabilidades de avería.

## 5. Datacenter inicial y servicios

El datacenter de CM ya existe en la ficha. Para dar forma al escenario se asumen **dos hosts físicos** y **un repositorio de respaldo**, con modelos, sistema operativo y soporte no verificados; recursos académicos, backup y energía definidos en el [dimensionamiento de operación](dimensionamiento-operacion-original.md), sin mediciones. No se les atribuye fin de soporte solo por ser antiguos ni se fija una marca para justificar una compra.

| Alojamiento supuesto | Funciones lógicas existentes | Dependencia que estudiar |
|---|---|---|
| Host DC-01 | Aplicación del core financiero y base de datos en VMs separadas | Pérdida del host afecta ambos servicios; no hay clúster declarado |
| Host DC-02 | Control de llamadas compatible con 7942G, DNS/NTP y NMS/registros en servicios o VMs separados | Control de llamadas y servicios auxiliares concentrados |
| Repositorio BKP-01 en CM | Copias de configuraciones y datos del escenario | No hay evidencia de copia externa, inmutabilidad o restauración probada |

La plataforma/versión de control de llamadas y sus licencias están pendientes: el teléfono no realiza llamadas por tener una IP. No se instala TACACS+ por este documento; las identidades locales, cambios manuales y registros dispersos son supuestos para estudiar estandarización. El NMS central se mantiene porque la ficha sí lo contempla.

Se asume enlace único de DC-01 y BKP-01 al miembro 1 del stack y DC-02 al miembro 2. La pérdida del switch de acceso desconecta esos hosts aunque sigan encendidos; el segundo switch no duplica una NIC inexistente. Este detalle ya está modelado y no representa un clúster de servidores.

La caída de acceso al control de llamadas puede afectar registros y nuevas llamadas; no se afirma que todas las llamadas ya establecidas se corten necesariamente. La dependencia de Internet para llamadas externas exige definir el servicio telefónico real.

## 6. Direccionamiento documental para preparar la base

Este plan es una **reserva lógica del escenario ANTES**, representada por el inventario y los diagnósticos del simulador; no es DHCP real ni una afirmación sobre el IPAM entregado por el profesor. Se mantiene el espacio base `10.70.0.0/16`.

Para número de sede `N=0..22` (CM=0):

- VLAN10 datos: `10.70.N.0/25`; gateway `.1`; PCs desde `.10`, conservando el inventario actual.
- VLAN20 voz: `10.70.(64+N).0/25`; gateway `.1`; teléfonos desde `.10`, en correspondencia con los PCs. CM puede alojar 55 teléfonos sin la limitación de la /27 anterior.
- VLAN30 gestión: `10.70.N.160/28`, separada de usuarios; direcciones de equipos pendientes del detalle de puertos.
- VLAN50 servidores, solo CM: `10.70.200.0/24`, gateway `.1`; reservas `.10` aplicación, `.11` base de datos, `.20` telefonía, `.30` DNS/NTP, `.40` NMS/registros y `.50` repositorio de respaldo.

En CM las interfaces VLAN se plantean en el stack L3 existente; en remotas los gateways se plantean en el router. La base no coloca gateways en los Palo Alto de la propuesta. La versión de software, las rutas, DHCP/provisión de voz y reglas deberán revisarse al implementar; reservar IPs no pone servicios en marcha.

No se declaran redes de invitados operativas sin inventario. La asignación de WAN, tránsitos y túneles queda para el detalle de implementación, evitando duplicar direcciones del perfil DESPUÉS. Los dos escenarios tendrán planes identificables y no mezclarán reservas antiguas de servidores en VLAN10 con estas nuevas reservas documentales de la base.

## 7. Riesgos y evidencia para la posterior comparación

| Hallazgo de la base | Efecto posible | Cómo justificar la mejora después |
|---|---|---|
| Red y teléfonos sin soporte oficial | Limitación de parches, asistencia y reposición del fabricante | Modelos con soporte contractual durante el horizonte requerido |
| Una WAN por sucursal | Pérdida de acceso central ante fallo del medio | Medir recuperación con camino alternativo |
| Router y switch únicos en remotas | Interrupción de la sede ante su pérdida | Probar continuidad y documentar puestos afectados |
| Firewall central único | Dependencia común aunque los routers estén duplicados | Verificar HA, sesiones y caminos físicos |
| Servicios y respaldos concentrados en CM | Riesgo compartido de host, edificio o energía | Diseñar y probar restauración y recuperación externa |
| Cambios manuales y trazabilidad incompleta | Error de configuración y recuperación más lenta | Respaldos, versiones, revisión, auditoría y rollback |
| Teléfono 10/100 entre switch y PC | Tope de velocidad del puesto | Evaluar beneficio de renovar terminales compatibles, según aplicación |
| Crecimiento de seis sedes | Mayor carga central y operación | Dimensionar para 29 ubicaciones con demanda explícita |

No se fabrican porcentajes de disponibilidad, incidentes históricos, pérdida de paquetes, jitter, CVEs explotadas ni costos de interrupción. Que no exista contingencia no demuestra por sí solo un RTO medido superior a cinco minutos; revela que hay escenarios en los que el requisito no está garantizado.

## 8. Integración de la base en el simulador

La definición documental se integró después en `index.html` mediante un módulo independiente para ANTES, generado desde el inventario JSON. Cubre:

1. Inventario, tarjetas por sede, comparativa y fechas reales de soporte.
2. Topologías con teléfono por PC, alimentación PoE, puerto compartido y capacidades por modelo.
3. CM con servicios/datacenter, doble ISP separado de MPLS, firewall único y redundancia parcial explícita.
4. S21/S22 con acceso remoto acorde al supuesto, sin falsas coberturas.
5. Direcciones y VLAN de cada escenario, consolas e inventario de teléfonos/servidores.
6. Ping/Trace y efectos de fallos reales del modelo: sin forzar caídas por la antigüedad ni respuestas de servicios inexistentes.
7. Regresiones, guía de demostración y entregables anteriores que describen el escenario previo.

**Estado:** la representación funcional de ANTES incluye inventario, diagnósticos de consulta, dependencias y Ping/Trace. No se generan configuraciones originales certificadas ni se ejecutan servicios reales. La renovación queda separada de esta base; sus modelos/licencias y cuatro WAN requieren su propio cierre.

## 9. Brechas organizacionales, protección de datos y marco chileno

**Revisión preliminar al 17-10-2026.** La obsolescencia técnica verificada de los modelos no acredita, por sí sola, infracción de una ley. No se concluye «incumple todas las normas» ni que la compra propuesta certifique cumplimiento. Se requiere contrastar obligaciones aplicables con evidencia del control y su funcionamiento.

### Aplicabilidad antes de afirmar cumplimiento o incumplimiento

- **Ley 19.628:** el escenario trata datos personales de clientes y trabajadores. La ley contempla, entre otros aspectos, confidencialidad y debida diligencia en el cuidado de datos; la infraestructura de red es solo parte de la protección [L1].
- **Ley 21.719:** incorporar preparación para el nuevo régimen, sin presentar obligaciones futuras como incumplimientos ya consumados a la fecha de diagnóstico. La referencia judicial consultada señala inicio el 01-12-2026 [L2]; existe una propuesta gubernamental de postergación al 01-12-2027 [L3]. Esa propuesta no se trata como ley aprobada. Revalidar texto vigente y calendario al cerrar la entrega o implantar.
- **Ley 21.663:** banca, servicios financieros y medios de pago figuran entre los servicios esenciales. Deben revisarse prevención, respuesta y reporte de incidentes. La condición de OIV depende de una calificación de ANCI y no se supone para la empresa ficticia [L4]. El encargado de ciberseguridad y el delegado de un OIV tienen alcances distintos [L5].
- **CMF:** capítulos RAN 20-9 (continuidad) y 20-10 (seguridad/ciberseguridad) como referencias a evaluar. Antes de declarar obligación directa, precisar si la empresa es banco, filial, sociedad de apoyo, emisor/operador u otra entidad y qué norma le corresponde. No basta el nombre comercial «financiera» [L6, L7].

Se mantiene el tipo jurídico/regulatorio de Financiera Pacífico como **pendiente de definición del caso**. Las normas no confirmadas como directamente aplicables se pueden usar como referencias de diseño, identificándolas así. No se afirma una designación real de ANCI, inscripción o fiscalización de esta entidad ficticia.

### Matriz inicial de controles y evidencia pendiente

| Área a revisar | Base conocida o supuesto existente | Evidencia para cerrar la brecha | Responsable funcional |
|---|---|---|---|
| Accesos y privilegios | Administración manual; identidades locales como supuesto | Cuentas individuales, roles, altas/bajas, acceso remoto, MFA donde corresponda y acceso de emergencia probado | TI y seguridad |
| Datos de clientes y trabajadores | Core/base de datos centrales; contenido exacto no inventariado | Categorías de datos, finalidad y fundamento del tratamiento, permisos, retención y ejercicio de derechos | Negocio, privacidad/legal y aplicaciones |
| Cifrado y separación | Firewall/VPN contemplados por el caso; detalles no verificados | Protocolos y claves, cifrado en tránsito y reposo, segmentación efectiva y controles de acceso a servidores | Redes, sistemas y seguridad |
| Copias y continuidad | Repositorio supuesto en CM; sin evidencia de copia externa/restauración | Restauración documentada, ubicación independiente, protección de copias, RPO/RTO por servicio y procedimiento manual de contingencia | Sistemas y continuidad/negocio |
| Incidentes | NMS existente; circuito formal de respuesta no acreditado | Responsables, escalamiento, registro, contención, preservación de evidencia y reporte externo según obligación aplicable | Seguridad y dirección |
| Cambios y soporte | Equipos de red sin soporte; cambios manuales | Inventario, riesgo aceptado, controles compensatorios, revisión, versiones, rollback y plan de renovación | TI y gestión de riesgos |
| Puestos y telefonía | 650 pares de dispositivos en el escenario | SO y soporte de PCs, protección de endpoint, provisión de teléfonos y tratamiento de grabaciones si existen | Soporte, seguridad y telefonía |
| Datacenter y terceros | Dos hosts supuestos y dependencias de WAN/energía | Acceso físico, UPS/climatización, contratos/SLA, proveedor y plan de salida/recuperación si se usa nube | Infraestructura, compras y continuidad |

«No acreditado» significa que falta evidencia en el caso, no que se haya observado ausencia del control. Cualquier nueva carencia incorporada a la historia deberá rotularse como supuesto del escenario.

La propuesta de redes deberá aportar controles y evidencias de su alcance, y señalar las dependencias de aplicaciones, procesos, personas y proveedores. No se amplía el simulador a una aplicación bancaria completa ni se declaran clientes reales o datos personales operativos.

### Redacción consolidada del problema

> La infraestructura actual permite la operación cotidiana de Financiera Pacífico, pero combina equipamiento de red y telefonía fuera de soporte, dependencias únicas en sucursales y administración manual. La falta de evidencia suficiente sobre recuperación, trazabilidad y protección de datos impide acreditar que los controles cubran de forma consistente los requisitos de continuidad y las obligaciones aplicables. Se requiere modernizar y estandarizar la plataforma, documentar los controles y probar su eficacia, preparando además el crecimiento de seis sucursales.

## Fuentes

- **Caso:** `Capstone_Ingenieria_Conectividad_Redes.xlsx`, Financiera Pacífico, fila 7 de Empresas, Fichas de Casos y Datos Técnicos; leído anteriormente en esta sesión.
- **Distribución:** `index.html` (`SEDES`) y `network/export-candidate.cjs` (`pcInventory`).
- **R1:** https://www.cisco.com/c/en/us/products/collateral/routers/1900-series-integrated-services-routers-isr/eos-eol-notice-c51-740520.html
- **R2:** https://www.cisco.com/c/en/us/products/collateral/routers/2900-series-integrated-services-routers-isr/eos-eol-notice-c51-737831.html
- **R3:** https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-3560-x-series-switches/eos-eol-notice-c51-736139.html
- **R4:** https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-2960-series-switches/eos-eol-notice-c51-733348.html
- **R5:** https://www.cisco.com/c/en/us/products/collateral/security/asa-5500-series-next-generation-firewalls/eos-eol-notice-c51-738644.html
- **R6:** https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/unified-ip-phone-7900-series/eos-eol-notice-c51-735570.html
- **R7:** https://www.cisco.com/c/en/us/td/docs/voice_ip_comm/cucm/srnd/8x/uc8x/endpnts.pdf (sección Cisco Unified IP Phone 7942G, página PDF 11).
- **R8:** https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/15-2_2_e/release/notes/OL_32525_01.html
- **R9:** https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-3560-x-series-switches/data_sheet_c78-584733.html
- **L1:** Ley 19.628, artículos 7 y 11, versión anterior a la reforma: https://www.bcn.cl/leychile/navegar?idNorma=141599&idParte=8642686&idVersion=2023-05-09
- **L2:** Academia Judicial, síntesis de Ley 21.719 y vigencia: https://academiajudicial.cl/recursos/actualizaciones-normativas/ley-21-719-que-regula-la-proteccion-y-el-tratamiento-de-los-datos-personales-y-crea-la-agencia-de-proteccion-de-datos-personales/
- **L3:** Ministerio de Economía, propuesta de ampliación de plazo, 01-09-2026: https://www.economia.gob.cl/2026/09/01/gobierno-propone-ampliar-plazo-para-implementar-nueva-ley-de-proteccion-de-datos-y-institucionalidad.htm
- **L4:** ANCI, servicios esenciales y OIV: https://anci.gob.cl/noticias/ley-marco-de-ciberseguridad-es-publicada-en-el-diario-oficial/
- **L5:** ANCI, encargado y delegado, 29-05-2026: https://anci.gob.cl/noticias/el-rol-del-delegado-de-ciberseguridad/
- **L6:** CMF, alcance de normativa de seguridad: https://cmfchile.cl/portal/prensa/625/w4-article-29314.html
- **L7:** CMF, RAN 20-9: https://www.cmfchile.cl/portal/normativa/624/articles-28984_doc_pdf.pdf

Inventario estructurado: [base-infraestructura-antes.json](base-infraestructura-antes.json). Registro de decisiones: [bitácora](bitacora-proyecto.md).


## 10. Matriz del problema y evidencia para la propuesta

| Problema de la base asumida | Efecto que debe evaluarse | Requisito para la mejora | Evidencia de aceptación pendiente |
|---|---|---|---|
| Router y WAN únicos en remotas | Pérdida de acceso central al detenerlos; la LAN local puede seguir comunicando | Recuperación de acceso acorde al negocio y mantenimiento planificado | Prueba extremo a extremo con carga y registro del tiempo de recuperación |
| Switch único en remotas | Se pierden datos y PoE de todos los puestos del switch | Distribución de puestos y repuestos/recuperación según criticidad | Corte de switch y verificación de puestos afectados; dos switches no hacen redundante un teléfono con una sola conexión |
| ASA central único | Dependencia compartida del tránsito central en el modelo | Evaluar par HA compatible y capacidad con funciones de seguridad activas | Failover con sesiones, configuración sincronizada y pruebas de rendimiento |
| DC-01 aloja aplicación y base de datos | Un host detiene ambos servicios | RPO/RTO por servicio y arquitectura de recuperación de sistemas | Restauración y consistencia transaccional verificadas por sistemas/negocio |
| DC-02 concentra telefonía, DNS/NTP y NMS | Un host afecta varios servicios auxiliares | Separación o recuperación según criticidad; dependencias explícitas | Registro y llamadas, resolución, sincronización y alarmas probadas por sus responsables |
| BKP-01 en el mismo edificio | No acredita recuperación ante pérdida del edificio | Copia independiente protegida y procedimiento de restauración | Recuperación desde copia externa y medición del RPO/RTO |
| Equipos de red y teléfonos sin soporte oficial | Mantenimiento y corrección de defectos limitados | Renovación compatible con horizonte de 5–6 años | Oferta formal con licencias, soporte y ciclo de vida verificados |
| CP-7942G limita PC a 100 Mbps en puerto compartido | Puede limitar aplicaciones y transferencia del puesto | Dimensionar teléfono, puerto y PoE con carga real | Prueba de datos/voz simultáneos y presupuesto PoE por modelo |
| Gestión/configuración original incompleta | No permite acreditar estandarización ni controles | Inventario, respaldo, acceso administrativo y proceso de cambios | Configuración revisada y prueba de rollback; ausencia de evidencia no equivale a ausencia de control |

### Dependencias y límites del modelo inicial

DC-01 contiene las VMs de aplicación y base de datos; DC-02 contiene las de control de llamadas, DNS/NTP y NMS/logs. BKP-01 es un repositorio separado. Son funciones lógicas: no se inventan marca, recursos, hipervisor, motor de base de datos o plataforma telefónica. La caída de un host cambia sus dependencias, sin apagar artificialmente la red ni producir respuestas ICMP de servidores.

El modelo HA de CM presupone entrega lógica de la red privada a ambos routers. El cableado, CPE y las interfaces/transceptores efectivos deberán verificarse; no demuestra diversidad física ni conmutación real. MPLS central y los ISP de Internet son dominios separados. S21/S22 usan el mismo MPLS cableado supuesto; no existe respaldo inalámbrico en ninguna remota de ANTES.

Para visualizar el recorrido se usan RTT didácticos constantes: 2 ms local y 34 ms intersede, uniformes e ilustrativos. La geografía no introduce retardos satelitales en la base MPLS. No son mediciones, predicciones de cobertura ni compromisos del proveedor. No hay llamadas, base de datos ni aplicación financiera en ejecución. Un servicio marcado con dependencias disponibles no queda certificado como sano.

### Recorrido de revisión

1. Cambiar a ANTES y abrir S01: contar 30 pares teléfono/PC; consultar ambas IP y el puerto compartido.
2. Ejecutar Ping/Trace local y hacia S02; revisar los teléfonos, routers y el ASA central en el recorrido. Repetir desde el ping del mapa sin abrir topología.
3. Apagar el router remoto: el ping local continúa y el intersede se detiene. Apagar el switch: ambos fallan y el teléfono pierde PoE.
4. Abrir CM: revisar los 55 pares, dos routers, stack, ASA y tres alojamientos. Apagar DC-01 y comprobar que aplicación/base de datos pierden alojamiento; DC-02 conserva sus dependencias.
5. Cortar MPLS nacional: las 22 remotas se aíslan, incluidas S21/S22. Restaurar. En CM, cortar solo el acceso/CPE MPLS central: la LAN y los hosts alimentados permanecen disponibles, pero todas las remotas pierden acceso a CM.
6. Volver a DESPUÉS: las configuraciones candidatas y estados de equipos modernos permanecen independientes del modelo de equipos antiguos. Cambiar de modo reinicia enlaces WAN según el comportamiento existente del simulador.
