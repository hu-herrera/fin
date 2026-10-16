# Presentación de avances — Proyecto de Título
**Viernes 16 de octubre de 2026 · Financiera Pacífico · Exposición sugerida: 6–7 minutos**

Este documento adapta **literalmente los cinco puntos del profesor** al avance del simulador web. Usa la opción **▣ Presentar** en `index.html`: seis escenas con el contenido visible y notas opcionales mediante **N** (ocultas por defecto, para no proyectar el guion). No es la defensa final ni necesita diapositivas.

## Escena 1 — Introducción (40 segundos)

> Buenas tardes, profesor. Nuestro proyecto consiste en desarrollar un simulador web de infraestructura de redes para una financiera ficticia. Considera 23 sedes y 650 computadores. La propuesta combina arquitectura Cisco y firewalls Palo Alto en un entorno interactivo, con el que podemos analizar conectividad, rutas alternativas y seguridad. En esta revisión vamos a mostrar lo que hemos avanzado, lo que ya funciona, las pruebas que hicimos, las dificultades que enfrentamos y las actividades que siguen pendientes.

**Acción:** abrir la página web y pulsar **▣ Presentar**. Mostrar «Financiera Pacífico».

## Escena 2 — Avances desde la última revisión (60 segundos)

> Desde la última revisión nos concentramos en convertir el diseño en un simulador que reaccione a nuestras acciones. Organizamos la arquitectura de cada sede desde los enlaces WAN hacia un router Cisco C8300, un firewall Palo Alto PA-1410 y dos switches Catalyst C9200L funcionando como un stack lógico. Modelamos EtherChannel con LACP, el tránsito entre router y firewall, la segmentación por VLAN y las políticas de acceso. Una mejora reciente fue hacer más clara la pestaña Ping / Trace que ya existía: ahora la prueba deja visible su resultado y los saltos lógicos en la misma ventana de la sede.

**Acción:** avanzar una escena. Explicar el recorrido Cisco → PA → StackWise y señalar que se conserva la comparación ANTES/DESPUÉS en el panel NOC.

## Escena 3 — Estado actual e implementaciones desarrolladas (60 segundos)

> Actualmente tenemos 23 sedes y 650 PCs representados, con cuatro alternativas WAN dentro del escenario. Las VLAN separan usuarios, telefonía, gestión e invitados. Las puertas de enlace están en el Palo Alto, que analiza las solicitudes conforme a sus reglas. Las consolas del laboratorio reproducen una selección de comandos y cambios de interfaz de Cisco y Palo Alto, y el resultado afecta las rutas y las pruebas. La página ya permite inspeccionar sedes, interrumpir enlaces, examinar decisiones y recuperarlos. Es importante precisar que se trata de una simulación educativa en JavaScript; no ejecutamos el software completo de los fabricantes.

**Acción:** enseñar brevemente la topología y el estado de la sede S01 si el profesor quiere profundizar.

## Escena 4 — Evidencias concretas (100 segundos)

> Ahora vamos a demostrarlo en la página. Seleccionamos la sucursal S01, abrimos su topología interna y entramos a Ping / Trace. Elegimos “Otro PC de esta sede” y pulsamos Enviar ping: vemos una respuesta local, los saltos por switching y un RTT estimado. Luego elegimos S02: el firewall bloquea ICMP entre sedes según la política actual, y podemos ver la denegación en el mapa. Después mostramos la pestaña StackWise / LACP y simulamos una caída WAN para observar el proveedor alternativo. Los resultados son reproducibles dentro del modelo; no son mediciones de tráfico físico.

**Acción paso a paso (sin salir de la web):**
1. En la escena de evidencias, pulsar **Probar Ping / Trace de S01**: se abre el simulador original en su pestaña de Ping / Trace.
2. Dejar “Otro PC de esta sede” como destino y pulsar **Enviar ping**. Mostrar respuesta, ruta local y RTT estimado; la ventana debe permanecer abierta.
3. Elegir S02 como destino y enviar otro ping. Mostrar que el firewall bloquea ICMP intersede y cuál es la regla.
4. Desde esa denegación, pulsar **Ver el bloqueo sobre el mapa**. Después volver a la sede, abrir **StackWise / LACP** y simular una caída WAN. Explicar que se observa el failover lógico del escenario.
5. Pulsar **Volver a la exposición** (o Esc). Regresa desde la misma ventana original de sede a la escena de evidencias; avanzar con flecha derecha.

**Evidencia externa:** [última CI aprobada antes de preparar esta presentación](https://github.com/hu-herrera/fin/actions/runs/38964467044), con 55 pruebas de Chromium y 126 comprobaciones de forwarding, además de pruebas de red anteriores. Consultar la ejecución más reciente en GitHub Actions para cifras actualizadas; nunca inventar pruebas de hardware.

## Escena 5 — Dificultades e inconvenientes (65 segundos)

> Los principales problemas aparecieron al intentar que todos los componentes se comportaran de forma coherente. Por ejemplo, StackWise no es simplemente conectar dos switches con EtherChannel: debimos distinguir un único switch lógico de sus enlaces LACP. También corregimos las puertas de enlace de las VLAN para que estuvieran en el firewall Palo Alto y no duplicadas en el router. Otro trabajo importante fue afinar qué debe pasar cuando se corta un enlace o cae el firewall: el paquete debe detenerse en el primer salto que realmente falla. Finalmente, aprendimos a separar las acciones simuladas de las funciones que necesitarían sistemas IOS-XE/PAN-OS completos; así evitamos presentar sesiones IPsec o servidores inventados como si fueran reales.

**Acción:** escena **Problemas que resolvimos**; no hace falta realizar otro corte WAN si ya se demostró.

## Escena 6 — Actividades pendientes y cierre (55 segundos)

> Nuestro siguiente objetivo es mejorar la fidelidad de los escenarios, ampliar las pruebas de fallos y servicios y seguir puliendo la interfaz y la documentación para que la demostración sea más clara. También queremos incorporar las observaciones que recibamos en esta revisión y validar que cualquier persona pueda repetir los mismos casos de laboratorio. Para presentar elegimos usar la página web, donde el mapa, la topología, los resultados y esta misma presentación permanecen juntos. Como se trata de un proyecto académico de simulación, la compra y certificación de routers físicos no es un requisito para mostrar el avance. Quedamos atentos a su retroalimentación sobre las funcionalidades que considera prioritarias para la entrega final.

**Acción:** cerrar con el escenario de pendientes y recibir preguntas.

---

## Preguntas probables del profesor

**¿Es como Packet Tracer o GNS3?**  
Comparte el objetivo de experimentar con topologías y fallos, pero tiene otro nivel de fidelidad. Nuestro motor JavaScript modela el comportamiento de los enlaces, rutas y políticas; Packet Tracer y GNS3 ofrecen otros niveles de simulación o emulación. No afirmamos que ejecuta el sistema operativo original de Cisco o Palo Alto.

**¿Por qué usaron Cisco y Palo Alto juntos?**  
Para separar las funciones de conectividad/ruteo WAN y los controles de seguridad, segmentación y políticas de un NGFW, simulando una arquitectura empresarial heterogénea.

**¿Qué significa que el ping tenga respuesta?**  
Significa que el modelo encuentra una ruta ICMP disponible entre las sedes. El RTT es estimado; no se midió sobre una red física.

**¿Qué ocurre si falla Starlink?**  
En el escenario, la política de selección considera el siguiente enlace disponible. Se ve la transición a Amazon Leo; es una opción del simulador, no una confirmación de disponibilidad comercial del proveedor.

**¿Qué falta antes de la entrega final?**  
Refinamiento de comportamiento, experiencia de usuario, nuevos ensayos repetibles, documentación, retroalimentación y pruebas funcionales finales.

**¿Las 55 pruebas certifican una red física?**  
No. Son pruebas automatizadas del software de simulación en navegador. Los candidatos de configuración son anexos, no evidencia de equipos físicos.

## Lista de control para entrar a clases

- Abrir `index.html` o el sitio publicado. Probar el botón **▣ Presentar**.
- Antes de demostrar, abrir Ping / Trace y confirmar que la prueba S01 → S02 muestre la ruta y la respuesta simulada.
- Si quedó Starlink caído por un ensayo, recuperarlo antes de comenzar.
- Mostrar las notas solo si se necesitan; la tecla **N** las oculta o muestra. **Esc** cierra la vista.
- Mantener a mano la [evidencia CI](https://github.com/hu-herrera/fin/actions/runs/38964467044) para el punto «Evidencias».
- Reservar al menos un minuto para preguntas o retroalimentación. **No prometer equipamiento físico inexistente.**
