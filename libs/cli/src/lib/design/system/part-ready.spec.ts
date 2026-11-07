import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { originOf } from './write-origin';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { openPointsAnswer } from '../studio-api';
import { checkActions, PART_HARNESS_ONLY, partActionFailuresOf } from './actions-command';
import { harnessMapOf, writeHarnessMap } from './harness-map';
import { checkLiveActions } from './live-actions';
import { drawnFindingsOf } from './drawn-open-points';
import { drawnPartPointsOf, markPartReady, readReady, readyMarkOf, readyPartOf, readyPartsOf } from './part-ready';
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

vi.mock('./slow-checks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./slow-checks')>()),
  slowProblemsOf: vi.fn(() => []),
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
  mkdirSync(join(target, 'libs'), { recursive: true });
  writeFileSync(join(target, 'libs/chip.component.ts'), 'export class Chip {}\n');

  return { target, dir: join(design, 'app-a') };
};

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: {} });

const hashOf = (target: string, part = 'components/chip') => {
  const found = readyPartOf({ product: productOf(target), part });

  return typeof found === 'string' ? found : found.hash;
};

const goOf = (target: string, part = 'components/chip') =>
  markPartGo({ product: productOf(target), part, by: 'tom', via: 'design go' });

const post = async (target: string, body: { part?: string; hash?: string }) => {
  const product = productOf(target);
  const part = body.part ?? '';
  const marked = await markPartReady({
    product,
    origin: originOf('spec'),
    part,
    hash: body.hash,
    pointsOf: async () => {
      const points = await drawnPartPointsOf({ target, config: {}, product, part });

      return 'unavailable' in points ? { status: 503, error: `cannot draw ${part}: ${points.unavailable}` } : points;
    },
    actionsOf: async () => {
      const failures = await partActionFailuresOf({ target, config: {}, product, part });

      return Array.isArray(failures)
        ? failures
        : { status: 503, error: `cannot check the actions of ${part}: ${failures.noVerdict}` };
    },
    actionsNote: PART_HARNESS_ONLY,
  });

  if ('status' in marked)
    return {
      status: marked.status,
      body: {
        error: marked.error,
        ...(marked.points ? { points: marked.points } : {}),
        ...(marked.actions ? { actions: marked.actions } : {}),
      },
    };

  return { status: 200, body: { part, hash: marked.hash, ready: marked, points: [] } };
};

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
    const answer = await post(target, { part: 'components/chip', hash });

    expect(answer.status).toBe(200);
    expect(readReady(dir)).toEqual({
      'components/chip': {
        hash,
        files: expect.any(Object),
        at: expect.any(String),
        by: 'spec',
        cmd: expect.any(String),
        pid: process.pid,
      },
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
      busyStates: [],
    });

    expect(await post(target, { part: 'components/chip', hash: hashOf(target) })).toEqual({
      status: 422,
      body: {
        error: 'components/chip has 1 open point - close them before ready',
        points: [{ kind: 'contrast', state: 'default', path: 'span' }],
      },
    });
    expect((await post(target, { part: 'components/tag', hash: hashOf(target, 'components/tag') })).status).toBe(422);
    expect(readReady(dir)).toEqual({});
  });

  it('answers 400 without a hash, 404 for an unknown part, 409 on a stale hash and 503 without a draw', async () => {
    const { target, dir } = checkout();
    const hash = hashOf(target);

    expect((await post(target, { part: 'components/chip' })).status).toBe(400);
    expect((await post(target, { part: 'components/gone', hash })).status).toBe(404);
    expect((await post(target, { part: 'components/chip', hash: 'stale' })).status).toBe(409);

    vi.mocked(drawnFindingsOf).mockResolvedValueOnce({ unavailable: 'no playwright' });

    expect((await post(target, { part: 'components/chip', hash })).status).toBe(503);
    expect(readReady(dir)).toEqual({});
  });

  it('answers the hash and the ready mark of a part with its open points', async () => {
    const { target } = checkout();

    goOf(target);

    const hash = hashOf(target);

    await post(target, { part: 'components/chip', hash });

    const answer = await openPointsAnswer({
      target,
      url: new URL('http://localhost/?product=app-a&part=components/chip'),
      request: Object.assign(Readable.from([]), { method: 'GET' }) as unknown as IncomingMessage,
    });

    expect(answer.body).toEqual({
      part: 'components/chip',
      hash,
      ready: {
        hash,
        files: expect.any(Object),
        at: expect.any(String),
        by: 'spec',
        cmd: expect.any(String),
        pid: process.pid,
      },
      directEdit: false,
      buildReady: expect.any(Object),
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
    expect(lines.join('\n')).toContain('a ready mark needs --by <model id | designer>');
    expect(await ready('components/tag', '--product', 'app-a', '--by', 'tom')).toBe(1);
    expect(lines).toContain('  components/tag: no controls declared');
    expect(lines).toContain('components/tag has 1 open point - close them before ready');

    expect(await ready('components/chip', '--product', 'app-a', '--by', 'tom')).toBe(0);
    expect(lines.at(-1)).toBe('components/chip is build-ready in app-a');
    expect(Object.keys(readReady(dir))).toEqual(['components/chip']);
  });

  it('refuses ready with the failed action checks, and answers 503 while they cannot run', async () => {
    const { target, dir } = checkout();
    const lines = output();
    const failed = ['default button "remove" click FAILED the output remove did not fire'];

    goOf(target);
    vi.mocked(partActionFailuresOf).mockResolvedValueOnce(failed);

    expect(await post(target, { part: 'components/chip', hash: hashOf(target) })).toEqual({
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

    vi.mocked(partActionFailuresOf).mockResolvedValueOnce({ noVerdict: 'no harness' });

    expect(await post(target, { part: 'components/chip', hash: hashOf(target) })).toEqual({
      status: 503,
      body: { error: 'cannot check the actions of components/chip: no harness' },
    });
    expect(readReady(dir)).toEqual({});
  });

  it('skips the actions of a part without an implements link, in one line', async () => {
    const { target } = checkout();
    const { partActionFailuresOf: failuresOf } =
      await vi.importActual<typeof import('./actions-command')>('./actions-command');
    const check = vi.fn<typeof checkActions>();
    const notes: string[] = [];

    expect(
      await failuresOf({
        target,
        config: {},
        product: productOf(target),
        part: 'components/tag',
        url: 'http://localhost:1',
        check,
        onNote: (line) => notes.push(line),
      }),
    ).toEqual([]);
    expect(check).not.toHaveBeenCalled();
    expect(notes).toEqual(['actions components/tag: skipped - no implements link, nothing to click']);
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

  it('reports a skipped host once, never as a miss', async () => {
    const { target } = checkout();
    const { partActionFailuresOf: failuresOf } =
      await vi.importActual<typeof import('./actions-command')>('./actions-command');
    mkdirSync(join(target, 'apps/a'), { recursive: true });
    mkdirSync(join(target, 'libs'), { recursive: true });
    writeFileSync(
      join(target, 'libs/chip.component.ts'),
      "@Component({ selector: 'app-chip', template: '' })\nexport class ChipComponent {}\n",
    );

    const product = resolveProduct({
      target,
      name: 'app-a',
      config: { harness: { app: 'apps/a', map: 'apps/a/harness.ts', hosts: ['DesignCanvas'] } },
    });
    const map = harnessMapOf({ target, product });

    if (map === null || typeof map === 'string') throw new Error(`no harness map: ${map}`);

    writeHarnessMap(map);
    const check = vi.fn<typeof checkActions>(async () => ({
      lines: [
        { state: 'default', element: 'button "remove"', input: 'click', failure: null },
        { state: 'hover', element: 'button "remove"', input: 'click', failure: null },
      ],
      pictures: null,
      hosts: ['DesignCanvas'],
    }));
    const notes: string[] = [];

    expect(
      await failuresOf({
        target,
        config: {},
        product,
        part: 'components/chip',
        url: 'http://localhost:1',
        check,
        onNote: (line) => notes.push(line),
      }),
    ).toEqual([]);
    expect(notes).toEqual([
      "host DesignCanvas: skipped - the app's own chrome around the part, which the design does not draw",
    ]);
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

describe('ready on an unchanged part', () => {
  const embeddingCheckout = () => {
    const { target, dir } = checkout();

    mkdirSync(join(dir, 'pages/inbox'), { recursive: true });
    writeFileSync(
      join(dir, 'pages/inbox/inbox.ts'),
      "import chip from '@system/components/chip';\nexport default definePart({ implements: 'libs/inbox.component.ts', states: { default: {} } });\nexport const shown = chip;\n",
    );
    mkdirSync(join(target, 'libs'), { recursive: true });
    writeFileSync(join(target, 'libs/chip.component.ts'), 'export class Chip {}\n');
    writeFileSync(
      join(target, 'libs/inbox.component.ts'),
      "import { Chip } from './chip.component';\nexport class Inbox { chip = Chip; }\n",
    );

    return target;
  };

  const readyAs = (target: string, at: string) =>
    markPartReady({
      product: productOf(target),
      origin: originOf('spec'),
      part: 'pages/inbox',
      hash: hashOf(target, 'pages/inbox'),
      at,
      pointsOf: async () => [],
      actionsOf: async () => [],
    });

  it('refuses a ready mark without an actor and stamps by, cmd and pid on one with', async () => {
    const { target, dir } = checkout();
    const product = productOf(target);
    const base = {
      product,
      part: 'components/tag',
      hash: hashOf(target, 'components/tag'),
      pointsOf: async () => [],
      actionsOf: async () => [],
    };

    expect(await markPartReady({ ...base, origin: { by: '', cmd: 'x', pid: 1 } })).toMatchObject({ status: 400 });
    expect(existsSync(join(dir, 'ready.json'))).toBe(false);

    const marked = await markPartReady({ ...base, origin: originOf('claude-opus-5-5', 'design ready components/tag') });

    expect(marked).toMatchObject({ by: 'claude-opus-5-5', cmd: 'design ready components/tag', pid: process.pid });
    expect(JSON.parse(readFileSync(join(dir, 'ready.json'), 'utf8'))['components/tag']).toMatchObject({
      by: 'claude-opus-5-5',
      pid: process.pid,
    });
  });

  it('keeps at and refreshes the embedded record, and writes a new mark when the part changed', async () => {
    const target = embeddingCheckout();
    const dir = join(target, DESIGN_DIR, 'app-a');
    const first = await readyAs(target, '2026-01-01T00:00:00.000Z');

    expect(first).toHaveProperty('by', 'spec');

    const marks = readReady(dir);

    writeFileSync(
      join(dir, 'ready.json'),
      JSON.stringify({ ...marks, 'pages/inbox': { ...marks['pages/inbox'], embedded: undefined } }),
    );

    const again = await readyAs(target, '2026-02-02T00:00:00.000Z');

    expect(again).toMatchObject({ at: '2026-01-01T00:00:00.000Z' });
    expect(again).toHaveProperty('embedded');
    expect(readReady(dir)['pages/inbox']).toMatchObject({ at: '2026-01-01T00:00:00.000Z' });
    expect(readReady(dir)['pages/inbox']).toHaveProperty('embedded');

    appendFileSync(join(dir, 'pages/inbox/inbox.ts'), 'export const more = 1;\n');

    expect(await readyAs(target, '2026-03-03T00:00:00.000Z')).toMatchObject({ at: '2026-03-03T00:00:00.000Z' });
  });
});
