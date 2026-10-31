/** A text token and the surface token it is drawn on, as `--name`. */
export type ContrastPair = { text: string; on: string };

/** What the contrast check of one frame measures: the selectors exempt from it and the token pairs to compute. */
export type ContrastOptions = { exceptions: string[]; pairs: ContrastPair[]; scheme: ColorScheme | null };

/** A colour scheme a product renders. */
export type ColorScheme = 'light' | 'dark';

/** The schemes a product renders: both when a stylesheet of it holds a `prefers-color-scheme` query or `light-dark(`, else the one the browser starts with. */
export const schemesOf = (stylesheets: (string | null)[]): (ColorScheme | null)[] =>
  stylesheets.some((source) => source !== null && /prefers-color-scheme|light-dark\(/.test(source))
    ? ['light', 'dark']
    : [null];

const CONTRAST_NORMAL = 4.5;
const CONTRAST_LARGE = 3;
const CONTRAST_NON_TEXT = 3;

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
    const solidImageOf = (style) => {
      const solid = /^linear-gradient\\(([a-z-]+\\([^()]*\\)), \\1\\)$/.exec(style.backgroundImage);
      return solid ? rgbaOf(solid[1]) : null;
    };
    const imageOf = (style) => style.backgroundImage !== 'none' && solidImageOf(style) === null;
    const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3]));
    const fade = (inner, behind, opacity) => [0, 1, 2].map((i) => inner[i] * opacity + behind[i] * (1 - opacity));
    const chainOf = (element) => {
      const chain = [];
      for (let at = element; at; at = at.parentElement) chain.unshift(at);
      return chain;
    };
    const createsContext = (element) => {
      if (element === document.documentElement) return true;
      const style = getComputedStyle(element);
      const flexed = /flex|grid/.test(getComputedStyle(element.parentElement).display);
      return (style.zIndex !== 'auto' && (style.position !== 'static' || flexed)) || style.position === 'fixed' || style.position === 'sticky' ||
        parseFloat(style.opacity) < 1 || style.isolation === 'isolate' || style.transform !== 'none' || style.filter !== 'none' || style.mixBlendMode !== 'normal';
    };
    const contextOf = (element) => {
      let at = element;
      while (!createsContext(at)) at = at.parentElement;
      return at;
    };
    let layers = null;
    const layerOf = (style, self, start, rect) => {
      const context = contextOf(start);
      let opacity = parseFloat(style.opacity);
      for (let at = start; at !== context; at = at.parentElement) opacity *= parseFloat(getComputedStyle(at).opacity);
      return { self, context, rect, opacity, z: parseInt(style.zIndex, 10), color: rgbaOf(style.backgroundColor), solid: solidImageOf(style), image: imageOf(style) };
    };
    const layersOf = () => {
      if (layers) return layers;
      layers = [];
      for (const element of document.querySelectorAll('*')) {
        const style = getComputedStyle(element);
        if (element.parentElement && style.position !== 'static' && parseInt(style.zIndex, 10) < 0 && style.visibility === 'visible')
          layers.push(layerOf(style, element, element.parentElement, element.getBoundingClientRect()));
        if (style.position === 'static') continue;
        for (const pseudo of ['::before', '::after']) {
          const at = getComputedStyle(element, pseudo);
          if (at.content === 'none' || at.content === 'normal' || at.position !== 'absolute' || !(parseInt(at.zIndex, 10) < 0) || at.visibility !== 'visible') continue;
          const px = (name) => parseFloat(at[name]) || 0;
          const content = at.boxSizing !== 'border-box';
          const box = element.getBoundingClientRect();
          const left = box.left + element.clientLeft - element.scrollLeft + px('left');
          const top = box.top + element.clientTop - element.scrollTop + px('top');
          const width = px('width') + (content ? px('paddingLeft') + px('paddingRight') + px('borderLeftWidth') + px('borderRightWidth') : 0);
          const height = px('height') + (content ? px('paddingTop') + px('paddingBottom') + px('borderTopWidth') + px('borderBottomWidth') : 0);
          layers.push(layerOf(at, null, element, { left, top, right: left + width, bottom: top + height }));
        }
      }
      layers.sort((a, b) => a.z - b.z);
      return layers;
    };
    const pixelOf = (chain, index, behind, ink, under) => {
      const style = getComputedStyle(chain[index]);
      const paint = (color, solid, at) => (solid ? over(solid, over(color, at)) : over(color, at));
      const filled = under[index].reduce((at, layer) => fade(paint(layer.color, layer.solid, at), at, layer.opacity), paint(rgbaOf(style.backgroundColor), solidImageOf(style), behind));
      const inner = index + 1 < chain.length ? pixelOf(chain, index + 1, filled, ink, under) : ink ? over(ink, filled) : filled;
      return fade(inner, behind, parseFloat(style.opacity));
    };
    const luminanceOf = (rgb) => {
      const [r, g, b] = rgb.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrastOf = (element, point, ink, ground) => {
      const chain = chainOf(element);
      if (chain.some((at) => imageOf(getComputedStyle(at)))) return null;
      const under = chain.map(() => []);
      for (const layer of layersOf()) {
        const index = chain.indexOf(layer.context);
        const { left, top, right, bottom } = layer.rect;
        if (index < 0 || layer.self?.contains(element) || point.x < left || point.x > right || point.y < top || point.y > bottom) continue;
        if (layer.image) return null;
        under[index].push(layer);
      }
      const white = [1, 1, 1];
      const [light, dark] = [luminanceOf(pixelOf(chain, 0, white, ink, under)), luminanceOf(pixelOf(ground ? chain.slice(0, ground) : chain, 0, white, null, under))].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };
    const ratioOf = (element, point) => contrastOf(element, point, rgbaOf(getComputedStyle(element).color));
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
      const box = [...range.getClientRects()].find((rect) => rect.width > 1 && rect.height > 1);
      if (!box) continue;
      const ratio = ratioOf(element, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
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
        detail: '"' + (text.length > 32 ? text.slice(0, 31) + '…' : text) + '" ' + shown(ratio) + (options.contrast.scheme ? ' in the ' + options.contrast.scheme + ' scheme' : '') + ', needs ' + shown(limit) +
          (large ? ' (large text)' : '') + '; on purpose: definePart({ contrast: { exceptions: [{ selector, reason }] } })',
      });
    }
    const inScheme = options.contrast.scheme ? ' in the ' + options.contrast.scheme + ' scheme' : '';
    const offWrapper = (element) => {
      const controls = [...element.querySelectorAll('input, select, textarea, button')];
      return controls.length > 0 && controls.every(offControl);
    };
    const skipped = (element) => element.closest(':disabled, [aria-disabled="true"], [inert]') !== null || inOffLabel(element) || offWrapper(element) || exempt(element) ||
      getComputedStyle(element).visibility !== 'visible' || chainOf(element).some((at) => parseFloat(getComputedStyle(at).opacity) === 0);
    const nonText = (kind, element, ratio) => {
      const path = pathOf(element);
      if (contrastSeen.has(kind + ' ' + path)) return;
      contrastSeen.add(kind + ' ' + path);
      found.push({
        rule: 'CONTRAST',
        path,
        detail: kind + ' ' + shown(ratio) + inScheme + ', needs ' + shown(${CONTRAST_NON_TEXT}) + ' (non-text); on purpose: definePart({ contrast: { exceptions: [{ selector, reason }] } })',
      });
    };
    const bordersOf = (element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return ['Top', 'Right', 'Bottom', 'Left'].flatMap((side) => {
        const width = parseFloat(style['border' + side + 'Width']) || 0;
        if (width <= 0 || ['none', 'hidden'].includes(style['border' + side + 'Style'])) return [];
        const color = rgbaOf(style['border' + side + 'Color']);
        if (color[3] <= 0) return [];
        const x = side === 'Left' ? box.left + width / 2 : side === 'Right' ? box.right - width / 2 : box.left + box.width / 2;
        const y = side === 'Top' ? box.top + width / 2 : side === 'Bottom' ? box.bottom - width / 2 : box.top + box.height / 2;
        return [{ color, point: { x, y } }];
      });
    };
    const controlSelector = 'input:not([type="hidden"]), select, textarea, button, [data-et-control], [role="button"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="option"], [role="textbox"], [role="combobox"], [role="slider"], [role="menuitem"]';
    const frameSelector = 'input:not([type="hidden"]), [data-et-control]';
    const frames = new Set();
    const hugs = (frame) => {
      if (frame.matches('[role="toolbar"]') || bordersOf(frame).length !== 4) return false;
      const boxes = [...frame.querySelectorAll(frameSelector)].map((control) => control.getBoundingClientRect());
      const width = Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left));
      const height = Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top));
      return width * 2 >= frame.clientWidth && height * 2 >= frame.clientHeight;
    };
    const surfaceOf = (element) => [...element.classList].find((name) => name.startsWith('et-surface--'));
    const floating = (element) => {
      if (element.matches('.et-overlay')) return true;
      const own = surfaceOf(element);
      if (!own || getComputedStyle(element).boxShadow === 'none') return false;
      for (let at = element.parentElement; at; at = at.parentElement) {
        const step = surfaceOf(at);
        if (step) return step !== own;
      }
      return true;
    };
    const wrappers = new Set();
    for (const control of root.querySelectorAll(frameSelector)) {
      for (let at = control; at && at !== root.parentElement; at = at.parentElement) {
        if (bordersOf(at).length === 0) continue;
        if (at !== control) wrappers.add(at);
        break;
      }
    }
    for (const wrapper of wrappers) if (hugs(wrapper)) frames.add(wrapper);
    for (const element of [root, ...root.querySelectorAll('*')]) {
      if (element.closest('svg, style, script, template')) continue;
      if (!element.matches(controlSelector) && !frames.has(element)) continue;
      const box = element.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) continue;
      const sides = bordersOf(element);
      if (sides.length === 0 || skipped(element) || floating(element)) continue;
      const ground = chainOf(element).length - 1;
      const fill = contrastOf(element, { x: box.left + box.width / 2, y: box.top + box.height / 2 }, null, ground);
      if (fill === null || fill >= ${CONTRAST_NON_TEXT}) continue;
      const ratios = sides.map(({ color, point }) => contrastOf(element, point, color, ground));
      if (ratios.includes(null)) continue;
      const lowest = Math.min(...ratios);
      if (lowest < ${CONTRAST_NON_TEXT}) nonText('border', element, lowest);
    }
    const paintOf = (style, paint, opacity) => {
      const value = style[paint];
      if (!value || value === 'none' || value.startsWith('url(')) return null;
      const [r, g, b, a] = rgbaOf(/currentcolor/i.test(value) ? style.color : value);
      const alpha = a * (parseFloat(style[opacity]) || 0);
      return alpha > 0 ? [r, g, b, alpha] : null;
    };
    for (const icon of [root, ...root.querySelectorAll('svg')]) {
      if (icon.tagName.toLowerCase() !== 'svg' || icon.parentElement?.closest('svg') || skipped(icon)) continue;
      if (icon.closest('[aria-hidden="true"]') && !icon.closest(controlSelector)) continue;
      const shapes = [...icon.querySelectorAll('path, circle, ellipse, line, polygon, polyline, rect, text, use')].filter((shape) => !shape.closest('defs, clipPath, mask, symbol, pattern, marker'));
      const ratios = shapes.flatMap((shape) => {
        const style = getComputedStyle(shape);
        const box = shape.getBoundingClientRect();
        if (style.visibility !== 'visible' || (box.width <= 0 && box.height <= 0)) return [];
        const point = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        const stroked = (parseFloat(style.strokeWidth) || 0) > 0;
        return [paintOf(style, 'fill', 'fillOpacity'), stroked ? paintOf(style, 'stroke', 'strokeOpacity') : null]
          .filter((ink) => ink !== null)
          .map((ink) => contrastOf(shape, point, ink));
      });
      if (ratios.length === 0 || ratios.includes(null)) continue;
      const best = Math.max(...ratios);
      if (best < ${CONTRAST_NON_TEXT}) nonText('icon', icon, best);
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
      const box = sample.getBoundingClientRect();
      const ratio = ratioOf(sample, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
      surface.remove();
      if (ratio !== null && ratio < ${CONTRAST_NORMAL})
        found.push({ rule: 'CONTRAST', path: pair.text + ' on ' + pair.on, detail: 'token pair ' + shown(ratio) + (options.contrast.scheme ? ' in the ' + options.contrast.scheme + ' scheme' : '') + ', needs ' + shown(${CONTRAST_NORMAL}) });
    }
    probe.remove();
  }
`;
