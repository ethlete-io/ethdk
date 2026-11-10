import { spawnSync } from 'child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { createShotStore, SharedDraw } from './shot-store';

const address = { product: 'acme', part: 'components/card', sketch: null, props: null };

const picture = { png: Buffer.from('drawn png'), marks: [] };

const sharedStore = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-design-draw-lock-'));
  const dir = join(root, 'part-shots');
  const file = join(root, 'card.ts');

  writeFileSync(file, 'export const card = 1;');

  const client = () =>
    createShotStore({ dir, salt: 'salt', checkout: root, inputsOf: () => [file], scopeOf: () => 'scope', pollMs: 5 });

  return { dir, file, client };
};

const lockFileOf = (dir: string) => {
  const [keyDir] = readdirSync(dir);

  return join(dir, keyDir ?? '', 'draw.lock');
};

const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;

describe('shot store draw lock', () => {
  it('lets a second client wait for the draw the first one holds and read its picture without drawing', async () => {
    const { client } = sharedStore();
    const first = client();
    const second = client();
    const claim = first.claim('key');

    expect(claim).not.toBeNull();
    expect(second.claim('key')).toBeNull();

    const waiting = second.waitFor('key', { address, ms: 10_000 });

    first.write('key', { address, picture });
    claim?.release();

    const answer = await waiting;

    expect(answer).toEqual({ picture: expect.objectContaining({ png: picture.png }) });
    expect(second.claim('key')).not.toBeNull();
  });

  it('takes over the lock of a process that is gone', async () => {
    const { dir, client } = sharedStore();
    const first = client();

    first.claim('key');
    writeFileSync(lockFileOf(dir), JSON.stringify({ pid: deadPid(), at: Date.now(), token: 'gone' }));

    const answer = await client().waitFor('key', { address, ms: 10_000 });

    expect(answer).toMatchObject({ why: 'owner gone', claim: expect.any(Object) });
  });

  it('takes over the lock of a live process once it is older than the wait', async () => {
    const { dir, client } = sharedStore();

    client().claim('key');
    writeFileSync(lockFileOf(dir), JSON.stringify({ pid: process.pid, at: Date.now() - 60_000, token: 'old' }));

    expect(await client().waitFor('key', { address, ms: 30_000 })).toMatchObject({
      why: 'too old',
      claim: expect.any(Object),
    });

    const claimedAt: number = JSON.parse(readFileSync(lockFileOf(dir), 'utf8')).at;

    expect(await client().waitFor('key', { address, ms: 50 })).toMatchObject({ why: 'too old' });
    expect(Date.now() - claimedAt).toBeGreaterThanOrEqual(50);
  });

  it('takes over a live lock whose age reaches the wait in the same poll that the wait runs out', async () => {
    const { client } = sharedStore();

    client().claim('key');

    expect(await client().waitFor('key', { address, ms: 0 })).toMatchObject({ why: 'too old' });
  });

  it('hands the draw to the waiter when the drawing client fails and releases its lock', async () => {
    const { client } = sharedStore();
    const first = client();
    const claim = first.claim('key');
    const waiting = client().waitFor('key', { address, ms: 10_000 });

    claim?.release();

    const answer: SharedDraw = await waiting;

    expect(answer).toMatchObject({ why: 'released', claim: expect.any(Object) });
  });

  it('draws again when the stored picture was drawn from other file contents', async () => {
    const { file, client } = sharedStore();
    const first = client();
    const claim = first.claim('key');
    const second = client();
    const waiting = second.waitFor('key', { address, ms: 10_000 });

    first.write('key', { address, picture });
    writeFileSync(file, 'export const card = 2;');
    claim?.release();

    expect(await waiting).toMatchObject({ why: 'released', claim: expect.any(Object) });
  });
});
