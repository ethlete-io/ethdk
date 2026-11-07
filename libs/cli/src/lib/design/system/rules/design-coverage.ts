import { DesignConfig } from '../../paths';
import { PartModuleLoader, withPartLoader } from '../action-lost';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';

type Size = { width: number; height: number };

type Coverage = {
  branches?: Record<string, { real: Size; samples: Record<string, Size | undefined> }>;
  zoom?: { extremes: readonly string[]; statuses: Record<string, Record<string, string | undefined>> };
  async?: Record<string, string | null>;
  chrome?: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>|([^<]+)/gu;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'wbr']);
const attributeOf = (attributes: string, name: string) => {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`, 'u'));

  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
};

type Node = { tag: string; view: number | null; sample: boolean };

/** Walks the elements of `markup` with the `data-et-view` region and the `data-et-sample` flag each one sits in. */
const walk = (
  markup: string,
  visit: (
    event:
      | { attributes: string; text: null; view: number | null; sample: boolean }
      | { attributes: null; text: string; view: number | null; sample: boolean },
  ) => void,
) => {
  const stack: Node[] = [];
  let views = 0;

  for (const match of markup.matchAll(TAG)) {
    const top = stack[stack.length - 1];
    const [, closing, tag, attributes = '', selfClosing, text] = match;

    if (text !== undefined) {
      visit({ attributes: null, text, view: top?.view ?? null, sample: top?.sample ?? false });
      continue;
    }

    const name = (tag as string).toLowerCase();

    if (closing) {
      const at = stack.map((node) => node.tag).lastIndexOf(name);

      if (at >= 0) stack.length = at;
      continue;
    }

    const node: Node = {
      tag: name,
      view: attributeOf(attributes, 'data-et-view') === null ? (top?.view ?? null) : ++views,
      sample: (top?.sample ?? false) || attributeOf(attributes, 'data-et-sample') !== null,
    };

    visit({ attributes, text: null, view: node.view, sample: node.sample });
    if (!selfClosing && !VOID.has(name) && name !== 'script' && name !== 'style') stack.push(node);
  }
};

/** Each status a state's markup marks with `data-et-status` more than once inside one `data-et-view` region. */
export const statusesTwiceOf = (markup: string): string[] => {
  const seen = new Map<string, number>();

  walk(markup, ({ attributes, view }) => {
    const status = attributes === null ? null : attributeOf(attributes, 'data-et-status');

    if (status) seen.set(`${view ?? 0}\u0000${status}`, (seen.get(`${view ?? 0}\u0000${status}`) ?? 0) + 1);
  });

  return [
    ...new Set([...seen].filter(([, count]) => count > 1).map(([key]) => key.split('\u0000')[1] as string)),
  ].sort();
};

const ATTRIBUTE_TEXTS = ['alt', 'aria-label', 'title', 'placeholder'];

/** The texts of `markup` inside a `data-et-sample` region, attribute texts included. */
export const sampleTextsOf = (markup: string): string[] => {
  const texts: string[] = [];

  walk(markup, ({ attributes, text, sample }) => {
    if (!sample) return;
    if (text !== null) texts.push(text);
    else
      for (const name of ATTRIBUTE_TEXTS) {
        const value = attributeOf(attributes, name);

        if (value) texts.push(value);
      }
  });

  return texts.map((text) => text.replace(/\s+/gu, ' ').trim()).filter(Boolean);
};

const containsLabel = (text: string, label: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?![\\p{L}\\p{N}])`, 'u').test(text);

/**
 * The coverage warnings of one part: its `coverage` declaration against its `states`, and the markup each state
 * draws (`drawn`, keyed by state). Pure, so a spec can feed it a definition and markup.
 */
export const coverageGapsOf = (options: {
  file: string;
  part: string;
  states: readonly string[];
  coverage: unknown;
  drawn: Record<string, string>;
}): Problem[] => {
  const { file, part } = options;
  const states = new Set(options.states);
  const coverage = (isRecord(options.coverage) ? options.coverage : {}) as Coverage;
  const problemOf =
    (rule: string) =>
    (where: string, message: string): Problem => ({ rule, file, part, at: where, message: `${where}: ${message}` });
  const unknownOf = (rule: string) => (where: string, state: string) =>
    states.has(state) ? [] : [problemOf(rule)(where, `names the state "${state}", which the part does not draw`)];

  const ranges = Object.entries(coverage.branches ?? {}).flatMap(([branch, { real, samples }]) => {
    const drawn = Object.entries(samples).filter((entry): entry is [string, Size] => !!entry[1]);
    const widest = Math.max(0, ...drawn.map(([, size]) => size.width));
    const tallest = Math.max(0, ...drawn.map(([, size]) => size.height));

    return [
      ...drawn.flatMap(([state]) => unknownOf('COVERAGE-RANGE')(`branch ${branch}`, state)),
      ...(drawn.length === 0
        ? [problemOf('COVERAGE-RANGE')(`branch ${branch}`, 'no state draws a sample in this layout branch')]
        : []),
      ...(drawn.length > 0 && widest < real.width
        ? [
            problemOf('COVERAGE-RANGE')(
              `branch ${branch}`,
              `the widest sample is ${widest} px, the widest real input ${real.width} px - draw a state with it`,
            ),
          ]
        : []),
      ...(drawn.length > 0 && tallest < real.height
        ? [
            problemOf('COVERAGE-RANGE')(
              `branch ${branch}`,
              `the tallest sample is ${tallest} px, the tallest real input ${real.height} px - draw a state with it`,
            ),
          ]
        : []),
    ];
  });

  const zooms = Object.entries(coverage.zoom?.statuses ?? {}).flatMap(([status, byZoom]) => [
    ...(coverage.zoom?.extremes ?? []).flatMap((extreme) => {
      const state = byZoom[extreme];

      return state
        ? unknownOf('COVERAGE-ZOOM')(`${status}@${extreme}`, state)
        : [
            problemOf('COVERAGE-ZOOM')(
              `${status}@${extreme}`,
              `no state draws the status "${status}" at the zoom extreme "${extreme}"`,
            ),
          ];
    }),
    ...Object.keys(byZoom)
      .filter((extreme) => !(coverage.zoom?.extremes ?? []).includes(extreme))
      .map((extreme) =>
        problemOf('COVERAGE-ZOOM')(`${status}@${extreme}`, `"${extreme}" is not one of the zoom extremes`),
      ),
  ]);

  const asyncs = Object.entries(coverage.async ?? {}).flatMap(([mark, state]) =>
    state
      ? unknownOf('COVERAGE-ASYNC')(`mark ${mark}`, state)
      : [
          problemOf('COVERAGE-ASYNC')(
            `mark ${mark}`,
            `the view reads "${mark}" asynchronously, but no state draws it while it is unknown`,
          ),
        ],
  );

  const chrome = coverage.chrome ?? [];
  const echoes = Object.entries(options.drawn).flatMap(([state, markup]) => {
    const texts = sampleTextsOf(markup);
    const hits = chrome.filter((label) => texts.some((text) => containsLabel(text, label)));

    return hits.length
      ? [
          problemOf('SAMPLE-CHROME')(
            `state ${state}`,
            `the sample repeats the live chrome label${hits.length === 1 ? '' : 's'} ${hits.map((label) => `"${label}"`).join(', ')} - give the sample other labels`,
          ),
        ]
      : [];
  });

  const twice = Object.entries(options.drawn).flatMap(([state, markup]) => {
    const statuses = statusesTwiceOf(markup);

    return statuses.length
      ? [
          problemOf('STATUS-TWICE')(
            `state ${state}`,
            `shows the status ${statuses.map((status) => `"${status}"`).join(', ')} twice in one view`,
          ),
        ]
      : [];
  });

  return [...ranges, ...zooms, ...asyncs, ...echoes, ...twice];
};

const COVERAGE_SOURCE = /\bcoverage\s*:|data-et-status/u;

const drawnStatesOf = async (definition: Record<string, unknown>) => {
  const render = definition['render'] as (props: unknown) => unknown;
  const drawn: Record<string, string> = {};

  for (const [state, props] of Object.entries(definition['states'] as Record<string, unknown>)) {
    const result = await Promise.resolve()
      .then(() => render(props))
      .catch(() => null);

    if (isRecord(result) && typeof result['body'] === 'string') drawn[state] = result['body'];
  }

  return drawn;
};

const gapsOfPart = async (options: { load: PartModuleLoader; product: ResolvedProduct; part: ResolvedPart }) => {
  const module = await options.load({ file: options.part.file, product: options.product.name }).catch(() => null);
  const definition = isRecord(module) ? module['default'] : null;

  if (!isRecord(definition) || typeof definition['render'] !== 'function' || !isRecord(definition['states'])) return [];

  return coverageGapsOf({
    file: options.part.file,
    part: partKeyOf(options.part),
    states: Object.keys(definition['states']),
    coverage: definition['coverage'],
    drawn: await drawnStatesOf(definition),
  });
};

/**
 * The design coverage warnings (`COVERAGE-RANGE`, `COVERAGE-ZOOM`, `COVERAGE-ASYNC`, `SAMPLE-CHROME`, `STATUS-TWICE`)
 * of a product's own parts that declare `coverage` or mark a status; only those parts are loaded.
 */
export const designCoverageOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part?: string;
  load?: PartModuleLoader;
}): Promise<Problem[]> => {
  const parts = options.product.parts.filter(
    (part) =>
      part.origin !== 'base' &&
      (!options.part || partKeyOf(part) === options.part) &&
      COVERAGE_SOURCE.test(part.source),
  );

  if (parts.length === 0) return [];

  const read = async (load: PartModuleLoader) => {
    const found: Problem[] = [];

    for (const part of parts) found.push(...(await gapsOfPart({ load, product: options.product, part })));

    return found;
  };

  return options.load ? read(options.load) : withPartLoader(options, read);
};
