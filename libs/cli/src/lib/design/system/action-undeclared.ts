import { INTERACTIVE_SELECTOR } from './actions';

/** The rule an interactive design element breaks when it declares no `data-et-action`. */
export const ACTION_UNDECLARED_RULE = 'ACTION-UNDECLARED';

const DRAWN_INTERACTIVE_SELECTOR = `:is(${INTERACTIVE_SELECTOR}, [aria-expanded])`;

/**
 * A script for the frame's init: it records every element a click listener is added to, for the
 * ACTION-UNDECLARED statements. It has to run before the drawing's `setup`.
 */
export const CLICK_LISTENER_INIT_SCRIPT = `(() => {
  const clicked = new WeakSet();
  const add = EventTarget.prototype.addEventListener;
  Object.defineProperty(window, '__etClickListened', { value: clicked });
  EventTarget.prototype.addEventListener = function (type, ...rest) {
    if (type === 'click' && this instanceof Element) clicked.add(this);
    return add.call(this, type, ...rest);
  };
})()`;

/**
 * The statements of the ACTION-UNDECLARED check inside the frame script of `render-check`. They use `root`, `partRoot`,
 * `options`, `report`, `ownedOf` and `textOf` of that script. A part whose root is the control leaves its action to the
 * part that uses it, and a click listener on an element around other interactive ones delegates.
 */
export const ACTION_UNDECLARED_STATEMENTS = `
  if (options.part !== null) {
    const interactive = ${JSON.stringify(DRAWN_INTERACTIVE_SELECTOR)};
    const clicked = window.__etClickListened;
    const candidates = [...root.querySelectorAll('*')].filter((element) =>
      element.matches(interactive) || (clicked?.has(element) && !element.querySelector(interactive)));
    const embedded = (element) => {
      for (let at = element.closest('[data-et-control]'); at; at = at.parentElement?.closest('[data-et-control]') ?? null)
        if (options.embedControls.includes(at.getAttribute('data-et-control'))) return true;
      return false;
    };
    for (const element of candidates) {
      if (element.hasAttribute('data-et-action') || element.getClientRects().length === 0 || !ownedOf(element)) continue;
      if (element.matches(':disabled, [aria-disabled="true"]') || element.closest('[inert], [aria-hidden="true"]')) continue;
      if (element === partRoot || embedded(element)) continue;
      const text = (element.getAttribute('aria-label') || textOf(element).trim()).replace(/\\s+/g, ' ');
      const cls = [...element.classList].find((name) => !/^et-(surface|color)--/.test(name));
      const named = element.tagName.toLowerCase() + (cls ? '.' + cls : '') + (text ? ' "' + (text.length > 32 ? text.slice(0, 31) + '…' : text) + '"' : '');
      report('${ACTION_UNDECLARED_RULE}', element, named + ' is interactive but declares no action - add data-et-action="<state>" or "emit:<output>"');
    }
  }
`;
