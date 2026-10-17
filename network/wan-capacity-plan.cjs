'use strict';
// Engineering sensitivity only: nominal sums cannot certify ECMP, contracts or applications.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const round=n=>Math.round(n*1000)/1000;
function demand(input,hyp,inventory,{load='normal',growth=0,futureRemotes=0}={}){
 const t=hyp.traffic,p=t[load],u=input.architecture.planning_max_utilization;
 assert.ok(p&&u>0&&u<=1);assert.ok(growth>=0&&Number.isFinite(growth));assert.ok(Number.isInteger(futureRemotes)&&futureRemotes>=0);
 const sites=inventory.sites.map(s=>({id:s.id,pcs:Math.ceil(s.pcs*(1+growth)),phones:Math.ceil(s.phones*(1+growth))}));
 for(let i=0;i<futureRemotes;i++)sites.push({id:'future-'+(i+1),pcs:input.architecture.future_remote_pcs_each_for_sensitivity_only,phones:input.architecture.future_remote_pcs_each_for_sensitivity_only});
 const cm=sites.find(s=>s.id==='cm');assert.ok(cm);
 const remotes=sites.filter(s=>s.id!=='cm');
 const remotePcs=remotes.reduce((n,s)=>n+s.pcs,0),voice=remotes.reduce((n,s)=>n+Math.ceil(s.phones*p.active_phone_fraction)*t.voice_envelope_mbps_per_active_endpoint,0);
 const corporate=remotePcs*p.data_concurrency*p.mbps_per_active_pc*(1-t.remote_data_internet_fraction);
 const vpn=(corporate+voice)*(1+input.architecture.data_tunnel_overhead_margin_assumed);
 const centralLocal=cm.pcs*p.data_concurrency*p.mbps_per_active_pc+p.external_calls*t.voice_envelope_mbps_per_active_endpoint;
 const full=vpn+centralLocal;
 return {load,growth_existing_sites:growth,future_remotes:futureRemotes,remote_pcs:remotePcs,central_pcs:cm.pcs,vpn_envelope_mbps:round(vpn),full_envelope_mbps:round(full),single_survivor_target_mbps:Math.ceil(full/u),single_survivor_vpn_only_target_mbps:Math.ceil(vpn/u),direction:'CADA_SENTIDO_POR_SEPARADO_SUPUESTO_NO_MEDIDO',transaction_only_requirement_mbps:null};
}
function evaluate(providers,d,u){
 assert.ok(providers.every(p=>Number.isFinite(p.model_mbps_assumed)&&p.model_mbps_assumed>=0));
 const nominal=providers.reduce((n,p)=>n+p.model_mbps_assumed,0),budget=nominal*u;
 return {survivors:providers.map(p=>p.id),nominal_ideal_sum_mbps:nominal,budget_ideal_mbps:round(budget),vpn_deficit_mbps:round(Math.max(0,d.vpn_envelope_mbps-budget)),full_deficit_mbps:round(Math.max(0,d.full_envelope_mbps-budget)),vpn_fits_ideal_budget:d.vpn_envelope_mbps<=budget,full_fits_ideal_budget:d.full_envelope_mbps<=budget,contracted_upstream_mbps:null,contracted_downstream_mbps:null,service_certified:false};
}
function build(input,hyp,inventory){
 const ids=input.providers.map(p=>p.id);assert.equal(ids.length,4);assert.equal(new Set(ids).size,4);
 const u=input.architecture.planning_max_utilization;assert.ok(u>0&&u<=1);
 const cases=[['current_normal','normal',0,0],['current_stress','stress',0,0],['expanded_normal','normal',input.architecture.growth_within_existing_sites,6],['expanded_stress','stress',input.architecture.growth_within_existing_sites,6]];
 return {status:'REQUISITOS_DE_INGENIERIA_NO_CONTRATOS_NI_GARANTIA',planning_max_utilization:u,baseline_changed:false,simulator_changed:false,cases:cases.map(([id,load,growth,futureRemotes])=>{
  const d=demand(input,hyp,inventory,{load,growth,futureRemotes});
  const subsets=Array.from({length:16},(_,mask)=>evaluate(input.providers.filter((p,i)=>mask&(1<<i)),d,u));
  const powerLoss=['A','B'].map(group=>({failed_power_group:group,...evaluate(input.providers.filter(p=>p.power_group!==group),d,u)}));
  return {id,demand:d,wan_subsets:subsets,power_group_failures:powerLoss};
 }),interpretation:{zero_survivors_included:true,ecmp_aggregate_is_upper_bound:true,equal_cost_does_not_imply_capacity_weighting:true,nominal_speed_is_not_symmetric_contract:true,transactions_cannot_be_inferred_from_all_corporate_traffic:true,future_site_sizes_are_sensitivity_only:true,backups_replication_updates_extra_traffic_not_included:true}};
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,'docs',f),'utf8'));
 const data=build(read('entradas-propuesta-cuatro-wan.json'),read('hipotesis-carga-base.json'),read('base-infraestructura-antes.json'));
 const dest=path.join(root,'docs/capacidad-wan-resiliencia.json'),text=JSON.stringify(data,null,2)+'\n';
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(dest,'utf8'),text,'Regenerar capacidad WAN');else fs.writeFileSync(dest,text);
 console.log(data.cases.map(c=>c.id+': '+c.demand.full_envelope_mbps+' Mbps; único superviviente >= '+c.demand.single_survivor_target_mbps+' Mbps por sentido').join('\n'));
}
module.exports={demand,evaluate,build};
