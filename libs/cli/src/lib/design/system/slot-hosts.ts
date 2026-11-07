import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PartMark } from '../shot';
import { componentSelectorOf } from './actions';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partLinkOf } from './sketch/part-definition';

type Page = { evaluate: (script: string) => Promise<unknown> };

/** Where a design draws an embedded part, and the selector of the component its `implements` link names. */
export type PartSlot = { part: string; selector: string; x: number; y: number; width: number; height: number };

/** One part slot of a live state, and whether the app renders the `implements` host there; `null` when the app has no live host. */
export type SlotHost = { part: string; selector: string; rendered: boolean | null };

/** The selector of the component each part's `implements` link names, by part key. */
export const implementsSelectorsOf = (options: { target: string; product: ResolvedProduct }) =>
  new Map(
    options.product.parts.flatMap((part): [string, string][] => {
      const link = partLinkOf(part.source);
      const path = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
      const file = path === null ? null : resolve(options.target, path);
      const selector = file && existsSync(file) ? componentSelectorOf(readFileSync(file, 'utf8')) : null;

      return selector ? [[partKeyOf(part), selector]] : [];
    }),
  );

/** One slot per part key of each design mark whose part names a component. */
export const partSlotsOf = (marks: PartMark[], selectors: ReadonlyMap<string, string>): PartSlot[] =>
  marks.flatMap(({ parts, ...box }) =>
    parts.flatMap((part) => {
      const selector = selectors.get(part);

      return selector ? [{ part, selector, ...box }] : [];
    }),
  );

const SLOT_HOSTS_SCRIPT = `(({ host, slots }) => {
  const root = document.querySelector(host);
  if (!root) return null;
  const origin = root.getBoundingClientRect();
  const meets = (element, area) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.left < area.right && box.right > area.left && box.top < area.bottom && box.bottom > area.top;
  };

  return slots.map((slot) => {
    const area = {
      left: origin.left + slot.x - slot.width,
      right: origin.left + slot.x + 2 * slot.width,
      top: origin.top + slot.y - slot.height,
      bottom: origin.top + slot.y + 2 * slot.height,
    };
    let hosts = [];

    try {
      hosts = [...document.querySelectorAll(slot.selector)];
    } catch {
      return false;
    }

    return hosts.some((element) => meets(element, area) || [...element.querySelectorAll('*')].some((child) => meets(child, area)));
  });
})`;

/**
 * Whether the open app page renders each slot's `implements` host at the slot: overlapping the slot box grown by its
 * own size on every side, so layout drift that compare reports does not count as a wrong link. Boxes are measured
 * from the live `host` element as the design measures its marks from the frame root.
 */
export const slotHostsOnPage = async (options: {
  page: Page;
  host: string;
  slots: PartSlot[];
}): Promise<SlotHost[]> => {
  if (options.slots.length === 0) return [];

  const rendered = (await options.page.evaluate(
    `${SLOT_HOSTS_SCRIPT}(${JSON.stringify({ host: options.host, slots: options.slots })})`,
  )) as boolean[] | null;

  return options.slots.map(({ part, selector }, index) => ({
    part,
    selector,
    rendered: rendered ? (rendered[index] ?? null) : null,
  }));
};
