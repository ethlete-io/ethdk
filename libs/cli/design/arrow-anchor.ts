const ARROW_PADDING = 16;

const anchorOf = (root: HTMLElement, pane: HTMLElement) => {
  try {
    return root.querySelector(pane.getAttribute('data-et-arrow-anchor') ?? '');
  } catch {
    return null;
  }
};

const toDevicePixel = (value: number) => {
  const ratio = window.devicePixelRatio || 1;

  return Math.round(Number((value * ratio).toFixed(4))) / ratio;
};

const moverOf = (root: HTMLElement, pane: HTMLElement) => {
  for (let element: HTMLElement | null = pane; element && element !== root; element = element.parentElement)
    if (getComputedStyle(element).position === 'absolute') return element;

  return pane;
};

type Span = { start: number; size: number };

const spanOf = (rect: DOMRect, { vertical, scale }: { vertical: boolean; scale: number }): Span =>
  vertical
    ? { start: rect.left / scale, size: rect.width / scale }
    : { start: rect.top / scale, size: rect.height / scale };

const moveOf = (pane: Span, { anchor, align }: { anchor: Span; align: 'centre' | 'start' | 'end' }) => {
  if (align === 'centre') return toDevicePixel(anchor.start + anchor.size / 2 - pane.size / 2) - pane.start;

  const edge = align === 'end' ? pane.start + pane.size : pane.start;

  return toDevicePixel(edge) - edge;
};

const placePane = (pane: HTMLElement, options: { mover: HTMLElement; anchor: Element; placement: string }) => {
  const { mover, anchor, placement } = options;

  for (const property of ['translate', 'margin-left', 'margin-top']) mover.style.removeProperty(property);

  const vertical = /^(top|bottom)/u.test(placement);
  const align = placement.endsWith('-end') ? 'end' : placement.includes('-') ? 'start' : 'centre';
  const rect = pane.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const scaleX = rect.width / pane.offsetWidth || 1;
  const scaleY = rect.height / pane.offsetHeight || 1;
  const along = moveOf(spanOf(rect, { vertical: vertical, scale: vertical ? scaleX : scaleY }), {
    anchor: spanOf(anchorRect, { vertical: vertical, scale: vertical ? scaleX : scaleY }),
    align,
  });
  const across = moveOf(spanOf(rect, { vertical: !vertical, scale: vertical ? scaleY : scaleX }), {
    anchor: spanOf(anchorRect, { vertical: !vertical, scale: vertical ? scaleY : scaleX }),
    align: 'start',
  });
  const margin = align === 'centre' ? along : 0;
  const [shiftX, shiftY] = vertical ? [along - margin, across] : [across, along - margin];

  if (margin) mover.style.setProperty(vertical ? 'margin-left' : 'margin-top', `${margin}px`);
  if (shiftX || shiftY) mover.style.setProperty('translate', `${shiftX}px ${shiftY}px`);
};

const aim = (root: HTMLElement, pane: HTMLElement) => {
  const arrow = pane.querySelector<HTMLElement>(':scope > .et-overlay-arrow');
  const anchor = anchorOf(root, pane);

  if (!arrow || !anchor) return null;

  const placement = pane.getAttribute('data-overlay-placement') ?? '';
  const vertical = /^(top|bottom)/u.test(placement);

  placePane(pane, { mover: moverOf(root, pane), anchor, placement });

  const paneRect = pane.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const scale = (vertical ? paneRect.width / pane.offsetWidth : paneRect.height / pane.offsetHeight) || 1;
  const centre = vertical
    ? (anchorRect.left + anchorRect.width / 2 - paneRect.left) / scale - pane.clientLeft
    : (anchorRect.top + anchorRect.height / 2 - paneRect.top) / scale - pane.clientTop;
  const size = vertical ? arrow.offsetWidth : arrow.offsetHeight;
  const room = (vertical ? pane.clientWidth : pane.clientHeight) - size - ARROW_PADDING;
  const offset = toDevicePixel(Math.min(Math.max(centre - size / 2, ARROW_PADDING), room));

  arrow.style.setProperty(vertical ? 'left' : 'top', '0');
  arrow.style.setProperty(
    '--et-floating-arrow-translate',
    vertical ? `translate3d(${offset}px, 0, 0)` : `translate3d(0, ${offset}px, 0)`,
  );

  return anchor;
};

/**
 * Aims the arrow of every drawn pane with `data-et-arrow-anchor` (from `anchoredDialog({ anchor })` or
 * `tooltip({ anchor })`) at the centre of the element that selector names, again whenever the pane or the anchor
 * resizes or the viewport resizes. Like the anchored strategy, a centred pane is placed, through the margin of its nearest absolutely
 * positioned ancestor so the frame fits and checks its real box, at the rounded
 * `centre - size / 2` and any other pane is moved onto a device pixel (its end edge when end-aligned), then the arrow is kept `16px` off the pane corners and rounded to a device pixel, so its tip lands on the rounded
 * anchor centre.
 */
export const aimAnchoredArrows = (root: HTMLElement) => {
  const panes = [...root.querySelectorAll<HTMLElement>('[data-et-arrow-anchor]')];

  if (panes.length === 0) return;

  const aimAll = () => panes.map((pane) => aim(root, pane));
  const anchors = aimAll();
  const aimOnResize = () => {
    if (panes.some((pane) => pane.isConnected)) aimAll();
    else window.removeEventListener('resize', aimOnResize);
  };

  // A viewport resize can move the frame by a fraction of a pixel without resizing a pane or an anchor.
  window.addEventListener('resize', aimOnResize);

  if (typeof ResizeObserver === 'undefined') return;

  const observer = new ResizeObserver(() => aimAll());

  for (const element of [...panes, ...anchors]) if (element) observer.observe(element);
};
