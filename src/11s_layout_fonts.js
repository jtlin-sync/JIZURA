/* JIZURA — per-cut layout fonts. Only named font parameters are editable:
   values such as shape:'round' and anchor:'dot' are not font references. */
(() => {
'use strict';
const fields = ('font fontBig fontSmall tileFont fontB fontC fontH fontL capFont fillFont bigFont sealFont markFont '
  + 'rf fo fonts fb fs fc fr qf pen numFont hf df sf gf fm nf fontS hand').split(' ');
const partsOf = cut => cut && cut.companion && typeof cut.companion === 'object' ? [cut, cut.companion] : cut ? [cut] : [];
const validFont = key => typeof key === 'string' && Object.prototype.hasOwnProperty.call(J.FONTS, key);
J.isLayoutFont = validFont;
J.layoutFontParams = cut => {
  const def = cut && J.LAYOUTS[cut.layout];
  if (!def || def.special) return [];
  const params = cut.params || {};
  const names = def.fontParams || (cut.layout === 'typeSpecimen' ? fields.concat('main') : fields);
  return names.filter(name => validFont(params[name]) || Array.isArray(params[name]) && params[name].some(validFont));
};
J.layoutFontState = (cut, lang = J.lang) => {
  const keys = new Set(), labels = new Set();
  let variable = false;
  for (const part of partsOf(cut)) {
    for (const field of J.layoutFontParams(part)) {
      const value = part.params[field];
      for (const key of (Array.isArray(value) ? value : [value]).filter(validFont)) {
        keys.add(key);
        if (part.weightGrow) {
          variable = true;
          labels.add(J.FONTS[key].kind === 'mincho' ? 'Noto Serif JP' : 'Noto Sans JP');
        } else labels.add((J.faceOf ? J.faceOf(key, lang) : J.FONTS[key]).label);
      }
    }
  }
  return keys.size ? { keys: [...keys], labels: [...labels], variable } : null;
};
J.applyLayoutFont = (cut, key) => {
  if (!validFont(key)) return;
  for (const part of partsOf(cut)) {
    const names = J.layoutFontParams(part);
    if (!names.length) continue;
    // Locked snapshots and repeated lyrics may share params. Never mutate them.
    const params = Object.assign({}, part.params);
    for (const name of names) {
      const value = params[name];
      params[name] = Array.isArray(value) ? value.map(v => validFont(v) ? key : v) : key;
    }
    part.params = params;
    // Weight animation forces Noto Sans/Serif JP, which would hide this choice.
    delete part.weightGrow;
  }
};
})();
