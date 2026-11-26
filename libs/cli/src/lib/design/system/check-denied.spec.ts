import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { DESIGN_DIR } from '../design-config';
import { acme, output } from './check-system.fixtures';

const dirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();

  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('checkDesign on a drawing that loads a file outside the allow list', () => {
  it('reports the refused request id as a problem', async (context) => {
    const target = acme();
    const outside = realpathSync(mkdtempSync(join(tmpdir(), 'design-denied-app-a-')));
    const stylesheet = join(outside, 'outside.css');
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    dirs.push(target, outside);
    writeFileSync(stylesheet, '.outside { color: inherit; }\n');
    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        '<h1>${film.title}</h1>',
        `<link rel="stylesheet" href="/@fs${stylesheet}" /><h1>\${film.title}</h1>`,
      ),
    );

    const lines = output();
    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines).toContainEqual(expect.stringMatching(new RegExp(`^SERVE-DENIED \\S*${stylesheet}\\S*: `)));
  }, 120_000);
});
