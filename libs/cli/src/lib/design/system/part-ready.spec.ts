import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { openPointsAnswer, partReadyAnswer } from '../studio-api';
import { checkActions, PART_HARNESS_ONLY, partActionFailuresOf } from './actions-command';
import { harnessMapOf, writeHarnessMap } from './harness-map';
import { checkLiveActions } from './live-actions';
import { drawnFindingsOf } from './drawn-open-points';
import { readReady, readyMarkOf, readyPartOf, readyPartsOf } from './part-ready';
import { markPartGo } from './part-go';
import { designReady } from './ready-command';
import { resolveProduct } from './resolve-product';

vi.mock('./drawn-open-points', () => ({
  drawnFindingsOf: vi.fn(async () => ({ contrasts: [], missingStates: [] })),
}));

vi.mock('./actions-command', async (importOriginal) => {
  const original = await importOriginal<typeof import('./actions-command')>();

  return { ...original, partActionFailuresOf: vi.fn(async () => []) };
});

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

const goOf = (target: string, part = 'components/chip') => markPartGo({ product: productOf(target), part, by: 'tom' });

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

    goOf(target);

    const hash = hashOf(target);
    const answer = await post(target, { part: 'components/chip', hash, by: 'tom' });

    expect(answer.status).toBe(200);
    expect(readReady(dir)).toEqual({
      'components/chip': { hash, files: expect.any(Object), by: 'tom', at: expect.any(String) },
    });
    expect(readyPartsOf(productOf(target))).toEqual(['components/chip']);

    appendFileSync(join(dir, 'components/chip/chip.ts'), '// changed\n');

    expect(readyMarkOf({ product: productOf(target), part: 'components/chip' })).toBeNull();
    expect(readyPartsOf(productOf(target))).toEqual([]);
  });

  it('refuses with the list while the part has open points, the drawn ones too', async () => {
    const { target, dir } = checkout();

    goOf(target);
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

    goOf(target);

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
      ready: { hash, files: expect.any(Object), by: 'tom', at: expect.any(String) },
      go: { hash, files: expect.any(Object), by: 'tom', at: expect.any(String) },
      directEdit: false,
      drawn: false,
      points: [],
    });
  });

  it('et design ready exits 1 with the open points, and marks a part without any', async () => {
    const { target, dir } = checkout();
    const lines = output();

    goOf(target);

    const ready = (...argv: string[]) => designReady({ target, argv, invocation: 'et design' });

    expect(await ready('components/tag', '--product', 'app-a')).toBe(2);
    expect(await ready('components/tag', '--product', 'app-a', '--by', 'tom')).toBe(1);
    expect(lines).toContain('  components/tag: no controls declared');
    expect(lines).toContain('components/tag has 1 open point - close them before ready');

    expect(await ready('components/chip', '--product', 'app-a', '--by', 'tom')).toBe(0);
    expect(lines.at(-1)).toBe('components/chip is ready in app-a');
    expect(Object.keys(readReady(dir))).toEqual(['components/chip']);
  });

  it('refuses ready with the failed action checks, and answers 503 while they cannot run', async () => {
    const { target, dir } = checkout();
    const lines = output();
    const failed = ['default button "remove" click FAILED the output remove did not fire'];

    goOf(target);
    vi.mocked(partActionFailuresOf).mockResolvedValueOnce(failed);

    expect(await post(target, { part: 'components/chip', hash: hashOf(target), by: 'tom' })).toEqual({
      status: 422,
      body: {
        error: `components/chip fails 1 action check - fix them before ready (${PART_HARNESS_ONLY})`,
        actions: failed,
      },
    });

    vi.mocked(partActionFailuresOf).mockResolvedValueOnce(failed);

    expect(
      await designReady({
        target,
        argv: ['components/chip', '--product', 'app-a', '--by', 'tom'],
        invocation: 'et design',
      }),
    ).toBe(1);
    expect(lines).toContain(`  ${failed[0]}`);
    expect(lines).toContain(`components/chip fails 1 action check - fix them before ready (${PART_HARNESS_ONLY})`);

    vi.mocked(partActionFailuresOf).mockResolvedValueOnce(failed);

    expect(
      await designReady({
        target,
        argv: ['components/chip', '--product', 'app-a', '--by', 'tom', '--url', 'http://localhost:1'],
        invocation: 'et design',
      }),
    ).toBe(1);
    expect(lines).toContain('components/chip fails 1 action check - fix them before ready');
    expect(partActionFailuresOf).toHaveBeenLastCalledWith(expect.objectContaining({ url: 'http://localhost:1' }));

    vi.mocked(partActionFailuresOf).mockResolvedValueOnce({ unavailable: 'no harness' });

    expect(await post(target, { part: 'components/chip', hash: hashOf(target), by: 'tom' })).toEqual({
      status: 503,
      body: { error: 'cannot check the actions of components/chip: no harness' },
    });
    expect(readReady(dir)).toEqual({});
  });

  it('answers only the failed lines of design actions', async () => {
    const { target } = checkout();
    const { partActionFailuresOf: failuresOf } =
      await vi.importActual<typeof import('./actions-command')>('./actions-command');
    const check = vi.fn<typeof checkActions>(async () => ({
      lines: [
        { state: 'default', element: 'button "remove"', input: 'click', failure: null },
        { state: 'default', element: 'button "remove"', input: 'Enter', failure: 'the output remove did not fire' },
      ],
      pictures: null,
    }));

    expect(
      await failuresOf({
        target,
        config: {},
        product: productOf(target),
        part: 'components/chip',
        url: 'http://localhost:1',
        check,
      }),
    ).toEqual(['default button "remove" Enter FAILED the output remove did not fire']);
    expect(check).toHaveBeenCalledWith(
      expect.objectContaining({ part: 'components/chip', url: 'http://localhost:1', only: null }),
    );
  });

  it('adds the failed live lines when ready runs with a url, and skips the live check without one', async () => {
    const { target } = checkout();
    const { partActionFailuresOf: failuresOf } =
      await vi.importActual<typeof import('./actions-command')>('./actions-command');

    const config = {
      products: { 'app-a': { harness: { app: 'apps/a', map: 'apps/a/harness.ts', live: 'apps/a/live.json' } } },
    };

    mkdirSync(join(target, 'apps/a'), { recursive: true });
    mkdirSync(join(target, 'libs'), { recursive: true });
    writeFileSync(
      join(target, 'libs/chip.component.ts'),
      "@Component({ selector: 'app-chip', template: '' })\nexport class ChipComponent {}\n",
    );
    writeFileSync(
      join(target, 'apps/a/live.json'),
      JSON.stringify({ host: 'app-shell', shell: 'app-shell-page', pages: {} }),
    );

    const product = resolveProduct({ target, name: 'app-a', config: config.products['app-a'] });
    const map = harnessMapOf({ target, product });

    if (map === null || typeof map === 'string') throw new Error(`no harness map: ${map}`);

    writeHarnessMap(map);

    const check = vi.fn<typeof checkActions>(async () => ({ lines: [], pictures: null }));
    const checkLive = vi.fn<typeof checkLiveActions>(async () => ({
      lines: [
        { page: 'pages/home', element: 'button "remove"', input: 'click', failure: null, parts: [] },
        {
          page: 'drift',
          element: 'button "remove"',
          input: 'Enter',
          failure: 'behaves differently per page',
          parts: [],
        },
      ],
    }));
    const options = { target, config, product, part: 'components/chip', check, checkLive };

    expect(await failuresOf({ ...options, url: 'http://localhost:1' })).toEqual([
      'live drift button "remove" Enter FAILED behaves differently per page',
    ]);
    expect(checkLive).toHaveBeenCalledWith(
      expect.objectContaining({ part: 'components/chip', url: 'http://localhost:1' }),
    );

    checkLive.mockClear();

    expect(
      await failuresOf({ ...options, start: async () => ({ url: 'http://localhost:2', stop: async () => undefined }) }),
    ).toEqual([]);
    expect(checkLive).not.toHaveBeenCalled();
  });
});
