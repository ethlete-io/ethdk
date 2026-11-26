import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { originOf } from './write-origin';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { checkSystemRendered } from './check-system';
import { markPartReady } from './mark-part-ready';
import { recordBuildReady } from './part-build-ready';
import { actionsRerunOf, readyMarkOf, readyPartOf } from './part-ready';
import { resolveProduct } from './resolve-product';

vi.mock('./render-check', async (actual) => ({
  ...(await actual<typeof import('./render-check')>()),
  renderIssuesOf: vi.fn(async () => ({ issues: [], warnings: [] })),
}));

vi.mock('./complete', async (actual) => ({
  ...(await actual<typeof import('./complete')>()),
  partsCompletenessOf: vi.fn(async () => ({ gaps: new Map(), exceptions: [], hints: new Map() })),
}));

vi.mock('./system-tsconfig', async (actual) => ({
  ...(await actual<typeof import('./system-tsconfig')>()),
  typecheckProduct: vi.fn(() => ({ kind: 'ok' })),
}));

vi.mock('./bespoke-controls', async (actual) => ({
  ...(await actual<typeof import('./bespoke-controls')>()),
  bespokeControlProblemsOf: vi.fn(async () => []),
}));

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-embedded-actions-'));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, source: string) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(join(design, 'app-a', path, `${path.split('/')[1]}.ts`), source);
  };

  part(
    'components/canvas',
    "export default definePart({ implements: 'libs/canvas.component.ts', states: { default: {} } });\n",
  );
  part(
    'pages/inbox',
    "import canvas from '@system/components/canvas';\nexport default definePart({ implements: 'libs/inbox.component.ts', states: { default: {} } });\nexport const shown = canvas;\n",
  );
  mkdirSync(join(target, 'libs'), { recursive: true });
  writeFileSync(join(target, 'libs/canvas.component.ts'), 'export class Canvas {}\n');
  writeFileSync(
    join(target, 'libs/inbox.component.ts'),
    "import { Canvas } from './canvas.component';\nexport class Inbox { canvas = Canvas; }\n",
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return target;
};

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: {} });

const ready = async (target: string, failures: string[] = [], part = 'pages/inbox') => {
  const product = resolveProduct({
    target,
    name: 'app-a',
    config: { harness: { app: 'apps/a', map: 'apps/a/harness.ts' } },
  });
  const found = readyPartOf({ product, part });

  return markPartReady({
    product,
    origin: originOf('spec'),
    part,
    hash: typeof found === 'string' ? found : found.hash,
    inputsOf: async () => ({ pointsOf: () => [], problemsOf: () => [], slowOf: () => [] }),
    actionsOf: async () => failures,
  });
};

describe('an embedded part change asks for the actions of its embedders again', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports the record of an embedding part with a rule problem as dropped in check, and clears after a passing ready', async () => {
    const target = checkout();

    expect(await ready(target, [], 'components/canvas')).not.toHaveProperty('status');
    expect(await ready(target)).not.toHaveProperty('status');
    expect(actionsRerunOf({ product: productOf(target), part: 'pages/inbox' })).toEqual([]);

    appendFileSync(join(target, 'libs/canvas.component.ts'), 'export const focusable = true;\n');

    expect(actionsRerunOf({ product: productOf(target), part: 'pages/inbox' })).toEqual([
      'pages/inbox',
      'components/canvas',
    ]);

    const lines: string[] = [];
    const push = (line: unknown) => void lines.push(String(line));

    vi.spyOn(console, 'log').mockImplementation(push);
    vi.spyOn(console, 'error').mockImplementation(push);
    vi.spyOn(console, 'warn').mockImplementation(push);

    await checkSystemRendered({ target, config: readConfig(target) ?? {}, products: ['app-a'] });

    expect(lines.some((line) => line.startsWith('ACTIONS RERUN'))).toBe(false);
    expect(lines).toContainEqual(expect.stringMatching(/^RECORD DROPPED app-a pages\/inbox: /u));
    expect(actionsRerunOf({ product: productOf(target), part: 'pages/inbox' })).toEqual([]);
    expect(lines.filter((line) => line.startsWith('PART app-a pages/inbox: '))).toEqual([
      expect.stringMatching(/IMPLEMENTS-SHAPE/u),
    ]);

    expect(await ready(target, ['default button "x" Enter FAILED'])).toEqual({
      status: 422,
      error: 'pages/inbox fails 1 action check - fix them before ready',
      actions: ['default button "x" Enter FAILED'],
      blockers: [{ kind: 'embedded', text: 'components/canvas is not build-ready', part: 'components/canvas' }],
    });

    expect(await ready(target)).toMatchObject({
      status: 422,
      blockers: [{ kind: 'embedded', part: 'components/canvas' }],
      record: { by: 'spec' },
    });
    expect(await ready(target, [], 'components/canvas')).not.toHaveProperty('status');
    expect(await ready(target)).not.toHaveProperty('status');
    expect(actionsRerunOf({ product: productOf(target), part: 'pages/inbox' })).toEqual([]);
  });

  it('reruns the actions of a part in check once its own app files changed', async () => {
    const target = checkout();
    const part = 'components/canvas';
    const product = () =>
      resolveProduct({ target, name: 'app-a', config: { harness: { app: 'apps/a', map: 'apps/a/harness.ts' } } });
    const actionsOf = vi.fn(async () => ['default button "x" Enter FAILED']);
    const check = () =>
      recordBuildReady({
        product: product(),
        by: 'spec',
        cmd: 'check',
        parts: [part],
        inputs: { pointsOf: () => [], problemsOf: () => [], slowOf: () => [] },
        actionsOf,
      });

    expect(await ready(target, [], part)).not.toHaveProperty('status');

    await check();

    expect(actionsOf).not.toHaveBeenCalled();

    appendFileSync(join(target, 'libs/canvas.component.ts'), 'export const focusable = true;\n');

    expect(actionsRerunOf({ product: product(), part })).toEqual([part]);
    expect((await check()).get(part)).toMatchObject({ ready: false });
    expect(actionsOf).toHaveBeenCalledOnce();
    expect(readyMarkOf({ product: product(), part })).toBeNull();
  });
});
