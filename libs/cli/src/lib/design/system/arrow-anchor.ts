/** The rule a drawn anchored-dialog arrow breaks when its tip misses the centre of the element it points at. */
export const ARROW_ANCHOR_RULE = 'ARROW-ANCHOR';

/**
 * The statements of the arrow-anchor check inside the frame script of `render-check`. They use `root` and `report` of
 * that script. A pane with `data-et-arrow-anchor` (from `anchoredDialog({ anchor })`) has its arrow tip measured
 * against the anchor's centre; a drawn anchored-dialog arrow moved by hand without an anchor is reported too, since
 * its offset fits one layout only.
 */
export const ARROW_ANCHOR_STATEMENTS = `
  for (const arrow of root.querySelectorAll('.et-overlay-arrow')) {
    if (arrow.getClientRects().length === 0) continue;
    const pane = arrow.parentElement;
    const selector = pane?.getAttribute('data-et-arrow-anchor');
    if (!selector) {
      if (pane?.classList.contains('et-anchored-dialog-mock') && getComputedStyle(arrow).getPropertyValue('--et-floating-arrow-translate').trim())
        report('${ARROW_ANCHOR_RULE}', arrow, 'the arrow is moved by hand, so it points right in one layout only - name what it points at with anchoredDialog({ anchor }), and the frame aims it');
      continue;
    }
    let anchor = null;
    try {
      anchor = root.querySelector(selector);
    } catch {}
    if (!anchor || anchor.getClientRects().length === 0) {
      report('${ARROW_ANCHOR_RULE}', arrow, 'the arrow anchor "' + selector + '" matches no drawn element');
      continue;
    }
    const vertical = /^(top|bottom)/.test(pane.getAttribute('data-overlay-placement') ?? '');
    const tip = arrow.getBoundingClientRect();
    const target = anchor.getBoundingClientRect();
    const miss = vertical
      ? tip.left + tip.width / 2 - (target.left + target.width / 2)
      : tip.top + tip.height / 2 - (target.top + target.height / 2);
    if (Math.abs(miss) > 1)
      report('${ARROW_ANCHOR_RULE}', arrow, 'the arrow tip is ' + Math.round(Math.abs(miss)) + 'px ' + (vertical ? (miss < 0 ? 'left' : 'right') : miss < 0 ? 'above' : 'below') + ' of the centre of "' + selector + '"');
  }
`;
