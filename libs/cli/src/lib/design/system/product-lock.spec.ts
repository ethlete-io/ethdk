import { spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { withProductLock, writeDecisionFile } from './product-lock';

const LOCK_MODULE = resolve(__dirname, 'product-lock.ts');
const JITI = require.resolve('jiti');
const WRITES = 40;

const childScript = `
const { createJiti } = require(${JSON.stringify(JITI)});
const { readFileSync } = require('fs');
const [dir, key, count, killAtRename] = process.argv.slice(1);
const { withProductLock, writeDecisionFile } = createJiti(${JSON.stringify(LOCK_MODULE)})(${JSON.stringify(LOCK_MODULE)});
const file = dir + '/ready.json';
if (killAtRename) require('fs').renameSync = () => process.kill(process.pid, 'SIGKILL');
const pause = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2);
for (let i = 0; i < Number(count); i++)
  withProductLock(dir, () => {
    const entries = JSON.parse(readFileSync(file, 'utf8'));
    pause();
    entries[key] = (entries[key] ?? 0) + 1;
    writeDecisionFile(file, JSON.stringify(entries, null, 2) + '\\n');
  });
`;

const productDirOf = () => {
  const root = mkdtempSync(join(tmpdir(), 'product-lock-'));
  const dir = join(root, '.ethlete', 'design', 'p');

  mkdirSync(dir, { recursive: true });

  return dir;
};

const padded = () => ({ padding: Array.from({ length: 2000 }, (_, index) => `entry-${index}`) });

const runChild = (args: string[]) =>
  new Promise<number | null>((done) => {
    const child = spawn(process.execPath, ['-e', childScript, ...args], { stdio: 'inherit' });

    child.on('exit', (code) => done(code));
  });

const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid ?? 0;

describe('withProductLock and writeDecisionFile', () => {
  it('loses no update and shows no torn ready.json while two processes read-modify-write it', async () => {
    const dir = productDirOf();
    const file = join(dir, 'ready.json');

    writeFileSync(file, JSON.stringify(padded()));

    const torn: string[] = [];
    let running = true;
    const watch = (async () => {
      while (running) {
        const text = readFileSync(file, 'utf8');

        try {
          JSON.parse(text);
        } catch {
          torn.push(text.slice(0, 40));
        }

        await new Promise((next) => setImmediate(next));
      }
    })();

    const codes = await Promise.all([runChild([dir, 'a', String(WRITES)]), runChild([dir, 'b', String(WRITES)])]);

    running = false;
    await watch;

    const entries = JSON.parse(readFileSync(file, 'utf8'));

    expect(codes).toEqual([0, 0]);
    expect(torn).toEqual([]);
    expect({ a: entries.a, b: entries.b }).toEqual({ a: WRITES, b: WRITES });
  }, 60_000);

  it('keeps the old file when the writer is killed between its temporary file and the rename', async () => {
    const dir = productDirOf();
    const file = join(dir, 'ready.json');
    const old = JSON.stringify({ a: 7 });

    writeFileSync(file, old);

    const code = await runChild([dir, 'a', '1', 'kill']);

    expect(code).toBeNull();
    expect(readFileSync(file, 'utf8')).toBe(old);
    expect(readdirSync(dir).filter((name) => name.endsWith('.tmp'))).toHaveLength(1);

    writeDecisionFile(file, '{"a":8}\n');

    expect(readFileSync(file, 'utf8')).toBe('{"a":8}\n');
    expect(readdirSync(dir)).toEqual(['ready.json']);
  }, 30_000);

  it('takes over the lock of a dead pid', () => {
    const dir = productDirOf();
    const lock = join(dir, '..', '..', 'cache', 'p', 'decisions.lock');

    mkdirSync(join(lock, '..'), { recursive: true });
    writeFileSync(lock, `${deadPid()}\n`);

    expect(withProductLock({ dir, waitMs: 200 }, () => readFileSync(lock, 'utf8'))).toBe(`${process.pid}\n`);
    expect(existsSync(lock)).toBe(false);
  });

  it('names the live holder when the wait runs out', () => {
    const dir = productDirOf();
    const lock = join(dir, '..', '..', 'cache', 'p', 'decisions.lock');

    mkdirSync(join(lock, '..'), { recursive: true });
    writeFileSync(lock, `${process.pid}\n`);

    expect(() => withProductLock({ dir, waitMs: 100 }, () => 'ran')).toThrow(`locked by pid ${process.pid}`);
    expect(readFileSync(lock, 'utf8')).toBe(`${process.pid}\n`);
  });

  it('is re-entrant when the nested call names the product through a symlink', () => {
    const dir = productDirOf();
    const root = join(dir, '..', '..', '..');
    const link = `${root}-link`;

    symlinkSync(root, link);

    withProductLock({ dir: join(link, '.ethlete', 'design', 'p'), waitMs: 100 }, () =>
      writeDecisionFile(join(dir, 'ready.json'), '{}\n'),
    );

    expect(readFileSync(join(dir, 'ready.json'), 'utf8')).toBe('{}\n');
  });
});
