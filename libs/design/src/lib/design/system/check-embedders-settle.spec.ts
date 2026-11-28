import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { git } from '@ethlete/cli/src/lib/git-test-env.fixtures';
import { DESIGN_DIR, readConfig } from '../design-config';
import { checkSystemRendered } from './check-system';
import { partKeyOf, resolveProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import { readStampText } from './stamp-files';

vi.mock('./render-check', async (actual) => ({
  ...(await actual<typeof import('./render-check')>()),
  renderIssuesOf: vi.fn(async () => ({ issues: [], warnings: [], grids: [], drawn: [] })),
}));

vi.mock('./part-ready', async (actual) => ({
  ...(await actual<typeof import('./part-ready')>()),
  dropPartRecord: vi.fn(() => false),
}));

vi.mock('./complete', async (actual) => ({
  ...(await actual<typeof import('./complete')>()),
  partsCompletenessOf: vi.fn(async () => ({ gaps: new Map(), exceptions: [], hints: new Map() })),
}));

vi.mock('./system-tsconfig', async (actual) => ({
  ...(await actual<typeof import('./system-tsconfig')>()),
  typecheckProduct: vi.fn(() => ({ kind: 'ok' })),
  typecheckProductAsync: vi.fn(async () => ({ kind: 'ok' })),
}));

vi.mock('./bespoke-controls', async (actual) => ({
  ...(await actual<typeof import('./bespoke-controls')>()),
  bespokeControlProblemsOf: vi.fn(async () => []),
}));

vi.mock('./action-lost', async (actual) => ({
  ...(await actual<typeof import('./action-lost')>()),
  declaredPartActionsOf: vi.fn(async () => []),
}));

const BEFORE =
  'inline-flex rounded-control-md border border-(--et-overlay-surface-border-color,var(--et-surface-border)) shadow-(--et-anchored-panel-shadow,0_10px_24px_rgb(var(--et-shadow-color-rgb,0_0_0)/0.16)) bg-et-surface-bg';
const AFTER =
  'inline-flex rounded-control-md border border-(--et-overlay-surface-border-color,var(--et-surface-border)) shadow-(--et-anchored-panel-shadow,0_10px_24px_color-mix(in_srgb,var(--et-shadow-color,rgb(0_0_0))_16%,transparent)) bg-et-surface-background';

const VIEWPORT = 'components/canvas-viewport';
const CHIP = 'components/zoom-chip';

const chipSource = (classes: string) =>
  [
    `import viewport from '@system/${VIEWPORT}';`,
    'export default definePart({ states: { default: {} }, describe: { default: "The part at rest." } });',
    'export const shown = [viewport];',
    `export const classes = '${classes}';`,
    '',
  ].join('\n');

const chipFile = (target: string) => join(target, DESIGN_DIR, 'app-a', CHIP, 'zoom-chip.ts');

const commit = (target: string, message: string) => {
  git(target, 'add', '-A');
  git(target, '-c', 'user.name=spec', '-c', 'user.email=spec@example.com', 'commit', '-q', '-m', message);
};

const chipHashOf = (target: string) => {
  const product = resolveProduct({ target, name: 'app-a', config: readConfig(target)?.products?.['app-a'] ?? {} });
  const chip = product.parts.find((resolved) => partKeyOf(resolved) === CHIP);

  return partHashOf({ product, dir: dirname(chip?.file ?? '') });
};

const mergedOf = (target: string) =>
  JSON.parse(readStampText(join(target, DESIGN_DIR, 'app-a', 'merged.json')) ?? '{}') as Record<string, string>;

const checkoutWithMergedChip = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-check-embedders-settle-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(join(design, 'app-a', VIEWPORT), { recursive: true });
  mkdirSync(join(design, 'app-a', CHIP), { recursive: true });
  writeFileSync(
    join(design, 'app-a', VIEWPORT, 'canvas-viewport.ts'),
    'export default definePart({ states: { default: {} }, describe: { default: "The part at rest." } });\n',
  );
  writeFileSync(chipFile(target), chipSource(BEFORE));
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
  writeFileSync(
    join(design, 'app-a', 'rule-baseline.json'),
    JSON.stringify({
      'ORPHAN-PART': {
        [`${CHIP}: ${CHIP} is used by no page, no other part and no implements link - embed it where it belongs or delete it`]:
          { finding: 'B1', sketch: 'none' },
      },
    }),
  );
  writeFileSync(join(design, 'app-a', 'merged.json'), `${JSON.stringify({ [CHIP]: chipHashOf(target) }, null, 2)}\n`);
  git(target, 'init', '-q');
  git(target, 'config', 'maintenance.auto', 'false');
  git(target, 'config', 'gc.auto', '0');
  commit(target, 'merged chip');

  return target;
};

const run = async (target: string) => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);
  vi.spyOn(console, 'warn').mockImplementation(push);

  const code = await checkSystemRendered({
    target,
    config: readConfig(target) ?? {},
    products: ['app-a'],
    part: VIEWPORT,
    drawPictures: async ({ parts }) => new Map(parts.map((name) => [name, 'not drawn in this spec'])),
  });

  return { code, lines };
};

describe('design check --part settles the committed edits of its embedders', () => {
  const targets: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    targets.splice(0).forEach((target) => rmSync(target, { recursive: true, force: true }));
  });

  it('accepts an embedder edit HEAD holds and records its hash in the stamp cache', async () => {
    const target = checkoutWithMergedChip();
    const before = chipHashOf(target);

    targets.push(target);
    writeFileSync(chipFile(target), chipSource(AFTER));
    commit(target, 'rename the old theme tokens');

    const { code, lines } = await run(target);

    expect(lines.filter((line) => line.includes('changed since its merged hash'))).toEqual([]);
    expect(lines).toContain(`EMBEDDERS PASS ${VIEWPORT}: 1 part`);
    expect(code).toBe(1);
    expect(lines).toContainEqual(expect.stringMatching(/^NO RECORD app-a /));
    expect(chipHashOf(target)).not.toBe(before);
    expect(mergedOf(target)).toEqual({ [CHIP]: chipHashOf(target) });
    expect(git(target, 'status', '--porcelain', '--', join(DESIGN_DIR, 'app-a', 'merged.json'))).toBe('');
  }, 60_000);

  it('leaves an uncommitted embedder edit pending', async () => {
    const target = checkoutWithMergedChip();
    const before = chipHashOf(target);

    targets.push(target);
    writeFileSync(chipFile(target), chipSource(AFTER));

    const { code, lines } = await run(target);

    expect(lines).toContainEqual(expect.stringContaining(`${CHIP} changed since its merged hash`));
    expect(lines).toContainEqual(expect.stringMatching(new RegExp(`^EMBEDDERS FAIL ${VIEWPORT}: 1 of 1`, 'u')));
    expect(code).toBe(1);
    expect(mergedOf(target)).toEqual({ [CHIP]: before });
  }, 60_000);
});
