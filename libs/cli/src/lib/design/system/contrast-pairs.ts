import { chromiumOf } from '../browser';
import { DesignConfig } from '../design-config';
import { createPartShooter } from '../shot';
import { DesignServer, drawingOn, WarmDraw } from '../warm-draw';
import { CONTRAST_PAIR_RULE } from './build-ready-contract';
import { compareFrameOf } from './harness-shot';
import { Problem } from './problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { measuresContrastPairs } from './slow-checks';
import { createSystemModules, productModuleIdOf } from './system-modules';

const TAG = /<[a-zA-Z][^\s/>]*(?:\s+[^\s=/>]+(?:="[^"]*")?)*\s*\/?>/gu;
const ATTRIBUTE = /\s([^\s=/>]+)(?:="([^"]*)")?/gu;

/** The pairs a drawn part marks below their need, as `measureContrastPairs` wrote them into its `markup`. */
export const lowContrastPairsOf = (markup: string) =>
  [...markup.matchAll(TAG)].flatMap(([tag]) => {
    const attributes = new Map([...tag.matchAll(ATTRIBUTE)].map(([, name, value]) => [name, value ?? '']));
    const pair = attributes.get('data-et-contrast');

    if (pair === undefined || !attributes.has('data-et-contrast-low')) return [];

    const [text = '', on = ''] = pair.split(' ');

    return [
      {
        pair: `${text} ${on}`,
        message: `${text} on ${on} ${attributes.get('data-et-contrast-ratio') ?? '?'} < ${attributes.get('data-et-contrast-needs') ?? '?'}`,
      },
    ];
  });

/**
 * `CONTRAST-PAIR` for each theme token pair a part measures with `measureContrastPairs` and draws below its need, read
 * from the ratio the drawing shows in each of its states.
 */
export const contrastPairProblemsOf = async (options: {
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
      measuresContrastPairs(part) &&
      (!options.part || partKeyOf(part) === options.part) &&
      (!options.parts || options.parts.includes(partKeyOf(part))),
  );

  if (own.length === 0 || !(await chromiumOf(target))) return [];

  return drawingOn({ target, config, warm: options.warm }, async ({ server, base, queue }) => {
    const partShooter = createPartShooter({ target, base, system: createSystemModules({ target, config }), queue });

    try {
      return await lowPairsDrawn({ product, own, server, partShooter });
    } finally {
      if (!options.warm) await partShooter.close();
    }
  });
};

const lowPairsDrawn = async (options: {
  product: ResolvedProduct;
  own: ResolvedPart[];
  server: DesignServer;
  partShooter: ReturnType<typeof createPartShooter>;
}) => {
  const { product, own, server, partShooter } = options;
  const problems: Problem[] = [];

  for (const part of own) {
    const key = partKeyOf(part);
    const module = (await server
      .ssrLoadModule(productModuleIdOf({ file: part.file, product: product.name }))
      .catch(() => null)) as { default?: { states?: unknown } } | null;
    const loaded = module?.default?.states;
    const states = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? Object.keys(loaded) : [];
    const frame = compareFrameOf({ presets: product.presets, part: key, preset: null });

    if (typeof frame === 'string') continue;

    const seen = new Set<string>();

    for (const state of states) {
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

      for (const low of lowContrastPairsOf(markup ?? ''))
        if (!seen.has(low.message)) {
          seen.add(low.message);
          problems.push({ rule: CONTRAST_PAIR_RULE, file: part.file, message: low.message, at: low.pair });
        }
    }
  }

  return problems;
};
