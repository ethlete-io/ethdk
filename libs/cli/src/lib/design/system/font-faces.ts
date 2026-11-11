export const FONT_FACE_RULE = 'FONT-FACE';

const FONT_FACE_LOAD_MS = 5000;

/**
 * Loads each `@font-face` rule of the drawn frame as a FontFace and answers one problem per rule that does not reach
 * status `loaded`, naming its family and source. A string, not a function: the build would add helpers to a function's
 * source that the page does not have.
 */
export const FONT_FACES_SCRIPT = `(async () => {
  const facesOf = (rules, base) => [...rules].flatMap((rule) => {
    if (rule.constructor.name === 'CSSFontFaceRule') return [{ rule, base }];
    return rule.cssRules ? facesOf(rule.cssRules, base) : [];
  });
  const faces = [...document.styleSheets].flatMap((sheet) => {
    try {
      return facesOf(sheet.cssRules, sheet.href ?? document.baseURI);
    } catch {
      return [];
    }
  });
  const found = [];
  const seen = new Set();
  for (const { rule, base } of faces) {
    const family = rule.style.getPropertyValue('font-family').trim().replace(/^['"]|['"]$/g, '');
    const src = rule.style.getPropertyValue('src').trim();
    if (!family || !src || seen.has(family + src)) continue;
    seen.add(family + src);
    const absolute = src.replace(/url\\(\\s*(['"]?)([^'")]+)\\1\\s*\\)/g, (whole, quote, url) => {
      try {
        return 'url("' + new URL(url, base).href + '")';
      } catch {
        return whole;
      }
    });
    const descriptors = {};
    for (const [name, key] of [['font-weight', 'weight'], ['font-style', 'style'], ['font-stretch', 'stretch'], ['unicode-range', 'unicodeRange']]) {
      const value = rule.style.getPropertyValue(name).trim();
      if (value) descriptors[key] = value;
    }
    let status = 'error';
    try {
      const face = new FontFace(family, absolute, descriptors);
      await Promise.race([face.load().catch(() => undefined), new Promise((done) => setTimeout(done, ${FONT_FACE_LOAD_MS}))]);
      status = face.status;
    } catch {
      status = 'error';
    }
    if (status !== 'loaded')
      found.push({ rule: '${FONT_FACE_RULE}', path: '@font-face', detail: '@font-face "' + family + '" from ' + src + ' does not load (FontFace status ' + status + '), so its text draws in a fallback font' });
  }
  return found;
})()`;
