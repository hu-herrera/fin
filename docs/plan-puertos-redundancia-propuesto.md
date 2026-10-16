# Plan físico candidato — redundancia completa de enlaces y switches

**Estado: PROPUESTA VALIDADA CONTRA FICHAS TÉCNICAS; NO implementada en el simulador actual.**
La topología gráfica se corregirá **al final**, por petición del usuario. El perfil desplegado actualmente en `index.html` sigue siendo un router-on-a-stick + PA virtual-wire + dos switches independientes con Po1 inter-switch, cuya redundancia cubre **solo caída de un cable entre switches**.

## Arquitectura candidata más sólida para la maqueta
WAN (4 ISP) → Cisco C8300 → Palo Alto PA-1410 **Layer 3** → stack lógico de dos C9200L con StackWise-80 → clientes.

| Conexión | Interfaces físicas candidatas | Velocidad | Agregación |
|---|---|---:|---|
| Starlink → C8300 | Gi0/0/0 | 1G | WAN independiente |
| Amazon Leo → C8300 | Gi0/0/1 | 1G | WAN futura |
| Entel 5G → C8300 | Gi0/0/2 | 1G | WAN independiente |
| GTD 4G → C8300 | Gi0/0/3 | 1G | WAN independiente |
| C8300 ↔ PA-1410 | Te0/0/4 ↔ ethernet1/19, Te0/0/5 ↔ ethernet1/20 | 2 × 10G | C8300 Port-channel10 / PA ae1, L3 LACP, pendiente validar IOS-XE y transceptores concretos |
| PA ↔ SW1 | ethernet1/3 ↔ Gi1/0/45, ethernet1/4 ↔ Gi1/0/46 | 2 × 1G | PA ae2 / Stack Po20 |
| PA ↔ SW2 | ethernet1/5 ↔ Gi2/0/45, ethernet1/6 ↔ Gi2/0/46 | 2 × 1G | mismos ae2 / Po20 (MEC solo porque hay StackWise) |
| SW1 ↔ SW2 | 2 cables **StackWise** por los puertos traseros dedicados | StackWise-80 | anillo de stack, **NO** EtherChannel en Gi45/46 |

Los cuatro miembros PA↔stack convergen en **una sola agregación lógica** hacia un stack unificado. No usar un único LAG hacia dos switches independientes. La selección de puertos del PA-1410 es compatible con 10G en e1/19–22 y 1G en e1/1–8; la compra de DAC/SFP+ y cables StackWise debe cotizarse aparte.

## Cambios de Capa 3 por implementar (sin inventar comandos activos)

- C8300: 4 WAN RJ45; tránsito L3 a PA sobre Po10. Mantener lógica de failover WAN, NAT/VPN solo donde corresponda tras definir rutas. Retirar subinterfaces LAN Gi0/0/0.{10,20,30,40} del router cuando migren los gateways.
- PA: ae1 (L3) de tránsito con el router y ae2 (L3) hacia el stack; gateways VLAN10/20/30/40 en subinterfaces de ae2. Definir zonas, políticas inter-VLAN y ruta por defecto al router. Elegir protocolo de distribución de rutas entre PA y Cisco, con validación de seguridad.
- SW: stack de dos miembros C9200L. Un solo plano lógico L2 de control, Po20 *multi-chassis* entre PA y los dos miembros. STP según topología realmente implementada. No configurar Po1 de inter-switch en los puertos de usuario si se está usando StackWise trasero.
- Gestión: **bloqueador a resolver**. No asignar la misma subred `10.70.N.160/28` simultáneamente a la interfaz de gestión OOB del PA y a su interfaz de datos L3. El acceso de gestión fuera de banda y su gateway deben definirse antes de migrar IP del PA.
- CM: estudiar par HA real de firewalls (HA1/HA2), core y routers. Un solo PA sigue siendo **punto único de falla**, aunque todos los enlaces de datos sean dobles.
- Convergencia: un cable LACP caído debe conservar el servicio; caída completa SW1 debe preservar solo equipos físicamente conectados al SW2; caída del PA único debe cortar ambos, nunca declarar HA total.

## Matriz mínima de pruebas para aceptación
1. Normal: todos los miembros LACP/StackWise activos y VLAN consistentes.
2. Un cable de cualquiera de los dos LAG caído → servicio conservado por miembros restantes.
3. Un cable StackWise caído → anillo degradado, stack en funcionamiento sujeto a validación; dos caídos → partición del stack, sin asumir conectividad.
4. SW1 fuera de servicio → PCs cableados a SW1 caen; PCs de SW2 siguen llegando al PA por sus cables directos.
5. SW2 fuera de servicio → simétrico al caso anterior.
6. PA fuera de servicio → caída del perímetro (falta un segundo PA y HA).
7. ISP con gateway local accesible pero Internet aguas arriba caído → seguimiento remoto debe disparar failover.
8. Sobre el hardware: comprobar `show etherchannel summary`, `show switch stack-ports`, `show spanning-tree`, `show ip route`, `show crypto ikev2 sa` y salidas PAN-OS.

## Fuentes del fabricante
- Cisco C8300 (4×1G + 2×10G): https://www.cisco.com/c/en/us/products/collateral/routers/catalyst-8300-series-edge-platforms/cat-8300-series-edge-qa.html
- Cisco puertos físicos 0/0/0..5: https://www.cisco.com/c/en/us/td/docs/routers/cloud_edge/c8300/hardware_installation/b-catalyst-8300-series-edge-platforms-hig.pdf
- Cisco StackWise-80, dos puertos traseros y MEC: https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-stackwise-architecture-cte-en.html
- PA-1410 puertos 1G y 10G: https://origin-docs.paloaltonetworks.com/hardware/pa-1400-hardware-reference/pa-1400-series-overview/front-panel-1400-series
- PAN-OS LACP e interfaces AE Layer3: https://docs.paloaltonetworks.com/ngfw/networking/configure-interfaces/configure-an-aggregate-interface-group
- PAN-OS virtual-wire **sin LACP local**: https://docs.paloaltonetworks.com/ngfw/networking/configure-interfaces/virtual-wire-interfaces

## Decisión de implementación
No modificar el cableado o los puertos activos del simulador hasta migrar de forma **atómica y probada** los cambios de router, firewall, stack, VLAN, NAT, OSPF, consolas y escenarios. Las pruebas verdes de la topología anterior no prueban la topología candidata.
