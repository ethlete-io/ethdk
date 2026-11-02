import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Browser } from '../thumb';
import { componentSelectorOf } from './actions';
import { ResolvedProduct } from './resolve-product';
import { partLinkOf } from './sketch/part-definition';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

export type RegionBox = { x: number; y: number; width: number; height: number };

/** One visible element of the app page as the uncovered-region check reads it. */
export type RegionNode = {
  tag: string;
  className: string;
  box: RegionBox;
  covered: boolean;
  paints: boolean;
  children: RegionNode[];
};

export type UncoveredRegion = { element: string; component: string | null; box: RegionBox };

/** An app region that is meant to have no part, with the reason the live spec gives. */
export type Partless = { selector: string; reason: string };

export const MIN_REGION_SIDE = 4;

const REGION_TREE_SCRIPT = `(({ covered }) => {
  const SKIP = new Set(['script', 'style', 'template', 'link', 'meta', 'noscript']);
  const PAINTED = new Set(['img', 'svg', 'canvas', 'video', 'iframe', 'input', 'textarea', 'select', 'picture']);
  const matches = (element) => covered.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
  const visibleBoxOf = (element) => {
    const box = element.getBoundingClientRect();
    let left = Math.max(box.left, 0);
    let top = Math.max(box.top, 0);
    let right = Math.min(box.right, innerWidth);
    let bottom = Math.min(box.bottom, innerHeight);

    for (let current = element.parentElement; current; current = current.parentElement) {
      const style = getComputedStyle(current);

      if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;

      const clip = current.getBoundingClientRect();

      left = Math.max(left, clip.left);
      top = Math.max(top, clip.top);
      right = Math.min(right, clip.right);
      bottom = Math.min(bottom, clip.bottom);
    }

    return { x: left, y: top, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
  };
  const transparent = (color) => color === 'transparent' || /rgba\\([^)]*,\\s*0\\)$/.test(color);
  const paints = (element) => {
    if (PAINTED.has(element.localName)) return true;

    const style = getComputedStyle(element);

    if (!transparent(style.backgroundColor) || style.backgroundImage !== 'none' || style.boxShadow !== 'none')
      return true;
    if (['Top', 'Right', 'Bottom', 'Left'].some((side) =>
      parseFloat(style['border' + side + 'Width']) > 0 && style['border' + side + 'Style'] !== 'none' &&
      !transparent(style['border' + side + 'Color'])))
      return true;

    return [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
  };
  const nodeOf = (element) => {
    if (SKIP.has(element.localName)) return null;
    if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null;

    const isCovered = matches(element);

    return {
      tag: element.localName,
      className: (element.getAttribute('class') ?? '').trim(),
      box: visibleBoxOf(element),
      covered: isCovered,
      paints: !isCovered && paints(element),
      children: isCovered ? [] : [...element.children].map(nodeOf).filter((node) => node !== null),
    };
  };

  return nodeOf(document.body);
})`;

const hasCovered = (node: RegionNode): boolean => node.covered || node.children.some(hasCovered);

const paintsAny = (node: RegionNode): boolean => node.paints || node.children.some(paintsAny);

const describe = (node: RegionNode) => `<${node.tag}${node.className ? ` class="${node.className}"` : ''}>`;

/**
 * The topmost visible regions of `tree` that no covered element holds: an element with no covered element inside that
 * paints something and measures at least `minSide` on both sides. An element that holds a covered one is a layout
 * wrapper, so the check looks at its children instead.
 */
export const uncoveredRegionsOf = (tree: RegionNode, minSide = MIN_REGION_SIDE): UncoveredRegion[] => {
  const visit = (node: RegionNode, component: string | null): UncoveredRegion[] => {
    if (node.covered) return [];

    const owner = node.tag.includes('-') ? node.tag : component;
    const big = node.box.width >= minSide && node.box.height >= minSide;

    if (!hasCovered(node) && big)
      return paintsAny(node)
        ? [
            {
              element: describe(node),
              component: owner,
              box: {
                x: Math.round(node.box.x),
                y: Math.round(node.box.y),
                width: Math.round(node.box.width),
                height: Math.round(node.box.height),
              },
            },
          ]
        : [];

    return node.children.flatMap((child) => visit(child, owner));
  };

  return visit(tree, null);
};

/** The element selectors of the components the parts of `product` implement, by route or by component. */
export const partSelectorsOf = (options: { target: string; product: ResolvedProduct }) =>
  options.product.parts.flatMap((part) => {
    const link = partLinkOf(part.source);
    const path = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
    const file = path === null ? null : resolve(options.target, path);
    const selector = file && existsSync(file) ? componentSelectorOf(readFileSync(file, 'utf8')) : null;

    return selector === null ? [] : [selector];
  });

/** The element, its component and its box, as a report names one uncovered region. */
export const regionTextOf = (region: UncoveredRegion) =>
  `${region.element}${
    region.component && !region.element.startsWith(`<${region.component}`) ? ` in <${region.component}>` : ''
  } at ${region.box.x},${region.box.y} ${region.box.width}x${region.box.height}`;

export const UNCOVERED_HINT =
  'no part covers this visible app region; add a part that implements its component, or list it under "partless" in the live spec with a reason if it stays undesigned';

/** The line that reports one uncovered region of the page at `address`. */
export const uncoveredLineOf = (region: UncoveredRegion, address: string) =>
  `UNCOVERED: ${regionTextOf(region)} on ${address} - ${UNCOVERED_HINT}`;

/** The visible regions of the open app page that no part component and no `partless` selector covers. */
export const uncoveredRegionsOnPage = async (options: { page: Page; parts: string[]; partless: Partless[] }) => {
  const tree = (await options.page.evaluate(
    `${REGION_TREE_SCRIPT}(${JSON.stringify({
      covered: [...options.parts, ...options.partless.map((entry) => entry.selector)],
    })})`,
  )) as RegionNode | null;

  return tree ? uncoveredRegionsOf(tree) : [];
};
