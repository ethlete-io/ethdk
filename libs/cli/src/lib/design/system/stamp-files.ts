import { AsyncLocalStorage } from 'async_hooks';
import { existsSync, readFileSync, rmSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { writeChangedFile, writeJsonFile } from '../../json-file';
import { productCacheDirOf } from './product';
import { withProductLock } from './product-lock';

const inMemory = new AsyncLocalStorage<Map<string, string>>();
const inCache = new AsyncLocalStorage<true>();

type CachedStamp = { base: string | null; text: string };

/**
 * Runs `run` with every write to a stamp file (`merged.json`, `ready.json`) kept in memory: reads in the run see the
 * writes, the files on disk stay as they are.
 */
export const withStampsInMemory = <T>(run: () => Promise<T>): Promise<T> =>
  inMemory.run(inMemory.getStore() ?? new Map(), run);

/**
 * Runs `run` with every write to a stamp file kept in the product's gitignored cache folder instead of the tracked
 * file. Every process reads the cached text while the tracked file still holds the text it was derived from; a change
 * to the tracked file, such as `design ready` or a checkout, voids it.
 */
export const withStampsInCache = <T>(run: () => Promise<T>): Promise<T> => inCache.run(true, run);

const cachedStampFileOf = (file: string) => resolve(productCacheDirOf(dirname(file)), 'stamps', basename(file));

const trackedTextOf = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

const cachedStampOf = (file: string, tracked: string | null): CachedStamp | null => {
  try {
    const cached = JSON.parse(readFileSync(cachedStampFileOf(file), 'utf8')) as CachedStamp;

    return cached.base === tracked && typeof cached.text === 'string' ? cached : null;
  } catch {
    return null;
  }
};

/** The text of a stamp file as the run sees it, or `null` when there is none. */
export const readStampText = (file: string): string | null => {
  const key = resolve(file);
  const held = inMemory.getStore()?.get(key);

  if (held !== undefined) return held;

  const tracked = trackedTextOf(key);

  return cachedStampOf(key, tracked)?.text ?? tracked;
};

const sameJson = (text: string | null, value: unknown) => {
  try {
    return text !== null && JSON.stringify(JSON.parse(text)) === JSON.stringify(value);
  } catch {
    return false;
  }
};

const writeCachedStamp = (file: string, value: unknown) => {
  const tracked = trackedTextOf(file);
  const cacheFile = cachedStampFileOf(file);

  if (sameJson(cachedStampOf(file, tracked)?.text ?? tracked, value)) return;

  if (sameJson(tracked, value)) {
    rmSync(cacheFile, { force: true });

    return;
  }

  writeChangedFile(cacheFile, JSON.stringify({ base: tracked, text: `${JSON.stringify(value, null, 2)}\n` }));
};

/** Moves each stamp file named `name` that the current `withStampsInMemory` run holds into the cache. */
export const keepHeldStampsInCache = (name: string) => {
  for (const [file, text] of inMemory.getStore() ?? [])
    if (basename(file) === name) withProductLock(dirname(file), () => writeCachedStamp(file, JSON.parse(text)));
};

/**
 * Writes `value` as a stamp file, or keeps it in memory inside `withStampsInMemory`, or in the cache inside
 * `withStampsInCache`.
 */
export const writeStampFile = (file: string, value: unknown) => {
  const held = inMemory.getStore();

  if (held) held.set(resolve(file), JSON.stringify(value));
  else if (inCache.getStore()) withProductLock(dirname(file), () => writeCachedStamp(resolve(file), value));
  else withProductLock(dirname(file), () => writeJsonFile({ file, value }));
};
