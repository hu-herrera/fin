// Pruebas reproducibles del motor WAN. Ejecutar: node tests/wan.test.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
function sourceOf(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'Falta función ' + name);
  const brace = html.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw Error('Función incompleta: ' + name);
}
const ctx = {
  PRIORITY: ['starlink', 'kuiper', 'g5', 'g4'],
  SEDES: [{ id: 's01', code: 'S01' }],
  ST: { mode: 'despues', links: { s01: { starlink: 'activo', kuiper: 'standby', g5: 'standby', g4: 'standby' } }, failback: {}, evCount: 0 },
  isWanInterfaceAdminDown: () => false,
  linkPriority: () => ['starlink', 'kuiper', 'g5', 'g4'],
  needDespues: () => false, addLog: () => {}, _refresh: () => {}, setTimeout: () => {},
  Date
};
vm.createContext(ctx);
vm.runInContext(['activeLink', 'recompute', 'sc_e7', 'runFailbackCountdown'].map(sourceOf).join('\n'), ctx);
let passed = 0;
function test(label, expected) {
  assert.equal(vm.runInContext("activeLink('s01')", ctx), expected, label);
  passed++;
  console.log('OK', label);
}
test('Primario Starlink', 'starlink');
ctx.ST.links.s01.starlink = 'caido'; ctx.recompute('s01');
test('Conmutación Amazon Leo', 'kuiper');
ctx.ST.links.s01.kuiper = 'caido'; ctx.recompute('s01');
test('Conmutación 5G', 'g5');
ctx.sc_e7();
test('Retorno pendiente no adelanta ruta', 'g5');
ctx.ST.failback.s01.startedAt -= 6000; ctx.runFailbackCountdown();
test('Retorno estable a Starlink', 'starlink');
ctx.ST.links.s01.starlink = 'caido'; ctx.recompute('s01'); ctx.sc_e7();
ctx.ST.links.s01.starlink = 'caido'; ctx.ST.failback.s01.pending = false;
ctx.ST.failback.s01.startedAt -= 6000; ctx.runFailbackCountdown();
test('Nueva caída cancela retorno', 'g5');
ctx.ST.links.s01.g5 = 'caido'; ctx.recompute('s01');
test('Último respaldo GTD 4G', 'g4');
ctx.ST.links.s01.g4 = 'caido'; ctx.recompute('s01');
test('Sin enlaces no hay conectividad', null);
console.log('Total:', passed, 'pruebas correctas');
