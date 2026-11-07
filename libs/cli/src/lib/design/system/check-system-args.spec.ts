import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { DESIGN_DIR } from '../paths';
import { acme, output, withoutBrowserLines, renderWarningsOf } from './check-system.fixtures';

describe('checkDesign', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('fails on an implements path that does not exist', async () => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        'definePart<HeroProps>({',
        "definePart<HeroProps>({ implements: 'src/gone.component.ts',",
      ),
    );

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(withoutBrowserLines(lines)).toEqual([expect.stringMatching(/^IMPLEMENTS-MISSING .*hero\.ts: "src\/gone/)]);
  }, 60_000);

  it('ends with one line per part with findings and the count of the clean parts', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { border-color: #fff; }');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(lines.filter((line) => /^PARTS? /u.test(line))).toEqual([
      `PART acme components/button: ${renderWarningsOf(lines).length > 0 ? '1 warning, ' : ''}3 open points`,
      'PART acme elements/hero: 1 problem (HARD-CODED-COLOUR), 1 open point',
      'PART acme components/card: 3 open points',
      'PARTS acme: 2 of 4 clean',
    ]);
  }, 60_000);

  it('ends with a count per rule, zeros included, then the complete line', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { border-color: #fff; }');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(lines).toContain('HARD-CODED-COLOUR 1');
    expect(lines).toContain('CONTROL-STATE 0');
    expect(lines).toContain('NESTED-SCROLL 0');
    expect(lines.at(-1)).toBe('check complete: 4 parts, 1 finding');
    expect(lines.indexOf('NESTED-SCROLL 0')).toBeGreaterThan(lines.findIndex((line) => line.startsWith('PARTS ')));
  }, 60_000);

  it('keeps only the findings of one part with --part', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { border-color: #fff; }');
    writeFileSync(join(target, DESIGN_DIR, 'acme/components/button/button.css'), '.acme-button { color: #000; }');

    expect(
      await checkDesign({ target, argv: ['--product', 'acme', '--part', 'elements/hero'], invocation: 'et design' }),
    ).toBe(1);
    expect(lines.filter((line) => /^(HARD-CODED-COLOUR \.|PARTS? |OPEN POINTS| {2})/.test(line))).toEqual([
      expect.stringMatching(/^HARD-CODED-COLOUR .*hero\.css: #fff/),
      'OPEN POINTS acme: 1 in 1 part',
      '  elements/hero: no controls declared',
      'PART acme elements/hero: 1 problem (HARD-CODED-COLOUR), 1 open point',
    ]);
    expect(lines).toContainEqual(expect.stringMatching(/^NO RECORD acme elements\/hero: open-point: .*\(\+1 more\)$/));
  }, 60_000);

  it('runs only the static rules with --rules, and fails on a problem', async () => {
    vi.stubEnv('CI', '');

    const target = acme();
    const lines = output();
    const unskipped = () => lines.filter((line) => !line.startsWith('skipped '));

    expect(await checkDesign({ target, argv: ['--product', 'acme', '--rules'], invocation: 'et design' })).toBe(0);
    expect(unskipped()).toEqual(['No static design rule finds a problem.']);
    expect(lines).toContain('skipped IMPLEMENTATION-UNCOMPARED for acme: no --base given');

    lines.length = 0;
    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { border-color: #fff; }');

    expect(await checkDesign({ target, argv: ['--product', 'acme', '--rules'], invocation: 'et design' })).toBe(1);
    expect(unskipped()).toEqual([
      expect.stringMatching(/^HARD-CODED-COLOUR .*hero\.css: #fff/),
      '1 problem(s) in acme.',
    ]);

    lines.length = 0;

    expect(await checkDesign({ target, argv: ['--product', 'acme', 'gone', '--rules'], invocation: 'et design' })).toBe(
      1,
    );
    expect(lines.at(-1)).toBe('2 problem(s) in acme, gone.');
  }, 60_000);

  it('finds the product of a part without --product, and refuses an unknown part', async () => {
    const lines = output();

    expect(await checkDesign({ target: acme(), argv: ['--part', 'pages/home'], invocation: 'et design' })).toBe(0);
    expect(lines.filter((line) => /^PARTS? /u.test(line))).toEqual([expect.stringMatching(/^PART acme pages\/home: /)]);
    expect(lines).toContain('actions pages/home: skipped - no implements link, nothing to click');
    expect(await checkDesign({ target: acme(), argv: ['--part', 'pages/gone'], invocation: 'et design' })).toBe(1);
    expect(lines.at(-1)).toBe('NO PART "pages/gone" in any product of config.json.');
  }, 60_000);
});
