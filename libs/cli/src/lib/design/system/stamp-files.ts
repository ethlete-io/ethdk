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
 * file. Every process reads each cached entry while the tracked file still holds the entry it was derived from; a
 * change to that entry of the tracked file, such as `design ready` of that part or a checkout, voids it, and a change to
 * another entry does not.
 */
export const withStampsInCache = <T>(run: () => Promise<T>): Promise<T> => inCache.run(true, run);

const cachedStampFileOf = (file: string) => resolve(productCacheDirOf(dirname(file)), 'stamps', basename(file));

const trackedTextOf = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

/** The text of a stamp file as the run sees it, or `null` when there is none. */
export const readStampText = (file: string): string | null => {
  const key = resolve(file);
  const held = inMemory.getStore()?.get(key);

  return held !== undefined ? held.text : diskStampTextOf(key);
};

const entriesOf = (text: string | null): Record<string, unknown> => {
  try {
    const parsed: unknown = text === null ? {} : JSON.parse(text);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const sameEntry = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const isEntries = (text: string | null) => {
  try {
    const parsed: unknown = text === null ? {} : JSON.parse(text);

    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
};

const sortedTextOf = (entries: Record<string, unknown>) =>
  `${JSON.stringify(Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`;

const changedEntriesOn = (options: { from: string | null; to: string | null; onto: string | null }) => {
  const [from, to] = [entriesOf(options.from), entriesOf(options.to)];
  const next = entriesOf(options.onto);
  let changed = false;

  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    if (sameEntry(from[key], to[key])) continue;

    changed = true;

    if (to[key] === undefined) delete next[key];
    else next[key] = to[key];
  }

  return changed ? next : null;
};

const overlaidTextOf = (cached: CachedStamp, tracked: string | null) => {
  if (!isEntries(cached.base) || !isEntries(cached.text) || !isEntries(tracked)) return tracked;

  const [base, run, now] = [entriesOf(cached.base), entriesOf(cached.text), entriesOf(tracked)];
  const kept = [...new Set([...Object.keys(base), ...Object.keys(run)])].filter(
    (key) => !sameEntry(base[key], run[key]) && sameEntry(base[key], now[key]),
  );

  if (kept.length === 0) return tracked;

  for (const key of kept) {
    if (run[key] === undefined) delete now[key];
    else now[key] = run[key];
  }

  return sortedTextOf(now);
};

const readCachedStamp = (file: string): CachedStamp | null => {
  try {
    const cached = JSON.parse(readFileSync(cachedStampFileOf(file), 'utf8')) as CachedStamp;

    return typeof cached.text === 'string' && (cached.base === null || typeof cached.base === 'string') ? cached : null;
  } catch {
    return null;
  }
};

const diskStampTextOf = (file: string) => {
  const tracked = trackedTextOf(file);
  const cached = readCachedStamp(file);

  if (cached === null) return tracked;

  return cached.base === tracked ? cached.text : overlaidTextOf(cached, tracked);
};

const writeTrackedStamp = (file: string, value: unknown) => {
  const tracked = trackedTextOf(file);
  const seen = diskStampTextOf(file);

  if (seen === tracked || !isEntries(tracked)) {
    writeJsonFile({ file, value });

    return;
  }

  const next = changedEntriesOn({ from: seen, to: JSON.stringify(value), onto: tracked });

  if (next !== null) writeChangedFile(file, sortedTextOf(next));
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

  if (sameJson(diskStampTextOf(file), value)) return;

  if (sameJson(tracked, value)) {
    rmSync(cacheFile, { force: true });

    return;
  }

  writeChangedFile(cacheFile, JSON.stringify({ base: tracked, text: `${JSON.stringify(value, null, 2)}\n` }));
};

const withoutAt = (entry: unknown) => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;

  const { at: _at, ...rest } = entry as Record<string, unknown>;

  return rest;
};

/**
 * Writes the entries of `keys` (or every entry with `'all'`) that the current `withStampsInMemory` run changed in each
 * stamp file named `name` into the tracked file, onto the entries the tracked file holds now, so a write by another
 * process during the run stays and no cached stamp entry reaches the tracked file.
 */
export const keepHeldStampsInFiles = (name: string, keys: readonly string[] | 'all') => {
  const asked = (key: string) => keys === 'all' || keys.includes(key);

  for (const [file, held] of inMemory.getStore() ?? []) {
    if (basename(file) !== name) continue;

    const [base, run] = [entriesOf(held.base), entriesOf(held.text)];

    withProductLock(dirname(file), () => {
      const tracked = trackedTextOf(file);
      const next = entriesOf(tracked);

      for (const key of new Set([...Object.keys(base), ...Object.keys(run)])) {
        if (!asked(key) || JSON.stringify(withoutAt(base[key])) === JSON.stringify(withoutAt(run[key]))) continue;
        if (run[key] === undefined) delete next[key];
        else next[key] = run[key];
      }

      const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));

      if (!sameJson(tracked, sorted)) writeJsonFile({ file, value: sorted });
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
  else withProductLock(dirname(file), () => writeTrackedStamp(resolve(file), value));
};
