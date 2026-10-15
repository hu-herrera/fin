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
