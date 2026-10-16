# Cierre de detalles de red: DHCP de invitados y BOM StackWise

**Estado — 16 octubre 2026:** la vista DESPUÉS del simulador conserva 23 sedes, 650 PCs con IP simuladas y esquema C8300 → PA-1410 L3 → dos Catalyst C9200L StackWise. **No se ha aprovisionado servicio DHCP ni se han comprado/verificado accesorios físicos mediante este trabajo.**

## 1. DHCP en VLAN40: por qué no va en Cisco

Las VLAN 10, 20, 30 y 40 tienen sus gateways en subinterfaces **ae2 del PA-1410**. Por tanto, el Cisco C8300 no recibe los broadcasts DHCP de los clientes de Wi-Fi invitados. La solución es una de estas alternativas, nunca ambas simultáneamente en una misma interfaz:

- **Servidor DHCP local en PA** para VLAN40, con un pool que no incluya network, gateway ni broadcast.
- **Relay DHCP en PA** hacia servidores existentes, pero solo tras confirmar rutas, políticas y reachability de los servidores DHCP, y el gateway entregado a cada cliente.

Fuentes: [PAN-OS DHCP](https://docs.paloaltonetworks.com/ngfw/networking/dhcp), [Configurar PA como servidor DHCP](https://docs.paloaltonetworks.com/ngfw/networking/dhcp/configure-an-interface-as-a-dhcp-server) y [CLI PAN-OS 11.1 — comandos DHCP](https://docs.paloaltonetworks.com/ngfw/pan-os-cli-quick-start/cli-command-hierarchy/pan-os-11-1-configure-cli-command-hierarchy).

### Generador local opcional, sin automatizar cambios

```bash
node network/export-candidate.cjs s01 guest-dhcp ./invitados-s01.json
```

Ejemplo **exclusivamente ilustrativo**, sin representar un plan contratado/verificado:

```json
{
  "approvedGuestDhcp": true,
  "verifiedPublicDns": true,
  "start": "10.70.1.178",
  "end": "10.70.1.190",
  "dnsPrimary": "1.1.1.1",
  "dnsSecondary": "9.9.9.9",
  "expectedGuests": 10
}
```

Las banderas de aprobación son **declaraciones manuales**: el software no puede probarlas. No utilizar este ejemplo como autorización real. Se requiere un inventario de AP/clientes, políticas de aislamiento Wi-Fi, DNS efectivo y evidencia del PAN-OS de destino antes del commit.

El plan VLAN40 es `10.70.N.176/28`: network **.176**, gateway **.177**, rango DHCP máximo **.178–.190** (13 clientes) y broadcast **.191**. El generador rechaza pools fuera del segmento, DNS privados, DNS de documentación o idénticos y más clientes que leases. No modifica automáticamente el firewall ni la interfaz web; el simulador sigue con PCs asignados estáticamente.

**Seguridad:** la política existente permite DNS/HTTP(S) a Internet para invitados, pero rechaza redes privadas RFC1918, por lo que los DNS entregados a invitados deben ser públicos y la salida NAT del C8300 debe estar efectivamente operativa. La existencia del pool no constituye una prueba de acceso WAN.

## 2. DHCP para VLAN10 y voz VLAN20: faltante a decidir

Actualmente **no existe servidor ni relay DHCP activo documentado** para estaciones corporativas o teléfonos. Los 650 PCs del simulador tienen IP predeterminada y no usan DHCP. Si la tesis requiere configuración dinámica en la red física, deben reservarse scopes, DNS, gateways, VLANs, DHCP option para telefonía según fabricante y un servidor/relay real. No colocar `ip helper-address` en el C8300 para VLANs que termina el Palo Alto.

VLAN20 es `/27` (30 direcciones utilizables): antes de adquirir teléfonos IP, confirmar la cantidad real por sede. El simulador detecta advertencia en casa matriz si se asume un teléfono por cada puesto; no inventa teléfonos instalados.

## 3. Componentes obligatorios para materializar StackWise-80

Según [Cisco Catalyst 9200 Series Data Sheet](https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html), el **C9200L-STACK-KIT** incluye **dos adaptadores de stack y un cable**. El diseño tiene **dos conexiones traseras** por stack de **dos C9200L**, por lo que el inventario mínimo derivado es:

| Elemento físico | Por sede | Para 23 sedes |
|---|---:|---:|
| C9200L-48T-4G | 2 | 46 |
| Adaptadores StackWise-80 | 4 | 92 |
| Cables traseros de StackWise | 2 | 46 |
| Kits C9200L-STACK-KIT (mínimos, sujetos a cotización del suministro) | 2 | 46 |

Estas son **cantidades técnicas**, no compras realizadas ni precios. Comprobar si el proveedor incluye los kits/cables; no agregarlos doblemente a una cotización que ya los incluya. Verificar en inventario, licencia/versión compatibles, cableado y `show switch stack-ports summary`.

La decisión de no incorporar switches de gestión OOB adicionales no se altera: OOB independiente sigue siendo una opción fuera del diseño base.

## 4. Pruebas agregadas a CI

`node tests/guest-dhcp.test.cjs` valida candidatos de 23 sedes, comprobando gateway, máscara, límites del pool, DNS, aprobación explícita y rechazo de configuraciones inseguras. `node tests/ipam-capacity.test.cjs` audita la ocupación de los 650 PCs, límites de VLAN, puertos de acceso y ahora la cantidad mínima de kits StackWise.

**Criterio de cierre real:** comprobar concesiones DHCP a clientes de prueba y conectividad DNS/NAT/Internet, además de StackWise físico operativo. Las comprobaciones actuales son estáticas y de simulador.
