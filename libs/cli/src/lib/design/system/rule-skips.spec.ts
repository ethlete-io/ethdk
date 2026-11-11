import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { checkRules } from './check-system';
import { gitExec } from '../../git-test-env.fixtures';

const CONFIG = { products: { 'app-a': { presets: { desktop: { width: 1280, height: 800 } } } } };

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-rule-skips-'));
  const file = join(target, DESIGN_DIR, 'app-a', 'components', 'chip', 'chip.ts');

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `export default definePart({ states: { default: {} } });\n`);
  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify(CONFIG));

  const git = (...args: string[]) => gitExec(args, { cwd: target, stdio: 'pipe' });

  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x');

  return target;
};

const run = (base?: string) => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const logs = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const status = checkRules({
    target: checkout(),
    config: CONFIG,
    products: ['app-a'],
    base,
    invocation: 'et design',
  });
  const lines = (spy: typeof errors) => spy.mock.calls.map(([line]) => String(line));

  return { status, errors: lines(errors), logs: lines(logs) };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('rule skips', () => {
  it('prints a note for a rule skipped without --base and passes outside CI', () => {
    vi.stubEnv('CI', '');

    const { status, errors, logs } = run();

    expect(errors).toEqual([]);
    expect(status).toBe(0);
    expect(logs).toContain('skipped IMPLEMENTATION-UNCOMPARED for app-a: no --base given');
  });

  it('fails a rule skipped without --base under CI', () => {
    vi.stubEnv('CI', 'true');

    const { status, errors, logs } = run();

    expect(status).toBe(1);
    expect(errors).toContain(
      'SKIPPED IMPLEMENTATION-UNCOMPARED for app-a: no --base given - a rule may not skip on a missing input under CI',
    );
    expect(logs.at(-1)).toBe('1 problem(s) in app-a.');
  });

  it('keeps a rule that does not apply to the product a note under CI', () => {
    vi.stubEnv('CI', 'true');

    const { status, errors, logs } = run('HEAD');

    expect(status).toBe(0);
    expect(errors).toEqual([]);
    expect(logs).toEqual(
      expect.arrayContaining([
        'skipped NATIVE-TITLE for app-a: config.json does not set nativeTitle: "deny"',
        'skipped CANONICAL-CLASS for app-a: the product and its base list no styles in config.json',
      ]),
    );
    expect(logs.some((line) => line.includes('IMPLEMENTATION-UNCOMPARED'))).toBe(false);
  });
});
