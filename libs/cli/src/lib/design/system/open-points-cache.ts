import { readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { buildReadyInputsOf } from './check-system';
import { PartOpenPoints } from './open-points';
import { BuildReadyInputs } from './part-build-ready';
import { readOpenPoints } from './read-open-points';
import { ResolvedProduct } from './resolve-product';

type Entry = { key: string; points: PartOpenPoints[]; inputs: BuildReadyInputs };

const entries = new Map<string, Entry>();

const statLineOf = (file: string) => {
  try {
    const { mtimeNs, ctimeNs, size } = statSync(file, { bigint: true });

    return `${file}\0${mtimeNs}\0${ctimeNs}\0${size}\n`;
  } catch {
    return `${file}\0missing\n`;
  }
};

const filesUnder = (dir: string): string[] => {
  try {
    return (readdirSync(dir, { recursive: true }) as string[]).map((path) => resolve(dir, path)).sort();
  } catch {
    return [];
  }
};

/**
 * A stat fingerprint of what the open points and the static rules of `product` read: its own and its base product
 * folders, the config file, the configured stylesheets and the `src` of each harness app.
 */
export const openPointsKeyOf = (product: ResolvedProduct) => {
  const checkout = resolve(product.configFile, '../../..');
  const sources = [product, ...(product.base ? [product.base] : [])];
  const dirs = sources.flatMap((source) => [
    source.dir,
    ...(source.config.harness ? [resolve(checkout, source.config.harness.app, 'src')] : []),
  ]);
  const files = [
    product.configFile,
    ...sources.flatMap((source) => (source.config.styles ?? []).map((style) => resolve(checkout, style))),
  ];

  return [...files, ...dirs.flatMap(filesUnder)].map(statLineOf).join('');
};

/**
 * The open points of every part of `product` and its build-ready inputs without a draw, reused while no file under
 * `openPointsKeyOf` changed.
 */
export const cachedOpenPointsOf = (product: ResolvedProduct): Omit<Entry, 'key'> => {
  const key = openPointsKeyOf(product);
  const held = entries.get(product.dir);

  if (held?.key === key) return held;

  const points = readOpenPoints(product);
  const entry = { key, points, inputs: buildReadyInputsOf(product, points) };

  entries.set(product.dir, entry);

  return entry;
};
