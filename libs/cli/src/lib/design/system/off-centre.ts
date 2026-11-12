/** The rule a single line of text breaks when it sits off the vertical centre of its filled or bordered box. */
export const OFF_CENTRE_RULE = 'OFF-CENTRE';

/**
 * The statements of the off-centre check inside the frame script of `render-check`. They use `root`, `report`, `px`,
 * `invisible`, `unseen`, `clippedAway` and `metrics` of that script. A box with a background or a border that holds one line of text,
 * and nothing that reaches above or below that line, must have the same gap above the capitals as below the baseline
 * (1px tolerance), and no icon in it may stick out of the box by more than 0.5px. A box counts only when a background
 * or a border on both the top and the bottom closes it, its line box is not all of it, its row is not aligned to the
 * top, and no form control in it draws text the walker cannot measure. Text in a scaled box is measured at its scale;
 * visually hidden text is skipped.
 */
export const OFF_CENTRE_STATEMENTS = `
  const backed = (style) => (style.backgroundColor && !invisible(style.backgroundColor)) || style.backgroundImage !== 'none';
  const bordered = (style, side) => px(style['border' + side + 'Width']) > 0 && style['border' + side + 'Style'] !== 'none' && !invisible(style['border' + side + 'Color']);
  const filled = (style) => backed(style) || ['Top', 'Right', 'Bottom', 'Left'].some((side) => bordered(style, side));
  const boxOfText = (node) => {
    for (let at = node.parentElement; at && at !== root; at = at.parentElement) if (filled(getComputedStyle(at))) return at;
    return null;
  };
  const textLines = new Map();
  const capWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = capWalker.nextNode(); node; node = capWalker.nextNode()) {
    if (!node.textContent.trim() || node.parentElement.closest('svg, style, script, template') || clippedAway(node.parentElement)) continue;
    const box = boxOfText(node);
    if (!box) continue;
    metrics.font = getComputedStyle(node.parentElement).font;
    const measured = metrics.measureText(node.textContent);
    const cap = metrics.measureText('H').actualBoundingBoxAscent;
    const range = document.createRange();
    range.selectNodeContents(node);
    const lines = textLines.get(box) ?? [];
    for (const rect of range.getClientRects()) {
      if (rect.width === 0 || rect.height === 0) continue;
      const drawnScale = rect.height / (measured.fontBoundingBoxAscent + measured.fontBoundingBoxDescent);
      const scale = Math.abs(drawnScale - 1) > 0.05 ? drawnScale : 1;
      const baseline = rect.top + scale * measured.fontBoundingBoxAscent;
      lines.push({ top: rect.top, bottom: rect.bottom, capTop: baseline - scale * cap, baseline });
    }
    textLines.set(box, lines);
  }
  for (const [box, lines] of textLines) {
    if (lines.length === 0 || unseen(box)) continue;
    const top = Math.min(...lines.map((line) => line.top));
    const bottom = Math.max(...lines.map((line) => line.bottom));
    const middleOf = (line) => (line.top + line.bottom) / 2;
    if (!lines.every((line) => lines.every((other) => middleOf(line) > other.top && middleOf(line) < other.bottom))) continue;
    const rect = box.getBoundingClientRect();
    if (rect.height > 4 * (bottom - top)) continue;
    const style = getComputedStyle(box);
    const centred =
      (backed(style) || (bordered(style, 'Top') && bordered(style, 'Bottom'))) &&
      !(px(style.paddingTop) === 0 && px(style.paddingBottom) === 0 && rect.height <= bottom - top + 1) &&
      !(/flex/.test(style.display) && /^row/.test(style.flexDirection) && /^(flex-start|start|self-start)$/.test(style.alignItems)) &&
      !box.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select, [contenteditable]:not([contenteditable=false])');
    const drawn = [...box.querySelectorAll('*')].filter((element) => element.getClientRects().length > 0 && !element.closest('svg *'));
    if (drawn.some((element) => {
      const inner = element.getBoundingClientRect();
      return inner.height > 0 && (inner.bottom <= top || inner.top >= bottom);
    })) continue;
    const above = Math.min(...lines.map((line) => line.capTop)) - rect.top;
    const below = rect.bottom - Math.max(...lines.map((line) => line.baseline));
    if (centred && Math.abs(above - below) > 1)
      report('${OFF_CENTRE_RULE}', box, 'the text sits ' + Math.abs(above - below).toFixed(1) + 'px ' + (above < below ? 'high' : 'low') + ' in its box: ' + above.toFixed(1) + 'px above the capitals, ' + below.toFixed(1) + 'px below the baseline');
    for (const icon of box.querySelectorAll('svg, img, .et-icon')) {
      if (icon.parentElement.closest('svg') || icon.getClientRects().length === 0) continue;
      const inner = icon.getBoundingClientRect();
      const past = Math.max(rect.top - inner.top, inner.bottom - rect.bottom, rect.left - inner.left, inner.right - rect.right);
      if (past > 0.5) report('${OFF_CENTRE_RULE}', box, 'an icon sticks ' + past.toFixed(1) + 'px out of the box');
    }
  }
`;
