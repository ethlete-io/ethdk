import { createHash, randomBytes } from 'crypto';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blankPngOf } from './blank-png';
import { createShotStore } from './shot-store';

const reads = vi.hoisted(() => ({
  bytes: new Map<string, number>(),
  stats: new Map<string, number>(),
  fds: new Map(),
}));

vi.mock('fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('fs')>();
  const add = (counts: Map<string, number>, path: unknown, by: number) =>
    counts.set(String(path), (counts.get(String(path)) ?? 0) + by);

  return {
    ...fs,
    openSync: (...args: Parameters<typeof fs.openSync>) => {
      const fd = fs.openSync(...args);

      reads.fds.set(fd, String(args[0]));

      return fd;
    },
    readSync: (...args: Parameters<typeof fs.readSync>) => {
      const got = fs.readSync(...args);

      add(reads.bytes, reads.fds.get(args[0]), got);

      return got;
    },
    readFileSync: (...args: Parameters<typeof fs.readFileSync>) => {
      const read = fs.readFileSync(...args);

      add(reads.bytes, args[0], read.length);

      return read;
    },
    statSync: (...args: Parameters<typeof fs.statSync>) => {
      add(reads.stats, args[0], 1);

      return fs.statSync(...args);
    },
  };
});

const address = { product: 'acme', part: 'components/card', sketch: null, props: null };

const entryFilesIn = (dir: string) =>
  (readdirSync(dir, { recursive: true }) as string[]).filter((name) => /\.(shot|json)$/.test(name));

const bytesReadIn = (dir: string) =>
  [...reads.bytes].filter(([path]) => path.startsWith(dir)).reduce((sum, [, bytes]) => sum + bytes, 0);

beforeEach(() => {
  reads.bytes.clear();
  reads.stats.clear();
});

describe('the shot store hit check', () => {
  it('reads no picture bytes of an entry a newer picture code misses', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-shot-store-reads-'));
    const store = join(dir, 'store');
    const input = join(dir, 'input.ts');
    const storeOf = (code: string) =>
      createShotStore({ dir: store, salt: 's', code, checkout: dir, inputsOf: () => [input], scopeOf: () => '' });

    writeFileSync(input, 'one');
    storeOf('older').write('key', { address, picture: { png: randomBytes(1024 * 1024), marks: [] } });
    reads.bytes.clear();

    expect(storeOf('newer').read('key', address)).toBeNull();
    expect(bytesReadIn(store)).toBeLessThan(4 * 1024);
  });

  it('answers the size of an older picture code without reading its picture, which loads on first use', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-shot-store-reads-'));
    const store = join(dir, 'store');
    const input = join(dir, 'input.ts');
    const storeOf = (code: string) =>
      createShotStore({ dir: store, salt: 's', code, checkout: dir, inputsOf: () => [input], scopeOf: () => '' });
    const png = Buffer.concat([blankPngOf(320, 120), randomBytes(1024 * 1024)]);

    writeFileSync(input, 'one');
    storeOf('older').write('key', { address, picture: { png, marks: [] } });
    reads.bytes.clear();

    const sized = storeOf('newer').readAnyCode('key', address);

    expect(sized?.size).toEqual({ width: 320, height: 120 });
    expect(bytesReadIn(store)).toBeLessThan(4 * 1024);
    expect(sized?.png).toEqual(png);
  });

  it('stats each read file once while one turn checks many entries drawn from it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-shot-store-reads-'));
    const inputs = Array.from({ length: 30 }, (_, index) => join(dir, `input-${index}.ts`));
    const keys = Array.from({ length: 20 }, (_, index) => `key-${index}`);
    const picture = { png: Buffer.from('png'), marks: [] };
    const storeOf = () =>
      createShotStore({ dir: join(dir, 'store'), salt: 's', checkout: dir, inputsOf: () => inputs, scopeOf: () => '' });

    for (const input of inputs) writeFileSync(input, input);
    for (const key of keys) storeOf().write(key, { address, picture });
    reads.stats.clear();

    const reader = storeOf();

    expect(keys.map((key) => reader.read(key, address))).toEqual(keys.map(() => picture));
    expect(Math.max(...inputs.map((input) => reads.stats.get(input) ?? 0))).toBe(1);
  });

  it('serves an entry an older store wrote as JSON, and rewrites every JSON entry it read in the current format', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-shot-store-reads-'));
    const store = join(dir, 'store');
    const input = join(dir, 'input.ts');
    const picture = { png: Buffer.from('legacy png'), marks: [] };
    const keyDir = join(store, createHash('sha1').update('s').update('\n').update('key').digest('hex'));
    const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');

    const legacy = (code: string) =>
      JSON.stringify({
        key: 'key',
        code,
        scope: '',
        inputs: [['input.ts', sha1('one')]],
        png: picture.png.toString('base64'),
        marks: [],
      });

    writeFileSync(input, 'one');
    mkdirSync(keyDir, { recursive: true });
    writeFileSync(join(keyDir, 'variant.json'), legacy(''));
    writeFileSync(join(keyDir, 'older.json'), legacy('older'));

    const storeOf = () =>
      createShotStore({ dir: store, salt: 's', checkout: dir, inputsOf: () => [input], scopeOf: () => '' });

    expect(storeOf().read('key', address)).toEqual(picture);
    expect(
      entryFilesIn(store)
        .map((name) => name.split('/').pop())
        .sort(),
    ).toEqual(['older.shot', 'variant.shot']);
    expect(storeOf().read('key', address)).toEqual(picture);
  });
});
