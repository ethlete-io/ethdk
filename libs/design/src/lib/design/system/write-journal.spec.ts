import { mkdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';
import { describe, expect, it } from 'vitest';
import { journaledAsync, openJournal, recoverJournal } from './write-journal';

const JITI = pathToFileURL(resolve(require.resolve('jiti/package.json'), '../lib/jiti-register.mjs')).href;

const holdInThread = (productDir: string, root: string, holdMs: number, cycleMs?: number) => {
  const worker = new Worker(resolve(__dirname, 'write-journal.hold.worker.ts'), {
    workerData: { productDir, root, holdMs, cycleMs },
    execArgv: ['--import', JITI],
  });
  const message = (expected: string) =>
    new Promise<number>((done, fail) => {
      worker.on('message', (seen: { kind: string; at: number }) => seen.kind === expected && done(seen.at));
      worker.once('error', fail);
    });

  return { open: message('open'), closed: message('closed') };
};

describe('openJournal', () => {
  it('waits for the journal another thread of this process still has open, then opens its own', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-write-journal-'));
    const productDir = join(root, '.ethlete', 'design', 'acme');

    mkdirSync(productDir, { recursive: true });

    const held = holdInThread(productDir, root, 1500);

    await held.open;

    const journal = openJournal({ productDir, root, label: 'merge of components/second', waitMs: 20_000 });
    const opened = Date.now();

    journal.close();

    expect(opened).toBeGreaterThanOrEqual(await held.closed);
  }, 30_000);

  it('leaves alone a journal another thread of this process closes during the recovery', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-write-journal-'));
    const productDir = join(root, '.ethlete', 'design', 'acme');

    mkdirSync(productDir, { recursive: true });

    const held = holdInThread(productDir, root, 0, 1500);
    const until = Date.now() + 1500;

    while (Date.now() < until) expect(recoverJournal(productDir)).toBeNull();

    await held.closed;
  }, 30_000);

  it('throws naming the open journal once its wait runs out', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-write-journal-'));
    const productDir = join(root, '.ethlete', 'design', 'acme');

    mkdirSync(productDir, { recursive: true });

    const held = holdInThread(productDir, root, 3000);

    await held.open;

    expect(() => openJournal({ productDir, root, label: 'merge of components/second', waitMs: 200 })).toThrow(
      /merge of components\/second waits: the merge of components\/first of pid \d+ has not finished/u,
    );

    await held.closed;
  }, 30_000);

  it('journaledAsync keeps the event loop running while another thread holds the journal, then runs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-write-journal-'));
    const productDir = join(root, '.ethlete', 'design', 'acme');

    mkdirSync(productDir, { recursive: true });

    const held = holdInThread(productDir, root, 1500);

    await held.open;

    let ticks = 0;
    const ticker = setInterval(() => ticks++, 50);
    const ran = await journaledAsync({ productDir, root, label: 'pick of components/second', waitMs: 20_000 }, () =>
      Date.now(),
    );

    clearInterval(ticker);

    expect(ran).toBeGreaterThanOrEqual(await held.closed);
    expect(ticks).toBeGreaterThanOrEqual(10);
  }, 30_000);
});
