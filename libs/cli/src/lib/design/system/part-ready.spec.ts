import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { openPointsAnswer, partReadyAnswer } from '../studio-api';
import { drawnFindingsOf } from './drawn-open-points';
import { readReady, readyMarkOf, readyPartOf, readyPartsOf } from './part-ready';
import { designReady } from './ready-command';
import { resolveProduct } from './resolve-product';

vi.mock('./drawn-open-points', () => ({
  drawnFindingsOf: vi.fn(async () => ({ contrasts: [], missingStates: [] })),
}));

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-part-ready-'));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, source: string) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(join(design, 'app-a', path, `${path.split('/')[1]}.ts`), source);
  };

  part(
    'components/chip',
    "export default definePart({ implements: 'libs/chip.component.ts', controls: { remove: {} }, states: { default: {} } });\n",
  );
  part('components/tag', 'export default definePart({ states: { default: {} } });\n');
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return { target, dir: join(design, 'app-a') };
};

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: {} });

const hashOf = (target: string, part = 'components/chip') => {
  const found = readyPartOf({ product: productOf(target), part });

  return typeof found === 'string' ? found : found.hash;
};

const post = (target: string, body: unknown) =>
  partReadyAnswer({
    target,
    url: new URL('http://localhost/?product=app-a'),
    request: Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
      method: 'POST',
    }) as unknown as IncomingMessage,
  });

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

describe('part ready', () => {
  afterEach(() => vi.restoreAllMocks());

  it('marks a part without open points ready, and drops the mark when the part changes', async () => {
    const { target, dir } = checkout();
    const hash = hashOf(target);
    const answer = await post(target, { part: 'components/chip', hash, by: 'tom' });

    expect(answer.status).toBe(200);
    expect(readReady(dir)).toEqual({ 'components/chip': { hash, by: 'tom', at: expect.any(String) } });
    expect(readyPartsOf(productOf(target))).toEqual(['components/chip']);

    appendFileSync(join(dir, 'components/chip/chip.ts'), '// changed\n');

    expect(readyMarkOf({ product: productOf(target), part: 'components/chip' })).toBeNull();
    expect(readyPartsOf(productOf(target))).toEqual([]);
  });

  it('refuses with the list while the part has open points, the drawn ones too', async () => {
    const { target, dir } = checkout();

    vi.mocked(drawnFindingsOf).mockResolvedValueOnce({
      contrasts: [{ part: 'components/chip', state: 'default', path: 'span' }],
      missingStates: [],
    });

    expect(await post(target, { part: 'components/chip', hash: hashOf(target), by: 'tom' })).toEqual({
      status: 422,
      body: {
        error: 'components/chip has 1 open point - close them before ready',
        points: [{ kind: 'contrast', state: 'default', path: 'span' }],
      },
    });
    expect(
      (await post(target, { part: 'components/tag', hash: hashOf(target, 'components/tag'), by: 'tom' })).status,
    ).toBe(422);
    expect(readReady(dir)).toEqual({});
  });

  it('answers 400 without by or hash, 404 for an unknown part, 409 on a stale hash and 503 without a draw', async () => {
    const { target, dir } = checkout();
    const hash = hashOf(target);

    expect((await post(target, { part: 'components/chip', hash })).status).toBe(400);
    expect((await post(target, { part: 'components/chip', by: 'tom' })).status).toBe(400);
    expect((await post(target, { hash, by: 'tom' })).status).toBe(400);
    expect((await post(target, { part: 'components/gone', hash, by: 'tom' })).status).toBe(404);
    expect((await post(target, { part: 'components/chip', hash: 'stale', by: 'tom' })).status).toBe(409);

    vi.mocked(drawnFindingsOf).mockResolvedValueOnce({ unavailable: 'no playwright' });

    expect((await post(target, { part: 'components/chip', hash, by: 'tom' })).status).toBe(503);
    expect(readReady(dir)).toEqual({});
  });

  it('answers the hash and the ready mark of a part with its open points', async () => {
    const { target } = checkout();
    const hash = hashOf(target);

    await post(target, { part: 'components/chip', hash, by: 'tom' });

    const answer = await openPointsAnswer({
      target,
      url: new URL('http://localhost/?product=app-a&part=components/chip'),
      request: Object.assign(Readable.from([]), { method: 'GET' }) as unknown as IncomingMessage,
    });

    expect(answer.body).toEqual({
      part: 'components/chip',
      hash,
      ready: { hash, by: 'tom', at: expect.any(String) },
      drawn: false,
      points: [],
    });
  });

  it('et design ready exits 1 with the open points, and marks a part without any', async () => {
    const { target, dir } = checkout();
    const lines = output();
    const ready = (...argv: string[]) => designReady({ target, argv, invocation: 'et design' });

    expect(await ready('components/tag', '--product', 'app-a')).toBe(2);
    expect(await ready('components/tag', '--product', 'app-a', '--by', 'tom')).toBe(1);
    expect(lines).toContain('  components/tag: no controls declared; no implements');
    expect(lines).toContain('components/tag has 2 open points - close them before ready');

    expect(await ready('components/chip', '--product', 'app-a', '--by', 'tom')).toBe(0);
    expect(lines.at(-1)).toBe('components/chip is ready in app-a');
    expect(Object.keys(readReady(dir))).toEqual(['components/chip']);
  });
});
