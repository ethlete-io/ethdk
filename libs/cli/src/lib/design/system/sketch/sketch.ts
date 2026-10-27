import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { statusPath, writeStatus } from '../../status';
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

export type SketchFile = {
  target: string;
  status: SketchStatus;
  createdAt: string;
  /** The content hash of each part and of the fixtures in the product when the sketch was created or rebased. */
  baseline?: Record<string, string>;
  decision?: SketchDecision;
};

export type Sketch = SketchFile & {
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

  return {
    ...(parsed as SketchFile),
    product,
    layer: target.layer,
    name: target.name,
    dir,
    variants: foldersOf(dir),
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

const writeSketchFile = (sketch: Sketch) => {
  const file: SketchFile = {
    target: partKeyOf(sketch),
    status: sketch.status,
    createdAt: sketch.createdAt,
    ...(sketch.baseline ? { baseline: sketch.baseline } : {}),
    ...(sketch.decision ? { decision: sketch.decision } : {}),
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

/**
 * Opens a sketch on a target, in progress, with one folder per variant. Each variant starts from the
 * part the product resolves for the target, or from an empty part when the target is new. A target
 * holds one open sketch at a time.
 */
export const createSketch = (options: {
  product: ResolvedProduct;
  sketch: SketchTarget;
  variants: string[];
}): Sketch | string => {
  const { product, sketch, variants } = options;
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

/** Where the live report of the agent on a sketch is kept, next to the call statuses. */
export const sketchReportPath = (options: { checkout: string; sketch: Sketch }) =>
  statusPath({ checkout: options.checkout, slug: reportSlugOf(options.sketch) });

/** Records what the agent builds on a sketch right now ("variant b, phone"), for Studio to show. */
export const reportSketch = (options: { checkout: string; sketch: Sketch; message: string }) =>
  writeStatus({
    checkout: options.checkout,
    slug: reportSlugOf(options.sketch),
    state: 'drawing',
    message: options.message,
  });

export const clearSketchReport = (options: { checkout: string; sketch: Sketch }) =>
  rmSync(sketchReportPath(options), { force: true });

/** Marks an in-progress sketch ready for the user to pick, and ends its live report. */
export const markSketchReady = (options: { checkout: string; sketch: Sketch }): Sketch | string => {
  const { checkout, sketch } = options;

  if (sketch.status !== 'in progress') return `${sketch.target} is ${sketch.status}, not in progress`;
  if (sketch.variants.length === 0) return `${sketch.target} holds no variant`;

  const ready: Sketch = { ...sketch, status: 'ready' };

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
