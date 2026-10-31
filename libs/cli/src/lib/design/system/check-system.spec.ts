import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { DESIGN_DIR, readConfig } from '../paths';
import { checkSystem, summaryText } from './check-system';
import { resolveProduct } from './resolve-product';
import { recordMerged } from './sketch/merged-parts';
import { createSketch, variantDirOf } from './sketch/sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

const withoutOpenPoints = (lines: string[]) =>
  lines.filter(
    (line) =>
      !line.startsWith('OPEN POINTS ') &&
      !line.startsWith('UNLINKED ') &&
      !line.startsWith('  ') &&
      !line.startsWith('PART ') &&
      !line.startsWith('PARTS '),
  );

const renderWarningsOf = (lines: string[]) =>
  lines.some((line) => line.startsWith('RENDER CHECK SKIPPED'))
    ? []
    : [expect.stringMatching(/^WARNING CONTROL-PART-INPUT acme components\/button /)];

const check = (target: string, products: string[]) =>
  checkSystem({ target, config: readConfig(target) ?? {}, products });

describe('checkSystem', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes the clean fixture, types included', () => {
    const lines = output();

    expect(check(acme(), ['acme'])).toBe(0);
    expect(lines).toEqual(['ok']);
  }, 60_000);

  it('prints each problem as rule, file and message', () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { color: #fff; }');

    expect(check(target, ['acme'])).toBe(1);
    expect(lines).toEqual([
      `HARD-CODED-COLOUR ${DESIGN_DIR}/acme/elements/hero/hero.css: #fff outside foundations - use a foundations token`,
    ]);
  }, 60_000);

  it('fails on an interaction Studio does not know', () => {
    const target = acme();
    const lines = output();
    const button = join(target, DESIGN_DIR, 'acme/components/button/button.ts');

    writeFileSync(button, readFileSync(button, 'utf8').replace("'active'", "'pressed'"));

    expect(check(target, ['acme'])).toBe(1);
    expect(lines[0]).toBe(
      `INTERACTIONS ${DESIGN_DIR}/acme/components/button/button.ts: unknown interaction "pressed" - interactions are hover, focus-visible, active, disabled; rest is always drawn, and pressed or loading is a state`,
    );
  }, 60_000);

  it('types a page drawn with the wireframe kit and fails a component that imports it', () => {
    const target = acme();
    const lines = output();
    const kitPart = `import { definePart, drawing } from '@design-system';
import { box, button, icon, image, input, textLines } from '@design-system/kit';
export default definePart({
  note: '',
  states: { rest: {} },
  render: () => drawing({ body: box([icon(), image({ height: 80 }), textLines({ lines: 2 }), input({ label: 'Mail' }), button('Go', { primary: true })], { direction: 'column' }), styles: '' }),
});
`;

    writeFileSync(join(target, DESIGN_DIR, 'acme/pages/home/home.ts'), kitPart);

    expect(check(target, ['acme'])).toBe(0);

    writeFileSync(join(target, DESIGN_DIR, 'acme/components/button/button.ts'), kitPart);
    lines.length = 0;

    expect(check(target, ['acme'])).toBe(1);
    expect(lines).toEqual([
      `WIREFRAME-KIT ${DESIGN_DIR}/acme/components/button/button.ts: components may not use @design-system/kit - only elements and pages draw with the wireframe kit`,
    ]);
  }, 60_000);

  it('lets a page import a named helper of a foundation, and refuses a foundation that imports one of a page', () => {
    const target = acme();
    const lines = output();
    const palette = join(target, DESIGN_DIR, 'acme/foundations/palette/palette.ts');
    const home = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');

    writeFileSync(palette, `${readFileSync(palette, 'utf8')}\nexport const accent = (): string => 'Accent';\n`);
    writeFileSync(
      home,
      `import { accent } from '@system/foundations/palette';\n${readFileSync(home, 'utf8').replace('<main>', '<main>${accent()}')}`,
    );

    expect(check(target, ['acme'])).toBe(0);
    expect(lines).toEqual(['ok']);

    lines.length = 0;
    writeFileSync(
      palette,
      `import { HomeProps } from '@system/pages/home';\n${readFileSync(palette, 'utf8')}\nexport type Films = HomeProps['films'];\n`,
    );

    expect(check(target, ['acme'])).toBe(1);
    expect(lines).toEqual([expect.stringMatching(/^UPWARD-DEPENDENCY .*palette\.ts: /)]);
  }, 60_000);

  it('fails on a type error', () => {
    const target = acme();
    const lines = output();

    writeFileSync(
      join(target, DESIGN_DIR, 'acme/pages/home/home.ts'),
      "import { definePart } from '@design-system';\nexport default definePart({ states: {}, render: () => ({ body: '', styles: '' }) });\n",
    );

    expect(check(target, ['acme'])).toBe(1);
    expect(lines[0]).toMatch(/^TYPE-ERROR \.ethlete\/design\/acme: /);
    expect(lines[0]).toContain("'note'");
  }, 60_000);

  it('checks a product on the built-in @ethlete/components base', () => {
    const target = acme();
    const lines = output();

    writeFileSync(
      join(target, DESIGN_DIR, 'config.json'),
      JSON.stringify({ products: { app: { base: '@ethlete/components' } } }),
    );

    expect(check(target, ['app'])).toBe(0);
    expect(lines).toEqual(['ok']);
  }, 60_000);

  it('names the declared products when asked for an unknown one', () => {
    const lines = output();

    expect(check(acme(), ['nope'])).toBe(1);
    expect(lines).toEqual(['NO PRODUCT "nope" - config.json declares acme-base, acme.']);
  });
});

describe('checkDesign', () => {
  afterEach(() => vi.restoreAllMocks());

  it('checks every product when run without flags', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { color: #fff; }');

    expect(await checkDesign({ target, argv: [], invocation: 'et design' })).toBe(1);
    expect(withoutOpenPoints(lines)).toEqual([
      expect.stringMatching(/^HARD-CODED-COLOUR .*hero\.css: #fff/),
      'RENDER CHECK NOT RUN - 1 problem above stop it (HARD-CODED-COLOUR 1); the open points list no contrasts or missing states until they are fixed',
    ]);
  }, 60_000);

  it('leaves the problems of a base part to the base, and checks a part the product overrides as its own', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme-base/components/card/card.css'), '.acme-card { color: #000; }');
    writeFileSync(join(target, DESIGN_DIR, 'acme-base/components/button/button.css'), '.acme-button { color: #000; }');

    expect(check(target, ['acme'])).toBe(0);
    expect(lines).toEqual([
      "1 finding in base product acme-base (HARD-CODED-COLOUR 1) - they do not block this product; run et design check --product acme-base for the base's own",
      'ok',
    ]);

    writeFileSync(join(target, DESIGN_DIR, 'acme/components/button/button.css'), '.acme-button { color: #fff; }');
    lines.length = 0;

    expect(check(target, ['acme'])).toBe(1);
    expect(lines).toEqual([
      expect.stringMatching(/^HARD-CODED-COLOUR .*acme\/components\/button\/button\.css: #fff/),
      "1 finding in base product acme-base (HARD-CODED-COLOUR 1) - they do not block this product; run et design check --product acme-base for the base's own",
    ]);

    lines.length = 0;

    expect(check(target, ['acme-base'])).toBe(1);
    expect(lines).toEqual([
      expect.stringMatching(/^HARD-CODED-COLOUR .*acme-base\/components\/button\/button\.css: #000/),
      expect.stringMatching(/^HARD-CODED-COLOUR .*acme-base\/components\/card\/card\.css: #000/),
    ]);
  }, 60_000);

  it('warns of a merged part that changed outside a sketch, and passes', async () => {
    const target = acme();
    const lines = output();
    const warnings: string[] = [];

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    recordMerged({ product: { dir: join(target, DESIGN_DIR, 'acme'), base: null }, parts: ['elements/hero'] });
    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(warnings).toEqual([
      expect.stringMatching(/^WARNING acme elements\/hero changed outside a sketch/),
      ...renderWarningsOf(lines),
    ]);
    expect(lines.at(-1)).toBe('ok');
  }, 60_000);

  it("warns of an export in a part's shared/ that nothing imports, and passes", async () => {
    const target = acme();
    const lines = output();
    const warnings: string[] = [];

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    mkdirSync(join(target, DESIGN_DIR, 'acme/elements/hero/shared'));
    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/shared/data.ts'), 'export const rows = [];\n');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(warnings).toEqual([
      expect.stringMatching(
        /^WARNING UNUSED-EXPORT .*hero\/shared\/data\.ts: rows is exported, but nothing imports it/,
      ),
      ...renderWarningsOf(lines),
    ]);
    expect(lines.at(-1)).toBe('ok');
  }, 60_000);

  it('fails on a type error in a variant of an open sketch', async () => {
    const target = acme();
    const lines = output();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a', 'b'] });

    if (typeof sketch === 'string') throw new Error(sketch);

    writeFileSync(
      join(variantDirOf(sketch, 'b'), 'elements/hero/hero.ts'),
      "const broken: number = 'text';\nexport default broken;\n",
    );

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(withoutOpenPoints(lines)).toEqual([
      expect.stringMatching(/^TYPE-ERROR .*sketches\/elements-hero\/b: \n[^]*TS2322/),
      expect.stringMatching(/^RENDER CHECK NOT RUN - 1 problem above stop it \(TYPE-ERROR 1\)/),
    ]);
  }, 60_000);

  it('checks one product with --product', async () => {
    const lines = output();

    expect(await checkDesign({ target: acme(), argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(withoutOpenPoints(lines).filter((line) => !line.startsWith('RENDER CHECK SKIPPED'))).toEqual(['ok']);
  }, 60_000);

  it('lists the open points of each part before ok, and still passes', async () => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    mkdirSync(join(target, 'src'));
    writeFileSync(join(target, 'src/hero.component.ts'), '');
    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        'definePart<HeroProps>({',
        "definePart<HeroProps>({ implements: 'src/hero.component.ts',",
      ),
    );
    const home = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');

    writeFileSync(
      home,
      readFileSync(home, 'utf8').replace(
        'definePart<HomeProps>({',
        "definePart<HomeProps>({ unreachable: [{ from: 'empty', to: 'default', reason: 'Films never come back.' }],",
      ),
    );
    mkdirSync(join(target, DESIGN_DIR, 'acme/comments'));
    writeFileSync(
      join(target, DESIGN_DIR, 'acme/comments/c-1.json'),
      JSON.stringify({
        part: 'components/button',
        state: 'default',
        size: 'fitted',
        text: 'x',
        createdAt: '2026-10-31',
      }),
    );

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(
      lines.filter((line) => line.startsWith('OPEN POINTS ') || line.startsWith('UNLINKED ') || line.startsWith('  ')),
    ).toEqual([
      'OPEN POINTS acme: 9 in 3 parts',
      '  components/button: no controls declared; 1 open comment (c-1); 2 missing motions (default -> long, long -> default)',
      '  components/card: no controls declared; 2 missing motions (default -> long, long -> default)',
      '  elements/hero: no controls declared; no go',
      'UNLINKED acme: components/button, components/card, pages/home',
    ]);
    expect(lines.at(-1)).toBe('ok');
  }, 60_000);

  it('lists the contrasts the render found and, with --complete, the missing states', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(
      hero,
      readFileSync(hero, 'utf8')
        .replace(
          'definePart<HeroProps>({',
          "definePart<HeroProps>({ controls: { cta: { kind: 'button', input: ['pointer'] } },",
        )
        .replace('<h1>${film.title}</h1>', '<h1>${film.title}</h1><p style="color: var(--acme-surface)">Faint</p>'),
    );

    const code = await checkDesign({ target, argv: ['--product', 'acme', '--complete'], invocation: 'et design' });

    if (lines.some((line) => line.startsWith('RENDER CHECK SKIPPED'))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines.filter((line) => line.startsWith('  elements/hero'))).toEqual([
      '  elements/hero: 1 missing state (cta); 1 contrast under the rule (state default)',
    ]);
  }, 120_000);

  it('leaves what the render finds in a base part to the base', async (context) => {
    const target = acme();
    const lines = output();
    const card = join(target, DESIGN_DIR, 'acme-base/components/card/card.ts');

    writeFileSync(
      card,
      readFileSync(card, 'utf8').replace(
        '<h3>${title}</h3>',
        '<h3>${title}</h3><p style="color: var(--acme-surface)">Faint</p>',
      ),
    );

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => line.startsWith('RENDER CHECK SKIPPED'))) return context.skip('no browser');

    expect(code).toBe(0);
    expect(withoutOpenPoints(lines).filter((line) => line.includes('components/card'))).toEqual([]);
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^\d+ findings? in base product acme-base \((?:[A-Z-]+ \d+(?:, )?)+\) - they do not block this product; run et design check --product acme-base for the base's own$/,
      ),
    );
    expect(await checkDesign({ target, argv: ['--product', 'acme-base'], invocation: 'et design' })).toBe(1);
  }, 120_000);

  it('lists a border under the non-text contrast rule as a contrast', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        '<h1>${film.title}</h1>',
        '<h1>${film.title}</h1><button type="button" style="height: 8px; border: 1px solid var(--acme-surface)"></button>',
      ),
    );

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => line.startsWith('RENDER CHECK SKIPPED'))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines.filter((line) => line.startsWith('  elements/hero'))).toEqual([
      '  elements/hero: no controls declared; 1 contrast under the rule (state default)',
    ]);
  }, 120_000);

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
    expect(withoutOpenPoints(lines)).toEqual([
      expect.stringMatching(/^IMPLEMENTS-MISSING .*hero\.ts: "src\/gone/),
      expect.stringMatching(/^RENDER CHECK NOT RUN - 1 problem above stop it \(IMPLEMENTS-MISSING 1\)/),
    ]);
  }, 60_000);

  it('ends with one line per part with findings and the count of the clean parts', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { color: #fff; }');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(lines.filter((line) => line.startsWith('PART'))).toEqual([
      'PART acme components/button: 3 open points',
      'PART acme elements/hero: 1 problem (HARD-CODED-COLOUR), 1 open point',
      'PART acme components/card: 3 open points',
      'PARTS acme: 2 of 4 clean',
    ]);
  }, 60_000);

  it('keeps only the findings of one part with --part', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { color: #fff; }');
    writeFileSync(join(target, DESIGN_DIR, 'acme/components/button/button.css'), '.acme-button { color: #000; }');

    expect(
      await checkDesign({ target, argv: ['--product', 'acme', '--part', 'elements/hero'], invocation: 'et design' }),
    ).toBe(1);
    expect(lines.filter((line) => /^(HARD-CODED|PART|OPEN POINTS| {2})/.test(line))).toEqual([
      expect.stringMatching(/^HARD-CODED-COLOUR .*hero\.css: #fff/),
      'OPEN POINTS acme: 1 in 1 part',
      '  elements/hero: no controls declared',
      'PART acme elements/hero: 1 problem (HARD-CODED-COLOUR), 1 open point',
    ]);
  }, 60_000);

  it('finds the product of a part without --product, and refuses an unknown part', async () => {
    const lines = output();

    expect(await checkDesign({ target: acme(), argv: ['--part', 'pages/home'], invocation: 'et design' })).toBe(0);
    expect(lines.filter((line) => line.startsWith('PART'))).toEqual([
      expect.stringMatching(/^PART acme pages\/home: /),
    ]);
    expect(await checkDesign({ target: acme(), argv: ['--part', 'pages/gone'], invocation: 'et design' })).toBe(1);
    expect(lines.at(-1)).toBe('NO PART "pages/gone" in any product of config.json.');
  }, 60_000);
});

describe('summaryText', () => {
  it('prints a clean line for the one part asked for', () => {
    expect(summaryText({ product: 'acme', parts: ['pages/home'], tally: new Map(), only: 'pages/home' })).toEqual([
      'PART acme pages/home: clean',
    ]);
  });
});
