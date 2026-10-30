/** A text token and the surface token it is drawn on, as `--name`. */
export type ContrastPair = { text: string; on: string };

/** What the contrast check of one frame measures: the selectors exempt from it and the token pairs to compute. */
export type ContrastOptions = { exceptions: string[]; pairs: ContrastPair[] };

const CONTRAST_NORMAL = 4.5;
const CONTRAST_LARGE = 3;

const tokenNamesOf = (value: unknown) =>
  (Array.isArray(value) ? value : [value]).filter(
    (name): name is string => typeof name === 'string' && /^--[\w-]+$/.test(name),
  );

/**
 * The token pairs of a part's `contrast.pairs`: each entry lists `text` tokens and the `on` tokens they are drawn
 * on, and every text token pairs with every surface token of its entry.
 */
export const contrastPairsOf = (value: unknown): ContrastPair[] =>
  (Array.isArray(value) ? value : []).flatMap((entry: { text?: unknown; on?: unknown } | null) =>
    tokenNamesOf(entry?.on).flatMap((on) => tokenNamesOf(entry?.text).map((text) => ({ text, on }))),
  );

/** The exceptions of a part's `contrast.exceptions`, split into the valid selectors and a problem for each other entry. */
export const contrastExceptionsOf = (value: unknown) => {
  const entries = Array.isArray(value) ? value : [];
  const valid = (entry: { selector?: unknown; reason?: unknown } | null) =>
    typeof entry?.selector === 'string' &&
    entry.selector.trim() !== '' &&
    typeof entry.reason === 'string' &&
    entry.reason.trim() !== '';

  return {
    selectors: entries.filter(valid).map((entry: { selector: string }) => entry.selector),
    problems: entries
      .filter((entry) => !valid(entry))
      .map(
        (entry) =>
          `contrast exception ${JSON.stringify(entry)} needs a selector and a reason, for example { selector: '.watermark', reason: 'decorative' }`,
      ),
  };
};

/**
 * The statements of the contrast check inside the frame script of `render-check`. They use `root`, `pathOf`,
 * `found` and `options.contrast` of that script. They finish the frame's finite animations to measure the end
 * state, so they run after the other checks, which measure the frame as it settled.
 */
export const CONTRAST_STATEMENTS = `
  if (options.contrast) {
    const contrast = options.contrast;
    for (const animation of document.getAnimations())
      if (animation.effect?.getComputedTiming().endTime !== Infinity) animation.finish();
    const probe = document.createElement('i');
    probe.style.display = 'none';
    document.body.append(probe);
    const parsed = new Map();
    const rgbaOf = (value) => {
      if (parsed.has(value)) return parsed.get(value);
      probe.style.color = 'color-mix(in srgb, ' + value + ' 100%, transparent)';
      const text = getComputedStyle(probe).color;
      const numbers = [...text.matchAll(/-?[\\d.]+(?:e-?\\d+)?/g)].map((match) => parseFloat(match[0]));
      const srgb = text.startsWith('color(');
      const [r = 0, g = 0, b = 0] = (srgb ? numbers : numbers.map((number) => number / 255)).map((channel) => Math.min(1, Math.max(0, channel)));
      const rgba = [r, g, b, numbers[3] ?? 1];
      parsed.set(value, rgba);
      return rgba;
    };
    const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3]));
    const fade = (inner, behind, opacity) => [0, 1, 2].map((i) => inner[i] * opacity + behind[i] * (1 - opacity));
    const chainOf = (element) => {
      const chain = [];
      for (let at = element; at; at = at.parentElement) chain.unshift(at);
      return chain;
    };
    const pixelOf = (chain, index, behind, text) => {
      const style = getComputedStyle(chain[index]);
      const filled = over(rgbaOf(style.backgroundColor), behind);
      const inner = index + 1 < chain.length ? pixelOf(chain, index + 1, filled, text) : text ? over(rgbaOf(style.color), filled) : filled;
      return fade(inner, behind, parseFloat(style.opacity));
    };
    const luminanceOf = (rgb) => {
      const [r, g, b] = rgb.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratioOf = (element) => {
      const chain = chainOf(element);
      if (chain.some((at) => getComputedStyle(at).backgroundImage !== 'none')) return null;
      const white = [1, 1, 1];
      const [light, dark] = [luminanceOf(pixelOf(chain, 0, white, true)), luminanceOf(pixelOf(chain, 0, white, false))].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };
    const shown = (ratio) => ratio.toFixed(2) + ':1';
    const contrastSeen = new Set();
    const exempt = (element) => contrast.exceptions.some((selector) => {
      try {
        return element.closest(selector) !== null;
      } catch {
        return false;
      }
    });
    for (const selector of contrast.exceptions)
      try {
        document.querySelector(selector);
      } catch {
        found.push({ rule: 'CONTRAST', path: '-', detail: 'contrast exception selector "' + selector + '" is not a valid selector' });
      }
    const offControl = (control) => control !== null && (control.matches(':disabled') || control.closest('[aria-disabled="true"]') !== null);
    const offLabels = new Set();
    for (const label of document.querySelectorAll('label[for]'))
      if (offControl(document.getElementById(label.htmlFor))) offLabels.add(label);
    for (const label of document.querySelectorAll('label'))
      if ([...label.querySelectorAll('*')].some(offControl)) offLabels.add(label);
    for (const control of document.querySelectorAll('[aria-labelledby]'))
      if (offControl(control))
        for (const id of control.getAttribute('aria-labelledby').split(/\\s+/)) {
          const label = document.getElementById(id);
          if (label) offLabels.add(label);
        }
    const inOffLabel = (element) => [...offLabels].some((label) => label.contains(element));
    const texts = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = texts.nextNode(); node; node = texts.nextNode()) {
      const element = node.parentElement;
      if (!element || !node.textContent.trim() || element.closest('svg, style, script, template')) continue;
      if (element.closest(':disabled, [aria-disabled="true"], [inert]') || inOffLabel(element) || exempt(element)) continue;
      const style = getComputedStyle(element);
      if (style.visibility !== 'visible') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (![...range.getClientRects()].some((rect) => rect.width > 1 && rect.height > 1)) continue;
      const ratio = ratioOf(element);
      if (ratio === null) continue;
      const size = parseFloat(style.fontSize) || 0;
      const large = size >= 24 || (size >= 18.66 && parseInt(style.fontWeight, 10) >= 700);
      const limit = large ? ${CONTRAST_LARGE} : ${CONTRAST_NORMAL};
      if (ratio >= limit) continue;
      const path = pathOf(element);
      if (contrastSeen.has(path)) continue;
      contrastSeen.add(path);
      const text = node.textContent.trim().replace(/\\s+/g, ' ');
      found.push({
        rule: 'CONTRAST',
        path,
        detail: '"' + (text.length > 32 ? text.slice(0, 31) + '…' : text) + '" ' + shown(ratio) + ', needs ' + shown(limit) +
          (large ? ' (large text)' : '') + '; on purpose: definePart({ contrast: { exceptions: [{ selector, reason }] } })',
      });
    }
    for (const pair of contrast.pairs) {
      const missing = [pair.text, pair.on].filter((name) => getComputedStyle(root).getPropertyValue(name).trim() === '');
      if (missing.length > 0) {
        found.push({ rule: 'CONTRAST', path: pair.text + ' on ' + pair.on, detail: 'token ' + missing.join(', ') + ' is not defined' });
        continue;
      }
      const surface = document.createElement('div');
      surface.style.background = 'var(' + pair.on + ')';
      const sample = document.createElement('span');
      sample.style.color = 'var(' + pair.text + ')';
      sample.textContent = 'Aa';
      surface.append(sample);
      root.append(surface);
      const ratio = ratioOf(sample);
      surface.remove();
      if (ratio !== null && ratio < ${CONTRAST_NORMAL})
        found.push({ rule: 'CONTRAST', path: pair.text + ' on ' + pair.on, detail: 'token pair ' + shown(ratio) + ', needs ' + shown(${CONTRAST_NORMAL}) });
    }
    probe.remove();
  }
`;
