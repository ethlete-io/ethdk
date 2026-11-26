/**
 * The `clippedAway` helper of the frame script of `render-check`: true for an element that is visually hidden itself or
 * sits in a visually hidden ancestor (`clip-path: inset(50%)`, a zero `clip`, or a 1x1px `overflow: hidden` box). Every
 * render rule that judges text or content geometry skips such an element.
 */
export const VISUALLY_HIDDEN_STATEMENTS = `
  const clippedAway = (element) => {
    for (let at = element; at && at !== root; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (/^inset\\(50%/.test(style.clipPath) || /^rect\\(0px,? 0px,? 0px,? 0px\\)$/.test(style.clip)) return true;
      if (style.overflow === 'hidden' && at.offsetWidth <= 1 && at.offsetHeight <= 1) return true;
    }
    return false;
  };
`;
