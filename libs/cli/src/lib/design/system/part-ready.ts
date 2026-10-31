import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { DesignConfig } from '../paths';
import { drawnFindingsOf } from './drawn-open-points';
import { partOwnerOf } from './inventory-approval';
import { OpenPoint } from './open-points';
import { partPointsOf, readOpenPoints } from './read-open-points';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';

export const READY_FILE = 'ready.json';

/** Who marked a part ready, and at which part hash; the mark holds only while the hash does. */
export type PartReady = { hash: string; by: string; at: string };

export type ReadyRefusal = { status: number; error: string; points?: OpenPoint[] };

const readyFileOf = (dir: string) => resolve(dir, READY_FILE);

const isReady = (value: unknown): value is PartReady => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { hash, by, at } = value as Record<string, unknown>;

  return typeof hash === 'string' && typeof by === 'string' && typeof at === 'string';
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

/** The part hash of a part and the directory whose ready.json holds it, or why the product has no such part. */
export const readyPartOf = (options: { product: ResolvedProduct; part: string }) => {
  const resolved = options.product.parts.find((candidate) => partKeyOf(candidate) === options.part);

  if (!resolved) return `product "${options.product.name}" has no part "${options.part}"`;

  const owner = partOwnerOf({ product: options.product, part: resolved });

  return { dir: owner.dir, hash: partHashOf({ product: owner, dir: dirname(resolved.file) }) };
};

/** The ready mark of a part while its hash still matches, `null` when it has none or the part changed since. */
export const readyMarkOf = (options: { product: ResolvedProduct; part: string }): PartReady | null => {
  const found = readyPartOf(options);

  if (typeof found === 'string') return null;

  const mark = readReady(found.dir)[options.part];

  return mark?.hash === found.hash ? mark : null;
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
 * part changed since `hash`, 422 while `pointsOf` lists any open point. `pointsOf` runs only after the hash holds.
 */
export const markPartReady = async (options: {
  product: ResolvedProduct;
  part: string;
  hash: unknown;
  by: unknown;
  pointsOf: () => Promise<OpenPoint[] | ReadyRefusal>;
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

  const mark: PartReady = { hash, by: by.trim(), at: options.at ?? new Date().toISOString() };
  const marks = Object.entries({ ...readReady(found.dir), [part]: mark }).sort(([a], [b]) => a.localeCompare(b));

  writeFileSync(readyFileOf(found.dir), `${JSON.stringify(Object.fromEntries(marks), null, 2)}\n`);

  return mark;
};
