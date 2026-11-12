/** The rule a sized control breaks when its rendered height is not the `--control-*` token that sizes it. */
export const CONTROL_HEIGHT_RULE = 'CONTROL-HEIGHT';

/**
 * The statements of the control-height check inside the frame script of `render-check`. They use `root`, `report`,
 * `px` and `unseen` of that script. An element is sized by a `--control-*` token when a rule that matches it sets
 * `height` or `block-size` to the token, or sets a custom property from the token that the element's own `height`,
 * `block-size`, `min-height` or block padding reads, when that custom property's computed value is the one this rule
 * writes and the reading declaration is the one in effect (an override such as `p-0` opts out, and so does a fixed `height` of its own).
 * Its border-box height, read from its computed style so a scaled thumbnail measures the same, must match the token
 * within 0.5px. Nested rules, `@layer` and `@media` blocks are followed; an element sized by two tokens is skipped.
 */
export const CONTROL_HEIGHT_STATEMENTS = `
  const controlRules = [];
  const collectControlRules = (rules, parent) => {
    for (const rule of rules) {
      let selector = parent;
      if (rule.selectorText !== undefined) {
        const own = rule.selectorText;
        selector = !parent ? own : own.includes('&') ? own.replaceAll('&', ':is(' + parent + ')') : ':is(' + parent + ') :is(' + own + ')';
      }
      if (rule.style && selector) controlRules.push({ selector, style: rule.style });
      if (rule.cssRules) collectControlRules(rule.cssRules, selector);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      collectControlRules(sheet.cssRules, null);
    } catch {}
  }
  const matchesRule = (element, rule) => {
    try {
      return element.matches(rule.selector);
    } catch {
      return false;
    }
  };
  const sizingProperties = ['height', 'block-size', 'min-height', 'min-block-size', 'padding', 'padding-block', 'padding-top', 'padding-bottom', 'padding-block-start', 'padding-block-end'];
  const controlTokenOf = (value) => [...value.matchAll(/var\\(\\s*(--control-[\\w-]+)/g)].map((match) => match[1]);
  const substituted = (value, style, depth = 0) => {
    let out = '';
    for (let at = 0; at < value.length; ) {
      const start = value.indexOf('var(', at);
      if (start < 0 || depth > 8) return out + value.slice(at);
      out += value.slice(at, start);
      let level = 1;
      let end = start + 4;
      for (; end < value.length && level > 0; end++) level += value[end] === '(' ? 1 : value[end] === ')' ? -1 : 0;
      const inner = value.slice(start + 4, end - 1);
      const comma = inner.indexOf(',');
      const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
      const own = style.getPropertyValue(name).trim();
      out += own || substituted(comma < 0 ? '' : inner.slice(comma + 1).trim(), style, depth + 1);
      at = end;
    }
    return out;
  };
  const squeezed = (value) => value.replace(/\\s+/g, '');
  const tokenPx = (value, element) => {
    const match = /^(-?[\\d.]+)(px|rem|em)$/.exec(value.trim());
    if (!match) return null;
    const size = Number(match[1]);
    if (match[2] === 'px') return size;
    return size * px(getComputedStyle(match[2] === 'rem' ? document.documentElement : element).fontSize);
  };
  const probedIn = (element, name, value, read) => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position: absolute; visibility: hidden';
    probe.style.setProperty(name, value);
    element.appendChild(probe);
    const result = read(getComputedStyle(probe), getComputedStyle(element));
    probe.remove();
    return result;
  };
  const fixedHeight = (element) =>
    controlRules.some((other) =>
      ['height', 'block-size'].some((name) => {
        const value = other.style.getPropertyValue(name);
        if (!value || value === 'auto' || value.includes('--control-') || !matchesRule(element, other)) return false;
        return probedIn(element, 'height', value, (probed, own) => /px$/.test(probed.height) && Math.abs(px(probed.height) - px(own.height)) < 0.01);
      }),
    );
  const sidesOf = (name) => (/^padding/.test(name) ? ['padding-top', 'padding-bottom'] : [name]);
  const readsSizing = (element, property) => {
    for (const other of controlRules) {
      for (const name of sizingProperties) {
        const value = other.style.getPropertyValue(name);
        if (!value.includes('var(' + property) || !matchesRule(element, other)) continue;
        if (probedIn(element, name, value, (probed, own) => sidesOf(name).every((side) => Math.abs(px(probed.getPropertyValue(side)) - px(own.getPropertyValue(side))) < 0.01)))
          return true;
      }
    }
    return false;
  };
  const tokensOfControl = new Map();
  for (const rule of controlRules) {
    for (let index = 0; index < rule.style.length; index++) {
      const property = rule.style[index];
      const value = rule.style.getPropertyValue(property);
      const tokens = controlTokenOf(value);
      if (tokens.length !== 1) continue;
      const custom = property.startsWith('--');
      if (!custom && property !== 'height' && property !== 'block-size') continue;
      let elements;
      try {
        elements = root.querySelectorAll(rule.selector);
      } catch {
        continue;
      }
      for (const element of elements) {
        if (custom) {
          const style = getComputedStyle(element);
          if (squeezed(style.getPropertyValue(property)) !== squeezed(substituted(value, style))) continue;
          if (!readsSizing(element, property) || fixedHeight(element)) continue;
        }
        const found = tokensOfControl.get(element) ?? new Set();
        found.add(tokens[0]);
        tokensOfControl.set(element, found);
      }
    }
  }
  for (const [element, tokens] of tokensOfControl) {
    if (tokens.size !== 1 || element.getClientRects().length === 0 || unseen(element)) continue;
    const token = [...tokens][0];
    const style = getComputedStyle(element);
    const expected = tokenPx(style.getPropertyValue(token), element);
    if (expected === null || !/px$/.test(style.height)) continue;
    const frame = style.boxSizing === 'content-box' ? px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth) : 0;
    const height = px(style.height) + frame;
    if (Math.abs(height - expected) > 0.5)
      report('${CONTROL_HEIGHT_RULE}', element, 'renders ' + Number(height.toFixed(2)) + 'px high, its token ' + token + ' is ' + Number(expected.toFixed(2)) + 'px');
  }
`;
