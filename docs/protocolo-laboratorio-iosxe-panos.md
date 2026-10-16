# Protocolo de aceptación técnica IOS-XE / PAN-OS — Financiera Pacífico

**Fecha:** 16 octubre 2026  
**Estado:** preparado para recopilar evidencia real; **NO ejecutado en hardware/CML/PAN-OS**.  
**Versión de la arquitectura:** C8300 Po10 (2×10G) → PA-1410 ae1 Layer3; PA ae2 (4×1G) → C9200L StackWise-80 Po20 MEC.  
**Alcance:** 23 sedes, 23 C8300, 23 PA-1410 y 23 stacks de dos C9200L.

## Base comprobada y límites

- [Pruebas publicadas](https://github.com/hu-herrera/fin/actions/runs/38875249803): **45/45 Playwright**, 185 fallas simuladas, 2.029 aserciones de redundancia, 2.674 de plantillas Cisco/PAN/StackWise, 911 de políticas, 1.274 intersede, 1.168 IP SLA y 784 OOB opcional; auditoría IPAM para 650 PCs.
- Documentación del fabricante: [Cisco StackWise y MEC](https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-stackwise-architecture-cte-en.html), [Cisco gestión StackWise](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/software/release/17-13/configuration_guide/ha/b_1713_stck_mgr_ha_9200_cg/managing_switch_stacks.html), [Cisco NAT vía route-map](https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-routing/b-ip-routing/m_pfr-nat-0.html), [Palo Alto LACP](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA10g000000ClG8CAK), [PAN-OS AE](https://docs.paloaltonetworks.com/ngfw/networking/configure-interfaces/configure-an-aggregate-interface-group) y [CiscoDevNet IOS Patterns](https://github.com/CiscoDevNet/skills/blob/main/skills/ios/cisco-ios-patterns/SKILL.md).
- **Nunca pegar el exportador `network/export-candidate.cjs` en producción.** Sus configuraciones contienen placeholders, carecen de parámetros WAN y credenciales, y no representan equipos reales.

## 1. Captura de línea base: Cisco C8300 (solo lectura)

Ejecutar en cada router (CM, S01–S22), guardando la salida sin claves privadas:

```text
terminal length 0
show version
show inventory
show ip interface brief
show interfaces Port-channel10
show etherchannel summary
show running-config interface Port-channel10
show ip route
show ip protocols
show ip prefix-list
show route-map
show ip ospf interface brief
show ip ospf neighbor
show crypto ikev2 sa
show crypto ipsec sa
show ip sla statistics
show track
show ip nat translations
show logging
```

**Aceptación:** `Port-channel10` con dos miembros físicos `Te0/0/4` y `Te0/0/5`, IP tránsito `10.72.N.1/30`; enlace hacia `10.72.N.2` accesible. Rutas estáticas LAN por Palo Alto, VLAN40 no exportada a OSPF. Las interfaces de túnel esperadas no deben estar pasivas en OSPF. La presencia de una ruta por defecto NO demuestra VPN ni salida Internet; requieren SAs y pruebas autorizadas. Si no hay parámetros WAN/peers reales, declarar **BLOQUEADO**.

## 2. Captura de línea base: StackWise Cisco C9200L (solo lectura)

Consola del **stack lógico**, no configurar como dos switches independientes:

```text
terminal length 0
show version
show inventory
show switch detail
show switch stack-ports summary
show etherchannel summary
show interfaces trunk
show vlan brief
show spanning-tree summary
show ip interface brief
show running-config interface Port-channel20
show logging
```

**Aceptación:** dos miembros `Ready`, cables traseros `Link OK / Active`, `Po20` con `Gi1/0/45–46` y `Gi2/0/45–46` LACP bundled, nativa 999 y permitidas 10,20,30,40. Única gestión `Vlan30 10.70.N.162/28`. Si se cae un miembro, solo deben perder servicio sus puertos físicamente conectados, no los del otro miembro.

## 3. Palo Alto PA-1410 (solo lectura)

Ejecutar en la CLI operativa de PAN-OS; la sintaxis de comandos adicionales depende de versión instalada:

```text
show system info
show interface all
show lacp aggregate-ethernet all
show routing route
show session info
show running security-policy
show jobs all
```

**Aceptación:** `ae1` con `ethernet1/19` y `ethernet1/20` a 10G; `ae2` con `ethernet1/3–6` a 1G, todos con LACP operativo. `ae1 10.72.N.2/30`, `ae2.10/.20/.30/.40` con gateways definidos, zonas separadas; default `10.72.N.1`. Registrar validación de commit, políticas efectivas de mínimo privilegio y sus hit counters. Los perfiles de Threat Prevention, licencias y estado HA deben verificarse, no deducirse de la plantilla.

## 4. Ensayos en laboratorio aislado (no en producción)

| Ensayo | Expectativa | Evidencia mínima |
|---|---|---|
| Desconectar un miembro del Po10 | Tránsito continúa sobre el otro enlace | Cisco EtherChannel / PA LACP antes y después |
| Desconectar un miembro del Po20 | Gateway sigue accesible vía miembros restantes | Po20/LACP y ping local al gateway |
| Desconectar un cable StackWise | Stack continúa en modo anillo degradado sujeto a versión/hardware | `show switch stack-ports summary` y tráfico intermiembro |
| Caer SW1 completo | Solo PCs de SW1 pierden su puerto; SW2 sigue | Estado miembros y pruebas desde SW2 |
| Caer PA único | LAN L2 misma VLAN conserva switching local; gateway/WAN e inter-VLAN caen | Ping intra-VLAN y distinto VLAN |
| Caer C8300 único | LAN local con PA sigue; WAN/overlay pierden salida | Rutas, ping local y externo |
| WAN primaria pierde upstream pero su gateway responde | IP SLA remoto detecta fallo y usa backup válido | `show ip sla statistics`, `show track`, RIB |
| Tumbar túnel IPsec/OSPF | Se retiran rutas remotas sin caer Internet local | Estado IKE/IPsec/OSPF y RIB |
| Tráfico intersede no aprobado | Denegado en PAN-OS, no basta que WAN esté UP | Regla, hit/log de denegación |
| DNS/NTP de sucursales a CM | Permitidos solo a IP/servicios aprobados | Tráfico y logs en ambos PA, servidor real |

**Seguridad de prueba:** respaldar configuraciones, habilitar consola/reversión y controlar ventana de mantenimiento; no desactivar firewalls o ACL para simular «conectividad». Solo guardar la configuración IOS-XE/commit PAN-OS después de validar cada cambio.

## 5. Bloqueadores que todavía no se pueden resolver desde GitHub

1. Versión y licencia IOS-XE/PAN-OS, transceptores, cables StackWise, `show inventory` reales.
2. Direccionamiento, MTU, modo DHCP/CGNAT, gateways y probes autorizados de cada operador; Amazon Leo no se considera desplegado.
3. Peers/identidades/secretos IPsec, negociación NAT-T, pruebas de interoperabilidad IOS-XE y adyacencias OSPF reales.
4. Servidores DNS/NTP/AAA, matriz de aplicaciones financieras autorizadas, políticas de seguridad, inspección/firmas y registros de eventos reales.
5. Capacidad de telefonía: VLAN20 /27 = 30 hosts por sede; **casa matriz necesita revisión si se instala más de un teléfono por cada uno de sus 55 puestos**. VLAN40 /28 = 14 invitados simultáneos como máximo sin rediseño. No inventar teléfonos/invitados que no figuran en el inventario.
6. Disponibilidad de equipos: un C8300 y un PA por sede continúan siendo puntos únicos de falla; Po10/Po20 no los redundan. La opción OOB es separada y no debe sumarse al presupuesto base.

## 6. Estado final por sede

**SIMULADOR: PASS** (alcance de CI). **IOS-XE REAL: PENDIENTE**, **PAN-OS REAL: PENDIENTE**, **STACK FÍSICO: PENDIENTE**, **OPERADORES/VPN: BLOQUEADO POR DATOS Y LABORATORIO**. No emitir acta de certificación física hasta que se entreguen las evidencias y los ensayos indicados.
