/** The rule a disabled control breaks when a forced hover or active changes how it looks. */
export const DISABLED_INTERACTION_RULE = 'DISABLED-INTERACTION';

/**
 * The statements of the disabled-interaction check inside the frame script of `render-check`. They use `root` and
 * `report` of that script. They measure each disabled element plain, then with `data-et-force` hover and active, and
 * restore the element, so they run last.
 */
export const DISABLED_INTERACTION_STATEMENTS = `
  const disabledLook = (element) => {
    const style = getComputedStyle(element);
    return ['backgroundColor', 'color', 'borderColor', 'boxShadow', 'outline', 'opacity', 'transform'].map((name) => [name, style[name]]);
  };
  for (const element of root.querySelectorAll(':disabled, [aria-disabled="true"]')) {
    if (element.getClientRects().length === 0) continue;
    const before = element.getAttribute('data-et-force');
    const transition = element.style.transition;
    element.style.transition = 'none';
    element.removeAttribute('data-et-force');
    const plain = disabledLook(element);
    const changed = new Set();
    for (const interaction of ['hover', 'active']) {
      element.setAttribute('data-et-force', interaction);
      disabledLook(element).forEach(([name, value], index) => {
        if (value !== plain[index][1]) changed.add(name);
      });
    }
    if (before === null) element.removeAttribute('data-et-force');
    else element.setAttribute('data-et-force', before);
    element.style.transition = transition;
    if (changed.size > 0)
      report('${DISABLED_INTERACTION_RULE}', element, 'hover/active styles apply while disabled - add a :not([disabled]) guard (changes ' + [...changed].join(', ') + ')');
  }
`;
