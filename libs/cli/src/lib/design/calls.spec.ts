import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { listCalls } from './calls';
import { markTransferred } from './legacy';
import { callsRootOf, readConfig } from './paths';
import { createDesignServer } from './serve';

const cwd = process.cwd();
const closing: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closing.splice(0).map((close) => close()));
  process.chdir(cwd);
});

const callOf = (lines: string) => `import { defineCall } from '@design-explore';

export default defineCall({
${lines}  eyebrow: 'Old',
  headline: 'An old call',
  intro: '',
  frameWidth: 640,
  variants: [{ key: 'a', name: 'First', load: () => import('./variants/a') }],
});
`;

const withCalls = (calls: Record<string, string>) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-calls-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  for (const [slug, text] of Object.entries(calls)) {
    const file = join(callsRootOf(target), slug, 'call.ts');

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }

  return target;
};

const callText = (target: string, slug: string) => readFileSync(join(callsRootOf(target), slug, 'call.ts'), 'utf8');

describe('listCalls', () => {
  it('lists the calls of every project with their flags and variants, and a broken one with its error', async () => {
    const target = withCalls({
      'acme/home/hero': callOf('  legacy: true,\n  transferred: true,\n'),
      'other/menu': callOf("  stage: 'component',\n"),
      'other/broken': 'throw new Error("no call here");\n',
    });
    const vite = await createDesignServer({ target, config: readConfig(target) ?? {}, listen: false });

    closing.push(() => vite.close());

    const calls = await listCalls({ target, load: (file) => vite.ssrLoadModule(file) });

    expect(calls).toEqual([
      {
        slug: 'acme/home/hero',
        project: 'acme',
        eyebrow: 'Old',
        headline: 'An old call',
        stage: null,
        legacy: true,
        transferred: true,
        closed: null,
        frameWidth: 640,
        variants: [{ key: 'a', name: 'First' }],
      },
      { slug: 'other/broken', project: 'other', error: expect.stringContaining('no call here') },
      expect.objectContaining({ slug: 'other/menu', stage: 'component', legacy: false, transferred: false }),
    ]);
  });

  it('lists nothing for a workspace without calls', async () => {
    expect(await listCalls({ target: withCalls({}), load: async () => ({}) })).toEqual([]);
  });
});

describe('markTransferred', () => {
  it('writes transferred: true below legacy: true, once', () => {
    const target = withCalls({ 'acme/hero': callOf('  legacy: true,\n') });

    expect(markTransferred({ target, slug: 'acme/hero' })).toBe('marked');
    expect(markTransferred({ target, slug: 'acme/hero' })).toBe('already');
    expect(callText(target, 'acme/hero')).toContain(
      'export default defineCall({\n  legacy: true,\n  transferred: true,\n  eyebrow',
    );
  });

  it('writes it at the top of a call that is not legacy', () => {
    const target = withCalls({ 'acme/hero': callOf('') });

    expect(markTransferred({ target, slug: 'acme/hero' })).toBe('marked');
    expect(callText(target, 'acme/hero')).toContain('defineCall({\n  transferred: true,\n  eyebrow');
  });

  it('refuses a call it can not find or read', () => {
    const target = withCalls({ 'acme/odd': 'export default {};\n' });

    expect(markTransferred({ target, slug: 'acme/none' })).toBe('missing');
    expect(markTransferred({ target, slug: '../acme/odd' })).toBe('missing');
    expect(markTransferred({ target, slug: '' })).toBe('missing');
    expect(markTransferred({ target, slug: 'acme/odd' })).toBe('unreadable');
    expect(callText(target, 'acme/odd')).toBe('export default {};\n');
  });
});
