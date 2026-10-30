import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';
import { jsonLayoutOf } from '../../json-layout';
import { statusPath } from '../../status';
import { ASSETS_FOLDER } from '../assets';
import { SHARED_PREFIX } from '../imports';
import { isLayer, Layer } from '../layers';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { baselineOf } from './baseline';
import { withMadeBy } from './part-definition';

export const SKETCH_STATUSES = ['in progress', 'ready'] as const;

export type SketchStatus = (typeof SKETCH_STATUSES)[number];

export type SketchTarget = { layer: Layer; name: string };

/** What the user decided in Studio: a variant to merge, or the whole sketch to drop. */
export type SketchDecision =
  | { kind: 'pick'; variant: string; comment?: string; decidedAt: string }
  | { kind: 'discard'; comment?: string; decidedAt: string };

/**
 * What `sketch.json` knows about one variant: the model ids that reported on it, in the order of their first report,
 * the key of its round, and its note - what it is and what it costs - kept apart from the part's merged note.
 */
export type SketchVariantInfo = { authors?: string[]; round?: string; note?: string };

/** Who recorded a verdict on a variant: the designer, in Studio or with `--by designer`, or an agent. */
export type SketchVerdictBy = 'designer' | 'agent';

/** Ends a rejection: the variant can be picked and merged again. */
export type SketchReopening = { by: SketchVerdictBy; decidedAt: string; reason?: string };

/**
 * One rejection of a variant. `by` recorded the rejection and `reasonBy` its reason, which can be set later;
 * the rejection holds while it has no `reopened`.
 */
export type SketchRejection = {
  by: SketchVerdictBy;
  decidedAt: string;
  reason?: string;
  reasonBy?: SketchVerdictBy;
  reopened?: SketchReopening;
};

/** One round of variants: its title, the note on what it shows, and why its variants lost once a newer round runs. */
export type SketchRound = { key: string; title: string; note: string; lost?: string; drops?: string[] };

export type SketchFile = {
  target: string;
  status: SketchStatus;
  createdAt: string;
  /** The content hash of each part and of the fixtures in the product when the sketch was created or rebased. */
  baseline?: Record<string, string>;
  decision?: SketchDecision;
  variantInfo?: Record<string, SketchVariantInfo>;
  /** Per variant, every rejection it had, oldest first. */
  rejections?: Record<string, SketchRejection[]>;
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

/** The folder of a sketch that holds no variant: code every variant imports as `@shared/<path>`. */
export const SHARED_FOLDER = 'shared';

export const sharedDirOf = (sketch: Pick<Sketch, 'dir'>) => resolve(sketch.dir, SHARED_FOLDER);

/** A variant's own `shared/` folder: a file there wins over the sketch's `shared/` file of the same path. */
export const variantSharedDirOf = (sketch: Sketch, variant: string) =>
  resolve(variantDirOf(sketch, variant), SHARED_FOLDER);

const SOURCE = /\.(?:ts|js|mjs)$/u;

export const sourceFilesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => SOURCE.test(path))
        .map((path) => resolve(dir, path))
    : [];

const liftShared = (options: { partDir: string; sketchSharedDir: string }) => {
  const { partDir, sketchSharedDir } = options;
  const shared = resolve(partDir, SHARED_FOLDER);

  if (!existsSync(shared)) return;

  for (const file of sourceFilesIn(partDir)) {
    const source = readFileSync(file, 'utf8');
    const rewritten = source.replace(
      /(['"])(\.{1,2}\/[^'"]+)\1/gu,
      (...[match = '', quote = '', specifier = '']: string[]) => {
        const path = relative(shared, resolve(dirname(file), specifier));

        return path.startsWith('..') || isAbsolute(path)
          ? match
          : `${quote}${SHARED_PREFIX}${path.split(sep).join('/')}${quote}`;
      },
    );

    if (rewritten !== source) writeFileSync(file, rewritten);
  }

  cpSync(shared, sketchSharedDir, { recursive: true });
  rmSync(shared, { recursive: true });
};

/** Reads `<layer>/<name>` as a sketch target, or answers with why it is not one. */
export const parseTarget = (value: string | undefined): SketchTarget | string => {
  const [layer = '', name = '', ...rest] = (value ?? '').split('/');

  if (!isLayer(layer) || !NAME.test(name) || rest.length > 0)
    return `"${value ?? ''}" is no target - pass <layer>/<name>, the layer one of foundations, components, elements, pages`;

  return { layer, name };
};

export const isVariantName = (name: string) => NAME.test(name) && name !== SHARED_FOLDER;

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
      ['undefined', 'string'].includes(typeof (info as Partial<SketchVariantInfo>).round) &&
      ['undefined', 'string'].includes(typeof (info as Partial<SketchVariantInfo>).note),
  );

const VERDICT_BY: readonly SketchVerdictBy[] = ['designer', 'agent'];

const isVerdictBy = (value: unknown): value is SketchVerdictBy => VERDICT_BY.includes(value as SketchVerdictBy);

const isOptionalText = (value: unknown) => value === undefined || typeof value === 'string';

const isReopening = (value: unknown): value is SketchReopening => {
  const reopening = value as Partial<Record<keyof SketchReopening, unknown>> | null;

  return (
    typeof reopening === 'object' &&
    reopening !== null &&
    isVerdictBy(reopening.by) &&
    typeof reopening.decidedAt === 'string' &&
    isOptionalText(reopening.reason)
  );
};

const isRejection = (value: unknown): value is SketchRejection => {
  const rejection = value as Partial<Record<keyof SketchRejection, unknown>> | null;

  return (
    typeof rejection === 'object' &&
    rejection !== null &&
    isVerdictBy(rejection.by) &&
    typeof rejection.decidedAt === 'string' &&
    isOptionalText(rejection.reason) &&
    (rejection.reasonBy === undefined || isVerdictBy(rejection.reasonBy)) &&
    (rejection.reopened === undefined || isReopening(rejection.reopened))
  );
};

const isRejections = (value: unknown): value is Record<string, SketchRejection[]> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (list: unknown) =>
      Array.isArray(list) &&
      list.every(isRejection) &&
      list.slice(0, -1).every((rejection: SketchRejection) => rejection.reopened !== undefined),
  );

const isRounds = (value: unknown): value is SketchRound[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (round: Partial<Record<keyof SketchRound, unknown>> | null) =>
      typeof round?.key === 'string' &&
      round.key !== '' &&
      typeof round.title === 'string' &&
      typeof round.note === 'string' &&
      (round.lost === undefined || typeof round.lost === 'string') &&
      (round.drops === undefined || (Array.isArray(round.drops) && round.drops.every((d) => typeof d === 'string'))),
  ) &&
  new Set(value.map((round: SketchRound) => round.key)).size === value.length;

const FIRST_ROUND = 'r1';

const firstRoundOf = (title = '', note = ''): SketchRound => ({ key: FIRST_ROUND, title, note: note.trim() });

const nextRoundKeyOf = (rounds: SketchRound[]) =>
  `r${Math.max(0, ...rounds.map((round) => Number(/^r(\d+)$/u.exec(round.key)?.[1] ?? 0))) + 1}`;

/** The round new variants join: the last one. */
export const runningRoundOf = (sketch: Pick<Sketch, 'rounds'>) =>
  sketch.rounds[sketch.rounds.length - 1] as SketchRound;

/** The rejection that holds on a variant now, or `null` when it is live. */
export const rejectionOf = (sketch: Pick<SketchFile, 'rejections'>, variant: string): SketchRejection | null => {
  const last = sketch.rejections?.[variant]?.at(-1);

  return last && !last.reopened ? last : null;
};

/** Why a rejected variant cannot be picked or merged, or `null` when it can. */
export const rejectedProblemOf = (sketch: Pick<Sketch, 'target' | 'rejections'>, variant: string) => {
  const rejection = rejectionOf(sketch, variant);

  return rejection
    ? `${sketch.target} variant ${variant} is rejected by the ${rejection.by}${rejection.reason ? `: ${rejection.reason}` : ''} - reopen it first`
    : null;
};

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
    return `${file}: variantInfo must be { <variant>: { authors?: string[], round?: string, note?: string } }`;
  if (parsed.rejections !== undefined && !isRejections(parsed.rejections))
    return `${file}: rejections must be { <variant>: [{ by: designer | agent, decidedAt, reason?, reasonBy?, reopened?: { by, decidedAt, reason? } }] }, each but the last reopened`;
  if (parsed.rounds !== undefined && !isRounds(parsed.rounds))
    return `${file}: rounds must be a non-empty list of { key, title, note } with unique keys`;

  const rounds = parsed.rounds ?? [firstRoundOf()];
  const running = runningRoundOf({ rounds }).key;
  const variants = foldersOf(dir).filter((folder) => folder !== SHARED_FOLDER);
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
    ...(sketch.rejections && Object.keys(sketch.rejections).length > 0 ? { rejections: sketch.rejections } : {}),
  };

  writeFileSync(resolve(sketch.dir, SKETCH_FILE), jsonLayoutOf(file));
};

const stubOf = (name: string) =>
  [
    "import { definePart, drawing, html } from '@design-system';",
    `import styles from './${name}.css?inline';`,
    '',
    'type Props = Record<string, never>;',
    '',
    'export default definePart({',
    "  note: '',",
    '  states: { default: {} },',
    `  render: (props: Props) => drawing({ body: html\`<div class="${name}">${name}</div>\`, styles }),`,
    '});',
    '',
  ].join('\n');

const pageStubOf = (options: { name: string; madeBy?: string; widths: number[] }) => {
  const { name, madeBy, widths } = options;

  return [
    "import { definePart, drawing, html } from '@design-system';",
    '',
    'type Props = Record<string, never>;',
    '',
    'export default definePart<Props>({',
    "  note: '',",
    ...(madeBy ? [`  madeBy: ['${madeBy}'],`] : []),
    ...(widths.length > 0 ? [`  widths: [${widths.join(', ')}],`] : []),
    '  states: { default: {} },',
    `  render: (props: Props) => drawing({ body: html\`<main>${name}</main>\` }),`,
    '});',
    '',
  ].join('\n');
};

/** Where `sketch new --like` copies from: a part folder, its part name, and the `shared/` folder of the sketch it comes from. */
export type SketchSource = { folder: string; name: string; shared: string | null };

/**
 * Reads `--like`: `<layer>/<name>` is the part the product resolves under that key, `<layer>/<name>:<variant>` that
 * part in a variant of the open sketch on it, together with the sketch's `shared/` folder.
 */
export const sketchSourceOf = (options: { product: ResolvedProduct; like: string }): SketchSource | string => {
  const { product, like } = options;
  const [key = '', variant, ...rest] = like.split(':');
  const parsed = parseTarget(key);

  if (typeof parsed === 'string' || rest.length > 0)
    return `--like "${like}" names no part - pass <layer>/<name> or <layer>/<name>:<variant>`;

  const resolved = product.parts.find((part) => partKeyOf(part) === key);

  if (variant === undefined)
    return resolved
      ? { folder: dirname(resolved.file), name: parsed.name, shared: null }
      : `--like: ${product.name} has no part ${key}`;

  const sketch = findSketch({ productDir: product.dir, product: product.name, sketch: parsed });

  if (sketch === null) return `--like: ${key} has no open sketch`;
  if (typeof sketch === 'string') return sketch;
  if (!sketch.variants.includes(variant))
    return `--like: the sketch on ${key} has no variant "${variant}" - it has ${sketch.variants.join(', ')}`;

  const own = resolve(variantDirOf(sketch, variant), parsed.layer, parsed.name);
  const folder = existsSync(own) ? own : resolved ? dirname(resolved.file) : null;

  if (folder === null) return `--like: variant "${variant}" of ${key} holds no ${key}`;

  return { folder, name: parsed.name, shared: existsSync(sharedDirOf(sketch)) ? sharedDirOf(sketch) : null };
};

const copyPartAs = (options: { from: SketchSource; to: string; name: string }) => {
  const { from, to, name } = options;

  cpSync(from.folder, to, { recursive: true });

  for (const extension of ['ts', 'css']) {
    const old = resolve(to, `${from.name}.${extension}`);

    if (from.name !== name && existsSync(old)) renameSync(old, resolve(to, `${name}.${extension}`));
  }

  const file = resolve(to, `${name}.ts`);

  if (!existsSync(file)) return;

  const source = readFileSync(file, 'utf8').split(`./${from.name}.css`).join(`./${name}.css`);

  writeFileSync(file, withMadeBy(source, []) ?? source);
};

const variantInfoOf = (options: { round: string; author?: string; note?: string }): SketchVariantInfo => ({
  ...(options.author ? { authors: [options.author] } : {}),
  round: options.round,
  ...(options.note?.trim() ? { note: options.note.trim() } : {}),
});

/**
 * Opens a sketch on a target, in progress, with one folder per variant, all in round 1 and with `author` as their
 * author. Each variant starts from `like` when given - renamed to the target, without its `madeBy`, and with its
 * sketch's `shared/` folder - else from the part the product resolves for the target, or from an empty part when the
 * target is new. A part's own `shared/` folder becomes the sketch's, imported as `@shared/`. A target holds one open
 * sketch at a time.
 */
export const createSketch = (options: {
  product: ResolvedProduct;
  sketch: SketchTarget;
  variants: string[];
  roundTitle?: string;
  roundNote?: string;
  author?: string;
  like?: SketchSource;
  variantNotes?: Map<string, string>;
}): Sketch | string => {
  const { product, sketch, variants, roundTitle, roundNote, author, like, variantNotes } = options;
  const dir = sketchDirOf({ productDir: product.dir, sketch });
  const key = partKeyOf(sketch);

  if (existsSync(dir)) return `${key} already has an open sketch - merge or discard it first`;
  if (variants.length === 0) return 'name at least one variant';

  const invalid = variants.find((variant) => !isVariantName(variant));

  if (invalid !== undefined)
    return `"${invalid}" is no variant name - use lower case letters, digits and dashes, and not "shared"`;
  if (new Set(variants).size !== variants.length) return 'each variant name must be unique';

  const existing = product.parts.find((part) => partKeyOf(part) === key);

  for (const variant of variants) {
    const folder = resolve(dir, variant, sketch.layer, sketch.name);

    mkdirSync(folder, { recursive: true });
    mkdirSync(resolve(dir, variant, ASSETS_FOLDER), { recursive: true });

    if (like) {
      copyPartAs({ from: like, to: folder, name: sketch.name });
      liftShared({ partDir: folder, sketchSharedDir: resolve(dir, SHARED_FOLDER) });
    } else if (existing) {
      cpSync(resolve(existing.file, '..'), folder, { recursive: true });
      liftShared({ partDir: folder, sketchSharedDir: resolve(dir, SHARED_FOLDER) });
    } else {
      if (sketch.layer === 'pages') {
        const widths = [...new Set(Object.values(product.presets).map((preset) => preset.width))].sort((a, b) => a - b);
        writeFileSync(resolve(folder, `${sketch.name}.ts`), pageStubOf({ name: sketch.name, madeBy: author, widths }));
      } else {
        writeFileSync(resolve(folder, `${sketch.name}.ts`), stubOf(sketch.name));
        writeFileSync(resolve(folder, `${sketch.name}.css`), '');
      }
    }
  }

  if (like?.shared) cpSync(like.shared, resolve(dir, SHARED_FOLDER), { recursive: true });

  const created: Sketch = {
    target: key,
    status: 'in progress',
    createdAt: new Date().toISOString(),
    baseline: baselineOf(product),
    rounds: [firstRoundOf(roundTitle, roundNote)],
    variantInfo: Object.fromEntries(
      variants.map((variant) => [
        variant,
        variantInfoOf({ round: FIRST_ROUND, author, note: variantNotes?.get(variant) }),
      ]),
    ),
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
  if (sketch.status !== 'in progress')
    return `${sketch.target} is ${sketch.status}, not in progress - Studio shows a report only while the sketch is in progress, so nothing was recorded`;

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

/** Ends the live report on a sketch when it belongs to `variant`, and says whether there was one to end. */
export const finishSketchReport = (options: { checkout: string; sketch: Sketch; variant: string }) => {
  const report = readSketchReport(options);

  if (!report || (report.variant !== null && report.variant !== options.variant)) return false;

  clearSketchReport(options);

  return true;
};

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

/** A verdict on one variant: reject it, set the reason of its rejection, or reopen it. */
export type SketchVariantVerdict =
  | { kind: 'reject'; variant: string; reason?: string; by: SketchVerdictBy }
  | { kind: 'reason'; variant: string; reason: string; by: SketchVerdictBy }
  | { kind: 'reopen'; variant: string; reason?: string; by: SketchVerdictBy };

export type SketchDecisionInput =
  { kind: 'pick'; variant: string; comment?: string } | { kind: 'discard'; comment?: string } | SketchVariantVerdict;

const withVerdict = (sketch: Sketch, verdict: SketchVariantVerdict): Sketch | string => {
  const { variant, by } = verdict;
  const reason = verdict.reason?.trim() || undefined;
  const decidedAt = new Date().toISOString();
  const history = sketch.rejections?.[variant] ?? [];
  const current = rejectionOf(sketch, variant);

  if (!sketch.variants.includes(variant))
    return `${sketch.target} has no variant "${variant}" - it has ${sketch.variants.join(', ')}`;

  let next: SketchRejection[];

  if (verdict.kind === 'reject') {
    if (current) return `${sketch.target} variant ${variant} is already rejected - set its reason instead`;

    next = [...history, { by, decidedAt, ...(reason ? { reason, reasonBy: by } : {}) }];
  } else if (!current) {
    return `${sketch.target} variant ${variant} is not rejected`;
  } else if (verdict.kind === 'reason') {
    if (!reason) return 'a reason needs text';

    next = [...history.slice(0, -1), { ...current, reason, reasonBy: by }];
  } else {
    next = [...history.slice(0, -1), { ...current, reopened: { by, decidedAt, ...(reason ? { reason } : {}) } }];
  }

  const unpicked = verdict.kind === 'reject' && sketch.decision?.kind === 'pick' && sketch.decision.variant === variant;
  const { decision, ...rest } = sketch;

  return {
    ...rest,
    ...(decision && !unpicked ? { decision } : {}),
    rejections: { ...sketch.rejections, [variant]: next },
  };
};

/**
 * Records the user's pick or discard on a sketch, the decision Studio writes and the agent acts on, or a verdict on
 * one variant. A rejected variant cannot be picked; rejecting the picked variant clears the pick.
 */
export const decideSketch = (options: { sketch: Sketch; decision: SketchDecisionInput }): Sketch | string => {
  const { sketch, decision } = options;

  if (decision.kind === 'reject' || decision.kind === 'reason' || decision.kind === 'reopen') {
    const judged = withVerdict(sketch, decision);

    if (typeof judged !== 'string') writeSketchFile(judged);

    return judged;
  }

  if (decision.kind === 'pick') {
    if (sketch.status !== 'ready') return `${sketch.target} is ${sketch.status} - a variant is picked once it is ready`;
    if (!sketch.variants.includes(decision.variant))
      return `${sketch.target} has no variant "${decision.variant}" - it has ${sketch.variants.join(', ')}`;

    const rejected = rejectedProblemOf(sketch, decision.variant);

    if (rejected) return rejected;
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
 * The new variant joins the running round, or starts the round `round` names, with `note` as its note, after writing
 * `lostNote` into the running round's `lost`.
 */
export const addVariant = (options: {
  sketch: Sketch;
  variant: string;
  from: string;
  round?: { title: string; lostNote: string; note?: string };
  author?: string;
}): Sketch | string => {
  const { sketch, variant, from, round, author } = options;

  if (sketch.decision?.kind === 'discard')
    return `The user decided to discard ${sketch.target}. The user must pick a variant first to go on.`;
  if (!sketch.variants.includes(from))
    return `${sketch.target} has no variant "${from}" - it has ${sketch.variants.join(', ') || 'none'}`;
  if (!isVariantName(variant))
    return `"${variant}" is no variant name - use lower case letters, digits and dashes, and not "shared"`;
  if (sketch.variants.includes(variant)) return `${sketch.target} already has a variant "${variant}"`;
  if (round && round.lostNote.trim() === '')
    return 'a new round needs a note on the running round: what it showed and why its variants lost';

  const running = runningRoundOf(sketch);
  const rounds = round
    ? [
        ...sketch.rounds.map((entry) => (entry === running ? { ...entry, lost: round.lostNote.trim() } : entry)),
        { key: nextRoundKeyOf(sketch.rounds), title: round.title.trim(), note: round.note?.trim() ?? '' },
      ]
    : sketch.rounds;

  cpSync(variantDirOf(sketch, from), variantDirOf(sketch, variant), { recursive: true });
  mkdirSync(resolve(variantDirOf(sketch, variant), ASSETS_FOLDER), { recursive: true });

  const { decision: _decision, ...undecided } = sketch;
  const added: Sketch = {
    ...undecided,
    status: 'in progress',
    rounds,
    variantInfo: { ...sketch.variantInfo, [variant]: variantInfoOf({ round: runningRoundOf({ rounds }).key, author }) },
    variants: [...sketch.variants, variant].sort(),
  };

  writeSketchFile(added);

  return added;
};

const withDrops = (round: SketchRound, drops: string[] | undefined): SketchRound => {
  const { drops: _previous, ...rest } = round;

  return drops && drops.length > 0 ? { ...rest, drops } : rest;
};

/** Changes the title, the note and the dropped states of the round with key `round`; a field left out stays as it is. */
export const editRound = (options: {
  sketch: Sketch;
  round: string;
  title?: string;
  note?: string;
  drops?: string[];
}): Sketch | string => {
  const { sketch, round, title, note, drops } = options;

  if (!sketch.rounds.some((entry) => entry.key === round))
    return `${sketch.target} has no round "${round}" - it has ${sketch.rounds.map((entry) => entry.key).join(', ')}`;
  if (title === undefined && note === undefined && drops === undefined)
    return 'pass --title <text>, --note <text> or --drops <state,state>';
  if (title !== undefined && title.trim() === '') return 'a round needs a title';

  const edited: Sketch = {
    ...sketch,
    rounds: sketch.rounds.map((entry) =>
      entry.key === round
        ? withDrops(
            { ...entry, title: title?.trim() ?? entry.title, note: note?.trim() ?? entry.note },
            drops ?? entry.drops,
          )
        : entry,
    ),
  };

  writeSketchFile(edited);

  return edited;
};
