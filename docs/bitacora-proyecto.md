# Bitácora del proyecto — Financiera Pacífico

## Propósito y criterio de registro

Registrar problemas observados, decisiones y evidencias para la revisión docente. Se diferencia entre funciones del simulador, propuestas de arquitectura y una implantación real. Una propuesta no acredita una compra, configuración aplicada ni disponibilidad medida.

## Entrada 001 — 17 de octubre de 2026

**Tema:** revisión de continuidad operativa, equipamiento y servicios centrales.

### Base documental revisada

- `README.md`: 23 sedes, 650 PCs; router C8300, firewall PA-1410 y stack de dos C9200L por sede. Plataforma académica, sin certificación de hardware.
- `aaa-syslog-observabilidad.md`: TACACS+ primario/secundario, Syslog y monitoreo previstos; servicios sin desplegar. Colector único identificado como punto de falla.
- `servicios-centrales-dns-ntp.md`: DNS/NTP primarios y secundarios reservados; infraestructura física o virtual aún sin dimensionar.

### Necesidad identificada

El respaldo de proveedores WAN no cubre la pérdida del único router o firewall de una sede. Se requiere evaluar continuidad durante mantenimiento, actualización y fallo de un equipo, incluyendo conexiones, energía y dependencias centrales. Dos equipos no garantizan ausencia de interrupciones ni protegen por sí solos de una configuración errónea común.

### Propuestas en evaluación

| Propuesta | Motivo | Pendiente para decidir |
|---|---|---|
| Dos routers por sede, preferentemente iguales | Mantener capacidad durante mantenimiento o fallo de uno | Rendimiento cifrado, interfaces, licencias, recuperación de VPN y costo |
| Dos firewalls por sede en HA | Evitar que un firewall único detenga la operación | Modelo, capacidad con inspección, sincronización, licencias y soporte |
| Acceso WAN disponible para ambos routers | No depender del router principal para usar proveedores | Handoffs, direccionamiento, terminales, cableado y alimentación |
| Dimensionamiento distinto para casa matriz | Atiende tráfico agregado y servicios centrales | Concurrencia, tráfico, túneles y crecimiento |
| Servicios centrales virtualizados o administrados | Evitar comprar un servidor físico para cada función | Carga, plataforma, licencias y tolerancia a fallas del alojamiento |
| Zona de servidores y gestión separada de usuarios | Las reservas actuales están en VLAN10 de CM | Nuevo plan IP, reglas y migración; no renumerar aún |
| Recuperación fuera de casa matriz | Dos equipos en el mismo sitio comparten riesgos del edificio | Ubicación alternativa, respaldos, costo y prueba de restauración |

Estas propuestas no están implementadas por esta entrada. No se han seleccionado nuevos modelos ni aplicado cambios a la topología activa.

### Servicios y responsabilidades

- **Red y operación:** AAA/TACACS+, DNS, NTP, monitoreo, registros, respaldos de configuración y acceso de emergencia. Ya existen planes; falta dimensionar y alojar los servicios.
- **Aplicaciones y datos financieros:** definir con responsables de aplicaciones, seguridad y negocio el sistema financiero, base de datos, capacidad, permisos, retención y recuperación. No asumir que TACACS+ almacena datos de clientes ni inventar un sistema financiero instalado.
- **Infraestructura:** evaluar hosts físicos, máquinas virtuales o servicios administrados. Dos máquinas virtuales en un único host no cubren el fallo del host. Dos hosts requieren un diseño compatible de almacenamiento, capacidad restante y quorum/testigo cuando corresponda; no se declara HA automática.
- **Respaldo:** conservar copias protegidas fuera del mismo dominio de falla y probar restauración. Replicación y alta disponibilidad no sustituyen al respaldo.

### Restricción económica

El usuario indica un presupuesto de referencia de **CLP 160.000.000**, ampliable con justificación. No se ha conciliado esa cifra con la planilla de costos en esta entrada. Falta confirmar si incluye IVA, implementación, servidores, enlaces recurrentes y soporte/licencias por cinco o seis años.

La comparación deberá separar inversión inicial, gasto recurrente y costo total del período, indicando fecha, fuente, moneda, impuestos y si el valor es público referencial o cotización formal. No se afirma que la propuesta completa quepa en ese presupuesto.

### Siguiente trabajo

1. Fijar requisitos por tipo de sede y aplicación: tráfico, crecimiento, interrupción tolerable (RTO), pérdida de datos tolerable (RPO) y capacidad bajo fallo.
2. Comparar la selección actual con alternativas redundantes; comprobar soporte oficial durante el horizonte de cinco a seis años y prestaciones de cada SKU/licencia.
3. Cotizar red, servicios centrales y recuperación, evitando doble conteo de funciones o componentes omitidos.
4. Seleccionar arquitectura con fundamento técnico y económico; después actualizar simulador, configuraciones, pruebas y entregables coherentemente.

### Criterios de aceptación futuros

Probar pérdida de un router, firewall y enlace; mantenimiento planificado; continuidad de acceso a servicios; restauración de configuración y datos. Registrar duración de interrupciones y sesiones afectadas. No presentar una meta de disponibilidad como una medición ni prometer operación al 100%.

### Fuentes técnicas de apoyo

- Cisco, administración de dispositivos con TACACS+: https://www.cisco.com/c/en/us/td/docs/security/ise/3-5/admin_guide/b_ise_admin_3_5/b_ISE_admin_device_admin.html
- Palo Alto Networks, requisitos de HA activo/pasivo: https://docs.paloaltonetworks.com/ngfw/administration/high-availability/set-up-activepassive-ha
- CISA, respaldo protegido y pruebas de recuperación: https://www.cisa.gov/stopransomware/ransomware-guide

**Resultado de esta entrada:** revisión documental y registro de propuestas. Sin compras, cotizaciones cerradas ni cambios en el comportamiento del simulador.

## Entrada 002 — 17 de octubre de 2026

**Tema:** inventario existente, telefonía y ubicación de servicios. **Estado:** revisión de la fuente académica y recomendaciones pendientes de diseño/cotización.

### Evidencia del Excel original

Se leyó `Capstone_Ingenieria_Conectividad_Redes.xlsx`, caso Financiera Pacífico, fila 7 de las hojas siguientes:

- **Empresas:** 780 trabajadores, 650 usuarios TI aproximados, 22 sedes, VoIP entre los servicios críticos, presupuesto CLP 160.000.000 y horizonte de cinco años.
- **Fichas de Casos:** casa matriz, datacenter y 21 sucursales; dual ISP en HQ y MPLS único en sucursales; OSPF; RTO de sucursal <=5 minutos; cifrado y auditoría obligatorios; crecimiento de seis sucursales.
- **Datos Técnicos:** switching L3 corporativo, firewall/VPN y NMS central existentes; objetivos de disponibilidad 99,99% core y 99,95% sucursal.
- **BOM y Costos:** plantilla sin inventario ni precios completos; total guardado de propuesta igual a cero. No constituye una cotización de la solución actual.

El archivo no especifica modelos, cantidades ni antigüedad de teléfonos, ni modelos o capacidad de servidores existentes. No inventar esos datos. Diferenciar las 22 sedes de la ficha base de las 23 del simulador; explicar la ampliación y contemplar las seis futuras antes de cerrar cantidades.

### Telefonía: brechas identificadas

- VLAN20 y un plan de DHCP ya están documentados. No equivalen a una PBX, proveedor SIP ni llamadas funcionales.
- La /27 prevista ofrece 29 direcciones de teléfonos después de reservar gateway: no alcanza para 55 teléfonos hipotéticos de CM. Cantidad real pendiente; no asumir un teléfono por PC.
- C9200L-48T-4G-E es un modelo de datos sin PoE. Si los terminales requieren alimentación por Ethernet, cotizar modelos PoE y presupuesto eléctrico/UPS; no asumir que el SKU actual alimenta teléfonos.
- Revisar compatibilidad de terminales existentes, soporte, PBX, licencias, llamadas simultáneas, QoS, jitter/pérdida, provisión segura y supervivencia ante pérdida WAN. SRST es una alternativa dependiente de plataforma, versión, licencias y telefonía compatible, no una función ya activa.
- El respaldo local de control de llamadas no garantiza llamadas externas sin una salida telefónica disponible.

### Propuesta de inventario y presupuesto

Separar situación actual y destino propuesto, con columnas: función, cantidad, modelo conocido o supuesto explícito, evidencia, estado de soporte, conservar/reemplazar/agregar, justificación y costo incremental. No cargar otra vez el precio de compra de un equipo existente que se conserva. Comparar dos opciones: reutilización compatible y renovación justificada; evitar renovación solo por novedad.

### Ubicación de servicios

Recomendar evaluar primero el datacenter existente, sin asumir que se construye desde cero. No proponer un servidor físico por sucursal sin una necesidad local concreta. Comparar servicios centrales redundantes, alojamiento administrado y esquema híbrido, documentando dependencias de WAN, energía, edificio y proveedor. Para nube, dimensionar recursos, tráfico, soporte, respaldo y recuperación; para local, verificar capacidad y costo de operar la infraestructura. La continuidad del core financiero requiere requisitos de la aplicación y no se acredita duplicando únicamente equipos de red.

### Fuentes complementarias

- Cisco Catalyst 9200 Ordering Guide (modelos de datos y PoE): https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-swit-ser-cte-en.html
- Cisco Unified SRST Data Sheet: https://www.cisco.com/c/en/us/products/collateral/unified-communications/unified-survivable-remote-site-telephony/data-sheet-c78-744126.html

**Resultado:** se confirmó que VoIP y datacenter pertenecen al caso original; se identificaron datos de inventario faltantes y discrepancias de alcance para resolver antes de cotizar. Excel y topología activa sin modificar.

## Entrada 003 — 17 de octubre de 2026

**Tema:** aclaración del alcance inicial y crecimiento. **Decisión del usuario:** mantener Hanga Roa/Isla de Pascua (S21) y Base Frei Montalva/Antártica (S22) como parte de la topología inicial. La idea previa de contarlas dentro del crecimiento queda descartada.

- **Base del simulador:** 23 ubicaciones, compuestas por casa matriz/datacenter y 22 sedes remotas; 650 PCs inventariados actualmente.
- **Expansión:** seis sucursales adicionales, separadas de la base inicial. Total objetivo: 29 ubicaciones, casa matriz más 28 remotas.
- **Fuente académica:** conservar la distinción con el Excel, que declara 22 sedes iniciales. Las 23 ubicaciones corresponden a una adaptación del proyecto y no a una cifra literal de la ficha original. No afirmar que agregar dos ubicaciones a 22 produce 23; no se ha establecido una correspondencia uno a uno con las sedes anónimas del Excel.

### Ubicaciones candidatas para las seis futuras

Propuesta por cobertura geográfica respecto del inventario actual, sin estudio de demanda comercial ni contratación confirmada:

| Identificador propuesto | Ubicación | Motivo de evaluación |
|---|---|---|
| S23 | San Pedro de Atacama | Preferencia del usuario para ampliar cobertura en el norte interior |
| S24 | Ovalle | Ampliar cobertura fuera de La Serena |
| S25 | Los Andes | Incorporar el interior de la zona de Valparaíso |
| S26 | Los Ángeles | Ampliar cobertura interior de Biobío |
| S27 | Osorno | Completar cobertura entre Valdivia y Puerto Montt |
| S28 | Castro | Incorporar Chiloé |

Las ciudades son candidatas, no ubicaciones aprobadas o incorporadas al simulador. Referencia geográfica: https://www.bcn.cl/siit/mapoteca/comunas . La selección por brechas del mapa es un criterio del proyecto, no una conclusión de mercado de la fuente.

**Ajuste posterior del usuario:** se reemplaza la candidata Calama por San Pedro de Atacama para S23. Se mantiene el crecimiento de seis sucursales y el total proyectado de 29 ubicaciones.

### Implicaciones de diseño y presupuesto

Dimensionar capacidad central, túneles, licencias, direccionamiento y operación para 29 ubicaciones. La cantidad de PCs/teléfonos de las seis futuras está pendiente y se sumará a los 650 actuales: no repartir automáticamente el inventario existente. Separar inversión inicial y expansión por etapas. Reservar bloques IP tras revisar el IPAM completo, sin asignaciones definitivas en esta entrada. Verificar proveedores y medios disponibles por ubicación; no asumir los cuatro enlaces del modelo disponibles comercialmente en Isla de Pascua o Antártica.

**Resultado:** alcance inicial aclarado y crecimiento documentado; sin cambios en sedes, direccionamiento ni comportamiento del simulador activo.

## Entrada 004 — 17 de octubre de 2026

**Tema:** investigación de equipos y presupuesto con fuentes trazables. Se elaboró [investigación preliminar de equipamiento](investigacion-equipamiento-2026-10-17.md) y [datos de precios y escenarios](referencias-precios-2026-10-17.json).

- Se consultó Cisco IOS Patterns en CiscoDevNet como apoyo para la posterior revisión de configuraciones; no es una herramienta de cotización ni certificación de hardware.
- Se verificó el aviso Cisco EOL15955 para el C8300 usado y los C8200 clásicos, y las fechas oficiales Palo Alto PA-400. Se incorporó el ciclo de soporte como requisito de selección, diferenciando cinco y seis años desde implantación.
- Se identificaron como candidatos C8211-G2/C8221-G2, PA-510/520 y switches PoE C9200L o C1300X, con condiciones de compatibilidad y diferencias de sistema operativo. CM requiere selección independiente.
- Se compararon tres escenarios de sucursal con hardware y ATP por cinco años, usando precios públicos. Sus parciales superan CLP 160 millones para las 22 remotas incluso antes de incluir CM y los restantes componentes. No representan cotizaciones cerradas ni costos totales.
- Se registraron brechas de entrega WAN doble, conteo de puertos, sincronización HA, sesiones/VPN, energía, teléfonos, capacidad agregada central y terminales conectados a un solo switch.
- Se mantuvo la propuesta de dos routers, dos firewalls y dos switches como variante principal de estudio; la integración de WAN/VPN en NGFW queda como alternativa comparativa sin migración aplicada.

**Resultado:** informe y cálculos preliminares revisables. Modelos, reutilización y presupuesto definitivo pendientes de requisitos de carga y oferta formal. Sin mensajes enviados a proveedores, sin compras ni cambios al simulador o Excel.

## Entrada 005 — 17 de octubre de 2026

**Tema:** priorizar fase 1, definición de la infraestructura inicial y su problema. El usuario solicita cerrar la base antes de seguir con la propuesta y de editar topologías en `index.html`.

- Se documentó la [fase 1 por sede](fase-1-problema-infraestructura-actual.md) y un [inventario estructurado de la base](base-infraestructura-antes.json).
- Se fijaron modelos antiguos como supuestos académicos y se verificaron sus últimas fechas de soporte en Cisco: 1921, 2911, 2960-S, 3750-X, ASA 5512-X y CP-7942G. No se los atribuye al Excel ni a una visita de terreno.
- Se conserva el reparto de 650 PCs en 23 ubicaciones. Se asumen 650 teléfonos, un teléfono por PC, con conexión switch PoE → teléfono → PC. No se confunden con los 780 trabajadores del caso.
- Se dimensionó la base: un switch PoE de 48 puertos por sucursal continental, uno de 24 en S21/S22 y dos de 48 en CM; 24 routers, 24 switches y un firewall central en total. CM conserva redundancia parcial y un datacenter de referencia; no se eliminan funciones antiguas para exagerar la necesidad de mejora.
- Se reservó un direccionamiento documental de voz y servidores dentro de 10.70.0.0/16 para preparar la implementación; estas reservas no cambian IPs ni configuraciones activas.
- Se separa el acceso satelital supuesto de S21/S22 de MPLS continental; doble ISP de CM no se interpreta como dos MPLS. Cobertura y contratos siguen pendientes.
- Se identificaron inconsistencias del ANTES actual: puertos insuficientes del switch de 24, ausencia de PoE del modelo mostrado, fechas genéricas de soporte, falta de teléfonos/datacenter y diferencias de WAN y stacking. Se deja listado de cambios funcionales para después de esta definición.

**Resultado:** problema e inventario académico inicial definidos y comprobados documentalmente. Propuesta DESPUÉS y renovación en pausa mientras se consolida la base. No se han editado `index.html`, el motor de red ni el Excel en esta fase.

## Entrada 006 — 17 de octubre de 2026

**Tema:** relacionar la base con seguridad, datos y continuidad en Chile. Se amplió la fase 1 con aplicabilidad normativa y una matriz de ocho áreas de controles, evidencia pendiente y responsables.

Se distingue obsolescencia de incumplimiento legal demostrado. Se revisaron Ley 19.628, preparación para Ley 21.719, servicios esenciales/OIV bajo Ley 21.663 y referencias CMF de continuidad/seguridad condicionadas al tipo de entidad. Se registró la propuesta de postergar la reforma de datos como propuesta, no como ley aprobada. Falta definir la naturaleza jurídica/regulatoria de la financiera ficticia.

Se incorporaron accesos, tratamiento de datos, cifrado/segmentación, recuperación, incidentes, cambios, endpoints/telefonía y dependencias físicas/de terceros. La ausencia de evidencia no se presenta como control inexistente. Se mantiene el alcance del proyecto de redes y se señalan dependencias de las demás áreas.

**Resultado:** diagnóstico ampliado sin afirmar certificación o incumplimiento integral y sin cambios al código del simulador.
