import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { statusPath } from '../../status';
import { isLayer, Layer } from '../layers';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { baselineOf } from './baseline';

export const SKETCH_STATUSES = ['in progress', 'ready'] as const;

export type SketchStatus = (typeof SKETCH_STATUSES)[number];

export type SketchTarget = { layer: Layer; name: string };

/** What the user decided in Studio: a variant to merge, or the whole sketch to drop. */
export type SketchDecision =
  | { kind: 'pick'; variant: string; comment?: string; decidedAt: string }
  | { kind: 'discard'; comment?: string; decidedAt: string };

/** What `sketch.json` knows about one variant: the model ids that reported on it, in the order of their first report, and the key of its round. */
export type SketchVariantInfo = { authors?: string[]; round?: string };

/** One round of variants: its title, and the note on what it showed and why its variants lost. */
export type SketchRound = { key: string; title: string; note: string };

export type SketchFile = {
  target: string;
  status: SketchStatus;
  createdAt: string;
  /** The content hash of each part and of the fixtures in the product when the sketch was created or rebased. */
  baseline?: Record<string, string>;
  decision?: SketchDecision;
  variantInfo?: Record<string, SketchVariantInfo>;
  rounds?: SketchRound[];
};

/** A sketch as read: `rounds` holds at least one round, and `variantInfo` names the round of every variant. */
export type Sketch = SketchFile & {
  rounds: SketchRound[];
  variantInfo: Record<string, SketchVariantInfo>;
  product: string;
  layer: Layer;
  name: string;
  dir: string;
  variants: string[];
};

const NAME = /^[a-z0-9][a-z0-9-]*$/u;

export const SKETCH_FILE = 'sketch.json';

export const sketchesDirOf = (productDir: string) => resolve(productDir, 'sketches');

export const sketchFolderOf = (target: SketchTarget) => `${target.layer}-${target.name}`;

export const sketchDirOf = (options: { productDir: string; sketch: SketchTarget }) =>
  resolve(sketchesDirOf(options.productDir), sketchFolderOf(options.sketch));

export const variantDirOf = (sketch: Sketch, variant: string) => resolve(sketch.dir, variant);

/** Reads `<layer>/<name>` as a sketch target, or answers with why it is not one. */
export const parseTarget = (value: string | undefined): SketchTarget | string => {
  const [layer = '', name = '', ...rest] = (value ?? '').split('/');

  if (!isLayer(layer) || !NAME.test(name) || rest.length > 0)
    return `"${value ?? ''}" is no target - pass <layer>/<name>, the layer one of foundations, components, elements, pages`;

  return { layer, name };
};

export const isVariantName = (name: string) => NAME.test(name);

const foldersOf = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => statSync(resolve(dir, name)).isDirectory())
        .sort()
    : [];

const isStatus = (value: unknown): value is SketchStatus => SKETCH_STATUSES.includes(value as SketchStatus);

const isAuthors = (value: unknown) =>
  value === undefined || (Array.isArray(value) && value.every((author) => typeof author === 'string' && author !== ''));

const isVariantInfo = (value: unknown): value is Record<string, SketchVariantInfo> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (info: unknown) =>
      typeof info === 'object' &&
      info !== null &&
      isAuthors((info as Partial<SketchVariantInfo>).authors) &&
      ['undefined', 'string'].includes(typeof (info as Partial<SketchVariantInfo>).round),
  );

const isRounds = (value: unknown): value is SketchRound[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (round: Partial<Record<keyof SketchRound, unknown>> | null) =>
      typeof round?.key === 'string' &&
      round.key !== '' &&
      typeof round.title === 'string' &&
      typeof round.note === 'string',
  ) &&
  new Set(value.map((round: SketchRound) => round.key)).size === value.length;

const FIRST_ROUND = 'r1';

const firstRoundOf = (title = '', note = ''): SketchRound => ({ key: FIRST_ROUND, title, note: note.trim() });

const nextRoundKeyOf = (rounds: SketchRound[]) =>
  `r${Math.max(0, ...rounds.map((round) => Number(/^r(\d+)$/u.exec(round.key)?.[1] ?? 0))) + 1}`;

/** The round new variants join: the last one. */
export const runningRoundOf = (sketch: Pick<Sketch, 'rounds'>) =>
  sketch.rounds[sketch.rounds.length - 1] as SketchRound;

/** The model ids that reported on a variant, in the order of their first report; none for old data. */
export const authorsOf = (sketch: Pick<Sketch, 'variantInfo'>, variant: string) =>
  sketch.variantInfo?.[variant]?.authors ?? [];

/** The sketch in a sketch folder, or why it cannot be read. */
export const readSketch = (options: { product: string; dir: string }): Sketch | string => {
  const { product, dir } = options;
  const file = resolve(dir, SKETCH_FILE);

  if (!existsSync(file)) return `${dir} holds no ${SKETCH_FILE}`;

  let parsed: Partial<SketchFile>;

  try {
    parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<SketchFile>;
  } catch (error) {
    return `${file} is no JSON: ${error instanceof Error ? error.message : String(error)}`;
  }

  const target = parseTarget(parsed.target);

  if (typeof target === 'string') return `${file}: ${target}`;
  if (!isStatus(parsed.status)) return `${file}: status must be one of ${SKETCH_STATUSES.join(', ')}`;
  if (parsed.variantInfo !== undefined && !isVariantInfo(parsed.variantInfo))
    return `${file}: variantInfo must be { <variant>: { authors?: string[], round?: string } }`;
  if (parsed.rounds !== undefined && !isRounds(parsed.rounds))
    return `${file}: rounds must be a non-empty list of { key, title, note } with unique keys`;

  const rounds = parsed.rounds ?? [firstRoundOf()];
  const running = runningRoundOf({ rounds }).key;
  const variants = foldersOf(dir);
  const variantInfo = { ...parsed.variantInfo };

  for (const variant of variants)
    variantInfo[variant] = { ...variantInfo[variant], round: variantInfo[variant]?.round ?? running };

  const lost = variants.find((variant) => !rounds.some((round) => round.key === variantInfo[variant]?.round));

  if (lost !== undefined)
    return `${file}: variant ${lost} names round "${variantInfo[lost]?.round}", which rounds does not hold`;

  return {
    ...(parsed as SketchFile),
    rounds,
    variantInfo,
    product,
    layer: target.layer,
    name: target.name,
    dir,
    variants,
  };
};

/** Every sketch folder of a product, read; a folder that cannot be read answers with its problem. */
export const listSketches = (options: { productDir: string; product: string }) =>
  foldersOf(sketchesDirOf(options.productDir)).map((folder) =>
    readSketch({ product: options.product, dir: resolve(sketchesDirOf(options.productDir), folder) }),
  );

export const findSketch = (options: { productDir: string; product: string; sketch: SketchTarget }) => {
  const dir = sketchDirOf(options);

  return existsSync(dir) ? readSketch({ product: options.product, dir }) : null;
};

export const writeSketchFile = (sketch: Sketch) => {
  const file: SketchFile = {
    target: partKeyOf(sketch),
    status: sketch.status,
    createdAt: sketch.createdAt,
    ...(sketch.baseline ? { baseline: sketch.baseline } : {}),
    ...(sketch.decision ? { decision: sketch.decision } : {}),
    rounds: sketch.rounds,
    ...(Object.keys(sketch.variantInfo).length > 0 ? { variantInfo: sketch.variantInfo } : {}),
  };

  writeFileSync(resolve(sketch.dir, SKETCH_FILE), `${JSON.stringify(file, null, 2)}\n`);
};

const stubOf = (name: string) =>
  [
    "import { definePart, drawing, html } from '@design-system';",
    `import styles from './${name}.css?inline';`,
    '',
    'export default definePart<Record<string, never>>({',
    "  note: '',",
    '  states: { default: {} },',
    `  render: () => drawing({ body: html\`<div class="${name}"></div>\`, styles }),`,
    '});',
    '',
  ].join('\n');

const variantInfoOf = (round: string, author: string | undefined): SketchVariantInfo =>
  author ? { authors: [author], round } : { round };

/**
 * Opens a sketch on a target, in progress, with one folder per variant, all in round 1 and with `author` as their
 * author. Each variant starts from the part the product resolves for the target, or from an empty part when the target
 * is new. A target holds one open sketch at a time.
 */
export const createSketch = (options: {
  product: ResolvedProduct;
  sketch: SketchTarget;
  variants: string[];
  roundTitle?: string;
  roundNote?: string;
  author?: string;
}): Sketch | string => {
  const { product, sketch, variants, roundTitle, roundNote, author } = options;
  const dir = sketchDirOf({ productDir: product.dir, sketch });
  const key = partKeyOf(sketch);

  if (existsSync(dir)) return `${key} already has an open sketch - merge or discard it first`;
  if (variants.length === 0) return 'name at least one variant';

  const invalid = variants.find((variant) => !isVariantName(variant));

  if (invalid !== undefined) return `"${invalid}" is no variant name - use lower case letters, digits and dashes`;
  if (new Set(variants).size !== variants.length) return 'each variant name must be unique';

  const existing = product.parts.find((part) => partKeyOf(part) === key);

  for (const variant of variants) {
    const folder = resolve(dir, variant, sketch.layer, sketch.name);

    mkdirSync(folder, { recursive: true });

    if (existing) {
      cpSync(resolve(existing.file, '..'), folder, { recursive: true });
    } else {
      writeFileSync(resolve(folder, `${sketch.name}.ts`), stubOf(sketch.name));
      writeFileSync(resolve(folder, `${sketch.name}.css`), '');
    }
  }

  const created: Sketch = {
    target: key,
    status: 'in progress',
    createdAt: new Date().toISOString(),
    baseline: baselineOf(product),
    rounds: [firstRoundOf(roundTitle, roundNote)],
    variantInfo: Object.fromEntries(variants.map((variant) => [variant, variantInfoOf(FIRST_ROUND, author)])),
    product: product.name,
    layer: sketch.layer,
    name: sketch.name,
    dir,
    variants: [...variants].sort(),
  };

  writeSketchFile(created);

  return created;
};

const reportSlugOf = (sketch: Sketch) => `sketches/${sketch.product}/${sketchFolderOf(sketch)}`;

/** The sketch with `author` among the authors of `variant`; the same sketch when it is there already. */
export const withAuthor = (options: { sketch: Sketch; variant: string; author: string }): Sketch => {
  const { sketch, variant, author } = options;
  const authors = authorsOf(sketch, variant);

  return authors.includes(author)
    ? sketch
    : {
        ...sketch,
        variantInfo: {
          ...sketch.variantInfo,
          [variant]: { ...sketch.variantInfo?.[variant], authors: [...authors, author] },
        },
      };
};

/** Where the live report of the agent on a sketch is kept, next to the call statuses. */
export const sketchReportPath = (options: { checkout: string; sketch: Sketch }) =>
  statusPath({ checkout: options.checkout, slug: reportSlugOf(options.sketch) });

const REPORT_LIMIT = 400;

type SketchReportFile = { state: 'drawing'; updatedAt: string; message: string; variant: string; author: string };

/**
 * Records what an agent builds on a variant of a sketch right now ("phone, outline state"), for Studio to show,
 * and adds the agent's model id to the variant's authors in `sketch.json` unless it is there already.
 */
export const reportSketch = (options: {
  checkout: string;
  sketch: Sketch;
  variant: string;
  author: string;
  message: string;
}): Sketch | string => {
  const { checkout, sketch, variant, author, message } = options;

  if (!sketch.variants.includes(variant))
    return `${sketch.target} has no variant "${variant}" - it has ${sketch.variants.join(', ') || 'none'}`;
  if (author.trim() === '') return 'a report needs --by <model id>';

  const reported = withAuthor({ sketch, variant, author });

  if (reported !== sketch) writeSketchFile(reported);

  const path = sketchReportPath({ checkout, sketch });
  const report: SketchReportFile = {
    state: 'drawing',
    updatedAt: new Date().toISOString(),
    message: message.slice(0, REPORT_LIMIT),
    variant,
    author,
  };

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(report));

  return reported;
};

/** The live report of an agent on a sketch: its message, the variant and the model id it named. `variant` and `author` are `null` in a report written before they were recorded. */
export type SketchReport = { message: string; updatedAt: string; variant: string | null; author: string | null };

/** The live report of the agent on a sketch, or `null` when none is running. */
export const readSketchReport = (options: { checkout: string; sketch: Sketch }): SketchReport | null => {
  const path = sketchReportPath(options);

  if (!existsSync(path)) return null;

  try {
    const { message, updatedAt, variant, author } = JSON.parse(readFileSync(path, 'utf8')) as Partial<
      Record<keyof SketchReportFile, unknown>
    >;

    return {
      message: typeof message === 'string' ? message : '',
      updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
      variant: typeof variant === 'string' && options.sketch.variants.includes(variant) ? variant : null,
      author: typeof author === 'string' && author !== '' ? author : null,
    };
  } catch {
    return null;
  }
};

export const clearSketchReport = (options: { checkout: string; sketch: Sketch }) =>
  rmSync(sketchReportPath(options), { force: true });

/**
 * Marks an in-progress sketch ready for the user to pick, ends its live report, and records `author` on each variant
 * that has no author yet.
 */
export const markSketchReady = (options: { checkout: string; sketch: Sketch; author?: string }): Sketch | string => {
  const { checkout, sketch, author } = options;

  if (sketch.status !== 'in progress') return `${sketch.target} is ${sketch.status}, not in progress`;
  if (sketch.variants.length === 0) return `${sketch.target} holds no variant`;

  const authored = author
    ? sketch.variants
        .filter((variant) => authorsOf(sketch, variant).length === 0)
        .reduce((current, variant) => withAuthor({ sketch: current, variant, author }), sketch)
    : sketch;
  const ready: Sketch = { ...authored, status: 'ready' };

  writeSketchFile(ready);
  clearSketchReport({ checkout, sketch });

  return ready;
};

/** Records the user's pick or discard on a sketch, the decision Studio writes and the agent acts on. */
export const decideSketch = (options: {
  sketch: Sketch;
  decision: { kind: 'pick'; variant: string; comment?: string } | { kind: 'discard'; comment?: string };
}): Sketch | string => {
  const { sketch, decision } = options;

  if (decision.kind === 'pick') {
    if (sketch.status !== 'ready') return `${sketch.target} is ${sketch.status} - a variant is picked once it is ready`;
    if (!sketch.variants.includes(decision.variant))
      return `${sketch.target} has no variant "${decision.variant}" - it has ${sketch.variants.join(', ')}`;
  }

  const decided: Sketch = { ...sketch, decision: { ...decision, decidedAt: new Date().toISOString() } };

  writeSketchFile(decided);

  return decided;
};

/**
 * Records the product as it is now as the sketch's baseline, once the agent has brought each variant
 * up to date with the parts that changed in the product since the sketch was created.
 */
export const rebaseSketch = (options: { product: ResolvedProduct; sketch: Sketch }): Sketch => {
  const rebased: Sketch = { ...options.sketch, baseline: baselineOf(options.product) };

  writeSketchFile(rebased);

  return rebased;
};

/**
 * Copies variant `from` into a new variant by `author`, sets the sketch back to in progress and clears a pick. A discard decision is refused.
 * The new variant joins the running round, or starts the round `round` names after writing its `lostNote` into the
 * running round's note.
 */
export const addVariant = (options: {
  sketch: Sketch;
  variant: string;
  from: string;
  round?: { title: string; lostNote: string };
  author?: string;
}): Sketch | string => {
  const { sketch, variant, from, round, author } = options;

  if (sketch.decision?.kind === 'discard')
    return `The user decided to discard ${sketch.target}. The user must pick a variant first to go on.`;
  if (!sketch.variants.includes(from))
    return `${sketch.target} has no variant "${from}" - it has ${sketch.variants.join(', ') || 'none'}`;
  if (!isVariantName(variant)) return `"${variant}" is no variant name - use lower case letters, digits and dashes`;
  if (sketch.variants.includes(variant)) return `${sketch.target} already has a variant "${variant}"`;
  if (round && round.lostNote.trim() === '')
    return 'a new round needs a note on the running round: what it showed and why its variants lost';

  const running = runningRoundOf(sketch);
  const rounds = round
    ? [
        ...sketch.rounds.map((entry) => (entry === running ? { ...entry, note: round.lostNote.trim() } : entry)),
        { key: nextRoundKeyOf(sketch.rounds), title: round.title.trim(), note: '' },
      ]
    : sketch.rounds;

  cpSync(variantDirOf(sketch, from), variantDirOf(sketch, variant), { recursive: true });

  const { decision: _decision, ...undecided } = sketch;
  const added: Sketch = {
    ...undecided,
    status: 'in progress',
    rounds,
    variantInfo: { ...sketch.variantInfo, [variant]: variantInfoOf(runningRoundOf({ rounds }).key, author) },
    variants: [...sketch.variants, variant].sort(),
  };

  writeSketchFile(added);

  return added;
};
