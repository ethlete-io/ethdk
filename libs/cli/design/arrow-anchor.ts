const ARROW_PADDING = 16;

const anchorOf = (root: HTMLElement, pane: HTMLElement) => {
  try {
    return root.querySelector(pane.getAttribute('data-et-arrow-anchor') ?? '');
  } catch {
    return null;
  }
};

const aim = (root: HTMLElement, pane: HTMLElement) => {
  const arrow = pane.querySelector<HTMLElement>(':scope > .et-overlay-arrow');
  const anchor = anchorOf(root, pane);

  if (!arrow || !anchor) return null;

  const vertical = /^(top|bottom)/u.test(pane.getAttribute('data-overlay-placement') ?? '');
  const paneRect = pane.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const scale = (vertical ? paneRect.width / pane.offsetWidth : paneRect.height / pane.offsetHeight) || 1;
  const centre = vertical
    ? (anchorRect.left + anchorRect.width / 2 - paneRect.left) / scale - pane.clientLeft
    : (anchorRect.top + anchorRect.height / 2 - paneRect.top) / scale - pane.clientTop;
  const size = vertical ? arrow.offsetWidth : arrow.offsetHeight;
  const room = (vertical ? pane.clientWidth : pane.clientHeight) - size - ARROW_PADDING;
  const offset = Math.min(Math.max(centre - size / 2, ARROW_PADDING), room);

  arrow.style.setProperty(vertical ? 'left' : 'top', '0');
  arrow.style.setProperty(
    '--et-floating-arrow-translate',
    vertical ? `translate3d(${offset}px, 0, 0)` : `translate3d(0, ${offset}px, 0)`,
  );

  return anchor;
};

/**
 * Aims the arrow of every drawn pane with `data-et-arrow-anchor` (from `anchoredDialog({ anchor })`) at the centre of
 * the element that selector names, kept `16px` off the pane corners like the strategy's `arrowPadding`, and again
 * whenever the pane or the anchor resizes.
 */
export const aimAnchoredArrows = (root: HTMLElement) => {
  const panes = [...root.querySelectorAll<HTMLElement>('[data-et-arrow-anchor]')];

  if (panes.length === 0) return;

  const aimAll = () => panes.map((pane) => aim(root, pane));
  const anchors = aimAll();

  if (typeof ResizeObserver === 'undefined') return;

  const observer = new ResizeObserver(() => aimAll());

  for (const element of [...panes, ...anchors]) if (element) observer.observe(element);
};
