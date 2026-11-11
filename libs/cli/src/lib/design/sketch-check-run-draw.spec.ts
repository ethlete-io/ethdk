import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './design-config';
import { aktuellPlaceholderWarnings, identicalRenderLines, variantChangesShown } from './ready-shots';
import { designSketch } from './sketch-command';
import { renderIssuesOf } from './system/render-check';
import { WarmDraw } from './warm-draw';

vi.mock('./ready-shots', () => ({
  aktuellPlaceholderWarnings: vi.fn(async (): Promise<string[]> => []),
  identicalRenderLines: vi.fn(async (): Promise<string[]> => []),
  sampleMarkDriftLines: vi.fn(async (): Promise<string[]> => []),
  identicalRenders: vi.fn(async (): Promise<{ variant: string; sibling: string | null; line: string }[]> => []),
  variantChangesShown: vi.fn(async () => [{ variant: 'a', change: 'variant a changes default' }]),
  variantsThatDoNotLoad: vi.fn(async (): Promise<string[]> => []),
}));

vi.mock('./system/sketch/viewed-shots', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system/sketch/viewed-shots')>()),
  unviewedShotLinesOf: vi.fn((): string[] => []),
}));

vi.mock('./system/render-check', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system/render-check')>()),
  renderIssuesOf: vi.fn(async (): Promise<Awaited<ReturnType<typeof renderIssuesOf>>> => ({
    issues: [],
    warnings: [],
    grids: [],
    drawn: [],
  })),
}));

vi.mock('./system/read-open-points', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system/read-open-points')>()),
  sketchOpenPointsOf: vi.fn(() => ({ added: [], inherited: [] })),
}));

const ID = 'components/button@alt';

const sketched = async () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-check-run-draw-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierignore'), '*\n');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  const created = await designSketch({
    target,
    argv: [
      'new',
      'components/button',
      '--override',
      '--variants',
      'a',
      '--name',
      'alt',
      '--round',
      'R',
      '--note',
      'n',
      '--product',
      'acme',
      '--by',
      'claude-opus-5-5',
    ],
    invocation: 'et design',
  });

  expect(created).toBe(0);

  const sketchFile = join(target, DESIGN_DIR, 'acme/sketches/components-button.alt/a/components/button/button.ts');

  writeFileSync(sketchFile, readFileSync(sketchFile, 'utf8').replace("note: '", "note: 'named "));

  return target;
};

const shotWarms = () => [
  ...vi.mocked(aktuellPlaceholderWarnings).mock.calls.map(([options]) => options.warm),
  ...vi.mocked(identicalRenderLines).mock.calls.map(([options]) => options.warm),
  ...vi.mocked(variantChangesShown).mock.calls.map(([options]) => options.warm),
];

describe('sketch check', { timeout: 120_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('shoots every ready phase on one per-run draw of the warm process, so a later phase reuses earlier shots', async () => {
    const target = await sketched();
    const warm: WarmDraw = { server: vi.fn(), queue: vi.fn() };

    vi.mocked(aktuellPlaceholderWarnings).mockClear();
    vi.mocked(identicalRenderLines).mockClear();
    vi.mocked(variantChangesShown).mockClear();
    vi.mocked(renderIssuesOf).mockClear();

    await designSketch({ target, argv: ['check', ID, '--product', 'acme'], invocation: 'et design', warm });

    const warms = shotWarms();

    expect(warms).toHaveLength(3);
    expect(new Set(warms).size).toBe(1);
    expect(warms[0]).toMatchObject({ server: warm.server, queue: warm.queue, perRun: true });
    expect(vi.mocked(renderIssuesOf).mock.calls[0]?.[0].warm).toBe(warm);
  });

  it('shares one run draw between the shot phases without a warm process', async () => {
    const target = await sketched();

    vi.mocked(aktuellPlaceholderWarnings).mockClear();
    vi.mocked(identicalRenderLines).mockClear();
    vi.mocked(variantChangesShown).mockClear();

    await designSketch({ target, argv: ['check', ID, '--product', 'acme'], invocation: 'et design' });

    const warms = shotWarms();

    expect(warms).toHaveLength(3);
    expect(new Set(warms).size).toBe(1);
    expect(warms[0]?.perRun).toBe(true);
  });

  it('reads the render inspect cache on every check, so a second check of an unchanged variant draws nothing', async () => {
    const target = await sketched();

    vi.mocked(renderIssuesOf).mockClear();

    await designSketch({ target, argv: ['check', ID, '--product', 'acme'], invocation: 'et design' });
    await designSketch({ target, argv: ['check', ID, '--product', 'acme'], invocation: 'et design' });

    const calls = vi.mocked(renderIssuesOf).mock.calls.map(([options]) => options.cached);

    expect(calls).toEqual([true, true]);
  });
});
