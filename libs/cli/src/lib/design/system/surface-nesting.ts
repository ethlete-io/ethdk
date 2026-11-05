/** The rule a card breaks when it is the only content of a pane that draws the same fill, with a padding band around it. */
export const NESTED_SURFACE_RULE = 'NESTED-SURFACE';

/** The rule a card breaks when its fill equals the surface around it, so only its edge shows where it is. */
export const LOST_SURFACE_RULE = 'LOST-SURFACE';

const CONTROLS = 'input, textarea, select, button, [role="button"], [role="switch"], [role="tab"], [data-et-control]';

const MIN_WIDTH = 80;
const MIN_HEIGHT = 24;
const OPAQUE = 0.95;

/**
 * The statements of the surface checks inside the frame script of `render-check`. They use `root` and `report` of
 * that script. A card is a box with a fill and a border or shadow; its surface is the nearest ancestor with an opaque
 * fill, or the page canvas.
 */
export const SURFACE_STATEMENTS = `
  {
    const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgbaOf = (colour) => {
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = 'rgba(0, 0, 0, 0)';
      paint.fillStyle = colour;
      paint.fillRect(0, 0, 1, 1);
      return [...paint.getImageData(0, 0, 1, 1).data];
    };
    const opaque = (colour) => rgbaOf(colour)[3] / 255 >= ${OPAQUE};
    const same = (a, b) => rgbaOf(a).every((value, index) => Math.abs(value - rgbaOf(b)[index]) <= 1);
    const edged = (style) =>
      ['Top', 'Right', 'Bottom', 'Left'].every((side) => parseFloat(style['border' + side + 'Width']) > 0 && style['border' + side + 'Style'] !== 'none' && rgbaOf(style['border' + side + 'Color'])[3] > 0) ||
      (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 && rgbaOf(style.outlineColor)[3] > 0) ||
      (style.boxShadow !== 'none' && style.boxShadow.split(/,(?![^(]*\\))/).some((shadow) => !/\\binset\\b/.test(shadow) && rgbaOf(shadow.match(/(rgba?|oklch|oklab|lab|lch|hsla?|color)\\([^)]*\\)/)?.[0] ?? 'transparent')[3] > 0));
    const surfaceOf = (element) => {
      for (let at = element.parentElement; at; at = at.parentElement) {
        const fill = getComputedStyle(at).backgroundColor;
        if (opaque(fill)) return { pane: root.contains(at) && at !== root ? at : null, fill };
      }
      return { pane: null, fill: 'rgb(255, 255, 255)' };
    };
    const onlyContentOf = (pane, card) => {
      for (const element of pane.querySelectorAll('*')) {
        if (element === card || card.contains(element) || element.contains(card) || element.matches('style, script, template')) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return false;
      }
      for (let at = card.parentElement; at && at !== pane.parentElement; at = at.parentElement)
        for (const child of at.childNodes) if (child.nodeType === Node.TEXT_NODE && child.data.trim()) return false;
      return true;
    };
    for (const card of root.querySelectorAll('*')) {
      if (card.matches(${JSON.stringify(CONTROLS)}) || card.closest(${JSON.stringify(CONTROLS)}) || !card.firstElementChild) continue;
      const rect = card.getBoundingClientRect();
      if (rect.width < ${MIN_WIDTH} || rect.height < ${MIN_HEIGHT}) continue;
      const style = getComputedStyle(card);
      if (style.visibility !== 'visible' || !opaque(style.backgroundColor) || !edged(style)) continue;
      const surface = surfaceOf(card);
      if (!same(style.backgroundColor, surface.fill)) continue;
      const fill = style.backgroundColor;
      if (surface.pane && onlyContentOf(surface.pane, card)) {
        const outer = surface.pane.getBoundingClientRect();
        const band = [rect.left - outer.left, rect.top - outer.top, outer.right - rect.right, outer.bottom - rect.bottom].map(Math.round);
        if (Math.min(...band) >= 0 && Math.max(...band) >= 1) {
          report(${JSON.stringify(NESTED_SURFACE_RULE)}, card, 'is the only content of ' + pathOf(surface.pane) + ', which draws the same fill ' + fill + ' with a band of ' + band.join('/') + 'px around it, so two surfaces draw as one - drop the card or the pane');
          continue;
        }
      }
      report(${JSON.stringify(LOST_SURFACE_RULE)}, card, 'fills with ' + fill + ', the fill of ' + (surface.pane ? pathOf(surface.pane) : 'the canvas') + ' around it, so only its edge shows the card - give it the surface it is placed on (data-et-auto-surface) or drop the fill');
    }
  }
`;
