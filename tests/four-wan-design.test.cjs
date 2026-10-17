'use strict';
const assert=require('node:assert/strict');
const m=require('../network/four-wan-design.cjs');
const input=require('../docs/entradas-propuesta-cuatro-wan.json'),base=require('../docs/base-infraestructura-antes.json'),old=require('../docs/propuesta-optimizada-2026-10-17.json'),hyp=require('../docs/hipotesis-carga-base.json');
const design=m.build(input,base,old,hyp);
const mixedFx=structuredClone(input);mixedFx.prices.usd_clp_assumed=900;assert.throws(()=>m.build(mixedFx,base,old,hyp),/Tipo de cambio/);
assert.equal(m.usdUnit(4016.25,1000),4779338); // Medio peso debe redondear hacia arriba, no depender de coma flotante.
assert.equal(design.sites.length,23);assert.equal(design.tunnels.initial_candidate_tunnels,352);assert.equal(design.tunnels.future_candidate_tunnels,448);
for(const s of design.sites){
 assert.equal(m.validateSite(s),true);assert.equal(m.inspect(s).wan_physically_available.length,4);
 for(const p of input.providers){
  for(const kind of ['cpe:','handoff:','wan:']){const r=m.inspect(s,[kind+p.id]);assert.equal(r.wan_physically_available.length,3);assert.ok(!r.wan_physically_available.includes(p.id));}
 }
 const fw=m.inspect(s,['fwA']);assert.equal(fw.active_firewall,'fwB');assert.equal(fw.wan_physically_available.length,4);
 const sw=m.inspect(s,['sw1']);assert.equal(sw.gateway_path_available,true);assert.deepEqual(sw.local_switches_available,['sw2']);
 const lan1=s.firewall_ports_per_member.find(p=>p.role==='LAN_SW1').port,lan2=s.firewall_ports_per_member.find(p=>p.role==='LAN_SW2').port;
 assert.equal(m.inspect(s,['fwA:'+lan1,'fwA:'+lan2]).active_firewall,'fwB');
 const both=m.inspect(s,['fwA','fwB']);assert.equal(both.gateway_path_available,false);assert.deepEqual(both.local_switches_available,['sw1','sw2']);
 assert.equal(m.inspect(s,['ha:HA2']).ha2_transport_available,true);
 const noSync=m.inspect(s,['ha:HA2','ha:HA2_BACKUP']);assert.equal(noSync.ha2_transport_available,false);assert.equal(noSync.wan_physically_available.length,4);
 const noWan=m.inspect(s,input.providers.map(p=>'cpe:'+p.id));assert.deepEqual(noWan.wan_physically_available,[]);assert.equal(noWan.gateway_path_available,true);
 assert.equal(m.inspect(s,['upsA']).wan_physically_available.length,2);assert.equal(m.inspect(s,['upsA']).gateway_path_available,true);
 assert.equal(m.inspect(s,['upsA','upsB']).gateway_path_available,false);
 const leak=structuredClone(s);leak.wan_handoffs[0].ports[0].vlan=130;assert.throws(()=>m.validateSite(leak),/Fuga/);
 const routed=structuredClone(s);routed.wan_handoffs[0].routing_enabled=true;assert.throws(()=>m.validateSite(routed),/enrutar/);
 const duplicate=structuredClone(s);duplicate.lan_links[1].firewall_port=duplicate.lan_links[0].firewall_port;assert.throws(()=>m.validateSite(duplicate),/duplicada/);
 if(s.id!=='cm'){
  const wrong=structuredClone(s);wrong.firewall_model='PAN-PA-510';assert.throws(()=>m.validateSite(wrong),/Modelo/);
  const media=structuredClone(s);media.firewall_ports_per_member.find(p=>p.port==='ethernet1/9').media='RJ45_1G';assert.throws(()=>m.validateSite(media),/Medio/);
 }
}
assert.ok(design.capacity.current.one_survivor.every(s=>!s.full_envelope_fits_ideal_budget));
assert.equal(design.capacity.current.single_wan_failures.find(s=>s.failed==='entel5g').critical_envelope_fits_ideal_budget,true);
assert.equal(design.capacity.future_sensitivity.single_wan_failures.find(s=>s.failed==='entel5g').critical_envelope_fits_ideal_budget,false);
assert.ok(design.capacity.current.all_wans.full_envelope_fits_ideal_budget);
assert.equal(design.capacity.current.all_wans.is_measured_or_guaranteed_capacity,false);
assert.equal(design.budget.complete_project_total_clp,null);assert.equal(design.budget.net_tco_saving_clp,null);
assert.equal(design.budget.comparison_with_historical_A_same_phone.historical_A_priced_partial_clp,524360778);
assert.equal(design.budget.comparison_with_historical_A_same_phone.is_equivalent_commercial_offer,false);
assert.equal(design.budget.handoff_observation_excluded.included_in_priced_partial,false);
assert.equal(design.budget.priced_lines.reduce((n,l)=>n+l.reference_extended_clp,0),design.budget.priced_partial_clp);
assert.equal(design.implementation.running_after_profile_migrated,false);
console.log('OK C4: 23 planos, WAN/gestión aisladas, puertos/medios, fallos de equipo/HA/energía y límites de capacidad sin falsa continuidad');
