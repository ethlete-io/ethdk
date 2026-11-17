import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './design-config';
import { identicalRenderLines, identicalRenders } from './ready-shots';
import { designSketch } from './sketch-command';
import { partHashOf } from './system/sketch/baseline';
import { renderIssuesOf } from './system/render-check';
import { resolveProduct } from './system/resolve-product';
import { openEditSketch } from './system/sketch/edit-sketch';
import { readMerged, recordMerged } from './system/sketch/merged-parts';
import { gitExec } from '../git-test-env.fixtures';

vi.mock('./ready-shots', () => {
  const identicalRenders = vi.fn<
    (options: object) => Promise<{ variant: string; sibling: string | null; everyState: boolean; line: string }[]>
  >(async () => []);
  const identicalRenderLines = vi.fn(async (options: object) =>
    (await identicalRenders(options)).map((render) => render.line),
  );

  return {
    aktuellPlaceholderWarnings: vi.fn(async (): Promise<string[]> => []),
    identicalRenderLines,
    identicalRenders,
    sketchRenderLines: vi.fn(async (options: object) => ({
      refusals: await identicalRenderLines(options),
      warnings: [],
    })),
    sampleMarkDriftLines: vi.fn(async (): Promise<string[]> => []),
    variantChangesShown: vi.fn(async () => []),
    variantsThatDoNotLoad: vi.fn(async (): Promise<string[]> => []),
  };
});

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

const HERO = 'elements/hero';

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);
  vi.spyOn(console, 'warn').mockImplementation(push);

  return lines;
};

const pickedEditSketch = async () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-edit-held-'));
  const git = (...args: string[]) => gitExec(args, { cwd: target, encoding: 'utf8' });
  const commit = () => git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'c');
  const productOf = () => resolveProduct({ target, name: 'acme', config: {} });
  const heroCss = join(target, DESIGN_DIR, 'acme', HERO, 'hero.css');

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierignore'), '*\n');
  git('init', '-q');
  recordMerged({ product: productOf(), parts: [HERO] });
  git('add', '-A');
  commit();
  appendFileSync(heroCss, '/* same pixels */\n');

  const opened = await openEditSketch({ target, product: productOf(), part: HERO, author: 'design check' });

  if (typeof opened === 'string' || 'rule' in opened) throw new Error(String(opened));

  const file = join(opened.dir, 'sketch.json');

  writeFileSync(
    file,
    JSON.stringify({
      ...JSON.parse(readFileSync(file, 'utf8')),
      status: 'in progress',
      decision: { kind: 'pick', variant: 'new', by: 'designer', decidedAt: '2026-11-17T00:00:00.000Z' },
    }),
  );
  git('add', '-A');
  commit();

  return { target, productOf, sketchDir: opened.dir, heroDir: dirname(heroCss) };
};

describe('sketch ready on an edit sketch whose variants draw the same pixels', { timeout: 120_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('holds the direct edit and closes the sketch instead of asking for a withdraw', async () => {
    const { target, productOf, sketchDir, heroDir } = await pickedEditSketch();
    const lines = output();

    vi.mocked(identicalRenders).mockResolvedValue([
      { variant: 'new', sibling: null, everyState: true, line: `${HERO}@edit variant new draws like Aktuell` },
      { variant: 'old', sibling: 'new', everyState: true, line: `${HERO}@edit variant old draws like variant new` },
    ]);

    expect(
      await designSketch({
        target,
        argv: ['ready', `${HERO}@edit`, '--no-visible-change', '--product', 'acme', '--by', 'claude-opus-5-5'],
        invocation: 'et design',
      }),
      lines.join('\n'),
    ).toBe(0);
    expect(existsSync(sketchDir)).toBe(false);
    expect(readMerged(productOf().dir)[HERO]).toBe(partHashOf({ product: productOf(), dir: heroDir }));
    expect(vi.mocked(identicalRenderLines)).not.toHaveBeenCalled();
  });

  it('keeps refusing when old draws a state differently', async () => {
    const { target, sketchDir } = await pickedEditSketch();
    const lines = output();

    vi.mocked(identicalRenders).mockResolvedValue([
      { variant: 'new', sibling: null, everyState: true, line: `${HERO}@edit variant new draws like Aktuell` },
      { variant: 'old', sibling: 'new', everyState: false, line: `${HERO}@edit variant old first changes like new` },
    ]);

    expect(
      await designSketch({
        target,
        argv: ['ready', `${HERO}@edit`, '--product', 'acme', '--by', 'claude-opus-5-5'],
        invocation: 'et design',
      }),
    ).toBe(1);
    expect(existsSync(sketchDir)).toBe(true);
    expect(lines.join('\n')).toContain('draws variants alike');
  });
});
