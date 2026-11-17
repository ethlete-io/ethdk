import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignConfig } from './design-config';
import { designCommand } from './design-command';
import { couldNotRenderText, failedText, withFailureExit } from './failure-line';
import { aktuellPlaceholderWarnings } from './ready-shots';
import { designSketch } from './sketch-command';
import { designCompare } from './system/compare-command';
import { ResolvedProduct } from './system/resolve-product';
import { Sketch } from './system/sketch/sketch';

vi.mock('./sketch-command', async (importOriginal) => ({ ...(await importOriginal<object>()), designSketch: vi.fn() }));
vi.mock('./system/compare-command', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  designCompare: vi.fn(),
}));
vi.mock('./system/stale-design-mocks', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  designMocksFresh: () => true,
}));

const SRC = join(__dirname, '../..');
const FAILURE_WORDS = /\bFAILED\b|could not render/;

const sourceFilesOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFilesOf(path);

    return /\.(ts|mts|mjs|js)$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      ? [path]
      : [];
  });

const failureWordsOf = (path: string) => {
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isStringLiteralLike(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      FAILURE_WORDS.test((node as ts.LiteralLikeNode).text)
    )
      found.push(`${relative(SRC, path)}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);

    ts.forEachChild(node, visit);
  };

  visit(file);

  return found;
};

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-failure-line-'));

  mkdirSync(join(target, '.ethlete/design'), { recursive: true });
  writeFileSync(join(target, '.ethlete/design/config.json'), '{}');

  return target;
};

describe('failure lines of the design commands', () => {
  beforeEach(() => vi.stubEnv('ETHLETE_DESIGN_RESIDENT', '0'));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('are spelled only by failure-line.ts, so each one is caught on its way out', () => {
    const outside = sourceFilesOf(SRC)
      .filter((path) => !path.endsWith(join('design', 'failure-line.ts')))
      .flatMap(failureWordsOf);

    expect(outside).toEqual([]);
  });

  it('make `sketch check` exit 1 when it could not render, even though it answered 0', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.mocked(designSketch).mockImplementation(async () => {
      const warnings = await aktuellPlaceholderWarnings({
        target: '/nowhere',
        config: {} as DesignConfig,
        product: {} as ResolvedProduct,
        sketch: { target: 'pages/system' } as Sketch,
      });

      warnings.forEach((warning) => console.warn(warning));

      return 0;
    });

    await expect(
      designCommand({ root: checkout(), argv: ['sketch', 'check', 'pages/system'], invocation: 'et design' }),
    ).resolves.toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^ready will refuse: could not render pages\/system: /));
  });

  it('make `compare` exit 1 when it printed a FAILED state, even though it answered 0', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.mocked(designCompare).mockImplementation(async () => {
      console.log(`canvas-note ${failedText('the design draws 1 overlay pane, the app opened 0')}`);

      return 0;
    });

    await expect(
      designCommand({ root: checkout(), argv: ['compare', 'pages/system'], invocation: 'et design' }),
    ).resolves.toBe(1);
    expect(log).toHaveBeenCalledWith('canvas-note FAILED the design draws 1 overlay pane, the app opened 0');
  });

  it('keep a higher exit code and leave a clean run at 0', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      withFailureExit(async () => {
        console.error(couldNotRenderText('pages/system', 'port in use'));

        return 2;
      }),
    ).resolves.toBe(2);
    await expect(withFailureExit(async () => (console.error('the shots failed: timeout'), 0))).resolves.toBe(0);
  });

  it('count a failure line written straight to stdout, and restore the streams', async () => {
    const write = process.stdout.write;
    const written = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await expect(
      withFailureExit(async () => {
        process.stdout.write(`RENDER CHECK ${failedText('- no usable browser: none')}\n`);

        return 0;
      }),
    ).resolves.toBe(1);
    expect(written).toHaveBeenCalledTimes(1);
    written.mockRestore();
    expect(process.stdout.write).toBe(write);
  });
});
