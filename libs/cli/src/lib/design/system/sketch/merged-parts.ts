import { existsSync, readFileSync } from 'fs';
import { writeJsonFile } from '../../../json-file';
import { dirname, resolve } from 'path';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { partHashOf } from './baseline';
import { listSketches, variantDirOf } from './sketch';

export const MERGED_FILE = 'merged.json';

const mergedFileOf = (productDir: string) => resolve(productDir, MERGED_FILE);

/** Who picked the variant a part's last sketch merge took, which variant, and when it was picked. */
export type MergeDecision = { variant: string; decidedBy: string; at: string };

type MergedEntry = { hash: string; decision: MergeDecision | null };

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

  return typeof record['hash'] === 'string' ? { hash: record['hash'], decision: decisionOf(record) } : null;
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
    .map(([part, { hash, decision }]) => [part, decision ? { hash, ...decision } : hash]);

  writeJsonFile({ file: mergedFileOf(productDir), value: Object.fromEntries(sorted) });
};

/** The content hash of each part, its folder and the assets it imports, as its last sketch merge left it, under the part key. */
export const readMerged = (productDir: string): Record<string, string> =>
  Object.fromEntries(Object.entries(readEntries(productDir)).map(([part, { hash }]) => [part, hash]));

/** The pick the part's last sketch merge took, or `null` for a part merged before picks were recorded. */
export const readMergeDecision = (productDir: string, part: string): MergeDecision | null =>
  readEntries(productDir)[part]?.decision ?? null;

type HashedProduct = Pick<ResolvedProduct, 'dir' | 'base'> & Partial<Pick<ResolvedProduct, 'config'>>;

/**
 * Records the current content hash of each named part of the product as merged, with `decision` when a sketch merge
 * records it. Without one, a part keeps the decision of its last merge.
 */
export const recordMerged = (options: { product: HashedProduct; parts: string[]; decision?: MergeDecision }) => {
  const { product, parts, decision } = options;
  const productDir = product.dir;
  const entries = readEntries(productDir);

  for (const part of parts)
    entries[part] = {
      hash: partHashOf({ product, dir: resolve(productDir, part) }),
      decision: decision ?? entries[part]?.decision ?? null,
    };

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
    const hash = partHashOf({ product, dir: dirname(part.file) });

    return part.origin !== 'base' && !except.includes(key) && merged[key] === hash ? [{ key, hash }] : [];
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
  const changed = product.parts.filter((part) => {
    const key = partKeyOf(part);

    return (
      part.origin !== 'base' &&
      merged[key] !== undefined &&
      partHashOf({ product, dir: dirname(part.file) }) !== merged[key]
    );
  });

  if (changed.length === 0) return [];

  const sketched = sketchedPartsOf(product);

  return changed.map(partKeyOf).filter((key) => !sketched.has(key));
};

export const ACCEPTED_FILE = 'accepted.json';

export type Acceptance = { part: string; by: string; note: string; hash: string; at: string; auto?: true };

export const readAccepted = (productDir: string): Acceptance[] => {
  const file = resolve(productDir, ACCEPTED_FILE);

  if (!existsSync(file)) return [];

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return Array.isArray(parsed) ? (parsed as Acceptance[]) : [];
  } catch {
    return [];
  }
};

const logAcceptance = (productDir: string, entry: Acceptance) =>
  writeJsonFile({ file: resolve(productDir, ACCEPTED_FILE), value: [...readAccepted(productDir), entry] });

/** Logs a sketch merged by itself because no state showed a visible change, as an `auto` entry in `accepted.json`. */
export const recordAutoMerge = (options: { product: HashedProduct; part: string; by: string }) => {
  const { part, by } = options;
  const product = holderOf(options);

  logAcceptance(product.dir, {
    part,
    by,
    note: 'merged automatically: no visible change in any state',
    hash: partHashOf({ product, dir: resolve(product.dir, part) }),
    at: new Date().toISOString(),
    auto: true,
  });
};

/**
 * Records a part changed outside a sketch whose states all draw as at its last acceptance: writes its hash to
 * `merged.json` and logs an `auto` entry in `accepted.json`.
 */
export const recordAutoReview = (options: { product: HashedProduct; part: string; by: string }) => {
  const { product, part, by } = options;

  recordMerged({ product, parts: [part] });
  logAcceptance(product.dir, {
    part,
    by,
    note: 'accepted automatically: every state draws as at the last acceptance',
    hash: readMerged(product.dir)[part] ?? '',
    at: new Date().toISOString(),
    auto: true,
  });
};

/**
 * Logs a sketch merge with a reason in `accepted.json`: the plan entry that let it go without a pick in Studio
 * (`planRef`), the merge reason (`reason`), or both.
 */
export const recordMergeReason = (options: {
  product: HashedProduct;
  part: string;
  by: string;
  planRef?: string;
  reason?: string;
}) => {
  const { part, by, planRef, reason } = options;
  const product = holderOf(options);
  const allowed = planRef ? `merged without a pick: allowed by ${planRef}` : '';

  logAcceptance(product.dir, {
    part,
    by,
    note: [allowed, reason ? `merged: ${reason}` : ''].filter(Boolean).join(' - '),
    hash: partHashOf({ product, dir: resolve(product.dir, part) }),
    at: new Date().toISOString(),
  });
};

export type AcceptRefusal = { reason: 'unknown-part' | 'open-sketch' | 'nothing-to-accept'; error: string };

/** Why a direct edit of a part cannot be accepted, or `null` when it can. */
export const acceptRefusalOf = (options: { product: ResolvedProduct; part: string }): AcceptRefusal | null => {
  const { product, part } = options;

  if (!product.parts.some((candidate) => partKeyOf(candidate) === part))
    return { reason: 'unknown-part', error: `NO PART "${part}" in ${product.name}` };

  if (sketchedPartsOf(product).has(part))
    return {
      reason: 'open-sketch',
      error: `${part} has an open sketch - merge or discard it; a merge records the part`,
    };

  if (!changedOutsideSketchOf(product).includes(part))
    return { reason: 'nothing-to-accept', error: `${part} has no change outside a sketch - nothing to accept` };

  return null;
};

/**
 * Records a direct edit of a merged part the user approved: writes the part's current hash to `merged.json` and
 * logs who accepted it and why in `accepted.json`. Answers with why nothing was accepted, or `null`.
 */
export const acceptPart = (options: {
  product: ResolvedProduct;
  part: string;
  by: string;
  note: string;
}): string | null => {
  const { product, part, by, note } = options;
  const refusal = acceptRefusalOf({ product, part });

  if (refusal) return refusal.error;

  recordMerged({ product, parts: [part] });

  const hash = readMerged(product.dir)[part] ?? '';
  const entry: Acceptance = { part, by, note, hash, at: new Date().toISOString() };

  logAcceptance(product.dir, entry);

  return null;
};
