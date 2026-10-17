'use strict';
const assert=require('node:assert/strict'),m=require('../network/wan-capacity-plan.cjs');
const input=require('../docs/entradas-propuesta-cuatro-wan.json'),hyp=require('../docs/hipotesis-carga-base.json'),base=require('../docs/base-infraestructura-antes.json');
const before=JSON.stringify([input,hyp,base]),r=m.build(input,hyp,base);
assert.equal(JSON.stringify([input,hyp,base]),before,'No mutar el escenario original');
const current=r.cases[0];assert.equal(current.demand.full_envelope_mbps,282.908);assert.equal(current.demand.single_survivor_target_mbps,405);
for(const c of r.cases){
 assert.equal(c.wan_subsets.length,16);assert.equal(new Set(c.wan_subsets.map(s=>s.survivors.join(','))).size,16);
 const empty=c.wan_subsets[0];assert.equal(empty.full_fits_ideal_budget,false);assert.equal(empty.full_deficit_mbps,c.demand.full_envelope_mbps);
 for(const s of c.wan_subsets){assert.equal(s.service_certified,false);assert.equal(s.contracted_upstream_mbps,null);assert.equal(s.contracted_downstream_mbps,null);}
 for(const group of c.power_group_failures){assert.equal(group.survivors.length,2);assert.ok(group.survivors.every(id=>input.providers.find(p=>p.id===id).power_group!==group.failed_power_group));}
 const target=c.demand.single_survivor_target_mbps;
 assert.equal(m.evaluate([{id:'engineering',model_mbps_assumed:target}],c.demand,0.7).full_fits_ideal_budget,true);
 assert.equal(m.evaluate([{id:'engineering',model_mbps_assumed:target-1}],c.demand,0.7).full_fits_ideal_budget,false);
}
assert.equal(current.power_group_failures.find(p=>p.failed_power_group==='A').nominal_ideal_sum_mbps,190);
assert.ok(r.cases[3].demand.full_envelope_mbps>r.cases[1].demand.full_envelope_mbps);
assert.ok(r.cases[3].demand.remote_pcs>775,'Incluir crecimiento por sede, no solo las seis nuevas');
const boundary={vpn_envelope_mbps:70,full_envelope_mbps:70};assert.equal(m.evaluate([{id:'x',model_mbps_assumed:100}],boundary,0.7).full_deficit_mbps,0);
const bad=structuredClone(input);bad.architecture.planning_max_utilization=0;assert.throws(()=>m.build(bad,hyp,base));
assert.throws(()=>m.demand(input,hyp,base,{futureRemotes:0.5}));
console.log('Capacidad WAN: 64 combinaciones, grupos UPS, crecimiento por sede, límites de admisión y contratos desconocidos OK.');
