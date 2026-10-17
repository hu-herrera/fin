# Cierre de criterios de capacidad y comparación comercial

17-10-2026 · Financiera Pacífico · complemento de C4. Requisitos de ingeniería, sin contrato ni cambio del simulador.

## Resultado de la revisión

El análisis anterior consideraba carga normal y seis futuras sedes, pero no sumaba simultáneamente el 20% de crecimiento dentro de las sedes existentes ni la carga exigente ya definida. Se incorpora ese análisis sin modificar ANTES ni sustituir velocidades por servicios inventados.

[Resultados generados](capacidad-wan-resiliencia.json) mediante `node network/wan-capacity-plan.cjs`: cuatro perfiles × las 16 combinaciones de disponibilidad WAN, incluyendo ninguna WAN. Se evalúa también pérdida de cada grupo UPS. Las tasas son **por sentido**, no la suma de subida y bajada; el supuesto de demanda en ambos sentidos debe contrastarse con mediciones. Las velocidades nominales de los cuatro proveedores no acreditan subida simétrica, caudal garantizado, cuotas o cobertura.

| Perfil de sensibilidad | Envolvente central Mbps | Un único enlace necesario al 70%, Mbps por sentido |
|---|---:|---:|
| Actual, carga normal | 282,908 | 405 |
| Actual, carga exigente | 923,976 | 1.320 |
| Existentes +20% y seis nuevas, normal | 417,548 | 597 |
| Existentes +20% y seis nuevas, exigente | 1.360,808 | 1.945 |

Los futuros locales de 30 colaboradores son una sensibilidad, no una distribución aprobada. El crecimiento se redondea hacia arriba por sede, incluyendo teléfonos y CM; no se aplica nuevamente a las seis futuras. Se conservan las concurrencias normal/exigente previas, 40% de Internet remoto local, reserva de voz por sede y 10% de margen de túnel. Backups, replicación y actualizaciones adicionales no están incluidos: deben programarse o dimensionarse aparte. El tráfico corporativo completo no equivale al mínimo de transacciones financieras.

## Qué falla con la referencia WAN actual

- Cuatro WAN suman 670 Mbps nominales; el límite ideal al 70% es 469. La carga exigente actual **ya supera ese límite aun sin fallas**.
- Perdida UPS A: quedan Leo + GTD, 190 nominales y 133 de presupuesto. Faltan 149,908 Mbps para la envolvente normal actual. Repartir las cuatro antenas entre UPS evita apagarlas todas, pero no preserva la capacidad.
- Perdida UPS B: quedan Starlink + Entel, 480 nominales y 336 de presupuesto. Cabe la normal actual en suma ideal, pero no la normal expandida: faltan 81,548 Mbps.
- Ninguno de los cuatro enlaces individuales conserva toda la carga normal actual con el margen elegido.

Esto demuestra insuficiencia del modelo nominal para esos objetivos, no tasas reales de falla ni disponibilidad medida. Pasar una suma ideal tampoco demuestra que ECMP distribuya las sesiones según el ancho de banda; cuatro rutas de igual costo con capacidades desiguales requieren una política validada y pruebas por enlace. Una sola sesión sigue limitada por su camino.

## Recomendación de diseño y condiciones de aceptación

**Mantener los pares de firewall y switching; dimensionar casa central de forma distinta de una sucursal.** Las cuatro WAN por sede siguen siendo el escenario académico, pero no asignar automáticamente a CM cuatro planes idénticos a los de una sucursal.

Para la próxima oferta se solicita una opción central con **dos caminos principales independientes, cada uno capaz de entregar al menos 600 Mbps útiles por sentido**, uno por dominio de energía, además de los otros dos respaldos. Es un mínimo redondeado de ingeniería para la sensibilidad normal expandida de 597 Mbps; no es un plan comercial encontrado. A 70%, 600 entrega 420 de presupuesto frente a 417,548 de demanda: ese margen adicional es pequeño. Backups o cargas nuevas exigen recalcularlo. No sumar dos caminos de 300 como si uno solo cubriera 600 al fallar el otro.

Esta opción permite diseñar continuidad normal ante pérdida de uno de esos caminos principales; **no satisface continuidad completa bajo carga exigente** ni bajo supervivencia exclusiva de un respaldo menor. Para tal objetivo, solicitar como alternativa dos caminos centrales de al menos **2 Gbps útiles por sentido** cada uno, calculados desde 1.945 Mbps, y validar que cada escenario comprometido conserve uno. Si se exige el servicio íntegro con cualquiera de los cuatro como único superviviente, los cuatro necesitan esa capacidad o hay que cambiar el objetivo y declarar el modo degradado. El tipo de acceso y su disponibilidad se cotizan; no se afirma que un plan satelital/celular actual cumpla estas tasas.

La alternativa de 2 Gbps implica revisar medios: C4 asigna WAN central a ethernet1/1–4 de 1G y distribuidores 1G. No soportan ese requisito por puerto. PA-1410 dispone de ethernet1/9–12 multigigabit hasta 5G según [panel oficial del fabricante](https://docs.paloaltonetworks.com/hardware/pa-1400-hardware-reference/pa-1400-series-overview/front-panel-1400-series); antes de adoptarla deben reasignarse ambos firewalls y sustituirse distribuidores/CPE/cables según entrega, además de verificar rendimiento inspeccionado y VPN. La velocidad física del puerto no certifica throughput con todas las funciones activas. Esta alternativa no está aplicada al plano ni incluida en su precio.

Si solo sobreviven enlaces pequeños, la política candidata es priorizar voz y transacciones, posponer copias/actualizaciones y limitar navegación. **No se fija todavía un Mbps de transacciones ni se afirma que el negocio completo continúe**: hacen falta tasa transaccional, tamaño, sesiones y objetivos de latencia/jitter/pérdida del sistema financiero. QoS distribuye el caudal disponible; no crea ancho de banda. Las velocidades actuales permanecen como referencia de respaldo hasta verificar contratos.

Para aceptar el diseño se exige probar, por cada sentido: capacidad útil bajo las funciones de seguridad previstas, pérdida individual de WAN, de firewall y de cada dominio eléctrico; rutas y sesiones VPN, tiempos de recuperación y carga simultánea. Las pruebas de software de esta revisión comprueban aritmética/escenarios, no sustituyen ese piloto.

## Comparación económica homogénea

| Concepto que debe tener la misma condición | A: router separado + NGFW | C4: routing/VPN en NGFW |
|---|---|---|
| Cuatro WAN, HA y capacidad por sentido bajo falla | Validar puertos, routing y criptografía/licencias Cisco | Validar PAN-OS, túneles y rendimiento inspeccionado |
| Seguridad equivalente cinco años y opción año seis | Oferta de bundle, soporte y renovación | Oferta de bundle, soporte y renovación |
| Distribución WAN, medios, energía y gestión | Incluir router, PSU y medios adicionales | Incluir distribuidores, PSU y medios; revisar multigig si aplica |
| Implementación, pruebas, importación y tributos | Mismo alcance de servicio y moneda/fecha | Mismo alcance de servicio y moneda/fecha |
| OPEX, terminales y datos por cinco/seis años | Mismos planes y cuotas requeridos | Mismos planes y cuotas requeridos |
| Total completo y diferencia comparable | Desconocidos | Desconocidos |

C4 continúa como candidato físico y A como alternativa comercial. Los parciales de 524.360.778 y 672.773.658 CLP no deciden el ganador: faltan partidas distintas y referencias comerciales equivalentes. No se agrega una licencia opcional si el bundle ya la incluye. La propuesta central de mayor caudal requerirá nueva oferta; no se introduce un precio supuesto ni se declara ahorro MPLS sin contrato comparable.

## Orden de implementación

1. Usar los requisitos anteriores para evaluar ofertas y medios, sin comprar todavía.
2. Cerrar el perfil de servicio bajo falla y probar una remota con CM; mantener explícito qué respaldo implica degradación.
3. Migrar juntos modelo, dibujo, selección WAN/HA, ping nacional y local, consola, IPAM y exportadores del simulador. Conservar ANTES como base histórica.

La fase completada aquí es el cálculo reproducible y la definición de condiciones de aceptación. La contratación, certificación y migración C4 continúan pendientes.
