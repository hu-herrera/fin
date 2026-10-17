# Decisión 009 — WAN/VPN integrada y telefonía SIP

17-10-2026 · Fase 2 · Diseño preferido para desarrollar la propuesta. No es adjudicación ni validación física.

Se adopta la **variante B**: dos firewalls NGFW en alta disponibilidad activo/pasivo por sucursal concentran routing L3, VPN, políticas y QoS. Se retiran de la propuesta los **44 routers remotos adicionales**, conservando dos routers Cisco de borde IP en casa central. **Yealink SIP-T33G** pasa de candidato comparativo a terminal preferido para los 650 puestos. Cisco se mantiene en switching. La compra requiere soporte, licencias y pruebas definidos abajo.

La alternativa A queda conservada como comparación histórica en [fase 2](fase-2-dimensionamiento-y-seleccion.md). Los números vigentes de esta decisión se generan en [propuesta optimizada](propuesta-optimizada-2026-10-17.json), sin sobreescribir los precios originales.

**Actualización de alcance posterior:** el usuario mantiene cuatro WAN como objetivo de la propuesta. El plano de dos WAN iniciales de esta revisión queda como antecedente para rediseñar; no representa la solución final a cuatro WAN ni acredita su costo completo. Se priorizó completar el [escenario original](dimensionamiento-operacion-original.md) antes de retomar ese rediseño.

**Revisión vigente:** la [propuesta C4](plano-cuatro-wan-y-ha.md) supera este plano B: cuatro WAN, PA-540 remotos, borde directo en NGFW también en CM y presupuesto separado. Las tablas de dos WAN y cantidades de routers de este documento son históricas; no usarlas como BOM vigente.

## Arquitectura elegida

| Ámbito | Selección de diseño | Cantidad inicial | Función |
|---|---|---:|---|
| 22 remotas | PA-510, pareja A/P por sede | 44 | Gateway, segmentación, IPsec, routing y QoS |
| 22 remotas | C9200L-24P-4G-E, pareja en stack | 44 | Acceso PoE a teléfonos y PCs |
| Casa central | C8221-G2 | 2 | Borde IP con acceso a ambos ISP; no terminan estas VPN |
| Casa central | PA-1410, pareja A/P | 2 | Concentración IPsec e inspección; dimensionar cada miembro para toda la carga |
| Casa central | C9200L-48P-4X-E, pareja en stack | 2 | Acceso y uplinks de servidores según reserva ya calculada |
| Puestos | Yealink SIP-T33G | 650 | Switch PoE → teléfono Gigabit → PC; VLAN datos/voz separadas |
| Distribución WAN remota | Entrega de cada ISP a ambos firewalls | Reserva de 44 distribuidores | Un equipo independiente por WAN cuando el CPE no entregue dos puertos equivalentes |

Dos switches de **acceso** por sede no equivalen a dos equipos de switching en toda la instalación: puede hacer falta distribución WAN adicional. Se reserva su costo como desconocido. Se elimina esa partida solo por sede con entrega doble de CPE documentada y probada; no se supone incluida gratis. Cada distribuidor de WAN afecta a su propio proveedor, y la otra WAN debe sobrevivir desde ambos firewalls. No concentrar los dos proveedores en un único equipo.

Se conservan 650 PCs, el reparto por sede, dos hosts centrales y el repositorio de backup como elementos a auditar. No se añaden servidores físicos a cada sucursal. La supervivencia de telefonía durante aislamiento total y la recuperación del core son requisitos de sistemas que se presupuestan aparte; el par NGFW no los resuelve.

## WAN y puertos: dos enlaces inicialmente, ampliación explícita

Se eligen **dos WAN independientes por remota** como base de diseño. Deben acreditarse cobertura, capacidad y diversidad física/energética por ubicación. Starlink, otros satélites y operadores móviles/fijos son opciones a verificar; no cuatro contratos disponibles en todas las sedes. S21/S22 requieren especialmente validación de servicio, permisos y condiciones ambientales. Una WAN satelital más otra que comparta la misma dependencia no demuestra diversidad.

Plano de **cada** PA-510 (el peer usa el mismo puerto para el mismo rol):

| Interfaz | Conexión |
|---|---|
| ethernet1/1 | WAN A, accesible desde ambos miembros |
| ethernet1/2 | WAN B, accesible desde ambos miembros |
| ethernet1/3–4 | Un agregado LAN propio del firewall, un miembro a cada switch del stack |
| ethernet1/5 | HA1 directo al peer |
| ethernet1/6 | HA2 directo al peer |
| ethernet1/7 | HA2 backup directo, por otro cable |
| ethernet1/8 | Reserva; una tercera WAN la consume |
| MGT, separado | Gestión restringida y heartbeat backup mediante red de gestión |

El stack tiene un port-channel por firewall; no se unen los dos firewalls independientes en un solo agregado. Cada gestión MGT se conecta a un miembro distinto; probar comunicación de heartbeat cuando se pierde cualquiera de ellos. Configurar sincronización y alarmas de HA2, monitorización de LAN/WAN y elección de rol; no volver automáticamente al preferido tras recuperarlo. Programar el retorno después de estabilizar y revisar sesiones.

**Corrección de la fase 2:** PA-520 tiene también ocho RJ45 de datos; no ofrece más puertos que PA-510. PA-540 añade dos SFP según el manual [F1]. Para cuatro WAN no se conserva a la vez este HA2 backup y todo el plano LAN sin rediseñar. No se compra un modelo superior solo por su numeración.

## VPN, routing y alcance del failover

Las VPN se terminan en los **PA de ambos extremos**. En CM los routers Cisco transportan el tráfico IP hacia la pareja de firewalls. Se deben contratar/diseñar dos endpoints públicos estables, uno por ISP central, alcanzables por ambos routers y por el miembro activo. Quedan pendientes bloques públicos/rutas de retorno, entrega del proveedor y protección de esos enlaces: no basta tener dos direcciones asignadas a routers sin acceso al firewall superviviente.

Con dos WAN remotas y dos endpoints centrales se reservan **4 túneles lógicos por remota: 88 iniciales y 112 con 28 remotas**. No se duplican por el peer pasivo, ni se confunden con asociaciones IKE/IPsec, proxy IDs o sesiones. Cada PA central debe admitir todo el conjunto y la carga cifrada/inspeccionada bajo falla; confirmar límites por modelo y versión. OSPF sobre túneles y filtros de prefijos deben mantener aislamiento entre sedes; voz, gestión e invitados no obtienen acceso al core por compartir VPN.

La base usa rutas con monitorización de camino y recuperación con espera de estabilidad. PAN-OS puede retirar rutas estáticas si fallan destinos ICMP y seleccionar otra ruta [F2]. Se requieren sondas fijadas a su WAN y destinos fiables más allá del CPE; probar pérdida de servicio con enlace Ethernet aún arriba. Verificar NAT-T, MTU/MSS, CGNAT, cambio de dirección y renegociación. Los endpoints centrales no pueden quedar detrás de CGNAT sin solución contractual/de arquitectura.

**No se denomina SD-WAN a este failover.** La selección automática por aplicación y umbrales de latencia/jitter/pérdida requiere evaluar la solución SD-WAN y sus licencias/gestión [F3]. La base identifica degradaciones mediante monitoreo y reserva QoS de voz; no garantiza que ICMP detecte toda degradación de una llamada. Si ese direccionamiento por calidad resulta obligatorio, se añade al alcance y costo antes de cerrar la propuesta.

HA2 sincroniza sesiones y SAs IPsec, pero la información de IKE fase 1 no se sincroniza íntegramente [F4, F5]. Por ello se prueban también renegociación, rekey y llamadas después de una conmutación. No se promete cero paquetes perdidos ni conservación de todas las llamadas. No desactivar DPD indiscriminadamente para ocultar fallos. Una actualización incompatible o una configuración errónea sincronizada puede afectar a ambos peers: respaldo, revisión, piloto y rollback siguen siendo necesarios.

La licencia criptográfica Cisco de la alternativa A deja de ser una compra automática: estos routers de CM ya no cifran las VPN. Se revisan sus licencias por las funciones de routing/failover realmente usadas. ATP no incluye por sí sola todas las suscripciones, soporte o administración centralizada. Se mantienen esas partidas abiertas para ambos miembros del par.

## Telefonía elegida y aceptación

SIP-T33G conserva doble Ethernet Gigabit y PoE sin gastar un puerto de acceso adicional por PC [F6]. La guía oficial de 3CX incluye el modelo y permite conexión LAN/VPN con PBX local, con firmware soportado [F7]. Eso aporta una referencia de interoperabilidad, **no selecciona ni incluye una PBX 3CX en el precio**.

La central telefónica, troncales SIP, canales simultáneos, SBC si procede, números, grabaciones/retención, respaldo y licencias se dimensionan como sistema aparte. No se asumen 650 llamadas simultáneas. La prueba piloto debe cubrir registro, llamadas internas/externas, transferencia, QoS, etiquetado de voz, DHCP/provisión segura, aislamiento y recuperación al perder WAN, firewall o host PBX. Probar TLS/SRTP con la revisión y firmware ofrecidos, sin publicar credenciales ni aprovisionamiento en HTTP abierto.

No se encontró una fecha contractual que acredite seis años de soporte del terminal. La selección de diseño exige oferta escrita con cinco años desde puesta en servicio y sexto separado, actualizaciones de seguridad y reposición en Chile. Si el T33G no cumple, sustituir por un SIP Gigabit con ese compromiso y recalcular; no aceptar un terminal 10/100 ni una promesa genérica de marca. La reserva PoE anterior de 7 W por terminal se conserva como envolvente de ingeniería hasta confirmar consumo/clase de la unidad ofertada.

## Costo comparable y brecha real

Se mantienen las referencias del 17-10-2026, USD supuesto a CLP 1.000 y factor 1,19 ilustrativo en referencias USD. Se redondea la unidad al peso antes de multiplicar; no es oferta tributaria/importadora. El teléfono local declara IVA incluido [P1].

| Comparación de partidas ya valorizadas | CLP |
|---|---:|
| A histórica con teléfonos Cisco | $608.597.528 |
| Hardware de 44 routers remotos retirado de B | −$113.201.792 |
| Diferencia de 650 teléfonos al seleccionar SIP-T33G | −$84.236.750 |
| **B preferida: subtotal parcial comparable** | **$411.158.986** |
| Reducción de estas referencias | $197.438.542 |
| Exceso de ese parcial sobre presupuesto de $160 millones | $251.158.986 |

Los teléfonos seleccionados suman $59.626.450 (650 × $91.733). Las seis remotas futuras agregan un parcial de red de **$79.662.120**, sin puestos ni distribución WAN, soporte u otras dependencias todavía sin precio. Sus usuarios/teléfonos siguen sin cantidad definitiva.

La reducción no es ahorro neto de TCO. Faltan routers/switches de CM, distribución WAN, soporte, licencias complementarias y sexto año, energía/UPS, ópticas, instalación, servidores/almacenamiento, PBX/SIP, DR, contingencia y servicios recurrentes. El total completo permanece en **null**, no cero. La distribución WAN añadida, el soporte y cualquier licencia SD-WAN pueden consumir parte de la diferencia.

La opción B es la preferida por reducir funciones duplicadas y terminales sobredimensionados manteniendo pares de equipos. **Todavía no cabe en $160 millones.** No se presenta una propuesta de cuatrocientos millones como compatible con ese límite. Si el cliente no amplía presupuesto, se requiere alcance por etapas y nuevas alternativas comerciales antes de afirmar viabilidad financiera.

## Pasos de implementación y criterios de cierre

1. Oferta comparable por SKU y plazo: confirmar hardware nuevo/registro de fabricante, stock, soporte geográfico y licencias de ambos peers. Elegir cada WAN por cobertura real; no adjudicar por el nombre del operador.
2. Piloto de una sucursal representativa y CM: cargas de 300 Mbps remotos con cifrado/inspección acordados, tráfico central agregado, capacidad de una sola WAN superviviente y un solo miembro activo; validar los endpoints públicos y el direccionamiento privado de voz/datos/gestión.
3. Simular/documentar pérdida de cada WAN, CPE/distribuidor, firewall, HA1, HA2, cable LAN, switch y alimentación; registrar servicio afectado y recuperación. El fallo de un switch apaga sus teléfonos/PCs conectados; no hay redundancia del puesto por tener stack.
4. Medir recuperación de aplicación y telefonía, además del ping, frente al RTO de sucursal ≤5 minutos del caso. Los objetivos core 99,99% y sucursal 99,95% requieren medición temporal por servicio; no se certifican con una demostración.
5. Migrar el perfil DESPUÉS en un cambio específico: pares HA y estados separados, WAN sin routers remotos, nuevo recorrido de ping interno y del mapa, dispositivos/CLI/PBX modelados coherentes y pruebas de regresión. Retirar o adaptar exportadores IOS-XE remotos; no emitir configuraciones del diseño viejo con la etiqueta B.

**Estado del simulador:** ANTES permanece integrado y DESPUÉS ejecuta aún C8300 → PA-1410 → stack C9200L del perfil anterior. Esta decisión y BOM están adoptadas documentalmente; no se presenta una migración funcional que aún no se ha implementado. El presupuesto previo queda histórico y enlazado a esta decisión.

## Fuentes verificadas el 17-10-2026

- **F1:** [Palo Alto: componentes PA-500 Series](https://docs.paloaltonetworks.com/hardware/pa-500-hardware-reference/pa-500-series-firewall-overview/pa-500-series-firewall-components).
- **F2:** [PAN-OS: static route removal based on path monitoring](https://docs.paloaltonetworks.com/ngfw/networking/static-routes/static-route-removal-based-on-path-monitoring).
- **F3:** [Palo Alto: About SD-WAN](https://docs.paloaltonetworks.com/sd-wan/getting-started/about-sd-wan).
- **F4:** [PAN-OS: configurar HA activo/pasivo](https://docs.paloaltonetworks.com/ngfw/administration/high-availability/set-up-activepassive-ha/configure-activepassive-ha).
- **F5:** [Palo Alto KB: sincronización de SA IPsec en A/P](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA14u000000HAuZCAW).
- **F6:** [Yealink: ficha SIP-T33G](https://support.yealink.com/es-es/docs/sip-t33p-g/ficha-tecnica-yealink-sip-t33g/469b3c31217a48d1b17f5f52e6c2844a).
- **F7:** [3CX: aprovisionamiento Yealink T3](https://www.3cx.com/sip-phones/yealink-t3-series/).
- **P1:** [AltaSistemas: SIP-T33G, $91.733 IVA incluido](https://altasistemas.cl/product-category/telefonia-megafonia/telefono-ip/). Referencia pública; no acredita 650 unidades ni soporte por seis años. Las demás fuentes de precios se conservan por partida en el JSON de fase 2 y en el derivado B.

Reproducir y comprobar los cálculos: `node scripts/build-optimized-proposal.cjs --check`. El generador verifica reparto de puestos, extensiones de precios, reconciliación de la comparación y puertos sin duplicados. No prueba prestaciones de hardware.
