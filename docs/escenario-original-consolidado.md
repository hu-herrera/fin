# Escenario original consolidado — Financiera Pacífico

**Revisión:** 17-10-2026. **Alcance:** definir ANTES; renovación, cuatro WAN inalámbricas y compras quedan fuera de esta definición. Este documento tiene prioridad sobre la descripción satelital anterior de S21/S22. Las definiciones funcionales se adoptan como supuestos académicos tras la autorización de continuar; no son datos levantados en una empresa real.

## 1. Hechos del escenario y procedencia

| Aspecto | Definición | Procedencia |
|---|---|---|
| Organización | Empresa financiera ficticia; actividad exacta y tipo jurídico no definidos | Caso académico; no atribuirle condición de banco o regulación específica sin definirla |
| Tamaño | 780 trabajadores, 650 puestos informáticos | Ficha del caso; no inferir 780 equipos ni acceso remoto para los 130 restantes |
| Sedes | CM + 22 sucursales, incluidas Hanga Roa y Antártica | Adaptación del proyecto a 23; la ficha original tenía 22 ubicaciones |
| Crecimiento | Seis sedes adicionales, fuera de inventario y costos de la instalación inicial | Requisito de expansión; cantidades de nuevos puestos pendientes |
| PCs | CM 55; S01–S05 30 cada una; S06–S20 28 cada una; S21 17; S22 8 | Reparto del simulador: 650 en total |
| Voz | 650 teléfonos, uno por PC; switch PoE → teléfono → PC | Supuesto académico acordado, no número de teléfonos confirmado por una visita |
| WAN original | MPLS por cable en las 23 ubicaciones, sin acceso satelital/móvil ni respaldo WAN remoto | Corrección explícita del usuario; premisa ficticia incluso en las ubicaciones especiales |
| Capacidad remota | 100 Mbps nominales por sucursal como acceso contratado supuesto | Decisión académica; no es caudal medido ni demanda permanente |
| Internet central | Dos ISP en CM, separados del servicio MPLS | Ficha del caso; operadores, caudal, SLA y diversidad física no acreditados |
| Operación | Red operativa en condiciones normales; administración manual y NMS central | Base del caso; no se inventa historial de incidentes |

**No equiparar MPLS a Internet ni a cifrado.** Las sucursales acceden a la red privada del operador; cifrado efectivamente configurado queda sin acreditar. La independencia física de servicios y el tipo de entrega deben describirse aparte.

## 2. Topología funcional de referencia

Se fija como **supuesto académico adoptado** un modelo centralizado: sucursales → MPLS del operador → borde de CM → firewall central → redes/servicios internos. La navegación de sucursales sale por CM, después del filtrado, usando sus ISP. No hay salida local a Internet en las sucursales del escenario inicial.

| Flujo | Recorrido y control de referencia |
|---|---|
| PC a aplicación financiera | VLAN de datos → router remoto → MPLS → borde CM → ASA → aplicación en zona de servidores |
| Aplicación a base de datos | Comunicación interna en CM autorizada para el servicio; los PCs no necesitan acceso directo al motor de BD |
| Sucursal a Internet | MPLS → CM → ASA/NAT → ISP central; sin acceso directo desde la LAN remota al proveedor |
| Una sucursal a otra | Políticas de CM permiten únicamente servicios necesarios; no se presume libre acceso entre usuarios de todas las sedes |
| Teléfono a central telefónica | VLAN de voz → router/MPLS → control de llamadas en CM; señalización y medios no son el mismo flujo |
| Llamadas externas | Troncal SIP central de 30 canales como supuesto, 20 llamadas externas normales; operador/PBX/licencias sin acreditar |
| Administración | Desde TI por rutas de gestión; mecanismos/cuentas originales por describir, sin asumir TACACS+ o MFA ya desplegados |

**Datacenter y seguridad interna:** aplicación y BD están en VMs distintas del mismo host; compartir VLAN de servidores no demuestra filtrado entre ambas. No afirmar microsegmentación, cifrado de datos en reposo o restricción de puertos si no se ha definido ese control.

### Borde central: redundancia parcial y entrega física

Los dos routers centrales pertenecen al borde MPLS; los dos ISP terminan en el ASA, usando interfaces distintas, como **asignación funcional académica**. No se exige que cada Cisco 2911 tenga una interfaz física independiente para MPLS, ambos ISP y LAN: eso excedería sus tres GE integradas.

Para conservar HSRP y que ambos routers alcancen MPLS se supone una entrega del operador con dos conexiones LAN utilizables. Es un único acceso/CPE y dominio de falla, no dos MPLS independientes. El tránsito entre routers y ASA requiere una VLAN dedicada aislada en el stack existente y un plano de puertos. No se inventa un switch WAN adicional ni se declara ya instalado ese cableado.

El ASA tiene zonas/interfaces separadas para tránsito MPLS, LAN y ambos ISP; las redes de datos/voz/servidores se enrutan en el stack de CM. El plano final debe evitar caminos que omitan el firewall, rutas asimétricas, solapamientos y bucles de encaminamiento. Esto define cómo completar la base, no certifica las configuraciones antiguas.

Se adopta **1 Gbps MPLS central y dos ISP de 300 Mbps** como hipótesis nominales del caso, desarrolladas en el [dimensionamiento de operación](dimensionamiento-operacion-original.md). Contratos, rendimiento de equipos y mediciones siguen sin acreditar: **22 accesos de 100 Mbps no significan 2,2 Gbps de uso simultáneo, ni justifican suponer 100 Mbps en CM**. La reserva de concurrencia y la sensibilidad exigente se calculan aparte; no se simula congestión ni se acredita capacidad física por mostrar el caudal nominal.

## 3. Inventario existente y capacidad real de puertos

Se mantienen como modelos académicos los ya documentados: 22 CISCO1921-SEC/K9 remotos; dos CISCO2911-SEC/K9 centrales; veinte WS-C2960S-48LPS-L y dos WS-C2960S-24PS-L remotos; dos WS-C3750X-48P-S en CM; un ASA5512-K9 y 650 CP-7942G. Fechas oficiales de soporte y referencias permanecen en la fase 1.

- Un router, un switch y un acceso MPLS por sucursal; no hay firewall appliance remoto dedicado. Esto no demuestra ausencia de ACL o controles en routers.
- CM conserva dos routers y dos switches StackWise Plus; un solo ASA limita la continuidad del perímetro. El stack comparte riesgos de configuración y mantenimiento.
- Los dos Ethernet 10/100 del teléfono limitan a 100 Mbps el camino del PC conectado detrás de él. No se presenta el puesto como Gigabit.
- Los puertos libres de la tabla histórica descontaban solo puestos: hay que reservar uplinks, CPE/tránsitos, servidores, backup y gestión antes de asignar periféricos.
- Cableado estructurado, patch panels, racks y tomas son infraestructura necesaria del escenario, pero su categoría, estado y cantidades no están inventariados. No afirmar que se reemplazan todos ni que todos se reutilizan.
- Impresoras, AP, Wi-Fi invitados, CCTV, control de acceso, cajeros/POS y computadores portátiles adicionales **no están incluidos en el inventario base**. Su ausencia de inventario no acredita que la empresa carezca de ellos. Cualquier incorporación cambia puertos, VLAN, PoE y costos.

## 4. Datacenter, datos e identidades

| Alojamiento | Funciones del escenario | Límite explícito |
|---|---|---|
| DC-01, host físico | VM de aplicación financiera + VM de base de datos | Ambas dependen del mismo host; sin clúster declarado |
| DC-02, host físico | Control de llamadas, DNS/NTP y NMS/registros, separados lógicamente | Sin segunda instancia de estos servicios declarada |
| BKP-01, repositorio separado en CM | Copias de datos y configuraciones | Mismo edificio; full semanal/incremental diario y cuatro semanas como supuestos; protección/restauración sin acreditar |

Los datos operativos de clientes del escenario residen en la BD central; no se añade nube ni almacenamiento permanente en sucursales por inferencia. Los documentos de clientes, archivos compartidos, correo, grabaciones telefónicas y archivos temporales requieren delimitar su alcance; no se asume que estén cubiertos por respaldar solo la BD.

Las capacidades académicas quedan en [hipótesis de carga](hipotesis-carga-base.json): DC-01 8 núcleos/64 GiB/2 TB útiles, DC-02 8 núcleos/32 GiB/1 TB y BKP-01 8 TB útiles. Marca real, discos/RAID, hipervisor, SO, motor de BD, licencias, versiones y rendimiento permanecen sin acreditar. No hace falta inventar un modelo para explicar el problema; sí hacen falta capacidades para decidir si se reutiliza o renueva. Dos hosts no equivalen a un clúster ni garantizan continuidad de la aplicación.

La autenticación de empleados y de la aplicación no está definida: no declarar Active Directory, MFA o SSO existentes sin incorporarlos al caso. Las identidades de administradores de red son otra función; TACACS+ no reemplaza la BD de clientes ni el directorio de usuarios.

## 5. Servicios de red, telefonía y operación

Se conserva el direccionamiento ANTES de fase 1: VLAN10 datos, VLAN20 voz, VLAN30 gestión y VLAN50 servidores en CM. Los gateways remotos están en el router; los centrales en el stack L3. Las seis futuras no reciben rangos definitivos por defecto. Direcciones WAN, tránsito y CPE siguen separadas de los rangos del perfil DESPUÉS.

**Supuesto funcional adoptado:** DHCP de datos/voz por router remoto y servicio DHCP de CM por definir; provisión telefónica desde el control de llamadas central. Esto evita hacer depender de un relay hacia CM toda renovación de direcciones remota, pero requiere reservar rangos, exclusiones, DNS y opciones de telefonía. Una IP asignada en el simulador no demuestra DHCP real ni llamadas operativas.

No se selecciona una PBX nueva para describir ANTES. La plataforma original debe ser compatible con los CP-7942G y se debe precisar protocolo/firmware y licencias antes de generar configuraciones. Faltan canales simultáneos, numeración/extensiones, troncal externa, llamadas de emergencia y comportamiento bajo pérdida de WAN. No se asume que toda llamada establecida se corte al perder señalización, ni que siga disponible sin probarla.

NMS central y cambios manuales siguen formando parte de la base. Horario de atención, ventanas de mantenimiento, responsables, escalamiento, cobertura de soporte, stock de repuestos y acceso de emergencia no están definidos. No se inventan turnos 24×7 ni tiempos de reparación. Se suponen 22 UPS de red 1.500 VA/900 W y una central 3.000 VA/2.700 W en el dimensionamiento; modelos/autonomía no acreditados. No se atribuyen generador, doble alimentación, climatización o protección ambiental concretos sin inventario; son puntos de levantamiento, especialmente en CM y sedes especiales.

## 6. Dependencias y fallas que sí describe la base

| Evento | Impacto que puede sostenerse |
|---|---|
| Pérdida de MPLS de una sucursal | Pierde acceso al core, servicios centrales e Internet centralizado; conserva switching local y lo que funcione autónomamente |
| Pérdida de router remoto | Se pierden redes enrutadas/WAN; comunicación en una misma VLAN puede continuar mientras el switch funcione |
| Pérdida de switch remoto | Puestos conectados pierden red y teléfonos pierden PoE |
| Pérdida del acceso/CPE MPLS central | Afecta las 22 sucursales; tener dos routers no elimina esa dependencia común |
| Pérdida de un ISP central | No implica caída automática de MPLS o del core; continuidad de Internet depende del failover correctamente definido |
| Pérdida del ASA | Interrumpe los flujos que lo atraviesan, incluidos MPLS hacia servicios según la topología funcional propuesta |
| Pérdida de DC-01 | Afecta aplicación y BD; no apaga artificialmente switches ni el host de telefonía |
| Pérdida de DC-02 | Afecta sus servicios; el efecto sobre equipos existentes depende de cachés, leases y protocolos |
| Pérdida del edificio/energía CM | Riesgo compartido para servicios y backup local; no hay recuperación externa acreditada |

No se inventan frecuencia de cortes, multas, ataques, pérdida efectiva de datos, porcentajes de disponibilidad o tiempos de recuperación. RTO ≤5 minutos, core 99,99% y sucursal 99,95% son metas del caso para la solución, no resultados medidos de ANTES. El RPO de cada servicio aún requiere definición.

## 7. Costos y lista de cierre

El costo anterior debe separar acceso MPLS de cada remota, acceso/puerto central, ambos ISP, telefonía, soporte y operación. No sumar mantenimiento de cable como gasto adicional si ya está incluido en el contrato. No se asigna el mismo precio nacional a las 23 ubicaciones sin una hipótesis geográfica explícita. A los activos antiguos no se les suma un precio de compra nuevo como si fueran inversión de la propuesta.

Para cerrar la base se revisan estos cinco conjuntos, sin abrir de nuevo la selección de equipos nuevos:

1. **Acordado:** 23 ubicaciones, reparto de puestos, 650 teléfonos, MPLS cableado único en todas, 100 Mbps remotos como supuesto y redundancia parcial central.
2. **Definición funcional adoptada en este documento:** navegación centralizada, borde MPLS separado de ISP/ASA, flujos del core y telefonía, entrega común a dos routers y DHCP remoto. Se identifica como supuesto académico; no equivale a protocolos/servicios realmente desplegados.
3. **Parámetros de estudio completados:** caudal central/ISP, tráfico, canales, recursos, backup y potencia quedan en las hipótesis y resultados reproducibles. Mediciones, licencias, autonomía, RPO/RTO logrado y mensualidades siguen desconocidos; no significan cero ni control inexistente.
4. **Alcance a declarar:** directorio/identidades, archivos/correo, periféricos, telefonía externa, seguridad física y responsabilidades de otras áreas. No convertir automáticamente cada dependencia en una compra del proyecto de redes.
5. **Sincronización funcional:** inventario JSON, generador, motor ANTES, textos de topología, pings y pruebas usan MPLS cableado en todas las ubicaciones. El corte nacional aísla las 22 sucursales. El acceso MPLS central se puede cortar/restaurar en CM. Los hosts reflejan su enlace único al miembro del stack definido; no se representa redundancia de servidor inexistente.

**Estado:** definición funcional consolidada e inventario/topología/fallas MPLS integrados en ANTES. DHCP, telefonía e Internet centralizado están descritos como arquitectura, sin sesiones o servicios reales emulados. Caudales centrales, carga de servidores, canales, backup y potencia UPS ya tienen hipótesis de estudio; RPO/RTO logrado, autonomía, contratos y mensualidades siguen sin acreditar. No afirmar «sin puntos de falla» ni «todo implementado». El [dimensionamiento de operación](dimensionamiento-operacion-original.md) completa las hipótesis y cálculos de esta base; la comparación TCO completa sigue pendiente de costos equivalentes.


## 8. Siguiente etapa: completar parámetros sin alterar el escenario

| Parámetro | Estado y regla de trabajo |
|---|---|
| Caudal MPLS central y ambos ISP | Hipótesis nominal: 1 Gbps MPLS y 300 Mbps por ISP; tráfico normal/exigente calculado, sin medición contractual |
| Voz simultánea y troncal | Reserva normal de 69 extremos activos; 30 canales externos y 20 llamadas externas normales como supuestos, PBX/licencias sin acreditar |
| Datos/almacenamiento y respaldo | 1 TB protegido/8 TB de backup como supuestos, full semanal/incremental diario; capacidad a 5–6 años calculada; RPO/RTO logrado desconocido |
| Energía | Hipótesis de cargas y UPS nominales por sede; autonomía permanece desconocida sin curvas/estado de batería |
| Costos anteriores | Sin dato. Buscar referencias equivalentes de MPLS 100 Mbps, agregación central y servicios; estimaciones por zona con rango y fecha |
| Periféricos y servicios externos | Fuera de cantidades conocidas. No sumar AP/impresoras/servidores de correo/AD sin dimensionarlos ni atribuirlos al Excel |

La falta de una mensualidad no impide definir la topología; sí impide afirmar ahorro o payback. La falta de RPO o retención no se resuelve con un número arbitrario presentado como medición. El diagnóstico cualitativo y las pruebas de dependencia ya pueden cerrarse sin fabricar esos valores.
