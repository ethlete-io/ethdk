import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { DesignConfig } from '../paths';
import { designHashOf, FileHashes, isOptionalFileHashes, recordHolds } from './design-hash';
import { drawnFindingsOf } from './drawn-open-points';
import { actionsRerunReasonOf, changedEmbeddedOf, EmbeddedHashes, embeddedHashesOf } from './embedded-actions';
import { partOwnerOf } from './inventory-approval';
import { OpenPoint } from './open-points';
import { partPointsOf, readOpenPoints } from './read-open-points';
import { partKeyOf, ResolvedProduct } from './resolve-product';

export const READY_FILE = 'ready.json';

/**
 * Who marked a part ready, and at which design hash, with the hash of each file it covers; the mark holds only while the
 * hash does. `embedded` holds the app hash of each embedded part its actions ran against.
 */
export type PartReady = { hash: string; files?: FileHashes; embedded?: EmbeddedHashes; by: string; at: string };

export type ReadyRefusal = { status: number; error: string; points?: OpenPoint[]; actions?: string[] };

const readyFileOf = (dir: string) => resolve(dir, READY_FILE);

const isReady = (value: unknown): value is PartReady => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { hash, by, at, files, embedded } = value as Record<string, unknown>;

  return (
    typeof hash === 'string' &&
    typeof by === 'string' &&
    typeof at === 'string' &&
    isOptionalFileHashes(files) &&
    isOptionalFileHashes(embedded)
  );
};

export const readReady = (dir: string): Record<string, PartReady> => {
  const file = readyFileOf(dir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, PartReady] => isReady(entry[1])))
      : {};
  } catch {
    return {};
  }
};

/** The design hash of a part and the directory whose ready.json holds it, or why the product has no such part. */
export const readyPartOf = (options: { product: ResolvedProduct; part: string }) => {
  const resolved = options.product.parts.find((candidate) => partKeyOf(candidate) === options.part);

  if (!resolved) return `product "${options.product.name}" has no part "${options.part}"`;

  const owner = partOwnerOf({ product: options.product, part: resolved });

  const design = designHashOf({ product: options.product, part: resolved });

  return { dir: owner.dir, hash: design.hash, design, resolved };
};

/** The ready mark of a part while its hash still matches, `null` when it has none or the part changed since. */
export const readyMarkOf = (options: { product: ResolvedProduct; part: string }): PartReady | null => {
  const found = readyPartOf(options);

  if (typeof found === 'string') return null;

  const mark = readReady(found.dir)[options.part];

  return mark && recordHolds(mark, found.design) ? mark : null;
};

/**
 * The embedded parts whose app files changed since the actions of `part` ran for its ready mark, `[]` while the mark
 * does not hold or predates the embedded record.
 */
export const actionsRerunOf = (options: { product: ResolvedProduct; part: string }): string[] => {
  const found = readyPartOf(options);

  if (typeof found === 'string') return [];

  const mark = readReady(found.dir)[options.part];

  if (!mark?.embedded || !recordHolds(mark, found.design)) return [];

  return changedEmbeddedOf(mark.embedded, embeddedHashesOf({ product: options.product, part: found.resolved }));
};

/** Draws a part and answers its whole open-point list, or why it could not be drawn. */
export const drawnPartPointsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
}): Promise<OpenPoint[] | { unavailable: string }> => {
  const findings = await drawnFindingsOf({ ...options, parts: [options.part] });

  return 'unavailable' in findings ? findings : partPointsOf(readOpenPoints(options.product, findings), options.part);
};

/** The parts of a product whose ready mark still holds. */
export const readyPartsOf = (product: ResolvedProduct) =>
  product.parts.map(partKeyOf).filter((part) => readyMarkOf({ product, part }) !== null);

/**
 * Marks a part ready at `hash`, or answers why not: 400 without `by` or `hash`, 404 for an unknown part, 409 when the
 * part changed since `hash`, 422 while `pointsOf` lists any open point or `actionsOf` any failed action check.
 * The failed-actions refusal names the embedded parts whose app files changed since the last ready.
 * `pointsOf` runs only after the hash holds, `actionsOf` only after the open-point list is empty.
 */
export const markPartReady = async (options: {
  product: ResolvedProduct;
  part: string;
  hash: unknown;
  by: unknown;
  pointsOf: () => Promise<OpenPoint[] | ReadyRefusal>;
  actionsOf: () => Promise<string[] | ReadyRefusal>;
  actionsNote?: string;
  at?: string;
}): Promise<PartReady | ReadyRefusal> => {
  const { product, part, hash, by } = options;

  if (typeof by !== 'string' || by.trim() === '') return { status: 400, error: 'by is required' };
  if (typeof hash !== 'string' || hash === '') return { status: 400, error: 'hash is required' };

  const found = readyPartOf({ product, part });

  if (typeof found === 'string') return { status: 404, error: found };
  if (hash !== found.hash)
    return { status: 409, error: `${part} changed since its open points were shown - reload and check it again` };

  const points = await options.pointsOf();

  if (!Array.isArray(points)) return points;
  if (points.length > 0)
    return {
      status: 422,
      error: `${part} has ${points.length} open point${points.length === 1 ? '' : 's'} - close them before ready`,
      points,
    };

  const rerun = actionsRerunOf({ product, part });
  const embedded = embeddedHashesOf({ product, part: found.resolved });
  const actions = await options.actionsOf();
  const notes = [
    ...(rerun.length > 0 ? [actionsRerunReasonOf(rerun)] : []),
    ...(options.actionsNote ? [options.actionsNote] : []),
  ];

  if (!Array.isArray(actions)) return actions;
  if (actions.length > 0)
    return {
      status: 422,
      error: `${part} fails ${actions.length} action check${actions.length === 1 ? '' : 's'} - fix them before ready${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`,
      actions,
    };

  const mark: PartReady = {
    hash,
    files: found.design.files,
    ...(Object.keys(embedded).length > 0 ? { embedded } : {}),
    by: by.trim(),
    at: options.at ?? new Date().toISOString(),
  };
  const marks = Object.entries({ ...readReady(found.dir), [part]: mark }).sort(([a], [b]) => a.localeCompare(b));

  writeFileSync(readyFileOf(found.dir), `${JSON.stringify(Object.fromEntries(marks), null, 2)}\n`);

  return mark;
};
