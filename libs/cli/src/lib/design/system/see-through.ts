/** The rule an open overlay pane breaks when text of the content under it stays visible through it. */
export const SEE_THROUGH_RULE = 'SEE-THROUGH';

/** An open overlay pane: an SDK or CDK overlay, an open native popover or dialog, or a positioned menu or dialog role. */
export const OVERLAY_PANE_SELECTOR = [
  '.et-overlay',
  '.et-overlay-runtime-pane',
  '.cdk-overlay-pane',
  '[popover]:popover-open',
  'dialog[open]',
  '[role="menu"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
].join(', ');

const SAMPLES_PER_SIDE = 3;
const OPAQUE = 0.95;

/**
 * The statements of the see-through check inside the frame script of `render-check`. They use `root` and `report`
 * of that script. Each point where text outside an open overlay pane lies under that pane must be covered by an
 * opaque background painted above the text, or the text shows through; text outside any overlay that paints above
 * the pane is reported too. They finish finite animations and force `pointer-events` on for the
 * hit test and restore it.
 */
export const SEE_THROUGH_STATEMENTS = `
  {
    const panes = [...document.querySelectorAll(${JSON.stringify(OVERLAY_PANE_SELECTOR)})].filter((pane) => {
      if (pane.getClientRects().length === 0 || getComputedStyle(pane).visibility !== 'visible') return false;
      if (pane.matches('[role]:not(.et-overlay, .et-overlay-runtime-pane, .cdk-overlay-pane, dialog, [popover])') && !['absolute', 'fixed'].includes(getComputedStyle(pane).position)) return false;
      return !pane.parentElement?.closest(${JSON.stringify(OVERLAY_PANE_SELECTOR)});
    });
    if (panes.length > 0) {
      for (const animation of document.getAnimations())
        if (animation.effect?.getComputedTiming().endTime !== Infinity) animation.finish();
      const force = document.createElement('style');
      force.textContent = '* { pointer-events: auto !important; }';
      document.head.append(force);
      const alphaOf = (colour) => {
        if (colour === 'transparent') return 0;
        const slash = /\\/\\s*([\\d.]+)(%?)\\s*\\)$/.exec(colour);
        if (slash) return parseFloat(slash[1]) / (slash[2] ? 100 : 1);
        const rgba = /^rgba\\([^,]+,[^,]+,[^,]+,\\s*([\\d.]+)\\s*\\)$/.exec(colour);
        return rgba ? parseFloat(rgba[1]) : 1;
      };
      const opacityOf = (element) => {
        let opacity = 1;
        for (let at = element; at; at = at.parentElement) opacity *= parseFloat(getComputedStyle(at).opacity);
        return opacity;
      };
      const coverOf = (element) => {
        const style = getComputedStyle(element);
        const solid = element.matches('img, video, canvas, iframe, object, embed') || style.backgroundImage !== 'none' || style.backdropFilter !== 'none';
        return (solid ? 1 : alphaOf(style.backgroundColor)) * opacityOf(element);
      };
      const shown = (element) => {
        const style = getComputedStyle(element);
        return style.visibility === 'visible' && alphaOf(style.color) > 0 && opacityOf(element) > 0;
      };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const texts = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode())
        if (node.textContent.trim() && node.parentElement && !node.parentElement.closest('style, script, template, head')) texts.push(node);
      const samples = ${SAMPLES_PER_SIDE};
      for (const pane of panes) {
        const box = pane.getBoundingClientRect();
        for (const node of texts) {
          const owner = node.parentElement;
          if (pane.contains(owner) || !shown(owner)) continue;
          const floats = owner.closest(${JSON.stringify(OVERLAY_PANE_SELECTOR + ', [role="tooltip"]')}) !== null;
          const range = document.createRange();
          range.selectNodeContents(node);
          let total = 0;
          let through = 0;
          let above = 0;
          for (const rect of range.getClientRects()) {
            const left = Math.max(rect.left, box.left, 0);
            const top = Math.max(rect.top, box.top, 0);
            const right = Math.min(rect.right, box.right, innerWidth);
            const bottom = Math.min(rect.bottom, box.bottom, innerHeight);
            if (right - left < 1 || bottom - top < 1) continue;
            for (let row = 0; row < samples; row++)
              for (let column = 0; column < samples; column++) {
                const x = left + 0.5 + ((right - left - 1) * column) / (samples - 1);
                const y = top + 0.5 + ((bottom - top - 1) * row) / (samples - 1);
                const stack = document.elementsFromPoint(x, y);
                const under = stack.indexOf(owner);
                const paneAt = stack.findIndex((element) => element === pane || pane.contains(element));
                if (under < 0 || paneAt < 0) continue;
                total++;
                if (paneAt > under) {
                  if (!floats) above++;
                  continue;
                }
                const clear = stack.slice(0, under).reduce((rest, element) => (element.contains(owner) ? rest : rest * (1 - coverOf(element))), 1);
                if (1 - clear < ${OPAQUE}) through++;
              }
          }
          if (through === 0 && above === 0) continue;
          const text = node.textContent.trim().replace(/\\s+/g, ' ');
          const name = owner.localName + (owner.classList[0] ? '.' + owner.classList[0] : '');
          const quoted = '"' + (text.length > 32 ? text.slice(0, 31) + '…' : text) + '" (' + name + ')';
          if (above > 0) report(${JSON.stringify(SEE_THROUGH_RULE)}, pane, quoted + ' paints over the open overlay pane at ' + above + ' of ' + total + ' points - lift the pane above it (z-index or stacking context)');
          else report(${JSON.stringify(SEE_THROUGH_RULE)}, pane, 'the open overlay pane lets ' + quoted + ' under it show through at ' + through + ' of ' + total + ' points - give the pane an opaque background');
          break;
        }
      }
      force.remove();
    }
  }
`;
