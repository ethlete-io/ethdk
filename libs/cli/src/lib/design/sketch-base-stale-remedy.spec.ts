import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from './design-config';
import { designSketch } from './sketch-command';
import { renderIssuesOf } from './system/render-check';
import { resolveProduct } from './system/resolve-product';
import { mergeSketch } from './system/sketch/merge';
import { decideSketch, listSketches, markSketchReady, Sketch } from './system/sketch/sketch';
import { originOf } from './system/write-origin';
import { gitExec } from '../git-test-env.fixtures';

vi.mock('./ready-shots', () => ({
  aktuellPlaceholderWarnings: vi.fn(async (): Promise<string[]> => []),
  identicalRenderLines: vi.fn(async (): Promise<string[]> => []),
  sampleMarkDriftLines: vi.fn(async (): Promise<string[]> => []),
  sketchRenderLines: vi.fn(async () => ({ refusals: [] as string[], warnings: [] as string[] })),
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

const HERO = 'elements/hero';
const MODEL = 'claude-opus-5-5';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-stale-remedy-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierignore'), '*\n');

  return target;
};

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);
  vi.spyOn(console, 'warn').mockImplementation(push);

  return lines;
};

const run = (target: string, argv: string[]) => designSketch({ target, argv, invocation: 'et design' });

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const heroSketchOf = (target: string) =>
  listSketches({ productDir: resolveAcme(target).dir, product: 'acme' }).find(
    (sketch): sketch is Sketch => typeof sketch !== 'string' && sketch.target === HERO,
  ) as Sketch;

const REBASE_REMEDY = /then run (?:et design )?sketch (rebase\b.*)$/mu;

const remedyOf = (text: string, last: string[]) => {
  const named = REBASE_REMEDY.exec(text)?.[1];

  if (named === undefined) return null;
  if (named === 'rebase again') return last;

  return named.replace('<model id>', MODEL).split(' ');
};

describe('SKETCH-BASE-STALE on a sketch drawn on an uncommitted state of its own part', { timeout: 120_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('clears by following the named remedies, and the sketch then merges', async () => {
    const target = acme();
    const lines = output();
    const git = (...args: string[]) =>
      gitExec(['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: target, encoding: 'utf8' }).trim();
    const css = join(target, DESIGN_DIR, 'acme', HERO, 'hero.css');

    git('init', '-q');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    writeFileSync(css, '.acme-hero { padding: 0; }\n');

    expect(await run(target, ['new', HERO, '--variants', 'a', '--note', 'n', '--product', 'acme', '--by', MODEL])).toBe(
      0,
    );

    writeFileSync(css, '.acme-hero { padding: 1px; }\n');
    lines.length = 0;
    await run(target, ['check', '--product', 'acme']);

    const stale = lines.find((line) => line.startsWith(`SKETCH-BASE-STALE acme ${HERO}:`)) ?? '';

    expect(stale).toContain('bring each variant up to date');

    writeFileSync(join(heroSketchOf(target).dir, 'a', HERO, 'hero.css'), '.acme-hero { padding: 1px; }\n');

    let remedy = remedyOf(stale, []);
    const attempts: string[] = [];
    const refusals: string[] = [];

    while (remedy !== null && attempts.length < 3) {
      lines.length = 0;
      attempts.push(remedy.join(' '));

      if ((await run(target, remedy)) === 0) break;

      refusals.push(lines.at(-1) ?? '');

      remedy = remedyOf(lines.join('\n'), remedy);
    }

    expect({ attempts, refusals }).toEqual({
      attempts: [`rebase ${HERO} --product acme --by ${MODEL}`],
      refusals: [],
    });

    lines.length = 0;
    await run(target, ['check', '--product', 'acme']);

    expect(lines.filter((line) => line.startsWith('SKETCH-BASE-STALE acme'))).toEqual([]);

    const sketch = decideSketch({
      sketch: markSketchReady({ checkout: target, sketch: heroSketchOf(target) }) as Sketch,
      decision: { kind: 'pick', variant: 'a', ...originOf('designer') },
    }) as Sketch;
    const merged = () =>
      mergeSketch({ target, config: readConfig(target) ?? {}, product: resolveAcme(target), sketch });

    expect(merged()).toMatchObject({ reason: expect.stringContaining(`commit ${HERO} first, then merge ${HERO}`) });

    git('commit', '-q', '-m', 'hero', '--', css);

    expect(merged()).toEqual([HERO]);
  });
});
