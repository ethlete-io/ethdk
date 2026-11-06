import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import { createPartShooter } from '../shot';
import { CONTROL_STATE_RULE } from './build-ready-contract';
import { compareFrameOf } from './harness-shot';
import { declaredControlsOf, isInteractionState } from './complete';
import { Problem } from './problem';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { createSystemModules, productModuleIdOf } from './system-modules';
import { DesignServer, DrawQueue, drawingOn, WarmDraw } from '../warm-draw';

export type BespokeControl = { id: string; why: string };

/**
 * Browser source of `({ root, part, ids }) => BespokeControl[]`: why each control of `ids` that `part` draws itself
 * under `root` is no SDK component used through its props - an element with no `et-` class, `et-` classes mixed with
 * custom ones, or custom-classed content outside icons and embedded parts.
 */
export const BESPOKE_CONTROLS_IN = `(({ root, part, ids }) => {
  const partsOf = (element) => (element.getAttribute('data-et-part') ?? '').split(' ');
  const customOf = (element) => [...element.classList].filter((name) => !name.startsWith('et-'));
  const isOwn = (element) => {
    const owner = element.closest('[data-et-part]');
    return owner === null || partsOf(owner).includes(part);
  };
  const contentOf = (element) =>
    [...element.children].flatMap((child) =>
      child.hasAttribute('data-et-part') || child.localName === 'svg' ? [] : [child, ...contentOf(child)],
    );
  const describe = (element) => element.localName + customOf(element).map((name) => '.' + name).join('');
  const found = [];
  for (const id of ids) {
    const element = [...root.querySelectorAll('[data-et-control="' + id + '"]')].find(isOwn);
    if (!element || (element.hasAttribute('data-et-part') && !partsOf(element).includes(part))) continue;
    const custom = customOf(element);
    const styled = contentOf(element).filter((child) => customOf(child).length > 0);
    if (![...element.classList].some((name) => name.startsWith('et-')))
      found.push({ id, why: 'is drawn markup (' + describe(element) + '), no SDK component' });
    else if (custom.length > 0)
      found.push({ id, why: 'is an SDK component with the custom class' + (custom.length > 1 ? 'es ' : ' ') + custom.join(' ') });
    else if (styled.length > 0)
      found.push({ id, why: 'is an SDK component with drawn content (' + styled.map(describe).join(', ') + ')' });
  }
  return found;
})`;

/** The own controls of a part to check: none on a page or a part with one control, which may draw its own. */
export const composedControlsOf = (options: { part: string; controls: unknown; states: string[] }): string[] => {
  const declared = Object.entries(declaredControlsOf(options.controls) ?? {});

  if (options.part.startsWith('pages/') || declared.length < 2 || !options.states.some(isInteractionState)) return [];

  return declared.filter(([, control]) => control.part === null).map(([id]) => id);
};

export const bespokeControlMessageOf = (part: string, { id, why }: BespokeControl) =>
  `control "${id}" ${why} - ${part} declares several controls, and a declared control counts for its interaction states only as an embedded part or an SDK component used through its props - extract ${id} as its own control part and draw its states there`;

/**
 * `CONTROL-STATE` for each control a part with several controls and interaction states draws as its own markup, read
 * from the drawn states until every own control was seen.
 */
export const bespokeControlProblemsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part?: string;
  parts?: readonly string[];
  warm?: WarmDraw;
}): Promise<Problem[]> => {
  const { target, config, product } = options;
  const own = product.parts.filter(
    (part) =>
      part.origin !== 'base' &&
      (!options.part || partKeyOf(part) === options.part) &&
      (!options.parts || options.parts.includes(partKeyOf(part))),
  );

  if (own.length === 0 || !(await chromiumOf(target))) return [];

  return drawingOn({ target, config, warm: options.warm }, async ({ server, base, queue }) => {
    const partShooter = createPartShooter({ target, base, system: createSystemModules({ target, config }), queue });

    try {
      return await bespokeProblemsDrawn({ product, own, server, queue, partShooter });
    } finally {
      if (!options.warm) await partShooter.close();
    }
  });
};

const bespokeProblemsDrawn = async (options: {
  product: ResolvedProduct;
  own: ResolvedProduct['parts'];
  server: DesignServer;
  queue: DrawQueue;
  partShooter: ReturnType<typeof createPartShooter>;
}) => {
  const { product, own, server, queue, partShooter } = options;
  const problems: Problem[] = [];

  for (const part of own) {
    const key = partKeyOf(part);
    const module = (await server
      .ssrLoadModule(productModuleIdOf({ file: part.file, product: product.name }))
      .catch(() => null)) as { default?: { states?: unknown; controls?: unknown } } | null;
    const loaded = module?.default?.states;
    const states = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? Object.keys(loaded) : [];
    const ids = composedControlsOf({ part: key, controls: module?.default?.controls, states });
    const frame = compareFrameOf({ presets: product.presets, part: key, preset: null });

    if (ids.length === 0 || typeof frame === 'string') continue;

    const unseen = new Set(ids);
    const found: BespokeControl[] = [];

    for (const state of states) {
      if (unseen.size === 0) break;

      const { markup } = await partShooter.pictureOf({
        product: product.name,
        part: key,
        state,
        preset: frame.preset,
        width: null,
        sketch: null,
        interaction: null,
        bare: true,
        emptySlots: true,
        checker: false,
        params: new URLSearchParams(),
      });

      if (markup === undefined) continue;

      const drawn = await queue.run(async (browser) => {
        const page = await browser.newPage();

        try {
          return (await page.evaluate(
            `(() => {
                const body = new DOMParser().parseFromString(${JSON.stringify(markup)}, 'text/html').body;
                const seen = [...body.querySelectorAll('[data-et-control]')].map((element) => element.getAttribute('data-et-control'));
                return { found: ${BESPOKE_CONTROLS_IN}({ root: body, part: ${JSON.stringify(key)}, ids: ${JSON.stringify([...unseen])} }), seen };
              })()`,
          )) as { found: BespokeControl[]; seen: string[] };
        } finally {
          await page.close();
        }
      });

      found.push(...drawn.found);

      for (const id of drawn.seen) unseen.delete(id);
    }

    for (const control of found)
      problems.push({
        rule: CONTROL_STATE_RULE,
        file: part.file,
        message: bespokeControlMessageOf(key, control),
        at: control.id,
      });
  }

  return problems;
};
