import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { appFilesOf } from './app-files';
import {
  ACTION_LOST_RULE,
  COMPARE_RULE,
  CONTRAST_PAIR_RULE,
  CONTROL_STATE_RULE,
  DROPPED_PROP_RULE,
  SDK_ERROR_RULE,
  SlowProblemsOf,
  STATE_NO_SOURCE_RULE,
} from './build-ready-contract';
import { DesignHash, designHashOf, designHolds, FileHashes, fileHashesOf, hashOfFiles, sha16 } from './design-hash';
import { harnessOf } from './harness-map';
import { READY_FILE, readRecordedActions } from './part-ready';
import { Problem } from './problem';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { APP_SPEC_RULE } from './rules/app-spec';
import { UNCOVERED_REGION_RULE } from './rules/uncovered-region';
import { unbaselinedProblemsOf } from './rule-baseline';
import { appSourcesOf } from './rules/implemented-components';
import { partLinkOf } from './sketch/part-definition';

export const PRODUCT_PART = '(product)';

export const isDrawRule = (rule: string) =>
  [CONTROL_STATE_RULE, DROPPED_PROP_RULE, STATE_NO_SOURCE_RULE, ACTION_LOST_RULE, CONTRAST_PAIR_RULE].includes(rule);

/** Whether the `--slow` set runs `rule`, so `check --rules` does not. */
export const isSlowRule = (rule: string) =>
  isDrawRule(rule) || [APP_SPEC_RULE, UNCOVERED_REGION_RULE, COMPARE_RULE, SDK_ERROR_RULE].includes(rule);

const DECLARES_CONTROLS = /\bcontrols\s*:/u;

/** Whether a part measures theme token pairs with `measureContrastPairs`, so `CONTRAST-PAIR` draws it. */
export const measuresContrastPairs = (part: ResolvedPart) =>
  part.origin !== 'base' && /\bmeasureContrastPairs\b/u.test(part.source);

/** A state of a part whose app picture a slow run could not take, and why. */
export type UnjudgedState = { state: string; why: string };

/** One part's slow-rule problems and the input hash they were found at. */
export type SlowEntry = { hash: string; problems: Problem[]; at: string; unjudged?: UnjudgedState[] };

export type SlowCache = Record<string, SlowEntry>;

const SPEC_SIBLING = /\.(?:ts|html|css)$/u;

/** The gitignored file that holds a product's slow results, under the checkout's `node_modules/.cache`. */
export const slowCacheFileOf = (product: ResolvedProduct) =>
  join(repoRootOf(product), 'node_modules', '.cache', 'ethlete-design', product.name, 'slow-checks.json');

export const readSlowCache = (product: ResolvedProduct): SlowCache => {
  try {
    const parsed = JSON.parse(readFileSync(slowCacheFileOf(product), 'utf8')) as unknown;

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as SlowCache) : {};
  } catch {
    return {};
  }
};

/** Stores `results` at `hashes`; every part in `hashes` without a result is stored clean. */
export const writeSlowResults = (options: {
  product: ResolvedProduct;
  hashes: Record<string, string>;
  results: Map<string, Problem[]>;
  unjudged?: Map<string, UnjudgedState[]>;
}) => {
  const file = slowCacheFileOf(options.product);
  const cache = readSlowCache(options.product);
  const at = new Date().toISOString();

  for (const [part, hash] of Object.entries(options.hashes)) {
    const unjudged = options.unjudged?.get(part) ?? [];

    cache[part] = { hash, problems: options.results.get(part) ?? [], at, ...(unjudged.length > 0 ? { unjudged } : {}) };
  }

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(cache, null, 2)}\n`);
};

/** The component a part's `implements` link names, `null` for none. */
export const linkedComponentOf = (part: ResolvedPart) => {
  const link = partLinkOf(part.source);

  return link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
};

const livePagesOf = (root: string, live: string | undefined) => {
  if (!live) return null;

  try {
    const spec = JSON.parse(readFileSync(resolve(root, live), 'utf8')) as { pages?: Record<string, unknown> };

    return new Set(Object.keys(spec.pages ?? {}));
  } catch {
    return new Set<string>();
  }
};

const implementedHashOf = (product: ResolvedProduct, part: string) => {
  try {
    const records = JSON.parse(readFileSync(join(product.dir, 'implemented.json'), 'utf8')) as Record<
      string,
      { hash?: unknown }
    >;

    return records[part]?.hash;
  } catch {
    return undefined;
  }
};

/** What a part's slow result depends on, and the rules that check it; no rules means it has no slow result. */
export type SlowInputs = { rules: string[]; hash: string; designOnly?: true };

type PartContext = {
  product: ResolvedProduct;
  root: string;
  harness: Exclude<ReturnType<typeof harnessOf>, string>;
  pages: Set<string> | null;
  designs: Map<string, DesignHash>;
};

const designOf = (context: PartContext, part: ResolvedPart) => {
  const key = partKeyOf(part);
  const known = context.designs.get(key);

  if (known !== undefined) return known;

  const design = designHashOf({ product: context.product, part });

  context.designs.set(key, design);

  return design;
};

const contextOf = (product: ResolvedProduct): PartContext => {
  const root = repoRootOf(product);
  const found = harnessOf(product);
  const harness = typeof found === 'string' ? null : found;

  return {
    product,
    root,
    harness,
    pages: livePagesOf(root, harness?.live),
    designs: new Map(),
  };
};

const consumersOf = (root: string, component: string | null): FileHashes => {
  const src = component?.match(/^(.*?\/src)\//u)?.[1];
  const dir = src ? resolve(root, src) : null;

  return dir && existsSync(dir)
    ? fileHashesOf(
        root,
        appSourcesOf(dir).map(({ path }) => path),
      )
    : {};
};

const partInputsOf = (context: PartContext, part: ResolvedPart): SlowInputs => {
  const { product, root, harness, pages } = context;
  const key = partKeyOf(part);
  const own = part.origin !== 'base';
  const linked = linkedComponentOf(part);
  const component = harness ? linked : null;
  const design = designOf(context, part);
  const implemented = implementedHashOf(product, key);
  const current = typeof implemented === 'string' && designHolds(implemented, design);
  const designOnly = component !== null && implemented !== undefined && !current;
  const app = linked === null ? {} : appFilesOf({ root, component: linked });
  const rules = [
    ...(own && !key.startsWith('pages/') && DECLARES_CONTROLS.test(part.source) ? [CONTROL_STATE_RULE] : []),
    ...(measuresContrastPairs(part) ? [CONTRAST_PAIR_RULE] : []),
    ...(own && linked !== null && existsSync(resolve(root, linked)) ? [DROPPED_PROP_RULE, STATE_NO_SOURCE_RULE] : []),
    ...(component !== null && harness?.specs ? [APP_SPEC_RULE] : []),
    ...(pages?.has(key) ? [UNCOVERED_REGION_RULE] : []),
    ...(component !== null && current ? [COMPARE_RULE, SDK_ERROR_RULE] : []),
    ...(designOnly ? [COMPARE_RULE] : []),
  ];

  if (rules.length === 0) return { rules, hash: '' };

  const specs = fileHashesOf(
    root,
    Object.keys(app)
      .filter((file) => SPEC_SIBLING.test(file))
      .map((file) => resolve(root, file.replace(SPEC_SIBLING, '.spec.ts')))
      .filter((file) => existsSync(file)),
  );
  const live =
    harness?.live && rules.includes(UNCOVERED_REGION_RULE) ? fileHashesOf(root, [resolve(root, harness.live)]) : {};

  return {
    rules,
    hash: sha16(
      [
        rules.join(','),
        design.withLinks,
        hashOfFiles(app),
        hashOfFiles(specs),
        hashOfFiles(live),
        rules.includes(STATE_NO_SOURCE_RULE) ? hashOfFiles(consumersOf(root, linked)) : '',
      ].join('\0'),
    ),
    ...(designOnly ? { designOnly: true as const } : {}),
  };
};

const actionsRecordedIn = (product: ResolvedProduct) =>
  Object.values(readRecordedActions(product.dir)).some((record) => record.actions.length > 0);

const productInputsOf = (context: PartContext, parts: Record<string, SlowInputs>): SlowInputs => {
  const { product, root, harness } = context;
  const actions = actionsRecordedIn(product);
  const rules = [
    ...(harness?.specs ? [APP_SPEC_RULE] : []),
    ...(harness?.live ? [UNCOVERED_REGION_RULE] : []),
    ...(actions ? [ACTION_LOST_RULE] : []),
  ];

  if (rules.length === 0) return { rules, hash: '' };

  const files = fileHashesOf(root, [
    ...(harness ? [harness.map, harness.live, harness.specs] : []).flatMap((file) =>
      file ? [resolve(root, file)] : [],
    ),
    ...(actions ? [join(product.dir, READY_FILE)] : []),
  ]);
  const designs = actions
    ? product.parts.filter((part) => part.origin !== 'base').map((part) => designOf(context, part).withLinks)
    : [];

  return {
    rules,
    hash: sha16(
      [
        rules.join(','),
        hashOfFiles(files),
        ...Object.entries(parts).map(([part, { hash }]) => `${part}=${hash}`),
        ...designs,
      ].join('\0'),
    ),
  };
};

/** The slow inputs of every part of the product that has a slow rule, and of `(product)`. */
export const slowInputsOf = (options: { product: ResolvedProduct }): Record<string, SlowInputs> => {
  const context = contextOf(options.product);
  const parts: Record<string, SlowInputs> = {};

  for (const part of options.product.parts) {
    const inputs = partInputsOf(context, part);

    if (inputs.rules.length > 0) parts[partKeyOf(part)] = inputs;
  }

  const product = productInputsOf(context, parts);

  return product.rules.length > 0 ? { ...parts, [PRODUCT_PART]: product } : parts;
};

/** The parts, `(product)` included, whose slow result is missing or found at other inputs. */
export const staleSlowPartsOf = (product: ResolvedProduct) => {
  const cache = readSlowCache(product);

  return Object.entries(slowInputsOf({ product }))
    .filter(([part, { hash }]) => cache[part]?.hash !== hash)
    .map(([part]) => part);
};

const freshSlowEntryOf = ({ product, part }: { product: ResolvedProduct; part: string }) => {
  const context = contextOf(product);
  const inputs =
    part === PRODUCT_PART
      ? slowInputsOf({ product })[PRODUCT_PART]
      : (() => {
          const found = product.parts.find((candidate) => partKeyOf(candidate) === part);

          return found ? partInputsOf(context, found) : undefined;
        })();

  if (!inputs || inputs.rules.length === 0) return null;

  const entry = readSlowCache(product)[part];

  return entry?.hash === inputs.hash ? entry : 'pending';
};

export const slowProblemsOf: SlowProblemsOf = ({ product, part }) => {
  const entry = freshSlowEntryOf({ product, part });

  if (entry === null) return [];
  if (entry === 'pending') return 'pending';

  return unbaselinedProblemsOf(product, entry.problems);
};

/** One warning line per state of `parts` whose current slow result could not judge it, naming the product, part, state and why. */
export const unjudgedStateWarningsOf = (options: { product: ResolvedProduct; parts: string[] }) =>
  options.parts.flatMap((part) => {
    const entry = freshSlowEntryOf({ product: options.product, part });

    return entry === null || entry === 'pending'
      ? []
      : (entry.unjudged ?? []).map(
          ({ state, why }) => `WARNING ${options.product.name} ${part}: state ${state} cannot be judged - ${why}`,
        );
  });
