import { createHash } from 'crypto';
import { readFileSync, utimesSync } from 'fs';
import { join } from 'path';
import { writeCacheEntry } from '../cache-entry';
import { evictOldestPast } from './compare-cache';

/** One response a drawing loaded, by url relative to the server, the `accept` header it was asked with, and a hash of status and body. */
export type ServedInput = { url: string; accept: string | null; hash: string | null };

export type ServedRequest = { url: string; accept: string | null };

export type FetchServed = (url: string, accept: string | null) => Promise<Buffer | null>;

const FETCH_TIMEOUT_MS = 30_000;

const ENTRY_SUFFIX = '.json';

/** Fetches `url` from the server at `base` as Node sees it; null when it cannot be reached in time. */
export const fetchServedOf =
  (base: string): FetchServed =>
  async (url, accept) => {
    try {
      const response = await fetch(new URL(url, base), {
        headers: accept ? { accept } : {},
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      return Buffer.concat([Buffer.from(`${response.status}\0`), Buffer.from(await response.arrayBuffer())]);
    } catch {
      return null;
    }
  };

/**
 * The hashes of what the server at `base` answers now, each url fetched at most once per instance. The server's own
 * host is left out of urls and bodies, so a server on another port answers the same.
 */
export const createServedHashes = (base: string, fetchServed: FetchServed = fetchServedOf(base)) => {
  const host = new URL(base).host;
  const held = new Map<string, Promise<string | null>>();
  const relativeOf = (url: string) => (url.startsWith(base) ? url.slice(base.length) || '/' : url);
  const hashOf = ({ url, accept }: ServedRequest) => {
    const at = `${accept ?? ''}\0${url}`;
    const known = held.get(at);

    if (known) return known;

    const hashed = fetchServed(url, accept).then((body) =>
      body ? createHash('sha256').update(body.toString('latin1').split(host).join('')).digest('hex') : null,
    );

    held.set(at, hashed);

    return hashed;
  };

  return {
    inputsOf: async (requested: readonly ServedRequest[]): Promise<ServedInput[]> => {
      const unique = new Map(
        requested.map(({ url, accept }) => [`${accept ?? ''}\0${relativeOf(url)}`, { url: relativeOf(url), accept }]),
      );
      const sorted = [...unique].sort(([a], [b]) => a.localeCompare(b)).map(([, request]) => request);

      return Promise.all(sorted.map(async (request) => ({ ...request, hash: await hashOf(request) })));
    },
    unchanged: async (inputs: readonly ServedInput[]) =>
      (await Promise.all(inputs.map(async (input) => (await hashOf(input)) === input.hash))).every(Boolean),
  };
};

export type ServedHashes = ReturnType<typeof createServedHashes>;

/** A result on disk with the responses its drawing loaded, reused while every one of them answers the same. */
export type ServedEntry<T> = { inputs: ServedInput[]; value: T };

export type ServedCache<T> = {
  read: (key: string) => ServedEntry<T> | null;
  write: (key: string, entry: ServedEntry<T>) => void;
};

/** A disk cache of drawn results under `dir`; the least recently used entries go past `limit` bytes. Reading and writing never throw. */
export const createServedCache = <T>(dir: string, limit: number): ServedCache<T> => ({
  read: (key) => {
    const path = join(dir, `${key}${ENTRY_SUFFIX}`);

    try {
      const entry = JSON.parse(readFileSync(path, 'utf8')) as { key?: unknown } & Partial<ServedEntry<T>>;

      if (entry.key !== key || !Array.isArray(entry.inputs) || entry.value === undefined) return null;

      const now = new Date();

      utimesSync(path, now, now);

      return { inputs: entry.inputs, value: entry.value };
    } catch {
      return null;
    }
  },
  write: (key, entry) => {
    if (writeCacheEntry(dir, { name: `${key}${ENTRY_SUFFIX}`, text: JSON.stringify({ key, ...entry }) }))
      evictOldestPast(dir, limit);
  },
});

/** A served cache read and written within one run: entries are checked against `served`, keys salted with `salt`. */
export type ServedCacheRun<T> = { store: ServedCache<T>; served: ServedHashes; salt: string };

/** The cached value under `key` when every response its drawing loaded still answers the same, else null. */
export const servedHitOf = async <T>(run: ServedCacheRun<T>, key: string): Promise<T | null> => {
  const held = run.store.read(key);

  return held && (await run.served.unchanged(held.inputs)) ? held.value : null;
};
