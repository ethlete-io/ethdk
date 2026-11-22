/** A box in whole pixels from the top left of a picture. */
export type PictureBox = { x: number; y: number; width: number; height: number };

/** Where compare finds a part's root and each of its open overlay panes in one picture of a state. */
export type CompareBoxes = { root: PictureBox; panes: PictureBox[] };

/** The overlay pane mocks a design picture draws, as `drawnPaneCountOf` counts them. */
export const DRAWN_PANES = '.et-overlay-runtime-pane, et-overlay-container, et-menu, et-select-panel';

/** A pane mock inside a part root a `slot()` region frames is frame content, not a pane of the part. */
const FRAMED_PANE = '[data-et-projected] [data-et-part]';

type PageRect = { left: number; top: number; right: number; bottom: number };

/**
 * A page script answering, in page pixels, the root element `root` (a script expression) finds, grown over its
 * absolutely or fixed positioned descendants as far as the overflow boxes that clip them, and each outermost visible
 * `panes` element grown over its visible content; an element that is or holds a pane never grows the root.
 * Null without a root.
 */
export const compareBoxesScriptOf = (options: { root: string; panes: string }) => `(() => {
  const root = ${options.root};

  if (!root) return null;

  const paneSelector = ${JSON.stringify(options.panes)};
  const panes = [...document.querySelectorAll(paneSelector)].filter(
    (pane) => !pane.parentElement?.closest(paneSelector) && !pane.closest(${JSON.stringify(FRAMED_PANE)}),
  );
  const holdsPane = (element) => panes.some((pane) => element === pane || element.contains(pane) || pane.contains(element));
  const fillsViewport = (style) =>
    style.position === 'fixed' && [style.top, style.right, style.bottom, style.left].every((edge) => parseFloat(edge) === 0);
  const clips = (style) => [style.overflow, style.overflowX, style.overflowY].some((overflow) => overflow && overflow !== 'visible');
  const holdsAbsolute = (style) => !['static', ''].includes(style.position) || !['none', ''].includes(style.transform);
  const edgesOf = (rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
  const visible = (rect) => rect.right - rect.left > 0 && rect.bottom - rect.top > 0;
  const cut = (rect, outer) => ({
    left: Math.max(rect.left, outer.left),
    top: Math.max(rect.top, outer.top),
    right: Math.min(rect.right, outer.right),
    bottom: Math.min(rect.bottom, outer.bottom),
  });
  const clipped = (element) => {
    let rect = edgesOf(element.getBoundingClientRect());
    let escaping = true;

    for (let ancestor = element.parentElement; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);

      if (escaping && holdsAbsolute(style)) escaping = false;
      if (!escaping && clips(style)) rect = cut(rect, ancestor.getBoundingClientRect());
      if (style.position === 'fixed') break;
      if (style.position === 'absolute') escaping = true;
    }

    return rect;
  };
  const shownIn = (element, pane) => {
    let rect = edgesOf(element.getBoundingClientRect());

    for (let ancestor = element.parentElement; ancestor && ancestor !== pane.parentElement; ancestor = ancestor.parentElement)
      if (clips(getComputedStyle(ancestor))) rect = cut(rect, ancestor.getBoundingClientRect());

    return rect;
  };
  const union = (rects) => ({
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  });
  const page = (rect) => ({ left: rect.left + scrollX, top: rect.top + scrollY, right: rect.right + scrollX, bottom: rect.bottom + scrollY });
  const outOfFlow = [...root.querySelectorAll('*')]
    .filter((element) => !holdsPane(element))
    .map((element) => ({ element, style: getComputedStyle(element) }))
    .filter(({ style }) => ['absolute', 'fixed'].includes(style.position) && !fillsViewport(style))
    .map(({ element, style }) => (style.position === 'fixed' ? edgesOf(element.getBoundingClientRect()) : clipped(element)))
    .filter(visible);
  const paneBoxes = panes
    .filter((pane) => visible(edgesOf(pane.getBoundingClientRect())))
    .map((pane) =>
      union([
        edgesOf(pane.getBoundingClientRect()),
        ...[...pane.querySelectorAll('*')]
          .filter((element) => getComputedStyle(element).visibility !== 'hidden')
          .map((element) => shownIn(element, pane))
          .filter(visible),
      ]),
    );

  return {
    root: page(union([edgesOf(root.getBoundingClientRect()), ...outOfFlow])),
    panes: paneBoxes.map(page),
  };
})()`;

/** The page script that finds the design picture's root: the element marked as the root of `part`, else the frame root. */
export const designRootOf = (part: string | null) =>
  `([...document.querySelectorAll('#root [data-et-part]')].find((element) => element.getAttribute('data-et-part').split(' ').includes(${JSON.stringify(part ?? '')})) ?? document.getElementById('root'))`;

const boxIn = (rect: PageRect, clip: PictureBox): PictureBox => {
  const left = Math.max(0, Math.round(rect.left - clip.x));
  const top = Math.max(0, Math.round(rect.top - clip.y));
  const right = Math.min(clip.width, Math.round(rect.right - clip.x));
  const bottom = Math.min(clip.height, Math.round(rect.bottom - clip.y));

  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
};

/**
 * The boxes a `compareBoxesScriptOf` script measured, relative to the picture shot of `clip` and cut to it; panes
 * ordered top to bottom, then left to right, and those left empty by the cut dropped. Null for an unreadable `measured`.
 */
export const compareBoxesIn = (measured: unknown, clip: PictureBox): CompareBoxes | null => {
  const { root, panes } = (measured ?? {}) as { root?: PageRect; panes?: PageRect[] };

  if (!root || !Array.isArray(panes)) return null;

  return {
    root: boxIn(root, clip),
    panes: panes
      .map((pane) => boxIn(pane, clip))
      .filter((pane) => pane.width > 0 && pane.height > 0)
      .sort((a, b) => a.y - b.y || a.x - b.x),
  };
};
