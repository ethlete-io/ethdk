import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markLegacy } from './legacy';

const callAt = (options: { target: string; slug: string; body: string }) => {
  const { target, slug, body } = options;
  const folder = join(target, '.ethlete/design/calls', slug);

  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, 'call.ts'),
    `import { defineCall } from '@design-explore';\n\nexport default defineCall({\n${body}});\n`,
  );

  return join(folder, 'call.ts');
};

describe('markLegacy', () => {
  afterEach(() => vi.restoreAllMocks());

  it('marks only the calls of the project that declare no stage', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = mkdtempSync(join(tmpdir(), 'cli-design-legacy-'));
    const old = callAt({ target, slug: 'app/pages/00-home', body: "  eyebrow: 'Home',\n" });
    const staged = callAt({ target, slug: 'app/pages/01-list', body: "  stage: 'page',\n  eyebrow: 'List',\n" });
    const other = callAt({ target, slug: 'other/00-home', body: "  eyebrow: 'Home',\n" });

    expect(markLegacy({ target, argv: ['app'], invocation: 'et design' })).toBe(0);

    expect(readFileSync(old, 'utf8')).toContain("defineCall({\n  legacy: true,\n  eyebrow: 'Home',");
    expect(readFileSync(staged, 'utf8')).not.toContain('legacy');
    expect(readFileSync(other, 'utf8')).not.toContain('legacy');
  });

  it('marks a call once, however often it runs', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = mkdtempSync(join(tmpdir(), 'cli-design-legacy-'));
    const old = callAt({ target, slug: 'app/00-home', body: "  eyebrow: 'Home',\n" });

    markLegacy({ target, argv: ['app'], invocation: 'et design' });
    markLegacy({ target, argv: ['app'], invocation: 'et design' });

    expect(readFileSync(old, 'utf8').match(/legacy: true/g)).toHaveLength(1);
  });

  it('refuses a project that has no calls folder', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = mkdtempSync(join(tmpdir(), 'cli-design-legacy-'));

    expect(markLegacy({ target, argv: ['app'], invocation: 'et design' })).toBe(1);
    expect(error.mock.calls.flat().join('')).toContain('NO PROJECT');
  });
});
