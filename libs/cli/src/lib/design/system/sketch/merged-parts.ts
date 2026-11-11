import { existsSync, readFileSync } from 'fs';
import { writeJsonFile } from '../../../json-file';
import { dirname, resolve } from 'path';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { partHashesHold, partHashHolds, partHashOf } from './baseline';
import { listSketches, Sketch, variantDirOf } from './sketch';

export const MERGED_FILE = 'merged.json';

const mergedFileOf = (productDir: string) => resolve(productDir, MERGED_FILE);

/** Who picked the variant a part's last sketch merge took, which variant, and when it was picked. */
export type MergeDecision = { variant: string; decidedBy: string; at: string };

type MergedEntry = { hash: string; decision: MergeDecision | null; note?: string };

const decisionOf = (value: Record<string, unknown>): MergeDecision | null => {
  const { variant, decidedBy, at } = value;

  return typeof variant === 'string' && typeof decidedBy === 'string' && typeof at === 'string'
    ? { variant, decidedBy, at }
    : null;
};

const entryOf = (value: unknown): MergedEntry | null => {
  if (typeof value === 'string') return { hash: value, decision: null };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;

  if (typeof record['hash'] !== 'string') return null;

  const note = record['note'];

  return { hash: record['hash'], decision: decisionOf(record), ...(typeof note === 'string' ? { note } : {}) };
};

const readEntries = (productDir: string): Record<string, MergedEntry> => {
  const file = mergedFileOf(productDir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([part, value]) => {
        const entry = entryOf(value);

        return entry ? [[part, entry]] : [];
      }),
    );
  } catch {
    return {};
  }
};

const writeEntries = (productDir: string, entries: Record<string, MergedEntry>) => {
  const sorted = Object.entries(entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([part, { hash, decision, note }]) => [
      part,
      decision || note ? { hash, ...decision, ...(note ? { note } : {}) } : hash,
    ]);

  writeJsonFile({ file: mergedFileOf(productDir), value: Object.fromEntries(sorted) });
};

/** The content hash of each part, its folder and the assets it imports, as its last sketch merge left it, under the part key. */
export const readMerged = (productDir: string): Record<string, string> =>
  Object.fromEntries(Object.entries(readEntries(productDir)).map(([part, { hash }]) => [part, hash]));

/** The pick the part's last sketch merge took, or `null` for a part merged before picks were recorded. */
export const readMergeDecision = (productDir: string, part: string): MergeDecision | null =>
  readEntries(productDir)[part]?.decision ?? null;

type HashedProduct = Pick<ResolvedProduct, 'dir' | 'base'> & Partial<Pick<ResolvedProduct, 'config'>>;

/** The note of the part's last sketch merge: the plan that allowed it without a pick, the merge reason, or both. */
export const readMergeNote = (productDir: string, part: string): string | null =>
  readEntries(productDir)[part]?.note ?? null;

/**
 * Records the current content hash of each named part of the product as merged, with `decision` when a sketch merge
 * records it. Without one, a part keeps the decision and note of its last merge.
 */
export const recordMerged = (options: { product: HashedProduct; parts: string[]; decision?: MergeDecision }) => {
  const { product, parts, decision } = options;
  const productDir = product.dir;
  const entries = readEntries(productDir);

  for (const part of parts) {
    const note = decision ? undefined : entries[part]?.note;

    entries[part] = {
      hash: partHashOf({ product, dir: resolve(productDir, part) }),
      decision: decision ?? entries[part]?.decision ?? null,
      ...(note ? { note } : {}),
    };
  }

  writeEntries(productDir, entries);
};

/** Drops the named parts from the product's `merged.json`. */
export const forgetMerged = (options: { productDir: string; parts: string[] }) => {
  const { productDir, parts } = options;
  const entries = readEntries(productDir);

  if (!parts.some((part) => part in entries)) return;

  for (const part of parts) delete entries[part];

  writeEntries(productDir, entries);
};

/** The product folder that holds the part now: the product's own, else its base's. */
export const holderOf = (options: { product: HashedProduct; part: string }): HashedProduct => {
  const { product, part } = options;

  return !existsSync(resolve(product.dir, part)) && product.base && existsSync(resolve(product.base.dir, part))
    ? { dir: product.base.dir, config: product.base.config, base: null }
    : product;
};

/** The recorded parts of the product, outside `except`, whose files still match their recorded hash, with that hash. */
export const unchangedMergedOf = (options: { product: ResolvedProduct; except: string[] }) => {
  const { product, except } = options;
  const merged = readMerged(product.dir);

  return product.parts.flatMap((part) => {
    const key = partKeyOf(part);
    const dir = dirname(part.file);

    return part.origin !== 'base' && !except.includes(key) && partHashHolds({ product, dir, hash: merged[key] })
      ? [{ key, hash: partHashOf({ product, dir }) }]
      : [];
  });
};

/** Records the parts of `before` whose hash differs now, and answers with their keys: an asset they use changed in a merge. */
export const rerecordChangedMerged = (options: {
  product: ResolvedProduct;
  before: { key: string; hash: string }[];
}) => {
  const { product, before } = options;
  const changed = before
    .filter(({ key, hash }) => partHashOf({ product, dir: resolve(product.dir, key) }) !== hash)
    .map(({ key }) => key);

  if (changed.length > 0) recordMerged({ product, parts: changed });

  return changed;
};

export const sketchedPartsOf = (product: ResolvedProduct) =>
  new Set(
    listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) =>
      typeof sketch === 'string'
        ? []
        : [
            partKeyOf(sketch),
            ...sketch.variants.flatMap((variant) => partFilesOf(variantDirOf(sketch, variant)).parts.map(partKeyOf)),
          ],
    ),
  );

/**
 * The merged parts of a product whose files changed since their last sketch merge, while no open
 * sketch holds them. A merge of a sketch on the part records its new state and clears it.
 */
export const changedOutsideSketchOf = (product: ResolvedProduct): string[] => {
  const merged = readMerged(product.dir);
  const recorded = product.parts.filter((part) => part.origin !== 'base' && merged[partKeyOf(part)] !== undefined);
  const holds = partHashesHold(
    product,
    recorded.map((part) => ({ dir: dirname(part.file), hash: merged[partKeyOf(part)] })),
  );
  const changed = recorded.filter((_, index) => !holds[index]);

  if (changed.length === 0) return [];

  const sketched = sketchedPartsOf(product);

  return changed.map(partKeyOf).filter((key) => !sketched.has(key));
};

/** The sketch name of the old/new sketch a direct edit of a merged part opens. */
export const EDIT_SKETCH = 'edit';

const editSketchIdOf = (part: string) => `${part}@${EDIT_SKETCH}`;

/** Whether `sketch` is the old/new sketch of a direct edit (`<part>@edit`). */
export const isEditSketch = (sketch: Pick<Sketch, 'target' | 'layer' | 'name'>) =>
  sketch.target === editSketchIdOf(partKeyOf(sketch));

/**
 * The direct edits of a product's merged parts: each part with an open edit sketch, with its id, and each part changed
 * outside a sketch that has none yet (`sketch: null`).
 */
export const directEditsOf = (product: ResolvedProduct): { part: string; sketch: string | null }[] => {
  const open = listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) =>
    typeof sketch !== 'string' && isEditSketch(sketch) ? [{ part: partKeyOf(sketch), sketch: sketch.target }] : [],
  );

  return [...open, ...changedOutsideSketchOf(product).map((part) => ({ part, sketch: null }))];
};

/**
 * Notes why a sketch merge went the way it did in the part's `merged.json` entry: the plan entry that let it go without
 * a pick in Studio (`planRef`), the merge reason (`reason`), or both.
 */
export const recordMergeReason = (options: {
  product: HashedProduct;
  part: string;
  planRef?: string;
  reason?: string;
}) => {
  const { part, planRef, reason } = options;
  const product = holderOf(options);
  const note = [planRef ? `merged without a pick: allowed by ${planRef}` : '', reason ? `merged: ${reason}` : '']
    .filter(Boolean)
    .join(' - ');
  const entries = readEntries(product.dir);

  if (note === '') return;

  entries[part] = {
    hash: entries[part]?.hash ?? partHashOf({ product, dir: resolve(product.dir, part) }),
    decision: entries[part]?.decision ?? null,
    note,
  };

  writeEntries(product.dir, entries);
};
