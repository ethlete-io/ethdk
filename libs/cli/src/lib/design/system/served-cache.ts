import { createHash } from 'crypto';
import { readFileSync, utimesSync } from 'fs';
import { join } from 'path';
import { writeCacheEntry } from '../cache-entry';
import { evictOldestPast } from './compare-cache';
import { QUIET_HEADER, RENDER_PATH, SERVED_LINES_HEADER } from '../render';
import { recordNullHashes } from '../timings';

/** A request a drawing made: url, `accept` header and, for a POST, its body. */
export type ServedRequest = { url: string; accept: string | null; post?: string | null };

/** One response a drawing loaded, by url relative to the server, with a hash of status and body. */
export type ServedInput = ServedRequest & { hash: string | null };

/** What the server answered: status and body, and the lines it logged while answering. */
export type Served = { body: Buffer; lines: string[] };

export type FetchServed = (request: ServedRequest) => Promise<Served | null>;

const FETCH_TIMEOUT_MS = 30_000;

const ENTRY_SUFFIX = '.json';

export const REGISTRY_SLICE_PATH = '/__design/registry-slice';

const REGISTRY_PATHS = new Set(['/@id/__x00__virtual:design-explore/env', '/@id/__x00__virtual:design-explore/system']);

const FRAME_PATH = '/frame.html';

const COUNTED_ID = /\bid=\\?"(et-[a-z-]+-\d+)\\?"/g;

/**
 * `text` with each SDK id that ends in a counter (`et-label-30`) renamed by its order of first appearance: the render
 * worker keeps the SDK loaded, so its counters grow with every render of the same template.
 */
export const withStableIds = (text: string) => {
  const ids = [...new Set([...text.matchAll(COUNTED_ID)].map(([, id]) => id))];
  const order = new Map(ids.map((id, index) => [id, `et-id-${index}`]));

  return order.size === 0 ? text : text.replace(/\bet-[a-z-]+-\d+\b/g, (id) => order.get(id) ?? id);
};

const pathOf = (url: string) => new URL(url, 'http://registry.invalid').pathname;

const INLINE_SOURCE_MAP = /\n\/\/# sourceMappingURL=data:[^\n]*/g;

const VITE_CLIENT_PATH = '/@vite/client';

const VITE_WS_TOKEN = /\bconst wsToken = "[^"]*"/;

/**
 * `text` without what a server start alone changes: inline source maps, which embed host and token, and the
 * `/@vite/client` websocket token, which Vite draws at random per server start.
 */
export const withoutStartNoise = (url: string, text: string) => {
  const mapless = text.replace(INLINE_SOURCE_MAP, '');

  return pathOf(url) === VITE_CLIENT_PATH ? mapless.replace(VITE_WS_TOKEN, 'const wsToken = ""') : mapless;
};

const isRender = (url: string) => pathOf(url) === RENDER_PATH;

const SLICE_PARAMS = ['product', 'call', 'sketch', 'variant', 'props', 'props-variant'];

/**
 * `requested` with the env and system registries, which list every part of every sketch, replaced by the slice of them
 * each requested frame can read, so a change to another part's entries leaves the key alone. Kept when no frame was
 * requested.
 */
export const withRegistrySlices = (requested: readonly ServedRequest[]): ServedRequest[] => {
  const urlOf = (request: ServedRequest) => new URL(request.url, 'http://registry.invalid');
  const frames = requested.filter((request) => urlOf(request).pathname === FRAME_PATH);

  if (frames.length === 0 || !requested.some((request) => REGISTRY_PATHS.has(urlOf(request).pathname)))
    return [...requested];

  const slices = frames.map((frame) => {
    const asked = urlOf(frame).searchParams;
    const query = new URLSearchParams(
      SLICE_PARAMS.flatMap((name) => (asked.has(name) ? [[name, asked.get(name) ?? '']] : [])),
    );
    const path = `${REGISTRY_SLICE_PATH}?${query}`;

    return { url: frame.url.startsWith('/') ? path : new URL(path, frame.url).href, accept: null };
  });

  return [...requested.filter((request) => !REGISTRY_PATHS.has(urlOf(request).pathname)), ...slices];
};

/**
 * The base Node reaches a listening server at: its own address, as Node's fetch tries IPv4 first for `localhost` while
 * a server on `localhost` may listen on `::1` only.
 */
export const reachableBaseOf = ({ address, family, port }: { address: string; family: string; port: number }) => {
  const any = address === '::' || address === '0.0.0.0';

  if (family === 'IPv6') return `http://[${any ? '::1' : address}]:${port}`;

  return `http://${any ? '127.0.0.1' : address}:${port}`;
};

/** Fetches `url` from the server at `base` as Node sees it; null when it cannot be reached in time. */
export const fetchServedOf =
  (base: string): FetchServed =>
  async ({ url, accept, post }) => {
    try {
      const response = await fetch(new URL(url, base), {
        headers: { ...(accept ? { accept } : {}), ...(typeof post === 'string' ? { [QUIET_HEADER]: '1' } : {}) },
        ...(typeof post === 'string' ? { method: 'POST', body: post } : {}),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = Buffer.concat([Buffer.from(`${response.status}\0`), Buffer.from(await response.arrayBuffer())]);

      return { body, lines: servedLinesOf(response.headers.get(SERVED_LINES_HEADER)) };
    } catch {
      return null;
    }
  };

const servedLinesOf = (header: string | null): string[] => {
  try {
    const lines: unknown = header ? JSON.parse(decodeURIComponent(header)) : [];

    return Array.isArray(lines) ? lines.filter((line): line is string => typeof line === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * The hashes of what the server at `base` answers now, each url fetched at most once per instance. The server's own
 * host is left out of urls and bodies, so a server on another port answers the same.
 */
export const createServedHashes = (base: string, fetchServed: FetchServed = fetchServedOf(base)) => {
  const ownHost = new RegExp(`(?:localhost|127\\.0\\.0\\.1|\\[::1\\]):${new URL(base).port}`, 'g');
  const held = new Map<string, Promise<{ hash: string | null; lines: string[] }>>();
  const relativeOf = ({ url, accept, post }: ServedRequest): ServedRequest => ({
    url: url.startsWith(base) ? url.slice(base.length) || '/' : url,
    accept,
    ...(typeof post === 'string' ? { post } : {}),
  });
  const atOf = ({ url, accept, post }: ServedRequest) => `${accept ?? ''}\0${url}\0${post ?? ''}`;
  const servedOf = (request: ServedRequest) => {
    const at = atOf(request);
    const known = held.get(at);

    if (known) return known;

    const hashed = fetchServed(request).then((served) => {
      if (!served) recordNullHashes(1);

      const text = served ? withoutStartNoise(request.url, served.body.toString('latin1').replace(ownHost, '')) : null;

      return {
        hash:
          text === null
            ? null
            : createHash('sha256')
                .update(isRender(request.url) ? withStableIds(text) : text)
                .digest('hex'),
        lines: served?.lines ?? [],
      };
    });

    held.set(at, hashed);

    return hashed;
  };

  return {
    inputsOf: async (requested: readonly ServedRequest[]): Promise<ServedInput[]> => {
      const unique = new Map(requested.map((request) => [atOf(relativeOf(request)), relativeOf(request)]));
      const sorted = [...unique].sort(([a], [b]) => a.localeCompare(b)).map(([, request]) => request);

      return Promise.all(sorted.map(async (request) => ({ ...request, hash: (await servedOf(request)).hash })));
    },
    linesOf: async (requested: readonly ServedRequest[]) =>
      (await Promise.all(requested.map(async (request) => (await servedOf(relativeOf(request))).lines))).flat(),
    unchanged: async (inputs: readonly ServedInput[]) =>
      (
        await Promise.all(
          inputs.map(async (input) => input.hash !== null && (await servedOf(input)).hash === input.hash),
        )
      ).every(Boolean),
  };
};

export type ServedHashes = ReturnType<typeof createServedHashes>;

/** A result on disk with the responses its drawing loaded and the lines the server logged meanwhile, reused while every response answers the same. */
export type ServedEntry<T> = { inputs: ServedInput[]; value: T; lines?: string[] };

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

      return { inputs: entry.inputs, value: entry.value, lines: Array.isArray(entry.lines) ? entry.lines : [] };
    } catch {
      return null;
    }
  },
  write: (key, entry) => {
    if (writeCacheEntry(dir, { name: `${key}${ENTRY_SUFFIX}`, text: JSON.stringify({ key, ...entry }) }))
      evictOldestPast(dir, limit);
  },
});

/**
 * A served cache read and written within one run: entries are checked against `served`, keys salted with `salt`, the
 * lines of a hit printed again with `print`.
 */
export type ServedCacheRun<T> = {
  store: ServedCache<T>;
  served: ServedHashes;
  salt: string;
  print?: (line: string) => void;
};

/**
 * The cached value under `key` when every response its drawing loaded still answers the same, else null. A hit prints
 * the lines the server logged while the value was drawn, as the drawing did.
 */
export const servedHitOf = async <T>(run: ServedCacheRun<T>, key: string): Promise<T | null> => {
  const held = run.store.read(key);

  if (!held || !(await run.served.unchanged(held.inputs))) return null;

  for (const line of held.lines ?? []) (run.print ?? console.warn)(line);

  return held.value;
};

/**
 * Writes what a drawing found under `key`, with every response it loaded and every line the server logged for it.
 * Writes nothing and returns false when a response could not be fetched, as its null hash would verify nothing.
 */
export const writeServed = async <T>(
  run: ServedCacheRun<T>,
  entry: { key: string; requested: ServedRequest[]; value: T },
) => {
  const { key, value } = entry;
  const requested = withRegistrySlices(entry.requested);
  const inputs = await run.served.inputsOf(requested);

  if (inputs.some((input) => input.hash === null)) return false;

  run.store.write(key, { inputs, lines: await run.served.linesOf(requested), value });

  return true;
};

/** Records every request `context` makes into `into`, a POST with its body. */
export const recordRequests = (
  context: {
    on(
      event: 'request',
      listener: (request: {
        url(): string;
        method(): string;
        postData(): string | null;
        headers(): Record<string, string>;
      }) => void,
    ): unknown;
  },
  into: () => ServedRequest[],
) =>
  context.on('request', (request) =>
    into().push({
      url: request.url(),
      accept: request.headers()['accept'] ?? null,
      ...(request.method() === 'POST' ? { post: request.postData() ?? '' } : {}),
    }),
  );
