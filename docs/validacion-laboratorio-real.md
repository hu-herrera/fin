# Evidencia de laboratorio real (IOS-XE / PAN-OS)

**Estado:** no se dispone de sesiones físicas ni de imágenes licenciadas de IOS-XE, PAN-OS o CML en el entorno de esta revisión. Las pruebas del simulador **no son certificación de hardware**.

## Cómo ejecutar la puerta de aceptación (solo lectura)

El verificador `network/verify-lab-evidence.cjs` **no se conecta por SSH, no modifica equipos y no almacena claves**. Lee tres capturas de consola reales y emite un dictamen por requisito, con `PASS` o `BLOCKED`.

1. Crea localmente (NO en el repositorio público) `evidencia-local/s01/`.
2. En `router.txt` pega las respuestas de `show version`, `show etherchannel summary`, `show ip interface brief`, `show ip route`, `show ip ospf neighbor` y `show crypto ipsec sa`. Conserva los encabezados de los comandos.
3. En `stack.txt` pega las respuestas de `show version`, `show switch detail`, `show etherchannel summary` y `show ip interface brief`.
4. En `palo.txt` pega `show system info`, `show interface all`, `show lacp aggregate-ethernet all`, `show routing route` y `show running security-policy`.
5. Ejecuta:
   ```bash
   node network/verify-lab-evidence.cjs s01 ./evidencia-local/s01
   ```

Usa `cm` para casa matriz y `s01` a `s22` para sucursales. Sin capturas o con textos del simulador el resultado queda **INCOMPLETE / BLOCKED** y el proceso devuelve código 2. Incluso cuando los 16 controles encuentran evidencia textual, el resultado es **READY_FOR_HUMAN_LAB_REVIEW**, nunca una certificación automática.

**Privacidad:** limpia contraseñas, tokens, PSK, certificados, direcciones públicas sensibles y números de serie cuando corresponda. Evita subir capturas a GitHub Pages y conserva los originales en un almacenamiento autorizado y protegido. Mantén el SHA/versiones del firmware y la fecha de cada prueba en el acta fuera del repositorio.

## Qué se valida y qué no

- Se detectan el modelo declarado, el Po10 del router con dos miembros, IP de tránsito, ruta LAN, vecino OSPF FULL y contadores IPsec.
- En el stack se revisan dos miembros Ready, Po20 con cuatro interfaces bundled y la SVI de gestión.
- En Palo Alto se buscan el modelo, ae1, ae2.30, miembros LACP, ruta por defecto y las políticas restrictivas.
- Un extracto de texto **no prueba** que el hardware, los transceptores, los enlaces, las licencias o el plano de datos sean correctos: se requieren ensayos reales de continuidad, pérdida/restauración y revisión humana en la plataforma instalada.

## Fuentes de configuración y restricciones

- [Cisco IOS Patterns / procedimiento seguro](https://github.com/CiscoDevNet/skills/blob/main/skills/ios/cisco-ios-patterns/SKILL.md).
- [PAN-OS jerarquía CLI 11.1](https://docs.paloaltonetworks.com/ngfw/pan-os-cli-quick-start/cli-command-hierarchy/pan-os-11-1-configure-cli-command-hierarchy).
- [Palo Alto administración sobre interfaces Layer3](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA10g000000ClMfCAK).
- [Palo Alto grupos Aggregate Ethernet](https://docs.paloaltonetworks.com/ngfw/networking/configure-interfaces/configure-an-aggregate-interface-group).
- [Cisco EtherChannel C8300 — según versión/modo IOS-XE](https://www.cisco.com/c/en/us/td/docs/routers/sdwan/17-x/systems-interfaces/systems-interfaces-guide-17-x/etherchann.html).
- [Protocolo de ensayo y aceptación](protocolo-laboratorio-iosxe-panos.md).

**Pendientes no sustituibles con scripts:** versión exacta de IOS-XE/PAN-OS, compatibilidad de LACP en el modo configurado, commit validate, pruebas de IPsec con peers reales, direccionamiento ISP, políticas financieras autorizadas, recuperaciones de fallos físicas y firmas de aceptación.
