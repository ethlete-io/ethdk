import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newCall } from './new-call';

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
});
