import { createHash } from 'crypto';
import { readFileSync, utimesSync } from 'fs';
import { join } from 'path';
import { writeCacheEntry } from '../cache-entry';
import { cacheKeyOf, evictOldestPast } from './compare-cache';
import { comparePngs, PixelCompare } from './part-compare';

export const COMPARE_PIXELS = 'compare-pixels';

const PIXEL_LIMIT = 64 * 1024 * 1024;

const sha256Of = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

const resultOf = (stored: unknown, diff: unknown): PixelCompare | null => {
  if (typeof stored !== 'object' || stored === null) return null;

  const result = stored as Partial<{ kind: string; pixels: number; design: unknown; app: unknown }>;

  if (result.kind === 'ok') return { kind: 'ok' };
  if (typeof diff !== 'string') return null;
  if (result.kind === 'diff' && typeof result.pixels === 'number')
    return { kind: 'diff', pixels: result.pixels, diff: Buffer.from(diff, 'base64') };
  if (result.kind === 'size')
    return {
      kind: 'size',
      design: result.design as { width: number; height: number },
      app: result.app as { width: number; height: number },
      diff: Buffer.from(diff, 'base64'),
    };

  return null;
};

const readEntry = (path: string, key: string) => {
  try {
    const entry = JSON.parse(readFileSync(path, 'utf8')) as { key?: unknown; result?: unknown; diff?: unknown };
    const result = entry.key === key ? resultOf(entry.result, entry.diff) : null;

    if (result) {
      const now = new Date();

      utimesSync(path, now, now);
    }

    return result;
  } catch {
    return null;
  }
};

/**
 * @internal `comparePngs` of a design and an app picture, kept in a disk cache under `dir` by both pictures and `salt`
 * (the pixel-compare code). `hit` says the result came from the cache. Reading and writing the cache never throw.
 */
export const cachedComparePngs = (options: {
  dir: string;
  salt: string;
  design: Buffer;
  app: Buffer;
  limit?: number;
}): { result: PixelCompare; hit: boolean } => {
  const { dir, design, app } = options;
  const key = cacheKeyOf([options.salt, sha256Of(design), sha256Of(app)]);
  const name = `${key}.json`;

  const cached = readEntry(join(dir, name), key);

  if (cached) return { result: cached, hit: true };

  const result = comparePngs({ design, app });
  const { diff, ...stored } = result.kind === 'ok' ? { ...result, diff: null } : result;

  if (
    writeCacheEntry(dir, {
      name,
      text: JSON.stringify({ key, result: stored, diff: diff?.toString('base64') ?? null }),
    })
  )
    evictOldestPast(dir, options.limit ?? PIXEL_LIMIT);

  return { result, hit: false };
};
