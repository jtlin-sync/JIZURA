#!/usr/bin/env node
/* Per-cut font regression checks. Run: node tools/test_layout_fonts.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = vm.createContext({ window: {}, console, Intl, performance, setTimeout, clearTimeout,
  document: { createElement: () => ({ getContext: () => ({ measureText: text => ({ width: [...text].length * 10 }) }) }) } });
for (const name of fs.readdirSync(path.join(root, 'src')).sort()) {
  if (!name.endsWith('.js') || /^(09_|10_|11_export|12_)/.test(name)) continue;
  vm.runInContext(fs.readFileSync(path.join(root, 'src', name), 'utf8'), context, { filename: name });
}
const J = context.window.J, clone = o => JSON.parse(JSON.stringify(o));
const project = layout => Object.assign(J.defaultProject(), { title: '', seed: 42, lang: 'ja',
  lyrics: '春夏秋冬\n風が吹く\n春夏秋冬', overrides: { 0: { single: true, layout }, 1: { single: true }, 2: { single: true } } });
const first = plan => plan.cuts.find(c => c.line === 0 && !J.LAYOUTS[c.layout].special);
const force = (p, key) => { p.overrides[0].cutTech = { 0: { layoutFont: key } }; };

// All registered layouts can switch without changing any non-font parameter.
let count = 0;
const style = J.resolveStyle(J.defaultProject());
for (const [layout, def] of Object.entries(J.LAYOUTS)) {
  if (def.special) continue;
  count++;
  for (const [W, H] of [[1920, 1080], [1080, 1920]]) for (const seed of [1, 42]) {
    const params = def.plan(J.rng(seed), { text: '春夏秋冬 Hello world', n: 16, W, H, dur: 3 }, style);
    const before = clone(params), cut = { layout, params, weightGrow: true };
    assert.ok(J.layoutFontState(cut), layout + ' has no font state');
    const names = [...J.layoutFontParams(cut)];
    J.applyLayoutFont(cut, 'brush');
    assert.deepEqual(clone(params), before, layout + ' mutated shared params');
    assert.deepEqual(clone(J.layoutFontState(cut).keys), ['brush'], layout + ' did not replace all font slots');
    assert.equal(cut.weightGrow, undefined, layout + ' still overrides the chosen face');
    for (const key of Object.keys(before)) {
      if (!names.includes(key)) assert.deepEqual(cut.params[key], params[key], layout + ' changed ' + key);
    }
  }
}
// Font names collide with shape names: those shapes must stay intact.
for (const field of ['shape', 'anchor', 'fulc', 'mark']) {
  const cut = { layout: 'center', params: { font: 'dela', [field]: 'round' } };
  assert.deepEqual(clone(J.layoutFontState(cut).keys), ['dela']);
  J.applyLayoutFont(cut, 'mincho');
  assert.equal(cut.params[field], 'round');
}
const mixed = { layout: 'mixed', params: { fontBig: 'dela', fontSmall: 'mincho', mode: 'wave' } };
assert.equal(J.layoutFontState(mixed).labels.length, 2);
J.applyLayoutFont(mixed, 'brush');
assert.equal(mixed.params.fontBig, 'brush'); assert.equal(mixed.params.fontSmall, 'brush');
const specimen = { layout: 'typeSpecimen', params: { main: 'dela', fonts: ['dot', 'mincho', 'brush'] } };
J.applyLayoutFont(specimen, 'round');
assert.deepEqual(clone(specimen.params), { main: 'round', fonts: ['round', 'round', 'round'] });

// Changing one cut survives saves, leaves timings/events/other cuts intact, and Auto restores it.
for (const layout of ['center', 'mixed', 'typeSpecimen', 'bubble']) {
  const p = project(layout), before = J.plan(p), c = first(before);
  force(p, 'brush');
  const after = J.plan(clone(p)), expected = clone(c);
  J.applyLayoutFont(expected, 'brush');
  assert.deepEqual(clone(first(after)), clone(expected), layout + ' changed non-font cut settings');
  assert.deepEqual(clone(after.cuts.filter(x => x !== first(after))), clone(before.cuts.filter(x => x !== c)), layout + ' changed other cuts');
  assert.deepEqual(clone(after.events), clone(before.events), layout + ' changed events');
  assert.deepEqual(clone(after.lines), clone(before.lines), layout + ' changed timing');
  assert.ok(J.fontsOfPlan(after).includes('brush'), 'loader missed the chosen font');
  delete p.overrides[0].cutTech;
  assert.deepEqual(clone(J.plan(p)), clone(before), layout + ' Auto did not restore the plan');
  force(p, 'brush'); p.seed++;
  assert.deepEqual(clone(J.layoutFontState(first(J.plan(p))).keys), ['brush'], 'reroll lost the choice');
}

// Locked snapshots, split scenes, forms and zero offsets all compose with font edits.
const locked = project('center'), lockedPlan = J.plan(locked);
locked.overrides[0].lock = true;
locked.overrides[0].lockedSeed = lockedPlan.lines[0].seed;
locked.overrides[0].lockedCuts = J.lineSnapshot(lockedPlan, 0);
const snapshot = clone(locked.overrides[0].lockedCuts);
force(locked, 'brush');
assert.equal(first(J.plan(locked)).params.font, 'brush');
assert.deepEqual(clone(locked.overrides[0].lockedCuts), snapshot, 'mutated lock snapshot');
delete locked.overrides[0].cutTech;
assert.deepEqual(clone(first(J.plan(locked)).params), snapshot[0].params, 'Auto lost the locked fonts');
const split = project('center'); split.centerFree = true;
split.overrides[0].cutTech = { 0: { layoutFont: 'brush', layoutForm: { layout: 'center', value: 'withoutLine' }, zeroOffset: 'center' } };
const splitCut = first(J.plan(split));
for (const cut of [splitCut, splitCut.companion]) {
  assert.equal(cut.params.font, 'brush'); assert.equal(cut.params.under, false);
  assert.equal(cut.params.ox, 0); assert.equal(cut.params.oy, 0);
}
const invalid = project('mixed'), invalidPlan = clone(J.plan(invalid));
for (const key of ['missing', '__proto__', 'constructor', { key: 'brush' }, null]) {
  force(invalid, key);
  assert.deepEqual(clone(J.plan(invalid)), invalidPlan, 'invalid font changed the plan');
}
J.addUserFont('user_test', 'My uploaded font', 'Test Family', 400);
force(invalid, 'user_test');
assert.deepEqual(clone(J.layoutFontState(first(J.plan(invalid))).labels), ['My uploaded font']);
J.setLang('zh-Hans');
assert.deepEqual(clone(J.layoutFontState({ layout: 'center', params: { font: 'gothic_black' } }).labels), ['Noto Sans SC 900']);
assert.deepEqual(clone(J.layoutFontState({ layout: 'center', params: { font: 'gothic_black' }, weightGrow: true }).labels), ['Noto Sans JP']);
J.setLang('ja');
assert.deepEqual(clone(J.layoutFontState({ layout: 'center', params: { font: 'gothic_black' } }, 'zh-Hans').labels), ['Noto Sans SC 900']);
assert.equal(J.lang, 'ja', 'reading font names changed the rendering language');
console.log(`OK: ${count} layouts; font fields, mixed fonts, isolation, saves, auto, locks, splits, forms, invalid keys and language faces`);
