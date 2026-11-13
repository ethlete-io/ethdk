/** The rule a card breaks when its fill equals the surface around it, so only its edge shows where it is. */
export const LOST_SURFACE_RULE = 'LOST-SURFACE';

const CONTROLS = 'input, textarea, select, button, [role="button"], [role="switch"], [role="tab"], [data-et-control]';

const MIN_WIDTH = 80;
const MIN_HEIGHT = 24;
const OPAQUE = 0.95;

/**
 * The statements of the surface checks inside the frame script of `render-check`. They use `root` and `report` of
 * that script, and `pansItself` of its clip checks. A card is a box with a fill and a border or shadow; its surface is the nearest ancestor with an opaque
 * fill, or the page canvas. A card over a patterned backdrop (a `background-image` between it and its surface, or on a
 * sibling painted under its centre) hides the pattern, so its fill is a surface of its own. Content of a pan viewport
 * under a floating card moves past it, so the backdrop search looks through that content.
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
      let patterned = false;
      for (let at = element.parentElement; at; at = at.parentElement) {
        const style = getComputedStyle(at);
        patterned ||= style.backgroundImage !== 'none';
        if (opaque(style.backgroundColor)) return { pane: root.contains(at) && at !== root ? at : null, fill: style.backgroundColor, patterned };
      }
      return { pane: null, fill: 'rgb(255, 255, 255)', patterned };
    };
    const pansUnder = (element) => {
      for (let at = element.parentElement; at && at !== root; at = at.parentElement) if (pansItself(at, getComputedStyle(at))) return true;
      return false;
    };
    const patternedBackdrop = (card, rect) => {
      const below = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (!below.includes(card)) return false;
      for (const at of below.slice(below.indexOf(card) + 1)) {
        if (at.contains(card) || pansUnder(at)) continue;
        const style = getComputedStyle(at);
        if (style.backgroundImage !== 'none') return true;
        if (opaque(style.backgroundColor)) return false;
      }
      return false;
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
      if (!same(style.backgroundColor, surface.fill) || surface.patterned) continue;
      const fill = style.backgroundColor;
      if (surface.pane && onlyContentOf(surface.pane, card)) {
        const outer = surface.pane.getBoundingClientRect();
        const band = [rect.left - outer.left, rect.top - outer.top, outer.right - rect.right, outer.bottom - rect.bottom].map(Math.round);
        if (Math.min(...band) >= 0 && Math.max(...band) >= 1) continue;
      }
      if (patternedBackdrop(card, rect)) continue;
      report(${JSON.stringify(LOST_SURFACE_RULE)}, card, 'fills with ' + fill + ', the fill of ' + (surface.pane ? pathOf(surface.pane) : 'the canvas') + ' around it, so only its edge shows the card - give it the surface it is placed on (data-et-auto-surface) or drop the fill');
    }
  }
`;
