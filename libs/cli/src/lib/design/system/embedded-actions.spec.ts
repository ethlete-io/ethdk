import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { checkSystemRendered } from './check-system';
import { actionsRerunOf, markPartReady, readyPartOf } from './part-ready';
import { resolveProduct } from './resolve-product';

vi.mock('./render-check', async (actual) => ({
  ...(await actual<typeof import('./render-check')>()),
  renderIssuesOf: vi.fn(async () => ({ issues: [], warnings: [] })),
}));

vi.mock('./complete', async (actual) => ({
  ...(await actual<typeof import('./complete')>()),
  partsCompletenessOf: vi.fn(async () => ({ gaps: new Map(), exceptions: [], hints: new Map() })),
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

const ready = (target: string, failures: string[] = []) => {
  const product = productOf(target);
  const found = readyPartOf({ product, part: 'pages/inbox' });

  return markPartReady({
    product,
    part: 'pages/inbox',
    hash: typeof found === 'string' ? found : found.hash,
    by: 'claude',
    pointsOf: async () => [],
    actionsOf: async () => failures,
  });
};

describe('an embedded part change asks for the actions of its embedders again', () => {
  afterEach(() => vi.restoreAllMocks());

  it('marks the embedding part in check, names it when ready refuses, and clears after a passing ready', async () => {
    const target = checkout();

    expect(await ready(target)).not.toHaveProperty('status');
    expect(actionsRerunOf({ product: productOf(target), part: 'pages/inbox' })).toEqual([]);

    appendFileSync(join(target, 'libs/canvas.component.ts'), 'export const focusable = true;\n');

    expect(actionsRerunOf({ product: productOf(target), part: 'pages/inbox' })).toEqual(['components/canvas']);

    const lines: string[] = [];
    const push = (line: unknown) => void lines.push(String(line));

    vi.spyOn(console, 'log').mockImplementation(push);
    vi.spyOn(console, 'error').mockImplementation(push);
    vi.spyOn(console, 'warn').mockImplementation(push);

    await checkSystemRendered({ target, config: readConfig(target) ?? {}, products: ['app-a'] });

    expect(lines).toContain(
      'ACTIONS RERUN app-a pages/inbox: embedded components/canvas changed since its actions last ran - run et design ready pages/inbox again',
    );
    expect(lines.filter((line) => line.startsWith('PART app-a pages/inbox: '))).toEqual([
      expect.stringMatching(/open point/u),
    ]);

    expect(await ready(target, ['default button "x" Enter FAILED'])).toEqual({
      status: 422,
      error:
        'pages/inbox fails 1 action check - fix them before ready (embedded components/canvas changed since its actions last ran)',
      actions: ['default button "x" Enter FAILED'],
    });

    expect(await ready(target)).not.toHaveProperty('status');
    expect(actionsRerunOf({ product: productOf(target), part: 'pages/inbox' })).toEqual([]);
  });
});
