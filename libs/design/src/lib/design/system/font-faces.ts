export const FONT_FACE_RULE = 'FONT-FACE';

const FONT_FACE_LOAD_MS = 5000;

const SYSTEM_FONTS = [
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'math',
  'emoji',
  'fangsong',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Helvetica',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Times',
  'Courier New',
  'Menlo',
  'Consolas',
  'Monaco',
  'SF Pro',
  'SF Mono',
  'Ubuntu',
  'Cantarell',
  'Noto Sans',
  'Noto Serif',
  'Liberation Sans',
  'DejaVu Sans',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Impact',
  'Palatino',
  'Garamond',
  'Apple Color Emoji',
  'Segoe UI Emoji',
];

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
  const failed = new Set();
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
    if (status !== 'loaded') failed.add(family);
    if (status !== 'loaded')
      found.push({ rule: '${FONT_FACE_RULE}', path: '@font-face', detail: '@font-face "' + family + '" from ' + src + ' does not load (FontFace status ' + status + '), so its text draws in a fallback font' });
  }
  await document.fonts?.ready;
  const system = new Set(${JSON.stringify(SYSTEM_FONTS)}.map((name) => name.toLowerCase()));
  const canvas = document.createElement('canvas').getContext('2d');
  const widthOf = (family) => {
    canvas.font = '40px ' + family;
    return canvas.measureText('mmmmmmmmmmlli1WQ@').width;
  };
  const available = (family) => {
    const quoted = '"' + family + '"';
    if ([...(document.fonts ?? [])].some((face) => face.family.replace(/^['"]|['"]$/g, '') === family && face.status === 'loaded')) return true;
    return ['monospace', 'serif', 'sans-serif'].some((generic) => widthOf(quoted + ', ' + generic) !== widthOf(generic));
  };
  const root = document.getElementById('root') ?? document.body;
  const named = new Map();
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (![...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) continue;
    const primary = getComputedStyle(element).fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
    if (primary && !system.has(primary.toLowerCase()) && !named.has(primary)) named.set(primary, element);
  }
  if (canvas)
    for (const family of named.keys())
      if (!failed.has(family) && !available(family))
        found.push({ rule: '${FONT_FACE_RULE}', path: '@font-face', detail: 'font "' + family + '" is named by the design but did not load in the shot, so its text draws in a fallback font: self-host it (a woff2 file in the product assets and an @font-face rule), never a CDN stylesheet such as fonts.googleapis.com' });
  return found;
})()`;
