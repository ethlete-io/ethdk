import { existsSync } from 'fs';
import { join, relative } from 'path';
import { PartMark } from '../shot';
import { componentSelectorOf } from './actions';
import { harnessOf } from './harness-map';
import { ResolvedProduct } from './resolve-product';
import { appSourcesOf } from './rules/implemented-components';

type Page = { evaluate: (script: string) => Promise<unknown> };

/** Where a design draws an embedded part, relative to the frame root. */
export type PartSlot = { part: string; x: number; y: number; width: number; height: number };

/** The app component selectors whose host the live page draws at a part slot, outermost first. */
export type SlotComponents = { part: string; selectors: string[] };

/** The repo path of each app component of the product's harness app, by its element selector. */
export const appComponentsOf = (options: { target: string; product: ResolvedProduct }): Map<string, string> => {
  const harness = harnessOf(options.product);
  const dir = harness && typeof harness !== 'string' ? join(options.target, harness.app, 'src') : null;

  if (!dir || !existsSync(dir)) return new Map();

  return new Map(
    appSourcesOf(dir).flatMap(({ path, text }): [string, string][] => {
      const selector = path.endsWith('.ts') ? componentSelectorOf(text) : null;

      return selector ? [[selector, relative(options.target, path).split('\\').join('/')]] : [];
    }),
  );
};

/** One slot per part key of each design mark. */
export const partSlotsOf = (marks: PartMark[]): PartSlot[] =>
  marks.flatMap(({ parts, ...box }) => parts.map((part) => ({ part, ...box })));

const SLOT_COMPONENTS_SCRIPT = `(({ host, slots, selectors }) => {
  const root = document.querySelector(host);
  if (!root) return null;
  const origin = root.getBoundingClientRect();
  const boxOf = (element) => {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return box;
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect();
  };
  const hosts = selectors.flatMap((selector) => {
    try {
      return [...document.querySelectorAll(selector)]
        .filter((element) => !element.contains(root))
        .map((element) => ({ element, selector }));
    } catch {
      return [];
    }
  });
  const depthOf = (element) => {
    let depth = 0;
    for (let node = element; node; node = node.parentElement) depth++;
    return depth;
  };

  return slots.map((slot) => {
    const area = { left: origin.left + slot.x, top: origin.top + slot.y, width: slot.width, height: slot.height };
    const size = area.width * area.height;
    if (size <= 0) return [];

    return hosts
      .map(({ element, selector }) => {
        const box = boxOf(element);
        const own = box.width * box.height;
        const width = Math.min(box.right, area.left + area.width) - Math.max(box.left, area.left);
        const height = Math.min(box.bottom, area.top + area.height) - Math.max(box.top, area.top);
        const shared = width > 0 && height > 0 ? width * height : 0;
        const fits = own > 0 && shared >= 0.5 * Math.min(own, size) && own <= 4 * size && size <= 4 * own;
        return fits ? { selector, depth: depthOf(element) } : null;
      })
      .filter((found) => found !== null)
      .sort((a, b) => a.depth - b.depth)
      .map(({ selector }) => selector)
      .filter((selector, index, all) => all.indexOf(selector) === index);
  });
})`;

/**
 * The app components whose host the open page draws at each slot: a host counts when it covers at least half of the
 * smaller of its box and the slot, and neither is more than four times the other, so layout drift that compare reports
 * does not move the link. A `display: contents` host is measured by its content. The live host and the components
 * around it are the page, never a part. `null` when the live host is missing.
 */
export const slotComponentsOnPage = async (options: {
  page: Page;
  host: string;
  slots: PartSlot[];
  selectors: string[];
}): Promise<SlotComponents[] | null> => {
  if (options.slots.length === 0) return [];

  const found = (await options.page.evaluate(
    `${SLOT_COMPONENTS_SCRIPT}(${JSON.stringify({ host: options.host, slots: options.slots, selectors: options.selectors })})`,
  )) as string[][] | null;

  return found ? options.slots.map(({ part }, index) => ({ part, selectors: found[index] ?? [] })) : null;
};

const AROUND_HOST_SCRIPT = `(({ host, selectors }) => {
  const root = document.querySelector(host);
  if (!root) return null;
  const around = [];
  for (let node = root; node; node = node.parentElement) {
    const selector = selectors.find((candidate) => {
      try {
        return node.matches(candidate);
      } catch {
        return false;
      }
    });
    if (selector && !around.includes(selector)) around.push(selector);
  }
  return around;
})`;

/** The app component selectors of the live host and the hosts around it, innermost first. `null` when the live host is missing. */
export const hostComponentsOnPage = async (options: {
  page: Page;
  host: string;
  selectors: string[];
}): Promise<string[] | null> =>
  (await options.page.evaluate(
    `${AROUND_HOST_SCRIPT}(${JSON.stringify({ host: options.host, selectors: options.selectors })})`,
  )) as string[] | null;
