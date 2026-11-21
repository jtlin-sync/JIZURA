/* JIZURA — named, discrete forms within a layout. Form numbers follow this
   explicit order (never the random weights or the currently available subset). */
(() => {
'use strict';
const define = (key, param, values, extra = {}) => {
  if (J.LAYOUTS[key]) J.LAYOUTS[key].forms = Object.assign({ param, values: values.split(' ') }, extra);
};
const variants = {
  vcols: 'repeat split', labels: 'radial rows scatter', circle: 'disc eclipse ring',
  orbit: 'ring atom wide', credits: 'center side single', splitHalves: 'slide shear duo',
  curtain: 'side shutter rise', tape: 'single cross stack', magazine: 'headline vertical plate',
  headlineDeck: 'top bottom split', contents: 'rows tate', numbered: 'cols rows behind',
  poster: 'stack block tate', swissGrid: 'a b', dictionary: 'entry page', newspaper: 'yoko tate',
  vinyl: 'sleeve label', bookSpine: 'shelf pile', letterPaper: 'tate yoko', calendar: 'month himekuri',
  chochin: 'single row', kakejiku: 'kake yoko', shoji: 'shadow open', warningLabel: 'header stripe side',
  priceTag: 'hang shelf', nameTag: 'hello school', karuta: 'single pair',
};
for (const [key, values] of Object.entries(variants)) define(key, 'variant', values);
const modes = {
  mixed: 'line stair wave', perspective: 'floor side', bounceLine: 'wave beat hop',
  kanjiFocus: 'dim outline tint', flag: 'unfurl raise', shadowPlay: 'floor wall',
  fisheye: 'sweep pingpong', origami: 'blintz gate', halftoneBig: 'duo tone',
  knSwapCenter: 'roll punch slide', tyKeySplit: 'kanji mid', tyCross: 'kanji mid', tyErode: 'grow erode',
  xbDonut: 'seg gauge', xdUpSide: 'alt pairs', xdSlowSpread: 'open close', xdPointSym: 'tb corner',
  xdStretchEcho: 'up both', xdColumnEcho: 'alt pair', xdSkyline: 'wave rand',
  tzHook: 'kanji mid', tzTrackClose: 'close open', tzHorizon: 'sink hang', tzZoomBox: 'kanji mid', tzWideOne: 'kanji mid last',
};
for (const [key, values] of Object.entries(modes)) define(key, 'mode', values);
const shapes = {
  bubble: 'round ellipse thought', hanging: 'arc wave random stair', searchBar: 'pill rect',
  dotMatrix: 'round square', halfVertical: 'rowCol colRow', routeMap: 'straight bend',
  bulbs: 'board arrow double', xaInitialPlate: 'sq circle tall', xcBunting: 'tri tail sq', xdRipple: 'ring square',
};
for (const [key, values] of Object.entries(shapes)) define(key, 'shape', values);
const styles = {
  stack: 'fade outline', frameBox: 'full double corners', tunnel: 'outline fill alt',
  keycaps: 'light dark', bubbles: 'soap solid mixed', slotMachine: 'cabinet window', flipBoard: 'ink fg',
  zoomRepeat: 'alt outline fill', depthStack: 'outline dim lines', equalizer: 'bars blocks mirror',
  crowdBubbles: 'mixed outline filled', tyCropGiant: 'dim outline', xaSpacers: 'x fill hatch',
  xbDiamond: 'plate outline', xbCircleFit: 'plate ring', xbTriangleSet: 'plate outline', xcPlate: 'eu us two',
  xdBrick: 'line fill', xdPivotFan: 'outline dim', xdDrum: 'outline dim', xdCyclic: 'dim outline',
  xdSunShadow: 'fill lines', xdSkewSweep: 'outline dim', xdSpiralEcho: 'outline dim', xdStitch: 'dash knot',
  tzDetail: 'solid accent outline',
};
for (const [key, values] of Object.entries(styles)) define(key, 'style', values);
define('ring', 'orient', 'tangent upright');
define('elastic', 'orient', 'h v diag');
define('splitScreen', 'split', 'v h diag');
define('xcSelect', 'ui', 'mobile desktop');

// Match the layout's own text/geometry limits, including its render-time fallbacks.
const latin = c => /[A-Za-z]/.test(c.text);
const port = c => c.H > c.W * 1.08;
const rules = {
  vcols: { allowed: (v, c) => v !== 'repeat' || c.n <= 9, current: c => c.n > 9 ? 'split' : c.params.variant },
  credits: { allowed: (v, c) => v !== 'side' || c.W >= c.H, current: c => c.W < c.H && c.params.variant === 'side' ? 'center' : c.params.variant },
  tape: { allowed: (v, c) => v !== 'cross' || c.n <= (c.H > c.W ? 5 : 9) },
  magazine: { allowed: (v, c) => v !== 'vertical' || !latin(c), current: c => latin(c) && c.params.variant === 'vertical' ? 'headline' : c.params.variant },
  headlineDeck: { allowed: (v, c) => v !== 'split' || !port(c), current: c => port(c) && c.params.variant === 'split' ? 'top' : c.params.variant },
  contents: { allowed: (v, c) => v !== 'tate' || !port(c) && !latin(c) },
  numbered: { allowed: (v, c) => v !== 'cols' || !port(c) && (c.params.chunks || []).length <= 3,
    current: c => c.params.variant === 'cols' && (port(c) || (c.params.chunks || []).length > 3) ? 'rows' : c.params.variant },
  poster: { allowed: (v, c) => v !== 'tate' || !latin(c), current: c => latin(c) && c.params.variant === 'tate' ? 'stack' : c.params.variant },
  swissGrid: { allowed: (v, c) => v !== 'b' || (c.params.chunks || []).length > 1, current: c => (c.params.chunks || []).length <= 1 ? 'a' : c.params.variant },
  newspaper: { allowed: (v, c) => v !== 'tate' || !latin(c) },
  vinyl: { allowed: (v, c) => v !== 'label' || c.n <= 6 },
  bookSpine: { allowed: (v, c) => v !== 'shelf' || !latin(c) },
  letterPaper: { allowed: (v, c) => v !== 'tate' || !latin(c) },
  chochin: { allowed: (v, c) => v !== 'single' || c.n <= 6 && !latin(c) },
  kakejiku: { allowed: (v, c) => v !== 'yoko' || !port(c), current: c => port(c) ? 'kake' : c.params.variant },
  elastic: { allowed: (v, c) => port(c) ? v === 'v' || v === 'h' && c.n <= 5 : v !== 'v' },
  splitScreen: { allowed: (v, c) => v !== 'v' || !port(c) },
};
for (const [key, rule] of Object.entries(rules)) if (J.LAYOUTS[key] && J.LAYOUTS[key].forms) Object.assign(J.LAYOUTS[key].forms, rule);

const partsOf = cut => cut.companion && typeof cut.companion === 'object' ? [cut, cut.companion] : [cut];
const context = (cut, plan) => ({ text: cut.text || '', n: J.glyphCount(cut.text || ''),
  W: cut.zone ? cut.zone.w : plan.W, H: cut.zone ? cut.zone.h : plan.H, dur: cut.dur, params: cut.params || {} });
J.layoutFormState = (cut, plan) => {
  const def = cut && J.LAYOUTS[cut.layout], form = def && def.forms;
  if (!form || def.special || !plan) return null;
  const contexts = partsOf(cut).map(part => context(part, plan)), c = contexts[0];
  const value = form.current ? form.current(c) : c.params[form.param];
  if (!form.values.includes(value)) return null;
  return { value, options: form.values.map((v, i) => ({ value: v, number: i + 1,
    enabled: contexts.every(part => !form.allowed || form.allowed(v, part)) })) };
};
J.applyLayoutForm = (cut, plan, choice) => {
  if (!choice || choice.layout !== cut.layout) return;
  const state = J.layoutFormState(cut, plan);
  if (!state || !state.options.some(o => o.value === choice.value && o.enabled)) return;
  const def = J.LAYOUTS[cut.layout];
  for (const part of partsOf(cut)) {
    const params = Object.assign({}, part.params, { [def.forms.param]: choice.value });
    if (def.formParams) Object.assign(params, def.formParams(params, context(part, plan)));
    part.params = params;
  }
};
})();
