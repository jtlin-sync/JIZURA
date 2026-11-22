#!/usr/bin/env node
/* Layout-form regression checks. No browser dependencies: node tools/test_layout_forms.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const canvas = () => ({ getContext: () => ({ measureText: text => ({ width: [...text].length * 10 }) }) });
const context = vm.createContext({ window: {}, console, Intl, performance,
  document: { createElement: canvas }, setTimeout, clearTimeout });
for (const name of fs.readdirSync(path.join(root, 'src')).sort()) {
  if (!name.endsWith('.js') || /^(09_|10_|11_export|12_)/.test(name)) continue;
  vm.runInContext(fs.readFileSync(path.join(root, 'src', name), 'utf8'), context, { filename: name });
}
const J = context.window.J;
const clone = obj => JSON.parse(JSON.stringify(obj));
const project = (layout = 'calendar') => Object.assign(J.defaultProject(), { title: '', lyrics: '春夏秋冬\n風が吹く\n夜明けの空',
  seed: 42, overrides: { 0: { single: true, layout }, 1: { single: true, layout: 'mixed' }, 2: { single: true, layout: 'labels' } } });
const cutOf = (plan, li = 0) => plan.cuts.find(c => c.line === li && c.layout !== 'interlude');
const force = (p, value, layout = p.overrides[0].layout) => { p.overrides[0].cutTech = { 0: { layoutForm: { layout, value } } }; };

// Every named variant is covered; weights and aspect-dependent subsets must not change numbering.
let count = 0;
for (const [key, def] of Object.entries(J.LAYOUTS)) {
  if (def.special) continue;
  if (/\bvariant\b/.test(String(def.plan))) assert.equal(def.forms?.param, 'variant', key + ' needs form metadata');
  if (!def.forms) continue;
  count++;
  assert.equal(new Set(def.forms.values).size, def.forms.values.length, key + ' duplicate forms');
  for (const aspect of ['16:9', '9:16']) for (const text of ['春', '春夏秋冬', '風が吹き抜ける夜明けの空', 'Hello world']) {
    const [W, H] = J.designSize(aspect);
    for (const seed of [1, 42, 93]) {
      const params = def.plan(J.rng(seed), { text, n: J.glyphCount(text), W, H, dur: 2 }, J.resolveStyle(project()));
      assert.ok(def.forms.values.some(v => (def.forms.parse ? def.forms.parse(v) : v) === params[def.forms.param]), key + ' missing value ' + params[def.forms.param]);
      const cut = { layout: key, text, params, dur: 2 };
      const state = J.layoutFormState(cut, { W, H });
      assert.ok(state && state.options.length === def.forms.values.length, key + ' missing state');
      assert.ok(state.options.some(o => o.enabled), key + ' no available forms');
      for (const option of state.options.filter(o => o.enabled)) {
        const next = clone(cut);
        J.applyLayoutForm(next, { W, H }, { layout: key, value: option.value });
        assert.equal(J.layoutFormState(next, { W, H }).value, option.value, key + ' wrong applied form');
      }
    }
  }
}

const p = project(), before = J.plan(p), first = cutOf(before);
const value = first.params.variant === 'month' ? 'himekuri' : 'month';
force(p, value);
const after = J.plan(p), changed = cutOf(after);
assert.equal(changed.params.variant, value);
const expected = clone(first); expected.params.variant = value;
assert.deepEqual(clone(changed), expected, 'changing form changed another setting of the cut');
assert.deepEqual(clone(after.cuts.filter(c => c !== changed)), clone(before.cuts.filter(c => c !== first)), 'other cuts changed');
assert.deepEqual(clone(after.events), clone(before.events), 'events changed');
assert.equal(cutOf(J.plan(clone(p))).params.variant, value, 'project round trip lost the form');
p.seed++;
assert.equal(cutOf(J.plan(p)).params.variant, value, 'reroll lost the manual form');
delete p.overrides[0].cutTech;
p.seed = 42;
assert.deepEqual(clone(J.plan(p).cuts), clone(before.cuts), 'automatic did not restore the original plan');

// Locked snapshots are immutable; form edits and clearing offsets apply on top.
p.overrides[0].lock = true;
p.overrides[0].lockedSeed = before.lines[0].seed;
p.overrides[0].lockedCuts = J.lineSnapshot(before, 0);
const snapshot = clone(p.overrides[0].lockedCuts);
force(p, value);
assert.equal(cutOf(J.plan(p)).params.variant, value, 'locked cut could not change form');
assert.deepEqual(clone(p.overrides[0].lockedCuts), snapshot, 'form edit mutated the lock snapshot');
force(p, '__invalid__');
assert.equal(cutOf(J.plan(p)).params.variant, first.params.variant, 'invalid form was applied');
force(p, value, 'circle');
assert.equal(cutOf(J.plan(p)).params.variant, first.params.variant, 'form leaked to a different layout');

const lantern = project('chochin');
for (const value of ['single', 'row', 'single']) {
  force(lantern, value);
  const c = cutOf(J.plan(lantern));
  assert.equal(c.params.units.join(''), '春夏秋冬', 'lantern form lost text');
  assert.equal(c.params.units.length, value === 'single' ? 1 : 4, 'lantern grouping did not follow the form');
}
const split = project('calendar'); split.centerFree = true;
force(split, 'himekuri');
const twin = cutOf(J.plan(split));
assert.equal(twin.params.variant, 'himekuri');
assert.equal(twin.companion.params.variant, 'himekuri', 'split cut did not share the selected form');

const portrait = project('headlineDeck'); portrait.aspect = '9:16';
const portPlan = J.plan(portrait), portCut = cutOf(portPlan), state = J.layoutFormState(portCut, portPlan);
assert.equal(state.options.find(o => o.value === 'split').number, 3);
assert.equal(state.options.find(o => o.value === 'split').enabled, false);
force(portrait, 'split');
assert.equal(cutOf(J.plan(portrait)).params.variant, portCut.params.variant, 'unavailable form was applied');

const offset = project('circle');
offset.overrides[0].cutTech = { 0: { layoutForm: { layout: 'circle', value: 'ring' }, zeroOffset: 'circle' } };
assert.equal(cutOf(J.plan(offset)).params.variant, 'ring', 'offset reset removed the selected form');
// Centre's line choice changes only the boolean flag and survives saves, locks and rerolls.
const centre = project('center'), centreBefore = J.plan(centre), firstCentre = cutOf(centreBefore);
for (const value of ['withLine', 'withoutLine', 'withLine']) {
  force(centre, value);
  const changedPlan = J.plan(clone(centre)), current = cutOf(changedPlan);
  const expected = clone(firstCentre); expected.params.under = value === 'withLine';
  assert.deepEqual(clone(current), expected, 'centre form changed another cut setting');
  assert.deepEqual(clone(changedPlan.cuts.filter(c => c.line !== 0)), clone(centreBefore.cuts.filter(c => c.line !== 0)), 'centre form changed other cuts');
  assert.deepEqual(clone(changedPlan.events), clone(centreBefore.events), 'centre form changed events');
  assert.equal(J.layoutFormState(current, changedPlan).value, value, 'centre form did not round trip');
}
delete centre.overrides[0].cutTech;
assert.deepEqual(clone(J.plan(centre)), clone(centreBefore), 'centre auto did not restore the original plan');
for (const value of ['withLine', 'withoutLine']) {
  force(centre, value);
  centre.seed++;
  assert.equal(cutOf(J.plan(centre)).params.under, value === 'withLine', 'centre reroll lost choice');
}
const lockedCentre = project('center'), lockedCentrePlan = J.plan(lockedCentre);
lockedCentre.overrides[0].lock = true;
lockedCentre.overrides[0].lockedSeed = lockedCentrePlan.lines[0].seed;
lockedCentre.overrides[0].lockedCuts = J.lineSnapshot(lockedCentrePlan, 0);
const lockedSnapshot = clone(lockedCentre.overrides[0].lockedCuts);
for (const value of ['withLine', 'withoutLine']) {
  force(lockedCentre, value);
  assert.equal(cutOf(J.plan(lockedCentre)).params.under, value === 'withLine', 'locked centre ignored choice');
}
assert.deepEqual(clone(lockedCentre.overrides[0].lockedCuts), lockedSnapshot, 'centre mutated locked snapshot');
const splitCentre = project('center'); splitCentre.centerFree = true;
for (const value of ['withLine', 'withoutLine']) {
  force(splitCentre, value);
  const cut = cutOf(J.plan(splitCentre));
  assert.equal(cut.params.under, value === 'withLine');
  assert.equal(cut.companion.params.under, value === 'withLine', 'split centre did not share line choice');
}
console.log(`OK: ${count} layouts; forms, isolation, persistence, locks, text, split scenes, constraints and reset compatibility`);
