import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CALL_STAGES, newCall } from './new-call';
import { statusPath } from './status';

const calls = (target: string) => join(target, '.ethlete/design/calls');

describe('newCall', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes call.ts, fixture.ts and one drawing per variant key', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const target = mkdtempSync(join(tmpdir(), 'cli-design-new-'));

    expect(newCall({ target, argv: ['app/checkout/01-summary', '--variants', 'a,b,c'], invocation: 'et design' })).toBe(
      0,
    );

    const folder = join(calls(target), 'app/checkout/01-summary');
    const call = readFileSync(join(folder, 'call.ts'), 'utf8');
    expect(existsSync(join(folder, 'fixture.ts'))).toBe(true);
    expect(['a', 'b', 'c'].map((key) => existsSync(join(folder, `variant-${key}.ts`)))).toEqual([true, true, true]);
    expect(call).toContain("load: () => import('./variant-c')");
    expect(
      JSON.parse(readFileSync(statusPath({ checkout: target, slug: 'app/checkout/01-summary' }), 'utf8')).state,
    ).toBe('scaffolded');
  });

  it('refuses a slug whose folder exists, so a drawing is never overwritten', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = mkdtempSync(join(tmpdir(), 'cli-design-new-'));

    newCall({ target, argv: ['app/one'], invocation: 'et design' });

    expect(newCall({ target, argv: ['app/one'], invocation: 'et design' })).toBe(1);
    expect(error.mock.calls.flat().join('')).toContain('CALL EXISTS');
  });

  it('refuses a slug without a project segment', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = mkdtempSync(join(tmpdir(), 'cli-design-new-'));

    expect(newCall({ target, argv: ['Summary'], invocation: 'et design' })).toBe(2);
    expect(existsSync(calls(target))).toBe(false);
  });

  it('writes the stage into call.ts and leads the eyebrow with the project', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const target = mkdtempSync(join(tmpdir(), 'cli-design-new-'));

    expect(newCall({ target, argv: ['--stage', 'component', 'app/one'], invocation: 'et design' })).toBe(0);

    const call = readFileSync(join(calls(target), 'app/one/call.ts'), 'utf8');
    expect(call).toContain("stage: 'component',");
    expect(call).toContain("eyebrow: 'App · Component',");
  });

  it('refuses a stage the call API does not know', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = mkdtempSync(join(tmpdir(), 'cli-design-new-'));

    expect(newCall({ target, argv: ['app/one', '--stage', 'sketch'], invocation: 'et design' })).toBe(2);
  });

  it('lists the stages of the call API', () => {
    const declared = /export type CallStage = ([^;]+);/.exec(
      readFileSync(join(__dirname, '../../../design/define-call.ts'), 'utf8'),
    )?.[1];

    expect(declared?.split('|').map((stage) => stage.trim().replace(/'/g, ''))).toEqual(CALL_STAGES);
  });

  it('draws each variant with ng() when the project names providers, and plain html otherwise', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const target = mkdtempSync(join(tmpdir(), 'cli-design-new-'));
    mkdirSync(join(target, '.ethlete/design'), { recursive: true });
    writeFileSync(
      join(target, '.ethlete/design/config.json'),
      JSON.stringify({ projects: { app: { providers: 'providers.ts' }, bare: {} } }),
    );

    newCall({ target, argv: ['app/one'], invocation: 'et design' });
    newCall({ target, argv: ['bare/one'], invocation: 'et design' });

    expect(readFileSync(join(calls(target), 'app/one/variant-a.ts'), 'utf8')).toContain("imports: ['BUTTON_IMPORTS']");
    expect(readFileSync(join(calls(target), 'bare/one/variant-a.ts'), 'utf8')).not.toContain('await ng(');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain('`providers`');
  });
});
