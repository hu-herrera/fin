'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const round = x => Math.round(x * 1000) / 1000;
function number(x, name, min=0) { assert.ok(typeof x==='number' && Number.isFinite(x) && x>=min, name+' inválido'); return x; }
function fraction(x, name, allowZero=true) { number(x,name); assert.ok(x<=1&&(allowZero||x>0),name+' fuera de rango'); return x; }
function trafficPlan(sites, t, load) {
 fraction(load.data_concurrency,'concurrencia'); fraction(load.active_phone_fraction,'voz');
 fraction(t.planning_max_utilization,'utilización',false); fraction(t.remote_data_internet_fraction,'fracción Internet');
 number(load.mbps_per_active_pc,'Mbps'); number(load.external_calls,'llamadas'); number(t.voice_envelope_mbps_per_active_endpoint,'reserva de voz');
 const perSite=sites.map(s=>{
  const activeEndpoints=Math.ceil(s.phones*load.active_phone_fraction);
  const data=s.pcs*load.data_concurrency*load.mbps_per_active_pc;
  const voice=activeEndpoints*t.voice_envelope_mbps_per_active_endpoint;
  return {id:s.id,pcs:s.pcs,active_phone_endpoints_envelope:activeEndpoints,data_mbps:round(data),voice_mbps:round(voice),combined_mbps:round(data+voice),required_at_planning_utilization_mbps:round((data+voice)/t.planning_max_utilization)};
 });
 assert.ok(Number.isInteger(load.external_calls)&&load.external_calls<=perSite.reduce((n,s)=>n+s.active_phone_endpoints_envelope,0),'Llamadas externas incompatibles con terminales activos');
 const remotes=perSite.filter(s=>s.id!=='cm'),cm=perSite.find(s=>s.id==='cm'); assert.ok(cm,'Falta CM');
 const mpls=remotes.reduce((n,s)=>n+s.combined_mbps,0);
 const dataRemote=remotes.reduce((n,s)=>n+s.data_mbps,0);
 // Todo el tráfico de CM se reserva aquí para Internet, conservador; no se suma a MPLS remoto.
 const internet=dataRemote*t.remote_data_internet_fraction+cm.data_mbps+load.external_calls*t.voice_envelope_mbps_per_active_endpoint;
 const mplsRequired=mpls/t.planning_max_utilization,internetRequired=internet/t.planning_max_utilization;
 return {per_site:perSite,active_phone_endpoints_envelope_total:perSite.reduce((n,s)=>n+s.active_phone_endpoints_envelope,0),remote_active_phone_endpoints_envelope:remotes.reduce((n,s)=>n+s.active_phone_endpoints_envelope,0),mpls_central_mbps:round(mpls),mpls_required_mbps:round(mplsRequired),mpls_nominal_assumption_sufficient:mplsRequired<=t.central_mpls_nominal_mbps_assumed,internet_mbps:round(internet),internet_required_on_one_isp_mbps:round(internetRequired),single_isp_nominal_assumption_sufficient:internetRequired<=t.central_isp_nominal_mbps_each_assumed,external_calls_assumed:load.external_calls,external_channels_assumed:t.external_sip_channels_assumed,external_demand_within_assumed_channels:load.external_calls<=t.external_sip_channels_assumed,measured:false,physical_device_capacity_certified:false};
}
function backupPlan(b, years=0) {
 number(b.protected_data_gb_assumed,'datos'); number(years,'años'); fraction(b.daily_change_fraction,'cambio diario');
 number(b.annual_data_growth_fraction,'crecimiento'); fraction(b.effective_transfer_fraction_assumed,'transferencia efectiva',false);number(b.network_mbps,'red backup',Number.MIN_VALUE);
 for(const key of ['weekly_full_copies_retained','incremental_days_per_week','restore_workspace_full_copies'])assert.ok(Number.isInteger(b[key])&&b[key]>=0,key+' inválido');
 assert.ok(b.weekly_full_copies_retained>0&&b.incremental_days_per_week<=6,'Retención semanal inválida');
 number(b.space_margin_fraction,'margen');number(b.usable_repository_gb_assumed,'repositorio');
 const full=b.protected_data_gb_assumed*(1+b.annual_data_growth_fraction)**years;
 const incremental=full*b.daily_change_fraction;
 const retained=b.weekly_full_copies_retained*full+b.weekly_full_copies_retained*b.incremental_days_per_week*incremental;
 const workspace=full*b.restore_workspace_full_copies;
 const required=(retained+workspace)*(1+b.space_margin_fraction);
 const hours=gb=>gb*8000/(b.network_mbps*b.effective_transfer_fraction_assumed)/3600;
 return {years,protected_data_gb:round(full),daily_incremental_gb:round(incremental),retained_backups_gb:round(retained),workspace_gb:round(workspace),required_repository_gb:round(required),assumed_usable_repository_gb:b.usable_repository_gb_assumed,repository_space_sufficient:required<=b.usable_repository_gb_assumed,full_transfer_hours_assumed:round(hours(full)),incremental_transfer_hours_assumed:round(hours(incremental)),full_transfer_fits_assumed_window:hours(full)<=b.backup_window_hours_assumed,rpo_achieved_hours:null,rto_achieved_hours:null};
}
function financialComparison(investment, oldMonthly, newMonthly, months=60) {
 assert.ok(Number.isInteger(months)&&months>0,'Plazo inválido');
 for(const [n,v] of Object.entries({investment,oldMonthly,newMonthly}))if(v!==null)number(v,n);
 const saving=oldMonthly===null||newMonthly===null?null:oldMonthly-newMonthly;
 return {months,incremental_investment_clp:investment,monthly_net_saving_clp:saving,undiscounted_net_benefit_clp:investment===null||saving===null?null:saving*months-investment,payback_months:investment===null||saving===null||saving<=0?null:round(investment/saving),status:investment===null||saving===null?'INCOMPLETO':saving<=0?'SIN_AHORRO_OPERATIVO':'ESCENARIO_NO_COTIZACION'};
}
function powerPlan(sites,p) {
 fraction(p.load_power_factor_assumed,'factor potencia',false);
 return sites.map(s=>{
  const cm=s.id==='cm';
  const watts=cm?2*p.central_router_w_each+2*p.central_switch_base_w_each+p.central_firewall_w+2*p.central_host_w_each+p.backup_repository_w+3*p.cpe_ont_w_each+s.phones*p.phone_budget_w:p.branch_router_w+p.branch_switch_base_w+p.cpe_ont_w_each+s.phones*p.phone_budget_w;
  const designW=watts*(1+p.headroom_fraction),designVA=designW/p.load_power_factor_assumed;
  const upsW=cm?p.central_ups_rating_w_assumed:p.branch_ups_rating_w_assumed,upsVA=cm?p.central_ups_rating_va_assumed:p.branch_ups_rating_va_assumed;
  return {id:s.id,assumed_load_w:round(watts),design_w_with_margin:round(designW),design_va_with_assumed_power_factor:round(designVA),assumed_ups_w:upsW,assumed_ups_va:upsVA,nominal_power_fits:designW<=upsW&&designVA<=upsVA,includes_pcs:false,runtime_verified_minutes:null};
 });
}
function build(base,hypothesis,pricedPartial) {
 assert.equal(base.original_wan.central_access_mbps_assumed,hypothesis.traffic.central_mpls_nominal_mbps_assumed,'MPLS central desalineado');
 assert.equal(base.original_wan.central_isp_capacity_mbps_each_assumed,hypothesis.traffic.central_isp_nominal_mbps_each_assumed,'ISP centrales desalineados');
 assert.equal(base.sites.reduce((n,s)=>n+s.pcs,0),650);assert.equal(base.sites.reduce((n,s)=>n+s.phones,0),650);
 assert.equal(base.datacenter.assumed_host_capacity.backup.usable_storage_gb,hypothesis.backup.usable_repository_gb_assumed,'Repositorio desalineado');
 const hosts=hypothesis.servers.hosts.map(h=>{
  const inventoryCapacity=base.datacenter.assumed_host_capacity[h.id==='DC-01'?'dc1':'dc2'];
  for(const key of ['physical_cores','ram_gib','usable_storage_gb'])assert.equal(inventoryCapacity[key],h[key],h.id+' '+key+' desalineado');
  const ram=h.vms.reduce((n,v)=>n+v.ram_gib,0)+h.hypervisor_ram_reserve_gib,disk=h.vms.reduce((n,v)=>n+v.allocated_disk_gb,0);
  assert.ok(ram<=h.ram_gib&&disk<=h.usable_storage_gb,'Asignación excesiva en '+h.id);
  return {id:h.id,physical_cores_assumed:h.physical_cores,vcpu_allocated:h.vms.reduce((n,v)=>n+v.vcpu,0),ram_gib_assumed:h.ram_gib,ram_gib_allocated_with_hypervisor:ram,ram_gib_unallocated:h.ram_gib-ram,usable_storage_gb_assumed:h.usable_storage_gb,vm_disk_gb_allocated:disk,unallocated_disk_gb:h.usable_storage_gb-disk,performance_validated:false};
 });
 const e=hypothesis.economics;
 return {as_of:hypothesis.as_of,status:'DIMENSIONAMIENTO_ACADEMICO_BASE_ANTES_NO_TELEMETRIA',initial_locations:base.sites.length,traffic:{normal:trafficPlan(base.sites,hypothesis.traffic,hypothesis.traffic.normal),stress:trafficPlan(base.sites,hypothesis.traffic,hypothesis.traffic.stress)},hosts,backup:[0,5,6].map(y=>backupPlan(hypothesis.backup,y)),power:powerPlan(base.sites,hypothesis.power),economics:{comparison_5y:financialComparison(e.incremental_investment_complete_clp,e.old_monthly_complete_clp,e.new_monthly_complete_clp,60),comparison_6y:financialComparison(e.incremental_investment_complete_clp,e.old_monthly_complete_clp,e.new_monthly_complete_clp,72),partial_reference_only_clp:pricedPartial,monthly_net_saving_needed_to_recover_partial_in_5y_clp:round(pricedPartial/60),monthly_net_saving_needed_to_recover_partial_in_6y_clp:round(pricedPartial/72),partial_reference_is_complete_investment:false,partial_reference_excludes_four_wan_redesign:true}};
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,'docs',f),'utf8'));
 const result=build(read('base-infraestructura-antes.json'),read('hipotesis-carga-base.json'),read('propuesta-optimizada-2026-10-17.json').results.preferred_B_priced_subtotal_clp);
 const expected=JSON.stringify(result,null,2)+'\n',dest=path.join(root,'docs/dimensionamiento-base-antes.json');
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(dest,'utf8'),expected,'Regenerar dimensionamiento base');else fs.writeFileSync(dest,expected);
 console.log('Base ANTES: '+result.traffic.normal.mpls_required_mbps+' Mbps MPLS; '+result.traffic.normal.active_phone_endpoints_envelope_total+' terminales activos de reserva; TCO completo pendiente.');
}
module.exports={trafficPlan,backupPlan,financialComparison,powerPlan,build};
