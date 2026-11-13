import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { readStampText, withStampsInCache, withStampsInMemory, writeStampFile } from './stamp-files';

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

describe('withStampsInCache', () => {
  const productReadyFile = () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-stamp-cache-'));

    dirs.push(root);

    const dir = join(root, '.ethlete/design/acme');

    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'ready.json'), '{"a":1}\n');

    return { root, file: join(dir, 'ready.json') };
  };

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
});
