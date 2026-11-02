/** The rule a box inside a design frame breaks when it scrolls content that does not fit it. */
export const NESTED_SCROLL_RULE = 'NESTED-SCROLL';

/** The SDK elements whose job is to scroll; a scroll box inside one is the component working, not a design defect. */
const SDK_SCROLLERS = 'select, input, textarea, et-scrollable, et-table, et-overlay-main';

/**
 * The statements of the nested-scroll check inside the frame script of `render-check`. They use `root` and `report`
 * of that script. A part that must scroll declares it with `data-et-skip="NESTED-SCROLL"` or `checks.skip`.
 */
export const NESTED_SCROLL_STATEMENTS = `
  {
    const scrolls = (value) => value === 'auto' || value === 'scroll';
    for (const element of root.querySelectorAll('*')) {
      if (element.closest(${JSON.stringify(SDK_SCROLLERS)}) || element.getClientRects().length === 0) continue;
      const style = getComputedStyle(element);
      const overX = scrolls(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      const overY = scrolls(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      if (overX || overY)
        report(${JSON.stringify(NESTED_SCROLL_RULE)}, element, 'scrolls its content ' + element.scrollWidth + 'x' + element.scrollHeight + ' in a ' + element.clientWidth + 'x' + element.clientHeight + ' box, so no shot shows all of it - size the box to its content');
    }
  }
`;
