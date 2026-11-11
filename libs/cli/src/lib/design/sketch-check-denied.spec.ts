import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './design-config';
import { createWarmRuns } from './resident/resident-process';
import { designSketch } from './sketch-command';

const readFreshDist = vi.hoisted(() => vi.fn());

vi.mock('./system/stale-dist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system/stale-dist')>()),
  readFreshDist,
}));

const dirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();

  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const sketchLoadingOutsideFile = async () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-denied-'));
  const outside = realpathSync(mkdtempSync(join(tmpdir(), 'design-denied-app-a-')));
  const stylesheet = join(outside, 'outside.css');
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  dirs.push(target, outside);
  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierignore'), '*\n');
  writeFileSync(stylesheet, '.outside { color: inherit; }\n');
  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);
  vi.spyOn(console, 'warn').mockImplementation(push);

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

  writeFileSync(
    sketchFile,
    readFileSync(sketchFile, 'utf8')
      .replace("note: '", "note: 'named ")
      .replace(
        '<button class="acme-button">',
        `<link rel="stylesheet" href="/@fs${stylesheet}" /><button class="acme-button">`,
      ),
  );

  return { target, stylesheet, lines };
};

describe('sketch check on a sketch that loads a file outside the allow list', () => {
  it('reports the refused request id as a problem', async (context) => {
    const { target, stylesheet, lines } = await sketchLoadingOutsideFile();

    const code = await designSketch({
      target,
      argv: ['check', 'components/button@alt', '--product', 'acme'],
      invocation: 'et design',
    });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines).toContainEqual(expect.stringMatching(new RegExp(`^SERVE-DENIED \\S*${stylesheet}\\S*: `)));
  }, 120_000);

  it('reports it when the check draws through the resident warm process', async (context) => {
    const { target, stylesheet, lines } = await sketchLoadingOutsideFile();
    const runs = createWarmRuns({ target });

    readFreshDist.mockResolvedValue({ ok: true, release: () => undefined });

    const code = await runs
      .run({
        argv: ['sketch', 'check', 'components/button@alt', '--product', 'acme'],
        invocation: 'et design',
        env: {},
      })
      .finally(() => runs.close());

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(readFreshDist).toHaveBeenCalled();
    expect(code).toBe(1);
    expect(lines).toContainEqual(expect.stringMatching(new RegExp(`^SERVE-DENIED \\S*${stylesheet}\\S*: `)));
  }, 120_000);
});
