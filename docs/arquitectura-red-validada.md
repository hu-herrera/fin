# Arquitectura acordada — Financiera Pacífico

Estado: decisión de topología validada por el usuario el 15 de octubre de 2026. Este documento define el objetivo; NO certifica que el simulador ya lo implemente.

## Orden de tráfico
Proveedores WAN (Starlink / Amazon Leo / Entel 5G / GTD 4G) → Cisco C8300 (selección WAN, rutas y VPN) → Palo Alto PA-1410 (control perimetral y segmentación, modo operativo por validar) → switches Catalyst → usuarios.

## Conectividad física objetivo
- Dos cables Router ↔ Firewall.
- Dos cables Firewall ↔ SW1.
- Dos cables Firewall ↔ SW2.
- Dos cables SW1 ↔ SW2.
- El dibujo se actualizará al final, según petición explícita del usuario.

## Reglas técnicas obligatorias
- NO afirmar que dos cables equivalen automáticamente a EtherChannel, alta disponibilidad ni recuperación tras caída de equipo.
- LACP requiere agregación compatible en ambos extremos. Un port-channel no puede extenderse a dos Catalyst independientes sin una solución multichasis/stack admitida; validar modelos y licencias antes de elegir.
- Verificar modos PAN-OS: interfaces virtual-wire vs Layer3 y soporte efectivo de aggregate Ethernet/LACP; no inventar ni asumir una agregación entre firewall y dos switches independientes.
- Establecer política antibucles, distribución de VLAN, gateways y rutas antes de activar enlaces físicos adicionales.
- Probar por separado fallo de miembro LACP, fallo de switch, fallo del firewall, pérdida de salida ISP con gateway aún accesible y fallos IPsec/OSPF.
- NO inventar configuración operativa de fabricante ni afirmar pruebas físicas: el proyecto es un simulador web. Distinguir comandos objetivos, estado modelado y validación sobre hardware real.
- No sustituir claves de ejemplo por credenciales reales en el repositorio.

## Estado observado antes de correcciones
- index.html representa "Stack 10G" y a la vez genera switches independientes con solo Gi1/0/45 entre ellos.
- La CLI indica que no existe EtherChannel; las pruebas browser.spec.cjs verifican erróneamente esa ausencia.
- Router maneja gateways VLAN y Palo Alto virtual-wire: todavía NO se ha migrado a Layer 3.
- Hay discrepancias de failover WAN y peer/túneles IPsec que requieren auditoría.
- Seguimiento en issues #1 y #2.

## Orden de ejecución
1. Verificar compatibilidad real de modelos y definir topología lógica y esquema IP.
2. Implementar modelos de puertos, vínculos, agregaciones válidas, estados y fallas sin falsear comportamiento.
3. Ajustar configuraciones y CLI del router, Palo Alto y switches con controles de coherencia.
4. Añadir pruebas por sede y escenarios de fallo; no aceptar tests basados solamente en strings.
5. Revisar topología visual al final, tras concordancia funcional y documental.

## Avance implementado — 15 de octubre de 2026
- En `index.html`: Po1 SW1↔SW2 con LACP active en Gi1/0/45 y Gi1/0/46 de ambos Catalyst **independientes**, troncal VLAN 10,20,30,40 y native VLAN 999; gestión PA movida en el modelo de Gi1/0/46 a Gi1/0/44 en SW1. El grafo de conectividad acepta uno o dos miembros activos y cae solo cuando ambos miembros dejan de estar operativos.
- Diagnóstico dinámico: `show etherchannel summary` muestra `Po1(SU)` o `Po1(SD)` y el estado `(P)/(D)` de cada miembro; `show interfaces trunk` presenta el puerto lógico, y la consola permite `shutdown` de `interface Port-channel1`.
- `tests/browser.spec.cjs`: auditoría LACP y escenarios de fallo individual, corte total y recuperación para cada sede. Workflow `.github/workflows/validate-lan.yml` incorporado; **LAN/LACP aprobadas y suite general 17/17 aprobada** en commit `aed2e082` (GitHub Actions, 2026-10-16).
- **Límite de esta primera fase**: la redundancia de dos cables SW1↔SW2 NO protege ante la caída de SW1 ni ante la del único firewall. La topología visual todavía dice Stack 10G; se corregirá al final según lo pedido. Los dobles uplinks router/firewall/switches y el modo Layer 3 del PA siguen pendientes de implementación.

Referencias de fabricante:
- Cisco EtherChannel Catalyst 9200: https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/software/release/17-8/configuration_guide/lyr2/b_178_lyr2_9200_cg/configuring_etherchannels.html
- Cisco StackWise-80 C9200L: https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-stackwise-architecture-cte-en.html
- PAN-OS Aggregate Ethernet LACP y modos: https://docs.paloaltonetworks.com/ngfw/help/11-1/network/network-interfaces/aggregate-ethernet-ae-interface-group

## Restricción adicional verificada: puertos físicos C8300 y LACP al firewall
La ficha de Cisco para C8300-2N2S-4T2X especifica **4 puertos RJ45 de 1GbE y 2 puertos SFP+ de 10GbE**. El Cisco 8300 admite EtherChannel L3 (LACP) en puertos onboard, pero un mismo bundle debe tener miembros de velocidad compatible. Fuentes:
- https://www.cisco.com/c/en/us/products/collateral/routers/catalyst-8300-series-edge-platforms/cat-8300-8200-series-edge-plat-og.html
- https://www.cisco.com/c/en/us/products/collateral/networking/sdwan-routers/8000-series-secure-routers-faq.html

**Asignación modelada actual:** Gi0/0/0 = conexión LAN hacia PA; Gi0/0/1 Starlink, Gi0/0/2 Leo, Gi0/0/3 5G, Te0/0/4 4G. Por tanto, los puertos integrados no dejan otro 1GbE libre para un LACP 2x1GbE Router↔PA sin reasignación del cableado y/o un NIM adecuado. No agregar ficticiamente un segundo Gi0/0/x. Antes de migrar PA a Layer3, cerrar un plan de puertos que preserve cuatro WAN y dos enlaces a firewall, verificando transceptores, módulos y velocidades negociadas.

## Evidencia de integración automática
- Validación general (17/17): https://github.com/hu-herrera/fin/actions/runs/38827619114
- Validación LAN/LACP: https://github.com/hu-herrera/fin/actions/runs/38827619121
- Publicación GitHub Pages: https://github.com/hu-herrera/fin/actions/runs/38827617977
- Cobertura: verificación de simulación y consistencia, no pruebas sobre hardware físico ni garantía de disponibilidad ante fallos de un equipo completo.
