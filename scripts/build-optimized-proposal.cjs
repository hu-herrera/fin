'use strict';
// Deriva la decisión B de las referencias históricas; no modifica el simulador.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = JSON.parse(fs.readFileSync(path.join(root, 'docs/dimensionamiento-propuesta-2026-10-17.json'), 'utf8'));
const phone = base.alternative_phone;
assert.equal(base.scope.initial_locations, base.capacity_per_site.length);
assert.equal(base.capacity_per_site.reduce((n, s) => n + s.pcs, 0), 650);
assert.equal(base.priced_lines.reduce((n, s) => n + s.reference_extended_clp, 0), base.results.priced_reference_subtotal_clp);
assert.ok(base.priced_lines.every(s => s.reference_extended_clp === s.quantity * s.reference_unit_clp));
const priced = base.priced_lines.filter(s => s.id !== 'router_branch').map(s => s.id === 'phone' ? {
  id: 'phone', sku: phone.sku, quantity: phone.quantity,
  source_unit_price: phone.unit_clp_iva_included_as_published, currency: 'CLP',
  reference_unit_clp: phone.unit_clp_iva_included_as_published,
  reference_extended_clp: phone.quantity * phone.unit_clp_iva_included_as_published,
  source: phone.price_source,
  note: 'Modelo preferido para diseño; oferta de soporte 5 años + sexto separado y piloto PBX pendientes'
} : s);
const subtotal = priced.reduce((n, s) => n + s.reference_extended_clp, 0);
const routerSaving = base.priced_lines.find(s => s.id === 'router_branch').reference_extended_clp;
const phoneSaving = base.priced_lines.find(s => s.id === 'phone').reference_extended_clp - phone.reference_extended_clp;
assert.equal(subtotal, base.results.priced_reference_subtotal_clp - routerSaving - phoneSaving);
const ports = [
  {port: 'ethernet1/1', role: 'WAN_A'}, {port: 'ethernet1/2', role: 'WAN_B'},
  {port: 'ethernet1/3', role: 'LAN_AE_MEMBER_TO_SW_A'}, {port: 'ethernet1/4', role: 'LAN_AE_MEMBER_TO_SW_B'},
  {port: 'ethernet1/5', role: 'HA1_DIRECT'}, {port: 'ethernet1/6', role: 'HA2_DIRECT'},
  {port: 'ethernet1/7', role: 'HA2_BACKUP_DIRECT'}, {port: 'ethernet1/8', role: 'SPARE'}
];
assert.equal(new Set(ports.map(p => p.port)).size, 8);
const counts = {...base.counts, routers_branch: 0, future_routers_additional: 0,
  wan_handoff_devices_branch_allowance: 44, future_wan_handoff_devices_allowance: 12};
const unpriced = base.unpriced_lines.filter(l => l.sku !== 'LICENCIAS_ROUTING_CRYPTO_MAYOR_250_MBPS').concat([
  {sku: 'CM_ROUTING_ENTITLEMENTS', quantity: 2, price_clp: null, reason: 'Cisco como borde IP; IPsec termina en PA de CM. Validar routing/failover por licencia, no comprar crypto Advanced automáticamente'},
  {sku: 'WAN_HANDOFF_MANAGED_1G', quantity: 44, price_clp: null, reason: 'Reserva conservadora: un distribuidor por WAN inicial por remota. Omitir solo con entrega CPE dual equivalente documentada; no conectar ambos ISP a un distribuidor único'},
  {sku: 'CENTRAL_WAN_HANDOFF', quantity: null, price_clp: null, reason: 'Entregas de ambos ISP a ambos routers CM; direccionamiento público enrutado y distribución pendientes'},
  {sku: 'OPTIONAL_ADVANCED_SD_WAN', quantity: null, price_clp: null, reason: 'No contratado en la base. Cotizar si se exige selección automática por latencia/jitter/pérdida, no equiparar ICMP con SD-WAN'}
]);
const output = {
  as_of: base.as_of, status: 'DISENO_B_PREFERIDO_NO_ORDEN_DE_COMPRA',
  source_comparison: 'dimensionamiento-propuesta-2026-10-17.json',
  scope: base.scope, counts,
  architecture: {
    branch: '2 PA-510 A/P con routing L3/IPsec/QoS + 2 C9200L-24P-4G-E + 2 WAN iniciales verificadas por sede',
    central: '2 C8221-G2 borde IP + 2 PA-1410 A/P concentradores IPsec + 2 C9200L-48P-4X-E',
    phone: phone.sku, initial_wan_paths_per_branch: 2,
    further_wan_paths_reserved_not_ordered: 2,
    branch_firewall_ports_per_member: ports,
    separate_management_port: 'MGT → VLAN de gestión; heartbeat backup entre peers, sin administración desde WAN',
    adding_third_wan: 'Usar ethernet1/8; ya no quedan puertos de datos libres',
    adding_fourth_wan: 'Rediseñar puertos/HA2 backup o cambiar plataforma; no sumar cuatro WAN conservando este plano sin cambios',
    initial_tunnels_per_branch_logical_cluster: 4,
    initial_tunnels_at_cm_logical_cluster: base.scope.initial_remotes * 2 * 2,
    future_tunnels_at_cm_logical_cluster: (base.scope.initial_remotes + base.scope.future_additional_locations) * 2 * 2,
    tunnel_count_is_sa_count: false, passive_peer_does_not_double_logical_tunnels: true,
    failback_preemption: 'Sin retorno automático al firewall preferido; restauración controlada tras estabilización',
    end_to_end_vpn_validation_pending: true
  },
  capacity_per_site: base.capacity_per_site,
  assumptions: {
    usd_clp: base.assumptions.usd_clp, usd_clp_is_market_rate: false,
    illustrative_tax_factor_for_usd: base.assumptions.illustrative_tax_factor_for_usd,
    unit_rounding: base.assumptions.unit_rounding,
    initial_budget_clp: base.assumptions.initial_budget_clp,
    voice_and_poe_envelope_preserved: true,
    provider_names_are_options_not_proof_of_coverage: true
  },
  priced_lines: priced, unpriced_lines: unpriced,
  results: {
    previous_A_priced_subtotal_clp: base.results.priced_reference_subtotal_clp,
    preferred_B_priced_subtotal_clp: subtotal,
    avoided_router_hardware_reference_clp: routerSaving,
    phone_reference_difference_clp: phoneSaving,
    comparable_reference_reduction_clp: routerSaving + phoneSaving,
    priced_excess_over_initial_budget_clp: subtotal - base.assumptions.initial_budget_clp,
    complete_project_total_clp: null, net_tco_saving_clp: null,
    future6_priced_network_only_clp: priced.filter(l => ['firewall_branch', 'atp_branch_5y', 'switch_branch'].includes(l.id)).reduce((n, l) => n + 12 * l.reference_unit_clp, 0) + 12 * priced.find(l => l.id === 'stack_kit').reference_unit_clp,
    future6_complete_total_clp: null
  },
  exclusions: base.exclusions.filter(s => s !== 'Soporte y licencias Cisco criptograficas').concat(['Soporte/entitlements de borde IP CM', 'Distribuidores WAN reservados pero sin precio', 'PBX, licencias y troncales SIP; soporte 5+1 de terminales']),
  purchase_authorized: false, simulation_architecture_changed: false,
  support_end_date_verified_for_selected_phone: null
};
const dest = path.join(root, 'docs/propuesta-optimizada-2026-10-17.json');
const expected = JSON.stringify(output, null, 2) + '\n';
if (process.argv.includes('--check')) {
  assert.equal(fs.readFileSync(dest, 'utf8'), expected, 'Regenerar propuesta optimizada desde sus referencias');
} else fs.writeFileSync(dest, expected);
console.log(`Propuesta B: ${subtotal.toLocaleString('es-CL')} CLP parcial; 650 puestos / 23 sedes; 88 túneles lógicos iniciales; total completo pendiente.`);
