import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './design-config';
import { variantsThatDoNotLoad } from './ready-shots';
import { designSketch } from './sketch-command';
import { renderIssuesOf } from './system/render-check';
import { findSketch } from './system/sketch/sketch';

vi.mock('./ready-shots', () => {
  const identicalRenderLines = vi.fn<(options: object) => Promise<string[]>>(async () => []);

  return {
    aktuellPlaceholderWarnings: vi.fn(async (): Promise<string[]> => []),
    identicalRenderLines,
    sketchRenderLines: vi.fn(async (options: object) => ({
      refusals: await identicalRenderLines(options),
      warnings: [],
    })),
    sampleMarkDriftLines: vi.fn(async (): Promise<string[]> => []),
    identicalRenders: vi.fn(async (): Promise<{ variant: string; sibling: string | null; line: string }[]> => []),
    variantChangesShown: vi.fn(async () => [{ variant: 'a', changed: 1, change: 'variant a changes default' }]),
    variantsThatDoNotLoad: vi.fn(async (): Promise<string[]> => []),
  };
});

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
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-new-ready-'));

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

const open = (target: string, ...extra: string[]) =>
  designSketch({
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
      ...extra,
    ],
    invocation: 'et design',
  });

const statusOf = (target: string) => {
  const found = findSketch({
    productDir: join(target, DESIGN_DIR, 'acme'),
    product: 'acme',
    sketch: { layer: 'components', name: 'button', sketch: 'alt' },
  });

  return typeof found === 'object' && found !== null ? found.status : null;
};

describe('sketch new --ready', { timeout: 120_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('checks the new sketch and marks it ready in the same command', async () => {
    const target = acme();
    const lines = output();

    expect(await open(target, '--ready')).toBe(0);
    expect(lines).toContain('components/button@alt is ready');
    expect(statusOf(target)).toBe('ready');
  });

  it('fails loudly and leaves the sketch in progress when ready refuses', async () => {
    const target = acme();
    const lines = output();

    vi.mocked(variantsThatDoNotLoad).mockResolvedValue(['a does not load']);

    expect(await open(target, '--ready')).toBe(1);
    expect(lines.some((line) => line.includes('is still in progress'))).toBe(true);
    expect(statusOf(target)).toBe('in progress');
  });

  it('leaves the sketch in progress without --ready', async () => {
    const target = acme();

    output();

    expect(await open(target)).toBe(0);
    expect(statusOf(target)).toBe('in progress');
  });
});
