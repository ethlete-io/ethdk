import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Rendered, renderMiddleware } from '../render';
import { recordRun, TimingLine } from '../timings';
import {
  createServedCache,
  createServedHashes,
  fetchServedOf,
  FetchServed,
  reachableBaseOf,
  servedHitOf,
  writeServed,
} from './served-cache';

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
  it('prints on a hit the warnings the render worker logged while drawing, as the drawn run printed them', async () => {
    const WARNING = 'etProvideColor="brand" has no effect because no color themes are registered.';
    const printed: string[] = [];
    const render = async (_ask: unknown, { quiet }: { quiet?: boolean }): Promise<Rendered> => {
      if (!quiet) printed.push(WARNING);

      return { html: '<et-chip></et-chip>', styles: [], lines: [WARNING] } as unknown as Rendered;
    };
    const server = createServer(renderMiddleware(render));

    await new Promise<void>((done) => server.listen(0, 'localhost', done));

    try {
      const address = server.address() as AddressInfo;
      const base = `http://localhost:${address.port}`;
      const requested = [{ url: `${base}/__design/render`, accept: null, post: '{"call":"components/chip"}' }];
      const runOf = () => ({
        store: createServedCache<string>(join(dir, 'cache'), 1e9),
        served: createServedHashes(base, fetchServedOf(reachableBaseOf(address))),
        salt: '',
        print: (line: string) => printed.push(line),
      });
      const drawn = async () => {
        const run = runOf();
        const hit = await servedHitOf(run, 'k');

        if (hit !== null) return hit;

        await fetch(`${reachableBaseOf(address)}/__design/render`, { method: 'POST', body: requested[0]?.post });
        await writeServed(run, { key: 'k', requested, value: 'drawn' });

        return 'drawn';
      };

      await drawn();
      const cold = printed.splice(0);

      await drawn();

      expect(cold).toEqual([WARNING]);
      expect(printed).toEqual(cold);
    } finally {
      await new Promise((done) => server.close(done));
    }
  });
});
