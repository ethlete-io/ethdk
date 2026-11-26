import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { buildReadyInputsOf, checkRules, checkSystem } from './check-system';
import { resolveProduct } from './resolve-product';
import { gitExec } from '../../git-test-env.fixtures';

const CONFIG = { products: { 'app-a': { presets: { desktop: { width: 1280, height: 800 } } } } };

const CHIP = `import { definePart, drawing } from '@design-system';
export default definePart({ note: 'A chip.', describe: { default: 'at rest' }, states: { default: { label: 'Made up' } }, render: () => drawing({ body: '' }) });
`;

const PAGE = CHIP.replace("label: 'Made up'", '');

const USER = `import chip from '@system/components/chip';\n${PAGE}`;

const checkout = (files: Record<string, string>) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-check-rules-errors-'));
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
    writeFileSync(join(target, DESIGN_DIR, path), text);
  };

  write('config.json', JSON.stringify(CONFIG));
  Object.entries(files).forEach(([path, text]) => write(`app-a/${path}`, text));

  const git = (...args: string[]) => gitExec(args, { cwd: target, stdio: 'pipe' });

  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x');

  return target;
};

const run = (files: Record<string, string>) => {
  const spy = (method: 'error' | 'log' | 'warn') => vi.spyOn(console, method).mockImplementation(() => undefined);
  const errors = spy('error');
  const logs = spy('log');
  const warnings = spy('warn');
  const status = checkRules({ target: checkout(files), config: CONFIG, products: ['app-a'], invocation: 'et design' });
  const lines = (calls: typeof errors) => calls.mock.calls.map(([line]) => String(line));

  return { status, errors: lines(errors), logs: lines(logs), warnings: lines(warnings) };
};

const ruleOf = (line: string) => line.split(' ')[0];

afterEach(() => vi.restoreAllMocks());

describe('checkRules', () => {
  it('fails sample text outside the sample data', () => {
    const { status, errors } = run({
      'components/chip/chip.ts': CHIP,
      'pages/home/home.ts': USER,
    });

    expect(status).toBe(1);
    expect(errors.map(ruleOf)).toEqual(['SAMPLE-TEXT']);
  });

  it('fails a merged part that no page, no part and no implements link uses', () => {
    const { status, errors } = run({
      'components/chip/chip.ts': PAGE,
      'pages/home/home.ts': PAGE,
    });

    expect(status).toBe(1);
    expect(errors.map(ruleOf)).toEqual(['ORPHAN-PART']);
  });

  it('passes a part new in a merge with its own note, not the was-there-before one', () => {
    const target = checkout({ 'components/chip/chip.ts': PAGE, 'pages/home/home.ts': PAGE });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    checkSystem({ target, config: CONFIG, products: ['app-a'] });

    const line = String(error.mock.calls[0]?.[0]);

    error.mockClear();

    expect(checkSystem({ target, config: CONFIG, products: ['app-a'], newParts: [line] })).toBe(0);
    expect(error).not.toHaveBeenCalled();
    expect(warn.mock.calls.map(([text]) => String(text))).toEqual([
      `NOTE (new in this merge; a page must embed it) ${line}`,
    ]);
  });

  it('passes the hits its rule baseline lists and prints them as baselined', () => {
    const entry = { finding: 'B1', sketch: 'components/chip' };
    const { status, errors, logs } = run({
      'components/chip/chip.ts': CHIP,
      'pages/home/home.ts': USER,
      'rule-baseline.json': JSON.stringify({
        'SAMPLE-TEXT': { 'components/chip: "Made up"': entry },
      }),
    });

    expect(logs.filter((line) => line.startsWith('baselined: '))).toHaveLength(1);
    expect({ status, errors }).toEqual({ status: 0, errors: [] });
  });

  it('prints the warnings of the static rules without failing on them', () => {
    const { warnings } = run({
      'pages/home/home.ts': PAGE,
      'pages/home/shared/helpers.ts': 'export const unusedHelper = 1;\n',
    });

    expect(warnings).toContainEqual(expect.stringMatching(/^WARNING UNUSED-EXPORT /u));
  });

  it('records a part whose only rule hits its rule baseline lists as build-ready', () => {
    const target = checkout({
      'components/chip/chip.ts': CHIP,
      'pages/home/home.ts': USER,
      'rule-baseline.json': JSON.stringify({
        'SAMPLE-TEXT': { 'components/chip: "Made up"': { finding: 'B1', sketch: 'components/chip' } },
      }),
    });
    const product = resolveProduct({ target, name: 'app-a', config: readConfig(target)?.products?.['app-a'] ?? {} });

    expect(buildReadyInputsOf(product, { points: [] }).problemsOf('components/chip')).toEqual([]);
  });
});
