'use strict';
// Read-only capacity analysis. It does not change the approved VLAN plan.
const {pcInventory}=require('./export-candidate.cjs');
const {VLAN}=require('./redundant-model.cjs');
const CAPACITY=Object.fromEntries(VLAN.map(v=>[v.id,2**(32-v.prefix)-2]));
function capacityAssessment(inventory=pcInventory()){
 const errors=[],warnings=[],sites=[];
 let totalPC=0;
 for(let n=0;n<=22;n++){
   const id=n===0?'cm':'s'+String(n).padStart(2,'0');
   const pcs=inventory[id];
   if(!Number.isInteger(pcs)||pcs<0){
     errors.push(id+': inventario PC inválido');
     continue;
   }
   totalPC+=pcs;
   const sw1=Math.ceil(pcs/2),sw2=Math.floor(pcs/2);
   const row={site:id,pcs,sw1,sw2,userCapacity:CAPACITY[10],
     voiceCapacity:CAPACITY[20],guestCapacity:CAPACITY[40],managementCapacity:CAPACITY[30]};
   sites.push(row);
   if(pcs>CAPACITY[10]-9)
     errors.push(id+': PCs exceden direcciones de VLAN10 disponibles desde .10');
   if(sw1>30||sw2>30)
     errors.push(id+': PCs exceden los puertos 3-32 reservados en un miembro');
   // No se conoce el número de teléfonos IP ni clientes invitados reales.
   // Por ello, una capacidad condicional NO equivale a una avería medida.
   if(pcs>CAPACITY[20])
     warnings.push(id+': '+pcs+' puestos; una telefonía IP por puesto necesitaría '+pcs+
       ' direcciones y VLAN20 /27 sólo ofrece '+CAPACITY[20]+' hosts');
 }
 if(Object.keys(inventory).length!==23)
   errors.push('El inventario no contiene exactamente 23 sedes');
 if(totalPC!==650)
   errors.push('Inventario PC '+totalPC+' distinto de 650');
 return {
   status:errors.length?'FAIL':'PASS_WITH_CAPACITY_NOTES',
   sites,totalPC,errors,warnings,
   constraints:{
     guestHostsPerSite:CAPACITY[40],
     managementHostsPerSite:CAPACITY[30],
     usersHostsPerSite:CAPACITY[10],
     voiceHostsPerSite:CAPACITY[20],
     aggregatePaStackMbps:4000,
     aggregateRouterPaMbps:20000,
     perFlowStackAccessMbps:1000,
     // C9200L-STACK-KIT = dos adaptadores + un cable (datasheet Cisco).
     // Un stack de 2 miembros con dos enlaces traseros necesita 4 adaptadores
     // y 2 cables: dos kits por sede, sujetos a cotización/inventario real.
     physicalStackMembers:46,
     physicalStackwiseAdapters:92,
     physicalStackwiseCables:46,
     minimumC9200LStackKits:46,
     stackKitPartNumber:'C9200L-STACK-KIT',
     stackKitProcurementVerified:false,
     clientAddressing:'STATIC_IN_SIMULATOR; DHCP_SERVER_OR_RELAY_NOT_PROVISIONED',
     limitations:'Valores de enlaces teóricos antes de overhead/negociación; LACP no suma velocidad a un único flujo'
   }
 };
}
if(require.main===module){
 const r=capacityAssessment();
 console.log('IPAM/puertos '+r.status+': '+r.sites.length+' sedes, '+r.totalPC+' PCs.');
 console.log('Capacidad por sede: usuarios '+CAPACITY[10]+', voz '+CAPACITY[20]+
   ', gestión '+CAPACITY[30]+', invitados '+CAPACITY[40]+' hosts.');
 console.log('Advertencias condicionales: '+r.warnings.length);
 for(const item of r.warnings)console.log('WARN '+item);
 for(const item of r.errors)console.error('ERROR '+item);
 if(r.errors.length)process.exitCode=1;
}
module.exports={CAPACITY,capacityAssessment};
