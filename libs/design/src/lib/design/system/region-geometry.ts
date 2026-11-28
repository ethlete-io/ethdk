import { Browser } from '../thumb';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

type Rect = { x: number; y: number; width: number; height: number };

/** A part root as compare measures it on either side: its box and the part of it its clipping ancestors leave visible. */
export type Region = { name: string; box: Rect; clip: Rect };

/** One region whose box or visible clip differs between the design and the app, both in px from the frame's top left. */
export type RegionDelta = { name: string; rect: 'box' | 'clip'; design: Rect; app: Rect };

/** The part components the app draws for the parts a page embeds, to measure as regions by their part key. */
export type RegionSelector = { name: string; selector: string };

/**
 * A browser function `(element, frame)` that answers the element's box and its clip: the box cut by every ancestor
 * whose overflow is not visible and by `frame` (a DOMRect, or null for none), both rounded and relative to `frame`.
 */
export const REGION_OF_SCRIPT = `((element, frame) => {
  const rect = element.getBoundingClientRect();
  let left = rect.left;
  let top = rect.top;
  let right = rect.right;
  let bottom = rect.bottom;

  for (let at = element.parentElement; at && at !== document.documentElement; at = at.parentElement) {
    const style = getComputedStyle(at);
    const outer = at.getBoundingClientRect();

    if (style.overflowX !== 'visible') {
      left = Math.max(left, outer.left);
      right = Math.min(right, outer.right);
    }
    if (style.overflowY !== 'visible') {
      top = Math.max(top, outer.top);
      bottom = Math.min(bottom, outer.bottom);
    }
  }
  if (frame) {
    left = Math.max(left, frame.left);
    right = Math.min(right, frame.right);
    top = Math.max(top, frame.top);
    bottom = Math.min(bottom, frame.bottom);
  }

  const originX = frame ? frame.left : -scrollX;
  const originY = frame ? frame.top : -scrollY;
  const rounded = (x, y, width, height) => ({
    x: Math.round(x - originX),
    y: Math.round(y - originY),
    width: Math.round(Math.max(width, 0)),
    height: Math.round(Math.max(height, 0)),
  });

  return {
    box: rounded(rect.left, rect.top, rect.width, rect.height),
    clip: rounded(left, top, right - left, bottom - top),
  };
})`;

const sameRect = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) <= 1 &&
  Math.abs(a.y - b.y) <= 1 &&
  Math.abs(a.width - b.width) <= 1 &&
  Math.abs(a.height - b.height) <= 1;

/** The regions of `names` that one part mark each draws; a part drawn twice or not at all names no region. */
export const designRegionsOf = (
  marks: { parts: string[]; x: number; y: number; width: number; height: number; clip?: Rect }[],
  names: string[],
): Region[] =>
  names.flatMap((name) => {
    const found = marks.filter((mark) => mark.parts.includes(name));
    const [mark] = found;

    if (found.length !== 1 || !mark) return [];

    const box = { x: mark.x, y: mark.y, width: mark.width, height: mark.height };

    return [{ name, box, clip: mark.clip ?? box }];
  });

/** The regions of the open app page: each selector one visible element matches, measured inside the `host` element. */
export const appRegionsOnPage = async (options: { page: Page; host: string; selectors: RegionSelector[] }) =>
  (await options.page.evaluate(
    `(({ host, selectors }) => {
      const regionOf = ${REGION_OF_SCRIPT};
      const frame = document.querySelector(host)?.getBoundingClientRect() ?? null;

      return selectors.flatMap(({ name, selector }) => {
        const found = [...document.querySelectorAll(selector)].filter((element) => {
          const rect = element.getBoundingClientRect();

          return rect.width > 0 && rect.height > 0;
        });

        return found.length === 1 ? [{ name, ...regionOf(found[0], frame) }] : [];
      });
    })(${JSON.stringify({ host: options.host, selectors: options.selectors })})`,
  )) as Region[];

/** Each region both sides measure whose box or clip differs by more than 1 px, box before clip, in `design` order. */
export const regionDeltasOf = (options: { design: Region[]; app: Region[] }): RegionDelta[] =>
  options.design.flatMap((design) => {
    const app = options.app.find((region) => region.name === design.name);

    if (!app) return [];

    return (['box', 'clip'] as const).flatMap((rect) =>
      sameRect(design[rect], app[rect]) ? [] : [{ name: design.name, rect, design: design[rect], app: app[rect] }],
    );
  });

const rectText = (rect: Rect) => `${rect.x},${rect.y} ${rect.width}x${rect.height}`;

const signed = (value: number) => `${value > 0 ? '+' : ''}${value} px`;

/** What the design changes against the app per side of a region delta, e.g. `height -20 px`. */
export const deltaTextOf = (delta: RegionDelta) =>
  (['x', 'y', 'width', 'height'] as const)
    .flatMap((side) => {
      const by = delta.design[side] - delta.app[side];

      return Math.abs(by) > 1 ? [`${side} ${signed(by)}`] : [];
    })
    .join(', ');

/** The report line of one region delta. */
export const regionDeltaLineOf = (delta: RegionDelta) =>
  `REGION ${delta.name} ${delta.rect}: ${deltaTextOf(delta)} in the design (design ${rectText(delta.design)}, app ${rectText(delta.app)})`;
