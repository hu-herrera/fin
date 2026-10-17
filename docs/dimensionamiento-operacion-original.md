# Parámetros de operación de la red original

**17-10-2026 · Financiera Pacífico · ANTES.** Se completa la definición con hipótesis reproducibles, para evitar que capacidades desconocidas se conviertan en números supuestamente medidos. No son compras nuevas ni recursos obtenidos de una empresa real.

- [Entradas y procedencia](hipotesis-carga-base.json): todos los valores de carga, recursos, respaldo y energía están marcados como supuestos.
- [Resultados calculados](dimensionamiento-base-antes.json): detalle por sede, escenarios normal/exigente, backup a cinco/seis años y límites económicos.
- Reproducir: `node network/base-sizing.cjs`; comprobar: `node network/base-sizing.cjs --check` y `node tests/base-sizing.test.cjs`.

## 1. Capacidad central que adoptamos para el caso

| Elemento original | Hipótesis nominal | Qué no demuestra |
|---|---|---|
| Cada una de las 22 remotas | MPLS cableado de 100 Mbps, sin respaldo | Ni caudal medido ni consumo permanente de 100 Mbps |
| Acceso MPLS de CM | **1 Gbps**, único, con entrega compartida a ambos routers | Dos routers no duplican el acceso/CPE ni prueban diversidad |
| ISP A e ISP B de CM | **300 Mbps cada uno**, para navegación centralizada | No se suman como 600 Mbps garantizados; capacidad y servicio bajo falla se analizan por enlace |

La referencia pública del CDE de 2026 describe remotas con 100 Mbps y conexión central Gigabit [R1]. Es una analogía técnica para construir el caso; no se trasplantan su contrato, redundancias, topología o precio a la financiera. Los 300 Mbps de Internet son una hipótesis propia basada en la carga siguiente, no una tarifa encontrada.

Los puertos Gigabit de equipos antiguos no garantizan 1 Gbps con ACL, inspección o cifrado. No se certifica rendimiento de Cisco 2911/ASA 5512-X mediante esta tabla; pruebas o fichas por función y versión son necesarias antes de atribuir un cuello de botella concreto. El simulador identifica rutas/fallas y no emula colas o saturación según estos caudales.

## 2. Tráfico y telefonía: cantidades distintas

Para el escenario normal se supone 30% de concurrencia de datos a 2 Mbps por PC activo; 10% de terminales telefónicos activos, redondeado hacia arriba **por sede**. Cada terminal remoto activo reserva 0,16 Mbps por sentido hacia CM. Es una envolvente conservadora, no una afirmación de que todo medio RTP pase realmente por la PBX. La tabla de Cisco publica 87,2 kbps Ethernet para G.711/20 ms; nuestra reserva adicional no es un valor atribuido al fabricante [R2]. No se suman dos sentidos full duplex para compararlos con un solo sentido de enlace.

**650 teléfonos no equivalen a 650 llamadas, ni a 650 canales externos.** El cálculo reserva 63 terminales remotos y seis centrales: 69 extremos activos. Una llamada interna ocupa dos extremos y podría tener medios locales; una externa consume canal de la troncal. La envolvente no es un número exacto de llamadas internas.

Se fija como supuesto funcional una troncal SIP central con **30 canales**, demanda normal de 20 llamadas externas y plataforma original compatible con CP-7942G. Operador, PBX, firmware/protocolo, numeración y licencias siguen sin acreditar; no se instala una PBX ni se simulan llamadas reales. El SIP externo debe contar con política perimetral y diseño de SBC/gateway según compatibilidad, no apertura indiscriminada de puertos.

| Cálculo por sentido | Normal | Exigente, sensibilidad |
|---|---:|---:|
| Concurrencia de datos / Mbps por PC activo | 30% / 2 | 50% / 4 |
| Reserva de terminales activos | 69 | 137 |
| Tráfico MPLS remoto agregado, voz incluida | 367,08 Mbps | 1.210,16 Mbps |
| Capacidad MPLS necesaria al usar máximo 70% | **524,4 Mbps** | **1.728,8 Mbps** |
| Demanda Internet central | 179 Mbps | 592,4 Mbps |
| Capacidad de un ISP al usar máximo 70% | **255,714 Mbps** | **846,286 Mbps** |
| Llamadas externas / canales supuestos | 20 / 30 | 40 / 30 |

Para Internet se supone que 40% del tráfico de datos remoto tiene destino externo, más todo el tráfico de datos de CM y las llamadas externas. Es una reserva conservadora; no incluye automáticamente replicación cloud, videoconferencia, grandes actualizaciones o copia externa. El resto de tráfico de datos remoto se considera corporativo. No volver a sumar todo Internet remoto sobre el MPLS: ya transita por él en este diseño centralizado.

El escenario normal cabe nominalmente en 1 Gbps MPLS y un ISP de 300 Mbps. El exigente supera ambas reservas y los canales telefónicos. Esto señala el límite de la hipótesis, **no una caída implementada, un incumplimiento observado o un motivo para desactivar la red en la demostración**. El escenario exigente tampoco es una predicción de consumo constante.

## 3. Servidores originales definidos sin comprar otros

Se mantienen DC-01, DC-02 y BKP-01. Se adoptan capacidades de estudio, sin elegir marcas, asegurar soporte o atribuirlas a la ficha del profesor.

| Recurso supuesto | DC-01 | DC-02 |
|---|---:|---:|
| Núcleos físicos | 8 | 8 |
| RAM | 64 GiB | 32 GiB |
| Almacenamiento útil del host | 2.000 GB | 1.000 GB |
| Enlace de red único | 1 Gbps a SW1 | 1 Gbps a SW2 |
| VMs | Aplicación: 4 vCPU/8 GiB/300 GB; BD: 4 vCPU/32 GiB/800 GB | Telefonía: 4 vCPU/8 GiB/200 GB; DNS/NTP: 2 vCPU/4 GiB/50 GB; NMS/logs: 2 vCPU/8 GiB/250 GB |
| Reserva RAM del hipervisor | 8 GiB | 4 GiB |
| RAM sin asignar tras esa reserva | 16 GiB | 8 GiB |
| Disco sin asignar a VMs | 900 GB | 500 GB |

vCPU y núcleo físico no son rendimiento intercambiable. La suma de asignaciones cabe en esta hipótesis; faltan CPU real, IOPS, latencia, licencias, hipervisor y compatibilidad de las aplicaciones para acreditar servicio. No se afirma que esas VMs sean requisitos oficiales de CUCM u otra PBX.

La BD del core conserva datos operativos de clientes en CM. No se añaden correo, AD, archivos personales, grabaciones, CCTV, nube o servidores de sucursal por inferencia. Si se incorporan al alcance, cambian las asignaciones y el conjunto protegido. Almacenamiento útil no equivale a capacidad bruta ni acredita RAID, cifrado o tolerancia a pérdida de discos.

## 4. Política original de respaldo que usamos como hipótesis

Se define un conjunto usado protegido de **1.000 GB**, incluido dentro de los discos asignados de las VMs; no se lo confunde con los 1.600 GB provisionados. BKP-01 tiene **8.000 GB útiles** y enlace único a SW1. Se plantea full semanal, incrementales diarios con cambio del 5%, cuatro conjuntos semanales, un full de espacio de restauración y margen del 20%; sin ahorros supuestos por compresión o deduplicación.

| Resultado | Hoy | Año 5 | Año 6 |
|---|---:|---:|---:|
| Datos protegidos, crecimiento supuesto 20% anual | 1.000 GB | 2.488,32 GB | 2.985,984 GB |
| Repositorio necesario con retención, workspace y margen | **7.440 GB** | **18.513,101 GB** | **22.215,721 GB** |
| Transferencia de un full a 600 Mbps efectivos supuestos | 3,704 h | 9,216 h | 11,059 h |

El full actual y el incremental de 50 GB (aprox. 11,1 minutos de transferencia) caben en una ventana nocturna supuesta de ocho horas. Con este mismo método, el repositorio y esa ventana no alcanzan al año cinco. El crecimiento no incluye una cantidad inventada de usuarios de seis nuevas sedes, y no supone que las VMs actuales puedan almacenar automáticamente todo el volumen futuro.

El intervalo de 24 horas **no acredita un RPO de 24 horas**: depende de trabajos exitosos, consistencia y recuperación. Las horas de transferencia tampoco son RTO: faltan lectura/escritura, validación de BD, arranque y pruebas de aplicación. Copia externa, inmutabilidad y restauración probada siguen sin evidencia. La retención de cuatro semanas es política operativa supuesta, no una afirmación de cumplimiento de retenciones legales.

No confundir el RTO de sucursal ≤5 minutos del caso con la recuperación completa de un host o edificio. Los RPO/RTO de aplicación/BD/telefonía deben acordarse por servicio antes de prometer continuidad del negocio.

## 5. Energía: capacidad nominal y autonomía separadas

Para completar el caso se asume **una UPS 1.500 VA/900 W por remota y una UPS 3.000 VA/2.700 W en CM**. No hay modelo, curva de batería o autonomía acreditada. Son activos originales supuestos, no nuevas compras añadidas a la propuesta. Una UPS central única conserva un punto de falla; no se inventa generador ni dos circuitos eléctricos independientes.

Las cargas estimadas incluyen router(s), switch(es), CPE, teléfonos PoE y, en CM, ASA, dos hosts y backup. Entradas: 7 W por teléfono como reserva; remoto router 50 W, switch base 60 W, CPE 15 W; central router 80 W cada uno, switch base 100 W cada uno, ASA 60 W, host 250 W cada uno y backup 100 W. No son consumos certificados de sus modelos. Se añade 25% de margen y se calcula VA con factor de potencia supuesto 0,9 [R3].

| Caso | Carga estimada | Con margen del 25% | VA con margen | Capacidad nominal supuesta |
|---|---:|---:|---:|---|
| Sucursal de 30 puestos | 335 W | 418,75 W | 465,278 VA | 900 W / 1.500 VA |
| Casa central | 1.450 W | 1.812,5 W | 2.013,889 VA | 2.700 W / 3.000 VA |

Hay potencia nominal suficiente en el ejercicio; **no se deriva de ello una duración de batería**. PoE/pérdidas, consumos pico, salud de baterías y ambiente requieren validación. Los PCs y monitores no están respaldados por estas UPS de red: mantener teléfonos/switches no mantiene por sí solo los puestos operativos ante un corte general. Climatización y seguridad física quedan fuera de las cargas calculadas.

## 6. Referencias económicas y límites de la recuperación

Una oferta pública de Telefónica para la Subsecretaría de Economía, **enero de 2018**, presenta accesos MPLS de 100 Mbps entre **4,22 y 5,27 UF netas mensuales** y un entronque de 1 Gbps en modalidad HA a **11,82 UF por unidad al mes**, bajo un contrato específico [P1]. Es evidencia histórica del orden y estructura del cobro, **no tarifa 2026 ni precio extrapolable a las 23 sedes**. No se convierte con una UF supuestamente vigente ni se copia su total como presupuesto de la financiera.

Como contraste comercial, Worki publica un paquete de Internet de 500 Mbps a **CLP 310.000/mes + IVA**, con telefonía y compartición 1:4 [P2]. No es MPLS, no es el enlace de 300 Mbps supuesto y no se incorpora al costo anterior. Esto evita confundir capacidad anunciada, servicio dedicado y prestaciones agrupadas.

No se dispone aún de una oferta equivalente vigente de MPLS 100 Mbps para toda la geografía del caso, ni de los cuatro contratos inalámbricos finales. Los costos de ambas soluciones y el payback completo permanecen en **null**. Las sedes ficticias polares/insulares necesitan una estimación de caso explícita, no fingir una cotización cableada real. Mantenimiento incluido en la renta no se vuelve a sumar como ahorro.

La referencia parcial anterior de CLP 411.158.986 corresponde a partidas del diseño B previo; **no es precio final del diseño con cuatro WAN**. Sirve aquí solo para mostrar la escala de la recuperación:

- Recuperar ese parcial en 60 meses requeriría **CLP 6.852.650 mensuales de ahorro neto**.
- En 72 meses requeriría **CLP 5.710.541 mensuales de ahorro neto**.

El ahorro neto debe descontar todas las nuevas mensualidades, soporte/operación y renovaciones, sin volver a cobrar licencias ya prepagadas. No se resta el presupuesto inicial de CLP 160 millones para fabricar una inversión incremental menor: presupuesto y costo del contrafactual son conceptos distintos. Estos umbrales simples no son VAN/TIR, financiación ni un payback demostrado. CAPEX pendiente, coexistencia durante migración y sexto año pueden elevarlos.

## 7. Estado y siguiente cierre

Quedan definidos como **supuestos académicos** caudales, demanda, canales, recursos, política de backup y potencia de UPS. Se conservan como desconocidos sus mediciones, soporte, licencias y autonomía. El simulador muestra caudales supuestos y recursos de hosts; no ejecuta llamadas, tareas de backup, hipervisor ni mediciones eléctricas.

Para retomar la propuesta se necesita: estimar costos comparables por geografía y SLA; separar renovación de red de continuidad de aplicaciones; y rehacer el plano físico para **cuatro WAN**, que es la intención vigente del usuario. El plano anterior de dos WAN no se considera el cierre de ese requisito.

## Referencias consultadas el 17-10-2026

- **R1:** [CDE, licitación de red IP/MPLS 2026](https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=NWZUPnk4VSjG9h7iFIyNIg%3D%3D): analogía de capacidades, no cotización de la financiera.
- **R2:** [Cisco, cálculo de ancho de banda de voz](https://www.cisco.com/c/en/us/support/docs/voice/voice-quality/7934-bwidth-consume.html).
- **R3:** [Schneider Electric/APC, selección de UPS](https://www.se.com/us/en/work/support/product-support/ups-buying-guide-for-selecting-a-battery-backup-system/).
- **P1:** [Oferta histórica de Telefónica, enero de 2018, página PDF 43](https://www.mercadopublico.cl/CMII/Archivos/AttchPC.aspx?file=AIaGhnnSuoxiSCU+ka5z73MdQq2W4ojDWRr6554BcSJRRsaH44OUKy3Prplu0J5b).
- **P2:** [Worki, paquetes de Internet empresarial](https://worki.cl/internet-empresas/). Condiciones y factibilidad del proveedor; no sustituto de MPLS ni oferta para toda la flota.
