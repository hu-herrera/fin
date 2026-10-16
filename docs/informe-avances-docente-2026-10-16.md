# Informe de avances de Proyecto de Título
**Financiera Pacífico — Simulador web de redes empresariales**

**Revisión:** viernes 16 de octubre de 2026  
**Modalidad de entrega:** revisión de avances (no entrega final)  
**Repositorio:** https://github.com/hu-herrera/fin  
**Simulador en línea:** https://hu-herrera.github.io/fin/  
**Pruebas verificadas:** https://github.com/hu-herrera/fin/actions/runs/38968500648

> **Alcance académico.** La plataforma modela comportamientos de red en JavaScript y permite ensayos interactivos. No usa dispositivos físicos ni ejecuta los sistemas operativos completos de Cisco o Palo Alto. Los resultados de CI avalan el software, no la operación de una red instalada.

## 1. Avances desde la última revisión

- Se consolidó el diseño de la red de una financiera ficticia con **23 sedes y 650 computadores inventariados**.
- Se pasó de un diagrama a un **simulador web interactivo** con estados de enlaces, cambios de rutas WAN y decisiones de seguridad.
- Se integró la arquitectura **Cisco C8300 → Palo Alto PA-1410 → Catalyst C9200L StackWise** por sede, con EtherChannel/LACP (Po10 y Po20).
- Se incorporó **Flujo de paquetes dentro de «Ver topología interna completa»**, con selección de PC, aplicación y destino; muestra cada salto y las causas de permisos o bloqueos.
- Se añadió un **modo Presentar en la misma página**, sin necesidad de PowerPoint, para recorrer la demostración y explicar sus avances.
- Se amplió la suite de pruebas reproducibles mediante **GitHub Actions, Node.js y Playwright/Chromium**.

## 2. Estado actual e implementaciones desarrolladas

| Componente | Estado académico observable |
|---|---|
| Topología de sedes y PCs | 23 sedes y 650 PCs modelados |
| Conexiones internas | C8300 / PA-1410 / StackWise de 2 miembros, LACP Po10 y Po20 |
| Segmentación | VLAN10 usuarios, VLAN20 voz, VLAN30 gestión, VLAN40 invitados |
| Seguridad | Decisiones allow/deny de PAN-OS modeladas, invitados aislados y permisos intersede mínimos |
| Redes WAN | Opciones Starlink, Amazon Leo, Entel 5G y GTD 4G, priorizadas en el escenario |
| Laboratorio original | Mapa de sedes, «Ver topología interna completa», consolas simuladas, Ping/Trace, StackWise y Flujo de paquetes |
| Recuperación ante fallos | Modelos de caída de WAN, puertos, enlaces, miembros del stack y firewall |
| Configuraciones de ejemplo | Generadores de candidatos Cisco/PAN-OS con validaciones; **no aplicadas a equipos físicos** |

El simulador diferencia entre **reenvío lógico permitido** y **respuesta real de servidores**. Por ejemplo, «DNS PERMITIDO» significa que las rutas/políticas del modelo permiten el flujo, no que existe un DNS físico activo.

## 3. Evidencias comprobables

**Pruebas automatizadas de la versión validada el 16 de octubre de 2026:**

- **58 / 58 pruebas de navegador** aprobadas con Playwright/Chromium.
- **126 comprobaciones** del motor de flujo de paquetes (enrutamiento, ACL, cambios WAN, fallos del hub y StackWise).
- **23 sedes y 650 PCs** revisados en la suite de topología e inventario.
- **1.981 comprobaciones intersede** de políticas y rutas PAN-OS/OSPF en el modelo.
- **2.881 verificaciones** de candidatos Cisco/PAN-OS/StackWise en la suite de código.

**Referencias directas:**

1. [Simulador en GitHub Pages](https://hu-herrera.github.io/fin/) — evidencia funcional exploratoria.
2. [Última ejecución verde de GitHub Actions](https://github.com/hu-herrera/fin/actions/runs/38968500648) — resultados y registro de pruebas.
3. [Publicación exitosa de la página](https://github.com/hu-herrera/fin/actions/runs/38968498822) — entrega del sitio.
4. [Código, historial y documentación](https://github.com/hu-herrera/fin) — evidencia del desarrollo.
5. [Guía de demostración](guia-demostracion-simulador.md) y [guion para exposición](presentacion-avances-16-octubre-2026.md).
6. El workflow genera el artefacto **`acceptance-23-sites.json`**. Sus advertencias de validación física son explícitas, no fallas del simulador académico.

### Prueba reproducible de cinco pasos

1. Entrar a [la página](https://hu-herrera.github.io/fin/), seleccionar **S01**.
2. Pulsar el botón amarillo **«Ver topología interna completa»**.
3. Ir a **«Flujo de paquetes»**; origen `10.70.1.10`, destino `10.70.0.110`, aplicación **DNS**. Pulsar **«Simular flujo»**: el modelo debe mostrar **PERMITIDO** y el camino lógico.
4. Pulsar **«SSH bloqueado»**: debe mostrar **BLOQUEADO** por la política de seguridad.
5. Volver a **DNS permitido**, pulsar **«Cortar Starlink»**: el escenario selecciona la siguiente WAN disponible (**Amazon Leo** en el modelo); pulsar **«Recuperar Starlink»** para restaurar.

La herramienta muestra el **número de ejecución** de cada simulación y sus saltos, de modo que se puede repetir la demostración. La disponibilidad comercial real de una WAN no se infiere de que aparezca simulada.

## 4. Dificultades e inconvenientes encontrados

- **Coherencia de arquitectura:** fue necesario distinguir dos switches físicamente apilados con StackWise de dos switches LACP independientes.
- **Funciones Cisco/Palo Alto:** se corrigió la ubicación de gateways VLAN en el PA y el tránsito con el C8300.
- **Rutas y seguridad:** se revisaron permisos en ambos extremos de las sedes para evitar abrir tráfico lateral innecesario.
- **Fallos encadenados:** algunas pruebas exigieron corregir el primer salto donde realmente se perdería el flujo (por ejemplo, caída del hub).
- **Interfaz gráfica:** se integró el trazador en **el simulador original** y se corrigieron controles poco evidentes, recargas de origen entre sedes y superposiciones visuales.
- **Alcance académico:** hubo que separar los comportamientos simulados de las validaciones que solo sería posible hacer con sistemas Cisco/PAN-OS reales.

## 5. Actividades y tareas pendientes

- Seguir afinando la experiencia visual y la usabilidad del modal de topología, especialmente con diferentes tamaños de pantalla.
- Ampliar los escenarios simulados de servicios, errores y recuperación con resultados deterministas y pruebas automatizadas.
- Revisar consistencia de consolas simuladas, direcciones, VLAN y rutas entre las **23 sedes**.
- Incorporar observaciones del docente; priorizar funcionalidades para la entrega final.
- Completar la documentación de funcionamiento, alcance, limitaciones y escenarios que cualquier evaluador pueda reproducir.
- Preparar y ensayar la defensa final utilizando la misma página web.

**Pendientes opcionales fuera del alcance académico:** despliegue con hardware físico, contratos de operadores, licencias reales, negociación IPsec en dispositivos y mediciones de rendimiento reales. No son condición para demostrar el progreso del simulador.

## Material entregado

- **Software ejecutable:** [simulador publicado](https://hu-herrera.github.io/fin/).
- **Código fuente versionado:** [repositorio público](https://github.com/hu-herrera/fin).
- **Evidencias de pruebas:** [ejecución GitHub Actions](https://github.com/hu-herrera/fin/actions/runs/38968500648).
- **Informe de avances:** este documento y su versión PDF adjunta al correo.
- **Guía técnica:** [demostración](guia-demostracion-simulador.md) y [README](../README.md).

**Conclusión:** el proyecto presenta un avance funcional y verificable: la red ficticia puede explorarse, modificarse y evaluarse en un simulador de navegador. La entrega es de **avance**, no se declara terminada la versión final.
