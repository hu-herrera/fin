# Datos necesarios para activar IP SLA Cisco por cada ISP

**ESTADO: contrato por verificar — la topología principal sigue usando pruebas simplificadas de gateway.** Este archivo acompaña al generador `network/wan-sla-candidate.cjs`, que **no genera comandos** si falta información o si el destino de monitoreo es inválido.

## Qué necesitamos del proveedor

Para cada sede y para Starlink, Amazon Leo, Entel 5G y GTD 4G, confirmar:
- IPv4 WAN entregada al C8300 y máscara/prefijo efectivo (si usa DHCP o /32 celular, solicitar diseño específico).
- Gateway o next-hop efectivo y posibilidad de utilizar rutas host `/32` hacia él.
- Dos destinos externos ICMP alcanzables **por ese proveedor** (distintos para los ocho monitores de la sede), y permiso de monitoreo continuo.
- Qué comportamiento y direccionamiento habrá bajo CGNAT, roaming 5G/4G y enlaces satelitales; IPsec IKEv2 podría requerir iniciarse desde la sucursal tras NAT.
- DNS, MTU/MSS, latencia, pérdida normal y umbrales de recuperación medidos; no aplicar temporizadores agresivos sin línea base.

**No asumir que Amazon Leo funciona en Chile por haber contratado un servicio extranjero.** Su disponibilidad y la activación física del terminal en Chile deben ser confirmadas.

## Formato de datos JSON obligatorio

Crea un archivo local `monitores-s01.json` con cuatro objetos. Sustituye todos los campos de ejemplo por valores de contrato o laboratorio autorizado:

```json
{
  "starlink": {"address":"REEMPLAZAR_IP_WAN","gateway":"REEMPLAZAR_GATEWAY","prefix":30,"monitors":["REEMPLAZAR_DESTINO_1","REEMPLAZAR_DESTINO_2"]},
  "leo": {"address":"REEMPLAZAR_IP_WAN","gateway":"REEMPLAZAR_GATEWAY","prefix":30,"monitors":["REEMPLAZAR_DESTINO_3","REEMPLAZAR_DESTINO_4"]},
  "entel5g": {"address":"REEMPLAZAR_IP_WAN","gateway":"REEMPLAZAR_GATEWAY","prefix":30,"monitors":["REEMPLAZAR_DESTINO_5","REEMPLAZAR_DESTINO_6"]},
  "gtd4g": {"address":"REEMPLAZAR_IP_WAN","gateway":"REEMPLAZAR_GATEWAY","prefix":30,"monitors":["REEMPLAZAR_DESTINO_7","REEMPLAZAR_DESTINO_8"]}
}
```

El prefijo `30` es **ejemplo de laboratorio**, no una afirmación sobre el contrato de cada operador. Este generador valida redes estáticas con gateway en el mismo segmento; **no se puede utilizar sin modificar el diseño** si el operador emplea PPPoE, DHCP con gateway especial o `/32` en 4G/5G.

El archivo de ejemplo falla deliberadamente la validación; no produce configuraciones instalables.

## Exportar sin modificar Cisco

```bash
node network/export-candidate.cjs s01 wan-sla ./monitores-s01.json
node tests/wan-sla-candidate.test.cjs
```

Una vez verificados los campos, la salida de Cisco incluye:
- La configuración estática `interface GigabitEthernet0/0/x`, `ip address` con máscara derivada del prefijo, `ip nat outside` y `no shutdown`. Esto solo cubre **contratos de IPv4 estática con gateway del mismo segmento**; no sustituye el aprovisionamiento de módem/terminal ni la configuración óptica o radio.

- Cuatro rutas default con AD 1/10/20/30 y seguimiento mediante `track 1..4`.
- Ocho `ip sla` ICMP (dos destinos remotos por ISP).
- Una ruta host `/32` fija por monitor, hacia el gateway del ISP correspondiente, impidiendo que un backup haga parecer sana la conexión primaria.
- `track ... list boolean or`: el enlace se considera operativo cuando al menos uno de sus dos destinos responde. `delay up 300 down 10` es **hipótesis de laboratorio**, a calibrar por pérdidas, handovers y RTT de cada ISP.
- Pruebas previas a guardar configuración: `show ip sla statistics`, `show track`, `show ip route 0.0.0.0`, simulación de caída upstream con gateway accesible y restauración estable.

Una ruta `/32` dirigida a un objetivo de prueba debe ser única por ISP; repetir el mismo destino en distintos ISP puede ocasionar rutas ambiguas y resultados inválidos. El test del repositorio rechaza duplicados, IP no públicas o de documentación, destinos sin monitor y gateway fuera de subred.

**La salida NO incluye por sí sola VPN, NAT, políticas de Palo Alto ni alta disponibilidad física y requiere validación sobre IOS-XE/operadores.**

## Referencias
- [Cisco IP SLA ICMP echo IOS-XE](https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-addressing/b-ip-addressing/m_sla_icmp_echo.html)
- [Cisco Enhanced Object Tracking, boolean OR](https://www.cisco.com/c/en/us/td/docs/routers/ios-xe/ip-addressing/ip-addressing/m_iap-eot-xe.html)
- [Cisco IOS patterns / skill, revisión segura](https://github.com/CiscoDevNet/skills/blob/main/skills/ios/cisco-ios-patterns/SKILL.md)

## Verificaciones de direcciones de host
- Las IP del router y gateway deben pertenecer a la misma red WAN, pero no pueden ser iguales, direcciones de red ni direcciones de broadcast.
- Se rechazan también IPv4 mal formadas, prefijos no soportados y objetivos ICMP públicos duplicados o reservados para documentación.
- La salida muestra direcciones **introducidas por el operador/usuario**; este proyecto no puede certificar que el proveedor las haya asignado realmente.
