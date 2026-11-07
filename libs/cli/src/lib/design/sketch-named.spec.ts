import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './design-config';
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

describe('a named sketch', { timeout: 120_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('is checked on its own part, readied and merged by its id', async () => {
    const target = acme();
    const lines = output();
    const id = 'components/button@alt';
    const buttonFile = join(target, DESIGN_DIR, 'acme/components/button/button.ts');
    const sketchFile = join(target, DESIGN_DIR, 'acme/sketches/components-button.alt/a/components/button/button.ts');

    expect(
      await write(
        target,
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
      ),
    ).toBe(0);

    const original = readFileSync(sketchFile, 'utf8');

    writeFileSync(sketchFile, original.replace(/^ {2}note: .*$/mu, "  note: ['x'].join(''),"));
    expect(await designSketch({ target, argv: ['check', id, '--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(lines.some((line) => line.includes(`merge cannot write metadata to ${id.split('@')[0]}`))).toBe(true);
    writeFileSync(sketchFile, original.replace("note: '", "note: 'named "));
    vi.mocked(renderIssuesOf).mockClear();

    expect(await designSketch({ target, argv: ['check', id, '--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(lines.some((line) => line.includes('ROUND-NOT-READY'))).toBe(true);
    expect(vi.mocked(renderIssuesOf).mock.calls.length).toBeGreaterThan(0);
    expect(await write(target, 'ready', id, '--product', 'acme')).toBe(0);
    expect(lines.some((line) => line.includes('has problems'))).toBe(false);
    const code = await write(
      target,
      'merge',
      id,
      '--variant',
      'a',
      '--allowed-by',
      'plans/ethlete-studio/contrast.md Findings decisions',
      '--product',
      'acme',
    );
    expect(code).toBe(0);
    expect(lines.some((line) => line.includes(`merged ${id} variant a into acme`))).toBe(true);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button.alt'))).toBe(false);
    expect(readFileSync(buttonFile, 'utf8')).toContain('named ');
  });
});
