import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recordRun, TimingLine } from '../timings';
import { createServedCache, createServedHashes, FetchServed, servedHitOf, writeServed } from './served-cache';

const BASE = 'http://localhost:4321';
const ANSWERED: FetchServed = async ({ url }) => ({ body: Buffer.from(`200\0${url}`), lines: [] });
const UNFETCHABLE = `${BASE}/gone.js`;
const fetchingAllBut: FetchServed = async (request) =>
  new URL(request.url, BASE).href === UNFETCHABLE ? null : ANSWERED(request);

describe('served cache inputs', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'served-cache-'));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('writes no entry when a response could not be fetched, so a later run draws again', async () => {
    const run = {
      store: createServedCache<string>(join(dir, 'cache'), 1e9),
      served: createServedHashes(BASE, fetchingAllBut),
      salt: '',
    };
    const requested = [
      { url: `${BASE}/part.js`, accept: null },
      { url: UNFETCHABLE, accept: null },
    ];

    await expect(writeServed(run, { key: 'k', requested, value: 'drawn' })).resolves.toBe(false);
    expect(readdirSync(dir)).toEqual([]);
    await expect(servedHitOf(run, 'k')).resolves.toBeNull();

    await expect(writeServed(run, { key: 'k', requested: requested.slice(0, 1), value: 'drawn' })).resolves.toBe(true);
    await expect(servedHitOf(run, 'k')).resolves.toBe('drawn');
  });

  it("records each unfetched input in the run's timings line, and zero when every input answered", async () => {
    const file = join(dir, '.timings.jsonl');
    const hashOnce = (fetchServed: FetchServed) =>
      recordRun({ file, argv: ['check'], env: {}, commitOf: async () => null }, async () => {
        const served = createServedHashes(BASE, fetchServed);

        await served.inputsOf([
          { url: UNFETCHABLE, accept: null },
          { url: `${BASE}/a.js`, accept: null },
        ]);
        await served.unchanged([{ url: '/gone.js', accept: null, hash: 'x' }]);

        return 0;
      });

    await hashOnce(fetchingAllBut);
    await hashOnce(ANSWERED);

    const lines = readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as TimingLine);

    expect(lines.map((line) => line.nullHashes)).toEqual([1, 0]);
  });
});
