'use strict';
// Candidate physical design. Does not replace the running DESPUES profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const round=x=>Math.round(x*1000)/1000;
function usdUnit(usd,fx){
 assert.ok(Number.isFinite(usd)&&usd>=0&&Number.isInteger(fx)&&fx>0);
 const numerator=Math.round(usd*100)*fx*119;
 assert.ok(Number.isSafeInteger(numerator));
 return Math.floor((numerator+5000)/10000);
}
function firewallPorts(central=false){
 const ports=['starlink','leo','entel5g','gtd4g'].map((provider,i)=>({port:'ethernet1/'+(i+1),role:'WAN',provider,media:'RJ45_1G'}));
 if(central)ports.push(
  {port:'ethernet1/19',role:'LAN_SW1',media:'SFP_PLUS_10G'},
  {port:'ethernet1/20',role:'LAN_SW2',media:'SFP_PLUS_10G'},
  {port:'HA1-A',role:'HA1',media:'RJ45_1G'},
  {port:'HA1-B',role:'HA1_BACKUP',media:'RJ45_1G'},
  {port:'HSCI',role:'HA2',media:'SFP_PLUS_10G_DIRECT'},
  {port:'ethernet1/8',role:'HA2_BACKUP',media:'RJ45_1G'});
 else ports.push(
  {port:'ethernet1/5',role:'HA1',media:'RJ45_1G'},
  {port:'ethernet1/6',role:'HA2',media:'RJ45_1G'},
  {port:'ethernet1/7',role:'HA2_BACKUP',media:'RJ45_1G'},
  {port:'ethernet1/8',role:'SPARE',media:'RJ45_1G'},
  {port:'ethernet1/9',role:'LAN_SW1',media:'SFP_1G'},
  {port:'ethernet1/10',role:'LAN_SW2',media:'SFP_1G'});
 ports.push({port:'MGT',role:'MANAGEMENT_SEPARATE',media:'RJ45_1G'});
 return ports;
}
function sitePlan(site,input){
 const central=site.id==='cm',portsPerSwitch=central?48:24;
 const managementPrefix='10.80.'+site.number+'.';
 return {id:site.id,number:site.number,pcs:site.pcs,phones:site.phones,
  firewall_model:central?input.architecture.central_firewall:input.architecture.branch_firewall,
  firewall_count:2,firewall_ports_per_member:firewallPorts(central),
  lan_port_channels:[{firewall:'fwA',stack_port_channel:'Po21'},{firewall:'fwB',stack_port_channel:'Po22'}],
  access_switch_count:2,access_ports_per_switch:portsPerSwitch,
  lan_links:['fwA','fwB'].flatMap((firewall,i)=>[1,2].map(member=>({firewall,firewall_port:'ethernet1/'+(central?(member===1?19:20):(member===1?9:10)),switch:'sw'+member,switch_port:(central?'Te':'Gi')+member+'/1/'+(i+1),stack_port_channel:'Po'+(21+i),media:central?'SFP_PLUS_10G':'SFP_1G',trunk_vlans:central?[10,20,40,50,131]:[10,20,40,131]}))),
  management_access_ports:[1,2].flatMap(member=>{const n=central?41:21;return [{switch:'sw'+member,port:'Gi'+member+'/0/'+n,role:member===1?'fwA_MGT':'fwB_MGT'},...input.providers.filter((_,i)=>i%2===member-1).map((p,i)=>({switch:'sw'+member,port:'Gi'+member+'/0/'+(n+i+1),role:'handoff_'+p.id+'_MGT'}))];}),
  access_copper_reserved:central?16:8,
  access_copper_reservation_breakdown:central?{fw_mgt:2,wan_handoff_mgt:4,other_infrastructure:10}:{fw_mgt:2,wan_handoff_mgt:4,other_infrastructure:2},
  access_copper_free_after_growth:2*portsPerSwitch-Math.ceil(site.pcs*(1+input.architecture.growth_within_existing_sites))-(central?16:8),
  sfp_ports_per_switch:4,sfp_lan_used_per_switch:2,
  sfp_left_per_switch_before_hosts:2,
  management:{vlan:130,network:managementPrefix+'0/27',stack_gateway:managementPrefix+'1',firewall_mgt:[managementPrefix+'10',managementPrefix+'11'],handoff_mgt:[20,21,22,23].map(n=>managementPrefix+n),transit_vlan:131,transit_network:managementPrefix+'64/29',stack_transit:managementPrefix+'65',firewall_data_transit:managementPrefix+'66',independent_remote_oob:false},
  wan_handoffs:input.providers.map((p,i)=>({provider:p.id,cpe_count:1,distribution_switch_allowance:1,model:input.architecture.handoff_switch_allowance_model,wan_vlan:p.vlan,management_vlan:130,routing_enabled:false,power_group:p.power_group,ports:[{port:'GE1',role:'CPE_WAN',vlan:p.vlan},{port:'GE2',role:'FWA_WAN',vlan:p.vlan},{port:'GE3',role:'FWB_WAN',vlan:p.vlan},{port:'GE4',role:'MANAGEMENT_ONLY',vlan:130}],management_switch:i%2===0?'sw1':'sw2'})),
  power:{firewalls:['A','B'],access_switches:['A','B'],dual_psus_required:true,ups_target_count:2,existing_ups_reuse_verified:false},
  candidate_only:true};
}
function validateSite(s){
 assert.equal(s.firewall_model,s.id==='cm'?'PAN-PA-1410':'PAN-PA-540','Modelo insuficiente o sin perfil verificado');
 assert.equal(new Set(s.firewall_ports_per_member.map(p=>p.port)).size,s.firewall_ports_per_member.length,'Puerto de firewall duplicado');
 assert.equal(s.firewall_ports_per_member.filter(p=>p.role==='WAN').length,4);
 assert.equal(s.firewall_ports_per_member.filter(p=>p.role.startsWith('LAN_SW')).length,2);
 const data=s.firewall_ports_per_member.filter(p=>p.port.startsWith('ethernet'));
 for(const p of data){const n=Number(p.port.split('/')[1]);assert.ok(Number.isInteger(n)&&n>=1&&n<=(s.id==='cm'?22:10),'Puerto inexistente');
  if(s.id!=='cm')assert.equal(p.media,n<=8?'RJ45_1G':'SFP_1G','Medio PA-540 incorrecto');
 }
 assert.ok(s.access_copper_free_after_growth>=0,'Puertos de puestos insuficientes');
 assert.equal(Object.values(s.access_copper_reservation_breakdown).reduce((a,b)=>a+b,0),s.access_copper_reserved);
 const ips=[s.management.stack_gateway,...s.management.firewall_mgt,...s.management.handoff_mgt,s.management.stack_transit,s.management.firewall_data_transit];
 assert.equal(new Set(ips).size,ips.length,'IP de gestión duplicada');
 for(const h of s.wan_handoffs){assert.equal(h.routing_enabled,false,'Distribuidor WAN no debe enrutar a gestión');assert.notEqual(h.wan_vlan,h.management_vlan,'WAN y gestión mezcladas');assert.equal(h.ports.length,new Set(h.ports.map(p=>p.port)).size);
  assert.ok(h.ports.filter(p=>p.role!=='MANAGEMENT_ONLY').every(p=>p.vlan===h.wan_vlan),'Fuga de VLAN WAN');
  assert.equal(h.ports.find(p=>p.role==='MANAGEMENT_ONLY').vlan,130);
 }
 assert.equal(s.wan_handoffs.length,4);
 const ends=s.lan_links.flatMap(l=>[l.firewall+':'+l.firewall_port,l.switch+':'+l.switch_port]);
 assert.equal(new Set(ends).size,ends.length,'Terminación LAN duplicada');
 for(const l of s.lan_links){const p=s.firewall_ports_per_member.find(p=>p.port===l.firewall_port);assert.ok(p&&p.role==='LAN_'+l.switch.toUpperCase()&&p.media===l.media,'LAN conectada a puerto/medio incorrecto');assert.match(l.switch_port,s.id==='cm'?/^Te[12]\/1\/[12]$/:/^Gi[12]\/1\/[12]$/);}
 assert.ok(s.lan_links.every(l=>!l.trunk_vlans.includes(s.management.vlan)&&l.trunk_vlans.includes(s.management.transit_vlan)),'MGT solapado con plano de datos');
 return true;
}
function inspect(s,faults=[]){
 const f=new Set(faults),up=n=>!f.has(n),powerOn=s.power.firewalls.some(p=>!f.has('ups'+p));
 const swUp=n=>up(n)&&powerOn;
 const lane=(fw,sw)=>{const role='LAN_'+sw.toUpperCase();const p=s.firewall_ports_per_member.find(p=>p.role===role);return up(fw)&&powerOn&&swUp(sw)&&up(fw+':'+p.port);};
 const wans=fw=>s.wan_handoffs.filter(h=>{
  const p=s.firewall_ports_per_member.find(p=>p.provider===h.provider);
  return up(fw)&&powerOn&&up('wan:'+h.provider)&&up('cpe:'+h.provider)&&up('handoff:'+h.provider)&&up('ups'+h.power_group)&&up(fw+':'+p.port)&&up('handoff:'+h.provider+':GE1')&&up('handoff:'+h.provider+':'+(fw==='fwA'?'GE2':'GE3'));
 }).map(h=>h.provider);
 const candidates=['fwA','fwB'].filter(fw=>['sw1','sw2'].some(sw=>lane(fw,sw)));
 const active=candidates.find(fw=>wans(fw).length)||candidates[0]||null;
 const syncRole=role=>{const p=s.firewall_ports_per_member.find(p=>p.role===role);return p&&up('fwA')&&up('fwB')&&powerOn&&up('fwA:'+p.port)&&up('fwB:'+p.port)&&up('ha:'+role);};
 return {active_firewall:active,wan_physically_available:active?wans(active):[],gateway_path_available:active!==null,local_switches_available:['sw1','sw2'].filter(swUp),ha2_transport_available:Boolean(syncRole('HA2')||syncRole('HA2_BACKUP')),traffic_through_management_allowed:false,business_continuity_certified:false};
}
function centralCapacity(input,baseHyp,baseInventory,futureRemotes=0){
 const t=baseHyp.traffic,remotes=baseInventory.sites.filter(s=>s.id!=='cm'),cm=baseInventory.sites.find(s=>s.id==='cm');
 const added=input.architecture.future_remote_pcs_each_for_sensitivity_only;
 const remotePcs=remotes.reduce((n,s)=>n+s.pcs,0)+futureRemotes*added;
 const activePhones=remotes.reduce((n,s)=>n+Math.ceil(s.phones*t.normal.active_phone_fraction),0)+futureRemotes*Math.ceil(added*t.normal.active_phone_fraction);
 const tunnelClear=remotePcs*t.normal.data_concurrency*t.normal.mbps_per_active_pc*(1-t.remote_data_internet_fraction)+activePhones*t.voice_envelope_mbps_per_active_endpoint;
 const critical=tunnelClear*(1+input.architecture.data_tunnel_overhead_margin_assumed);
 const full=critical+cm.pcs*t.normal.data_concurrency*t.normal.mbps_per_active_pc+t.normal.external_calls*t.voice_envelope_mbps_per_active_endpoint;
 const u=input.architecture.planning_max_utilization,sum=input.providers.reduce((n,p)=>n+p.model_mbps_assumed,0);
 const evaluate=names=>{const total=input.providers.filter(p=>names.includes(p.id)).reduce((n,p)=>n+p.model_mbps_assumed,0);return {providers:names,ideal_aggregate_nominal_mbps:total,planning_budget_mbps:round(total*u),critical_envelope_fits_ideal_budget:critical<=total*u,full_envelope_fits_ideal_budget:full<=total*u,is_measured_or_guaranteed_capacity:false};};
 return {future_remotes_added:futureRemotes,additional_pcs_are_sensitivity_only:true,remote_pcs:remotePcs,critical_tunnel_envelope_mbps:round(critical),all_reference_traffic_mbps:round(full),single_provider_required_for_full_envelope_mbps:round(full/u),all_wans:evaluate(input.providers.map(p=>p.id)),single_wan_failures:input.providers.map(p=>({failed:p.id,...evaluate(input.providers.filter(q=>q.id!==p.id).map(q=>q.id))})),one_survivor:input.providers.map(p=>evaluate([p.id])),aggregate_is_upper_bound_not_a_bonded_single_flow:true};
}
function build(input,inventory,oldProposal,baseHyp){
 assert.equal(inventory.sites.length,23);assert.equal(inventory.sites.reduce((n,s)=>n+s.pcs,0),650);
 assert.equal(input.prices.usd_tax_factor_illustrative,1.19);
 assert.deepEqual(input.providers.map(p=>p.id).sort(),['entel5g','gtd4g','leo','starlink']);
 assert.equal(input.management.vlan,130);assert.equal(input.management.transit_vlan,131);
 assert.equal(input.management.network_rule,'10.80.N.0/27');assert.equal(input.management.transit_network_rule,'10.80.N.64/29');
 assert.deepEqual(input.management.firewall_mgt_hosts,[10,11]);assert.deepEqual(input.management.handoff_mgt_hosts,[20,21,22,23]);
 assert.equal(input.providers.length,4);assert.equal(new Set(input.providers.map(p=>p.id)).size,4);
 const sites=inventory.sites.map(s=>sitePlan(s,input));sites.forEach(validateSite);
 const allIps=sites.flatMap(s=>[s.management.stack_gateway,...s.management.firewall_mgt,...s.management.handoff_mgt,s.management.stack_transit,s.management.firewall_data_transit]);assert.equal(new Set(allIps).size,allIps.length,'IPAM entre sedes');
 const fx=input.prices.usd_clp_assumed, priced=oldProposal.priced_lines.filter(l=>!['firewall_branch','atp_branch_5y'].includes(l.id));
 for(const id of ['firewall_branch','atp_branch_5y']){const p=input.prices[id],unit=usdUnit(p.unit,fx);priced.push({id,sku:p.sku,quantity:44,source_unit_price:p.unit,currency:'USD',reference_unit_clp:unit,reference_extended_clp:unit*44,source:p.source,kind:p.kind});}
 const optional=[['sdwan_branch_5y_optional',44],['sdwan_central_5y_optional',2]].map(([id,quantity])=>{const p=input.prices[id],unit=usdUnit(p.unit,fx);return {id,sku:p.sku,quantity,currency:'USD',source_unit_price:p.unit,reference_unit_clp:unit,reference_extended_clp:unit*quantity,source:p.source,kind:p.kind};});
 const subtotal=priced.reduce((n,l)=>n+l.reference_extended_clp,0),optionalTotal=optional.reduce((n,l)=>n+l.reference_extended_clp,0);
 return {as_of:input.as_of,status:input.status,predecessor:'propuesta-optimizada-2026-10-17.json',architecture:input.architecture,counts:{initial_locations:23,remotes:22,corporate_router_chassis:0,firewalls_branch:44,firewalls_central:2,access_switches:46,wan_handoff_switch_allowance:92,cpe_or_terminals:92,stack_kits:46,phones:650,branch_lan_sfp_1g_modules:176,central_lan_sfp_10g_modules:8,branch_lan_fiber_patch_pairs:88,central_lan_fiber_patch_pairs:4,central_hsci_dac:1,wan_copper_patch_allowance:276,management_copper_patch_allowance:138,ha_copper_patch_allowance:69,ups_target:46,new_ups_to_purchase:null,branch_secondary_fw_power_adapters:44,access_secondary_psus_allowance:46,future6_additional_firewalls:12,future6_additional_access_switches:12,future6_additional_handoff_allowance:24,future6_additional_cpe:24,future_phones:null},tunnels:{branch_wans:4,central_endpoints:4,per_branch_candidate_tunnels:16,initial_candidate_tunnels:352,future_candidate_tunnels:448,passive_peer_does_not_double_tunnels:true,max_equal_cost_forwarding_paths_to_one_destination:4,tunnel_limits_by_version_verified:false},sites,capacity:{current:centralCapacity(input,baseHyp,inventory),future_sensitivity:centralCapacity(input,baseHyp,inventory,6)},budget:{fx_usd_clp_assumed:fx,tax_factor_illustrative:1.19,priced_lines:priced,priced_partial_clp:subtotal,optional_sdwan_lines:optional,optional_sdwan_partial_clp:optionalTotal,priced_partial_with_optional_sdwan_clp:subtotal+optionalTotal,handoff_observation_excluded:{...input.prices.handoff_observation_excluded,quantity_allowance:92,displayed_extended_clp:92*input.prices.handoff_observation_excluded.displayed_unit_clp,included_in_priced_partial:false},complete_project_total_clp:null,net_tco_saving_clp:null,comparison_with_historical_A_same_phone:{historical_A_priced_partial_clp:oldProposal.results.previous_A_priced_subtotal_clp-oldProposal.results.phone_reference_difference_clp,c4_minus_historical_A_priced_partial_clp:subtotal-(oldProposal.results.previous_A_priced_subtotal_clp-oldProposal.results.phone_reference_difference_clp),is_equivalent_commercial_offer:false,cisco_crypto_licenses_and_four_wan_adaptation_unpriced:true},unpriced_required:['Switches CM y sus licencias/bundle','Distribución WAN o entregas dobles CPE por proveedor','92 CPE/terminales, datos/mensualidades y direcciones públicas','Ópticas 1G/10G, fibras, DAC HSCI, cobre, racks y tierra','Soporte local, seguridad complementaria y sexto año','Segundo PSU/adaptador, dos dominios UPS y autonomía','Gestión central, DNS local y parámetros/versiones routing/VPN','Continuidad de aplicaciones, backup, almacenamiento y telefonía','Migración, coexistencia, instalación, flete/importación y contingencia']},implementation:{running_after_profile_migrated:false,before_profile_changed:false,hardware_or_service_certified:false,purchase_authorized:false}};
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,'docs',f),'utf8'));
 const result=build(read('entradas-propuesta-cuatro-wan.json'),read('base-infraestructura-antes.json'),read('propuesta-optimizada-2026-10-17.json'),read('hipotesis-carga-base.json'));
 const expected=JSON.stringify(result,null,2)+'\n',dest=path.join(root,'docs/propuesta-cuatro-wan-2026-10-17.json');
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(dest,'utf8'),expected,'Regenerar plano C4');else fs.writeFileSync(dest,expected);
 console.log('C4: '+result.sites.length+' planos; 4 WAN por sitio; '+result.tunnels.initial_candidate_tunnels+' túneles candidatos; CLP '+result.budget.priced_partial_clp.toLocaleString('es-CL')+' parcial, total completo desconocido.');
}
module.exports={usdUnit,firewallPorts,sitePlan,validateSite,inspect,centralCapacity,build};
