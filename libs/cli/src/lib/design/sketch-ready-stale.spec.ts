import { execFileSync } from 'child_process';
import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './paths';
import { designSketch } from './sketch-command';
import { renderIssuesOf } from './system/render-check';

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

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-named-'));

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

const write = (target: string, ...argv: string[]) =>
  designSketch({ target, argv: [...argv, '--by', 'claude-opus-5-5'], invocation: 'et design' });

describe('sketch ready on a stale base', { timeout: 120_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('refuses with the SKETCH-BASE-STALE line the check prints', async () => {
    const target = acme();
    const lines = output();

    expect(await write(target, 'new', 'pages/home', '--variants', 'a', '--note', 'n', '--product', 'acme')).toBe(0);
    const git = (...args: string[]) => execFileSync('git', args, { cwd: target, encoding: 'utf8' }).trim();
    const commit = (message: string) =>
      git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', message);

    git('init', '-q');
    git('add', '-A');
    commit('drawn');
    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');
    git('add', '-A');
    commit('hero');

    const heroCommit = git('rev-parse', '--short', 'HEAD');

    expect(await write(target, 'ready', 'pages/home', '--product', 'acme')).toBe(1);

    const line =
      'SKETCH-BASE-STALE acme pages/home: elements/hero changed since the sketch was drawn - bring each variant up to date, then run et design sketch rebase pages/home --product acme --by <model id>';

    expect(lines.some((entry) => entry.includes(line))).toBe(true);
    expect(
      lines.some((entry) =>
        entry.includes(`pages/home is stale (base changed in ${heroCommit}) - rebase it before ready`),
      ),
    ).toBe(true);

    lines.length = 0;
    expect(await designSketch({ target, argv: ['check', '--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(lines).toContain(line);
  });
});
