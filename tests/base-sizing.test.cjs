'use strict';
const assert=require('node:assert/strict');
const {trafficPlan,backupPlan,financialComparison,powerPlan,build}=require('../network/base-sizing.cjs');
const h=require('../docs/hipotesis-carga-base.json'),base=require('../docs/base-infraestructura-antes.json');
// Redondear voz por sede protege a sucursales pequeñas; no redondear una sola vez la flota.
const tiny=trafficPlan([{id:'cm',pcs:5,phones:5},{id:'a',pcs:5,phones:5},{id:'b',pcs:5,phones:5}],h.traffic,{...h.traffic.normal,external_calls:0});
assert.equal(tiny.active_phone_endpoints_envelope_total,3);
assert.equal(tiny.remote_active_phone_endpoints_envelope,2);
assert.throws(()=>trafficPlan(base.sites,h.traffic,{...h.traffic.normal,external_calls:651}),/terminales activos/);
assert.throws(()=>trafficPlan(base.sites,{...h.traffic,planning_max_utilization:0},h.traffic.normal),/rango/);
// Un dato desconocido no debe convertirse en precio cero ni recuperar automáticamente inversión.
for(const triple of [[null,100,50],[100,null,50],[100,100,null]]){
 const r=financialComparison(...triple);assert.equal(r.payback_months,null);assert.equal(r.undiscounted_net_benefit_clp,null);assert.equal(r.status,'INCOMPLETO');
}
assert.equal(financialComparison(1200,100,120).monthly_net_saving_clp,-20);
assert.equal(financialComparison(1200,100,120).payback_months,null);
assert.equal(financialComparison(1200,200,100).payback_months,12);
assert.equal(financialComparison(1200,200,100,60).undiscounted_net_benefit_clp,4800);
assert.throws(()=>financialComparison(100,-1,10));assert.throws(()=>financialComparison(100,20,10,0));
// Workspace y retención consumen disco; crecimiento afecta también ventana, sin certificar RPO/RTO.
const today=backupPlan(h.backup),future=backupPlan(h.backup,5);
assert.ok(today.required_repository_gb>today.retained_backups_gb+today.workspace_gb);
assert.equal(today.repository_space_sufficient,true);assert.equal(future.repository_space_sufficient,false);
assert.equal(today.full_transfer_fits_assumed_window,true);assert.equal(future.full_transfer_fits_assumed_window,false);
assert.equal(today.rpo_achieved_hours,null);assert.equal(future.rto_achieved_hours,null);
assert.ok(backupPlan({...h.backup,restore_workspace_full_copies:0}).required_repository_gb<today.required_repository_gb);
assert.throws(()=>backupPlan({...h.backup,effective_transfer_fraction_assumed:0}));
assert.throws(()=>backupPlan({...h.backup,weekly_full_copies_retained:-1}));
// Pasar el límite W no basta si se exceden VA. No se inventa autonomía por cumplir potencia.
const insufficientVA=powerPlan(base.sites,{...h.power,branch_ups_rating_va_assumed:1});
assert.ok(insufficientVA.filter(s=>s.id!=='cm').every(s=>!s.nominal_power_fits));
assert.ok(insufficientVA.every(s=>s.runtime_verified_minutes===null&&!s.includes_pcs));
const result=build(base,h,411158986);assert.equal(result.traffic.normal.active_phone_endpoints_envelope_total,69);
assert.equal(result.traffic.normal.mpls_required_mbps,524.4);assert.equal(result.economics.comparison_5y.payback_months,null);
assert.equal(result.economics.partial_reference_excludes_four_wan_redesign,true);
assert.throws(()=>build({...base,original_wan:{...base.original_wan,central_access_mbps_assumed:100}},h,411158986),/desalineado/);
const mismatchedHost=structuredClone(base);mismatchedHost.datacenter.assumed_host_capacity.dc1.ram_gib=1;
assert.throws(()=>build(mismatchedHost,h,411158986),/DC-01 ram_gib desalineado/);
const mismatchedBackup=structuredClone(base);mismatchedBackup.datacenter.assumed_host_capacity.backup.usable_storage_gb=1;
assert.throws(()=>build(mismatchedBackup,h,411158986),/Repositorio desalineado/);
console.log('OK: carga por sede, voz/canales, retención y crecimiento, W/VA y economía sin ahorros ficticios');
