import { AsyncLocalStorage } from 'async_hooks';
import { existsSync, readFileSync, rmSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { writeChangedFile, writeJsonFile } from '../../json-file';
import { productCacheDirOf } from './product';
import { withProductLock } from './product-lock';

type HeldStamp = { base: string | null; text: string };

const inMemory = new AsyncLocalStorage<Map<string, HeldStamp>>();
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

  return held !== undefined ? held.text : diskStampTextOf(key);
};

const diskStampTextOf = (file: string) => {
  const tracked = trackedTextOf(file);

  return cachedStampOf(file, tracked)?.text ?? tracked;
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

const entriesOf = (text: string | null): Record<string, unknown> => {
  try {
    const parsed: unknown = text === null ? {} : JSON.parse(text);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/**
 * Writes the entries that the current `withStampsInMemory` run changed in each stamp file named `name` into the
 * tracked file, onto the entries the file holds now, so a write by another process during the run stays.
 */
export const keepHeldStampsInFiles = (name: string) => {
  for (const [file, held] of inMemory.getStore() ?? []) {
    if (basename(file) !== name) continue;

    const [base, run] = [entriesOf(held.base), entriesOf(held.text)];

    withProductLock(dirname(file), () => {
      const next = entriesOf(diskStampTextOf(file));

      for (const key of new Set([...Object.keys(base), ...Object.keys(run)])) {
        if (JSON.stringify(base[key]) === JSON.stringify(run[key])) continue;
        if (run[key] === undefined) delete next[key];
        else next[key] = run[key];
      }

      const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));

      if (!sameJson(trackedTextOf(file), sorted)) writeJsonFile({ file, value: sorted });
    });
  }
};

/**
 * Writes `value` as a stamp file, or keeps it in memory inside `withStampsInMemory`, or in the cache inside
 * `withStampsInCache`.
 */
export const writeStampFile = (file: string, value: unknown) => {
  const held = inMemory.getStore();

  if (held) {
    const key = resolve(file);
    const base = held.has(key) ? (held.get(key)?.base ?? null) : diskStampTextOf(key);

    held.set(key, { base, text: JSON.stringify(value) });
  } else if (inCache.getStore()) withProductLock(dirname(file), () => writeCachedStamp(resolve(file), value));
  else withProductLock(dirname(file), () => writeJsonFile({ file, value }));
};
