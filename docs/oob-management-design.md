# Red de gestión OOB independiente — mejora opcional

**Estado: propuesta opcional, no presupuestada ni exigida para la topología principal.** El diseño base mantiene los dos C9200L de cada sede y la VLAN30 de gestión con acceso restringido y respaldo de consola. Esta alternativa OOB independiente complementaría el corte C8300 ↔ PA-1410 Layer3 ↔ StackWise-80, sin inventar interfaces del C8300 ni simular que existen switches de gestión.

## Esquema y direccionamiento por sede

Cada sede usa `10.73.N.0/28`, con N=0 para casa matriz y N=1..22 para sucursales. Todo el tráfico de administración va por **cables separados** del enlace de producción hacia un **switch OOB independiente**. Este switch necesita su propio gateway de gestión, preferentemente con salida alternativa si el router WAN principal falla.

| Reserva | IP en sede N | Equipo o función |
|---|---|---|
| Red de gestión | 10.73.N.0/28 | Red OOB privada, 14 hosts utilizables |
| Gateway OOB | 10.73.N.1 | **Equipo pendiente de adquisición/provisión** |
| Palo Alto PA-1410 MGT | 10.73.N.2 | Puerto MGT físico, distinto del agregado ae1/ae2 |
| Catalyst StackWise Mgmt-vrf | 10.73.N.3 | Gi0/0 del miembro activo; conectar OOB a ambos miembros |
| Cisco C8300 management | 10.73.N.4 | **Solo reserva**, pendiente confirmar interfaz/VRF con `show inventory` |
| Jump/bastión OOB | 10.73.N.5 | **Solo reserva**, no es un servidor actualmente instalado |
| Broadcast | 10.73.N.15 | No asignable |

La red OOB `10.73.N.0/28` **no pertenece** a las VLAN 10/20/30/40 ni al tránsito `10.72.N.0/30`; no se debe exportar mediante OSPF WAN de negocio.

## Cableado e inventario requerido

- **Solo si se adopta la mejora completa:** hasta 23 switches de gestión OOB, adicionales a los Catalyst existentes. No forman parte de la compra base.
- **Solo si se adopta la mejora completa:** hasta 23 gateways de gestión OOB con trayecto separado. No agregarlos al presupuesto base; su alcance y costo requieren una decisión explícita.
- Para cada sede, conectar MGT del PA-1410 al switch OOB y el puerto Gi0/0 de **ambos** miembros C9200L al mismo segmento de gestión mediante cableado independiente.
- La conexión de administración del C8300 queda pendiente de inspección del hardware físico exacto. No usar uno de los seis puertos que ya están asignados a WAN o AE1 sin rediseñar el inventario.
- Conservar acceso serial/consola de emergencia, DNS/NTP/AAA por rutas de servicio verificadas, jump hosts y un plan de recuperación local.

## Configuraciones candidatas por sede

Leer sin modificar equipos:

```bash
node network/export-candidate.cjs s01 oob
node network/export-candidate.cjs cm oob
node tests/oob-management.test.cjs
```

El exportador incluye direcciones PA MGT y gestión de Catalyst por `GigabitEthernet0/0` / `Mgmt-vrf`, pero **no produce** interfaz OOB del C8300, porque su nombre y soporte deben confirmarse en el equipo real. El estado `deployable:false` permanece mientras falten gateway, cableado y control de acceso.

## Seguridad y verificación de corte

1. Aislar el acceso OOB por cableado y control de puertos; no mezclar con VLAN30 del dataplane. Permitir SSH/HTTPS solo desde bastiones autorizados; integrar AAA y auditar accesos.
2. Probar `show ip route vrf Mgmt-vrf` / `show ip interface brief vrf Mgmt-vrf` en Catalyst. Comprobar que no existe fuga entre Mgmt-vrf y la tabla de negocio. En el stack la administración se mantiene por el miembro activo.
3. Probar el acceso al **MGT físico del Palo Alto**, su gateway y las rutas de servicio para DNS, NTP, licencias, logs y actualizaciones. PAN-OS utiliza MGT por defecto para servicios salvo rutas personalizadas.
4. Desconectar un cable de producción y un miembro LACP, sin perder el canal OOB de recuperación.
5. Cortar SW1 (stack member principal), comprobar elección de miembro activo y acceso OOB por Gi0/0 del segundo Catalyst. Cortar el firewall único no debe impedir gestionar el switch OOB.
6. Verificar autenticación, registro de accesos y rollback. Solo después de evidencias reales se habilita la migración Layer3 del tráfico productivo.

## Restricciones

- **La reserva de IP no instala gateway, servidores, firewall ni hardware.**
- El C8300 no se configura automáticamente con una interfaz de gestión inventada.
- Un único gateway/switch OOB por sede constituye otra dependencia de hardware. Para una alta disponibilidad real es necesario valorar su redundancia.
- Se necesitan rutas separadas desde el NOC. Si los enlaces de datos fallan, OOB solo permite gestión remota cuando su camino alternativo sigue disponible.

## Fuentes del fabricante

- [Cisco Catalyst 9200 — Ethernet Management Port y VRF](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/software/release/17-17/configuration_guide/int_hw/b_1717_int_and_hw_9200_cg/configuring_ethernet_management_port.html)
- [Palo Alto — utilización del puerto MGT dedicado](https://docs.paloaltonetworks.com/ngfw/getting-started/integrate-ngfws-into-your-network)
- [Palo Alto — service routes y MGT](https://docs.paloaltonetworks.com/ngfw/networking/configure-service-routes)
- [Cisco C8300 — especificaciones y variantes de hardware](https://www.cisco.com/c/en/us/products/collateral/routers/catalyst-8300-series-edge-platforms/datasheet-c78-744088.html)
