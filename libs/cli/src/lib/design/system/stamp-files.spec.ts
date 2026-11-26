import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { keepHeldStamps, readStampText, withStampsInCache, withStampsInMemory, writeStampFile } from './stamp-files';

const dirs: string[] = [];

const readyFile = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-stamp-files-'));

  dirs.push(dir);

  const file = join(dir, 'ready.json');

  writeFileSync(file, '{"a":1}\n');

  return file;
};

const gate = () => {
  let open = () => undefined as void;
  const opened = new Promise<void>((resolve) => (open = resolve));

  return { open, opened };
};

const productReadyFile = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-stamp-cache-'));

  dirs.push(root);

  const dir = join(root, '.ethlete/design/acme');

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ready.json'), '{"a":1}\n');

  return { root, file: join(dir, 'ready.json') };
};

afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('withStampsInMemory', () => {
  it('keeps the writes of the run in memory and the file unchanged', async () => {
    const file = readyFile();

    const seen = await withStampsInMemory(async () => {
      writeStampFile(file, { b: 2 });

      return readStampText(file);
    });

    expect(JSON.parse(seen ?? '')).toEqual({ b: 2 });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ a: 1 });
  });

  it('leaves the reads and writes of the design server in the same process on disk while a check runs', async () => {
    const file = readyFile();
    const checking = gate();
    const recorded = gate();

    const check = withStampsInMemory(async () => {
      writeStampFile(file, { check: true });
      checking.open();
      await recorded.opened;

      return readStampText(file);
    });

    await checking.opened;

    const serverSaw = readStampText(file);

    writeStampFile(file, { server: true });
    recorded.open();

    expect(JSON.parse(serverSaw ?? '')).toEqual({ a: 1 });
    expect(JSON.parse((await check) ?? '')).toEqual({ check: true });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ server: true });
  });

  it('keeps the writes of a run that ends after an earlier one in memory', async () => {
    const file = readyFile();
    const firstStarted = gate();
    const firstEnded = gate();

    const first = withStampsInMemory(async () => {
      firstStarted.open();
    }).then(() => firstEnded.open());
    const second = withStampsInMemory(async () => {
      await firstStarted.opened;
      await firstEnded.opened;
      writeStampFile(file, { second: true });
    });

    await Promise.all([first, second]);

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ a: 1 });
  });
});

describe('keepHeldStamps', () => {
  it('writes a dropped mark into the tracked file, a changed one only into the cache, and keeps a write made during the run', async () => {
    const { file } = productReadyFile();

    writeFileSync(file, '{"a":{"hash":"1"},"b":{"hash":"1"}}\n');

    await withStampsInMemory(async () => {
      writeStampFile(file, { a: { hash: '2' } });
      writeFileSync(file, '{"a":{"hash":"1"},"b":{"hash":"1"},"c":{"hash":"3"}}\n');
      keepHeldStamps('ready.json', 'all');
    });

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ a: { hash: '1' }, c: { hash: '3' } });
    expect(JSON.parse(readStampText(file) ?? '')).toEqual({ a: { hash: '2' }, c: { hash: '3' } });
  });

  it('writes a mark stripped of its hash into the tracked file', async () => {
    const { file } = productReadyFile();

    writeFileSync(file, '{"a":{"hash":"1","actions":[]}}\n');

    await withStampsInMemory(async () => {
      writeStampFile(file, { a: { actions: [] } });
      keepHeldStamps('ready.json', 'all');
    });

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ a: { actions: [] } });
  });

  it('never writes a new entry into the tracked file', async () => {
    const { file } = productReadyFile();

    await withStampsInMemory(async () => {
      writeStampFile(file, { a: 1, b: 2 });
      keepHeldStamps('ready.json', 'all');
    });

    expect(readFileSync(file, 'utf8')).toBe('{"a":1}\n');
    expect(JSON.parse(readStampText(file) ?? '')).toEqual({ a: 1, b: 2 });
  });

  it('drops an entry that only the cache held from the cache and leaves the tracked file alone', async () => {
    const { file } = productReadyFile();

    await withStampsInCache(async () => writeStampFile(file, { a: 1, b: { hash: '2' } }));
    await withStampsInMemory(async () => {
      writeStampFile(file, { a: 1 });
      keepHeldStamps('ready.json', 'all');
    });

    expect(readFileSync(file, 'utf8')).toBe('{"a":1}\n');
    expect(JSON.parse(readStampText(file) ?? '')).toEqual({ a: 1 });
  });

  it('keeps only the entries of the asked keys', async () => {
    const { file } = productReadyFile();

    await withStampsInMemory(async () => {
      writeStampFile(file, { a: 2, b: 2 });
      keepHeldStamps('ready.json', ['b']);
    });

    expect(readFileSync(file, 'utf8')).toBe('{"a":1}\n');
    expect(JSON.parse(readStampText(file) ?? '')).toEqual({ a: 1, b: 2 });
  });

  it('writes no cache entry when the run changed only the `at` of an entry', async () => {
    const { root, file } = productReadyFile();
    const tracked = '{"a":{"actions":[],"at":"2026-11-14T17:21:52.883Z"}}\n';

    writeFileSync(file, tracked);

    await withStampsInMemory(async () => {
      writeStampFile(file, { a: { actions: [], at: '2026-11-18T08:45:28.168Z' } });
      keepHeldStamps('ready.json', 'all');
    });

    expect(readFileSync(file, 'utf8')).toBe(tracked);
    expect(existsSync(join(root, '.ethlete/cache/acme/stamps/ready.json'))).toBe(false);
  });
});

describe('withStampsInCache', () => {
  it('keeps a write in the gitignored cache, which every later read sees until the tracked file changes', async () => {
    const { root, file } = productReadyFile();

    await withStampsInCache(async () => writeStampFile(file, { a: 2 }));

    expect(readFileSync(file, 'utf8')).toBe('{"a":1}\n');
    expect(existsSync(join(root, '.ethlete/cache/acme/stamps/ready.json'))).toBe(true);
    expect(JSON.parse(readStampText(file) ?? '')).toEqual({ a: 2 });

    writeFileSync(file, '{"a":3}\n');

    expect(readStampText(file)).toBe('{"a":3}\n');
  });

  it('drops the cached copy once a write equals the tracked file again', async () => {
    const { root, file } = productReadyFile();

    await withStampsInCache(async () => writeStampFile(file, { a: 2 }));
    await withStampsInCache(async () => writeStampFile(file, { a: 1 }));

    expect(existsSync(join(root, '.ethlete/cache/acme/stamps/ready.json'))).toBe(false);
    expect(readStampText(file)).toBe('{"a":1}\n');
  });

  it('keeps a cached entry while only another entry of the tracked file changes, and writes none of it there', async () => {
    const { file } = productReadyFile();

    await withStampsInCache(async () => writeStampFile(file, { a: 1, b: 2 }));
    writeStampFile(file, { ...JSON.parse(readStampText(file) ?? '{}'), a: 3 });

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ a: 3 });
    expect(JSON.parse(readStampText(file) ?? '')).toEqual({ a: 3, b: 2 });

    writeFileSync(file, '{"a":3,"b":4}\n');

    expect(readStampText(file)).toBe('{"a":3,"b":4}\n');
  });
});
