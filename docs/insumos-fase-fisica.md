# Hoja única de insumos para la fase 2 — despliegue y aceptación

**No hace falta pedir estos datos por turnos separados.** Son todos los insumos reales que debe proporcionar el responsable de redes/proveedores para pasar del simulador al laboratorio certificado. Este documento **no declara equipos comprados, contratos vigentes ni credenciales disponibles**.

## Por cada una de las 23 sedes

| Evidencia/dato imprescindible | Detalles de aceptación |
|---|---|
| Inventario real Cisco/Palo Alto | SKU, números de puertos, módulos/transceptores, versión firmware, licencias, cableado, capacidad Po y 2 miembros StackWise |
| WAN (Starlink / Leo / Entel / GTD) | Operador contratado, tecnología, provisión en Chile, IP pública o CGNAT, CPE/modo bridge, máscara, gateway, MTU, VLAN, DNS, restricciones UDP/500/4500 |
| SLA por WAN | Dos objetivos reales de sondeo autorizados por ISP, método de prueba, latencia, RTT, pérdida, criterios de transición/failback, horas/soporte |
| Concentrador VPN | FQDN/IP alcanzable y propiedad del extremo; capacidades IKEv2, NAT-T, propuestas criptográficas y SA; intercambio de credenciales por gestor de secretos |
| Ruteo entre sedes | Subred/ID de cada Tunnel100/200/300/400, costos OSPF, vecinos FULL, rutas de retorno a VLAN10/20/30 y Loopback0, failover y ausencia de fuga VLAN40 |
| Switches/Po | Compatibilidad modelo/línea, LACP Po10 y Po20 operativos, anillo StackWise, cuatro adaptadores y dos cables por sede o inventario equivalente verificado |
| Segmentación/DHCP | Confirmar PCs con IP estática vs plan de migración; scopes/relay, DNS, VLAN40, APs, opción de telefonía y números de terminales de voz |
| Servidores centrales | DNS `.110/.111`, NTP `.116/.117`, TACACS `.112/.113`, Syslog TLS `.100`, monitor `.101`: propietario, sistema, licencia, backup y prueba desde cada red |
| Gestión segura | IP/jump host autorizado del PA o MGT OOB independiente, ACL, certificados HTTPS/SSH, cuenta de emergencia, ruta de service routes, acceso físico/consola |
| Observabilidad | Syslog TLS con certificados y retención, SNMPv3 authPriv RO con usuarios/keys fuera de Git, monitor y alarmas, pruebas de eventos y recuperaciones |
| Políticas financieras | Por aplicación: propietario, PC/subred origen aprobada, servidor IP real, puerto, App-ID, perfil de amenazas, logs, aprobación formal y prueba funcional |
| Pruebas e informe | `show` reales depurados, `commit validate` PAN-OS, captures aprobadas, ensayos de cable, switch, firewall, router y WAN, restauración, respaldo y acta |

## Casa matriz: decisiones extra

La casa matriz necesita conectividad real estable y **endpoint de hub IPsec alcanzable** desde sedes potencialmente detrás de CGNAT. Si el C8300/PA central no dispone de un servicio entrante direccionable debe elegirse un overlay gestionado o concentrador en un lugar con IP pública, presupuestarlo y probarlo. No contratar un servicio satelital de otra jurisdicción como atajo para activar cobertura donde no existe.

También es necesaria una decisión sobre **HA real**: si se exige supervivencia a la caída de un C8300 o un PA-1410, hacen falta más equipos o rediseño y presupuesto. No atribuir ese resultado a StackWise ni EtherChannel. Para voz, CM tiene 55 PCs y la VLAN20 /27 de diseño solo deja 29 concesiones DHCP; verificar el inventario real de teléfonos antes de aprobar la solución.

## Método de entrega sin contraseñas

1. Por cada sede, adjuntar datos no secretos y evidencias sanitizadas bajo el esquema de aceptación; nunca publicar PSK, claves privadas, usuarios protegidos, seriales sensibles ni volcados de configuración que contengan secretos.
2. Exportar los candidatos mediante `network/export-candidate.cjs` únicamente después de aceptar y verificar sus parámetros. El directorio `evidencia-local/` está ignorado por Git.
3. Capturar `show` de C8300, stack y PA y ejecutar `node network/verify-lab-evidence.cjs s01 ./evidencia-local/s01`; verificar personalmente las alertas restantes y registrar resultados del laboratorio.
4. Descargar el artefacto `acceptance-23-sites.json` desde GitHub Actions para cruzar los bloqueos por sitio. Sigue siendo **modelo, no certificado** hasta la aceptación física.

No es necesario más trabajo de codificación para **pedir** estos datos; sí serán necesarias las configuraciones de equipo y pruebas específicas después de obtenerlos.
