import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { partOwnerOf } from './inventory-approval';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';

export const GO_FILE = 'go.json';

/** Who released a part for implementation, and at which part hash; the go holds only while the hash does. */
export type PartGo = { hash: string; by: string; at: string };

export type GoRefusal = { status: number; error: string };

export type GoState = 'current' | 'missing' | 'stale';

const goFileOf = (dir: string) => resolve(dir, GO_FILE);

const isGo = (value: unknown): value is PartGo => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { hash, by, at } = value as Record<string, unknown>;

  return typeof hash === 'string' && typeof by === 'string' && typeof at === 'string';
};

export const readGo = (dir: string): Record<string, PartGo> => {
  const file = goFileOf(dir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, PartGo] => isGo(entry[1])))
      : {};
  } catch {
    return {};
  }
};

/** The part hash of a part and the directory whose go.json holds it, or why the product has no such part. */
export const goPartOf = (options: { product: ResolvedProduct; part: string }) => {
  const resolved = options.product.parts.find((candidate) => partKeyOf(candidate) === options.part);

  if (!resolved) return `product "${options.product.name}" has no part "${options.part}"`;

  const owner = partOwnerOf({ product: options.product, part: resolved });

  return { dir: owner.dir, hash: partHashOf({ product: owner, dir: dirname(resolved.file) }) };
};

/** Whether a part has a go that still matches its hash, no go, or a go from before the part changed. */
export const goStateOf = (options: { product: ResolvedProduct; part: string }): GoState => {
  const found = goPartOf(options);

  if (typeof found === 'string') return 'missing';

  const go = readGo(found.dir)[options.part];

  return !go ? 'missing' : go.hash === found.hash ? 'current' : 'stale';
};

/** The go of a part while its hash still matches, `null` when it has none or the part changed since. */
export const goMarkOf = (options: { product: ResolvedProduct; part: string }): PartGo | null => {
  const found = goPartOf(options);

  if (typeof found === 'string') return null;

  const go = readGo(found.dir)[options.part];

  return go?.hash === found.hash ? go : null;
};

/** The parts of a product whose go still holds. */
export const goPartsOf = (product: ResolvedProduct) =>
  product.parts.map(partKeyOf).filter((part) => goMarkOf({ product, part }) !== null);

/**
 * Stores a go for a part at its current hash, or answers why not: 400 without `by`, 404 for an unknown part. A given
 * `hash` must match the part, else 409. A go needs no empty open-point list.
 */
export const markPartGo = (options: {
  product: ResolvedProduct;
  part: string;
  by: unknown;
  hash?: unknown;
  at?: string;
}): PartGo | GoRefusal => {
  const { product, part, by } = options;

  if (typeof by !== 'string' || by.trim() === '') return { status: 400, error: 'by is required' };

  const found = goPartOf({ product, part });

  if (typeof found === 'string') return { status: 404, error: found };
  if (options.hash !== undefined && options.hash !== found.hash)
    return { status: 409, error: `${part} changed since it was shown - reload and check it again` };

  const go: PartGo = { hash: found.hash, by: by.trim(), at: options.at ?? new Date().toISOString() };
  const entries = Object.entries({ ...readGo(found.dir), [part]: go }).sort(([a], [b]) => a.localeCompare(b));

  writeFileSync(goFileOf(found.dir), `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`);

  return go;
};
