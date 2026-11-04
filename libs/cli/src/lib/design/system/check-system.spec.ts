import { execFileSync } from 'child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { DESIGN_DIR, readConfig } from '../paths';
import { checkSystem, checkSystemRendered, summaryText } from './check-system';
import { markPartGo } from './part-go';
import { writePartRecord } from './part-ready';
import { resolveProduct } from './resolve-product';
import { recordMerged } from './sketch/merged-parts';
import { createSketch, decideSketch, rebaseSketch, variantDirOf } from './sketch/sketch';

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
      !/^\[\d+\/\d+\] /.test(line) &&
      !line.startsWith('UNLINKED ') &&
      !line.startsWith('  ') &&
      !line.startsWith('PART ') &&
      !line.startsWith('PARTS ') &&
      !line.startsWith('DONE ') &&
      !/^[A-Z][A-Z-]+ \d+$/.test(line) &&
      !line.startsWith('check complete:'),
  );

const withoutBrowserLines = (lines: string[]) =>
  withoutOpenPoints(lines).filter(
    (line) =>
      !/^RENDER CHECK (SKIPPED|FAILED)/.test(line) &&
      !line.startsWith('NOT CHECKED') &&
      !line.startsWith('CONTROL-UNDECLARED'),
  );

const noBrowser = async () => null;

const renderWarningsOf = (lines: string[]) =>
  lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))
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
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('checks every product when run without flags', async () => {
    const target = acme();
    const lines = output();

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { border-color: #fff; }');

    expect(await checkDesign({ target, argv: [], invocation: 'et design' })).toBe(1);
    expect(withoutBrowserLines(lines)).toEqual([expect.stringMatching(/^HARD-CODED-COLOUR .*hero\.css: #fff/)]);
  }, 60_000);

  it('runs the render check past a static failure and reports both', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { color: #fff; }');
    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        'styles: styles + play.styles,',
        "styles: styles + play.styles, setup: (root) => root.querySelector('h1')?.addEventListener('click', () => undefined),",
      ),
    );

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines).toContainEqual(expect.stringMatching(/^HARD-CODED-COLOUR .*hero\.css: #fff/));
    expect(lines).toContainEqual(expect.stringMatching(/^ACTION-UNDECLARED acme elements\/hero default at /));
    expect(lines.filter((line) => line.startsWith('RENDER CHECK NOT RUN'))).toEqual([]);
  }, 120_000);

  it('names a part that does not draw as not checked by the render rules', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(hero, `if (Date.now() > 0) throw new Error('hero will not load');\n${readFileSync(hero, 'utf8')}`);

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines).toContainEqual(expect.stringMatching(/^RENDER acme elements\/hero - at -: - - .*hero will not load/));
    expect(lines.filter((line) => line.startsWith('NOT CHECKED'))).toEqual([
      'NOT CHECKED acme render rules on 2 parts: elements/hero, pages/home - they did not draw, see RENDER above',
    ]);
  }, 120_000);

  it('names each state that does not draw as not checked by the render rules', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(
      hero,
      readFileSync(hero, 'utf8')
        .replace(
          "states: { default: { film: films[0] ?? { title: '' } } },",
          "states: { default: { film: films[0] ?? { title: '' } }, broken: { film: { title: 'boom' } }, gone: { film: { title: 'boom' } } },",
        )
        .replace(
          'render: async ({ film }) => {',
          "render: async ({ film }) => {\n    if (film.title === 'boom') throw new Error('state will not draw');",
        ),
    );

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines).toContainEqual(
      expect.stringMatching(/^RENDER acme elements\/hero broken at .*failed - state will not draw$/),
    );
    expect(lines.filter((line) => line.startsWith('NOT CHECKED'))).toEqual([
      'NOT CHECKED acme render rules on elements/hero state broken - it did not draw, see RENDER above',
      'NOT CHECKED acme render rules on elements/hero state gone - it did not draw, see RENDER above',
    ]);
  }, 120_000);

  it('fails a capability no design action draws, and warns of one known as missing', async () => {
    const target = acme();
    const lines = output();
    const warnings: string[] = [];

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    writeFileSync(
      join(target, DESIGN_DIR, 'acme/capabilities.json'),
      JSON.stringify({
        capabilities: [
          { id: 'film-rate', label: 'Rate a film', place: null },
          { id: 'film-share', label: 'Share a film', place: null, missing: 'B1' },
        ],
      }),
    );

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^CAPABILITY-PLACE .*capabilities\.json: film-rate \(Rate a film\): no design action draws it/,
      ),
    );
    expect(warnings).toContainEqual(
      expect.stringMatching(/^WARNING CAPABILITY-PLACE .*capabilities\.json: film-share .* tracked in B1$/),
    );
  }, 120_000);

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
    expect(lines).toContain('ok');
  }, 60_000);

  it('warns once per product of decision files that differ from HEAD or are untracked, and passes', async () => {
    const target = acme();
    output();
    const warnings: string[] = [];
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
        cwd: target,
        stdio: 'ignore',
      });
    const dir = join(target, DESIGN_DIR, 'acme');

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    writeFileSync(join(dir, 'go.json'), '{}\n');
    git('init', '-q');
    git('add', '.');
    git('commit', '-q', '--no-verify', '-m', 'base');
    writeFileSync(join(dir, 'go.json'), '{ }\n');
    mkdirSync(join(dir, 'sketches/hero'), { recursive: true });
    writeFileSync(join(dir, 'sketches/hero/sketch.json'), '{}\n');
    writeFileSync(join(dir, 'sketches/hero/notes.md'), 'x\n');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(warnings.filter((line) => line.includes('UNCOMMITTED-DECISIONS'))).toEqual([
      'WARNING UNCOMMITTED-DECISIONS acme: go.json, sketches/hero/sketch.json differ from HEAD - Studio or Tom ' +
        'commits them; an agent never commits go.json',
    ]);
  }, 60_000);

  it('checks only the part named as a positional, as --part does', async () => {
    const target = acme();
    const lines = output();
    const run = async (argv: string[]) => {
      lines.length = 0;
      const code = await checkDesign({ target, argv, invocation: 'et design' });

      return { code, lines: lines.filter((line) => !/^\[\d+\/\d+\] .* \d+s$/.test(line)) };
    };

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { color: #fff; }');

    const flagged = await run(['--part', 'components/button', '--product', 'acme']);

    expect(flagged.lines).toContain('HARD-CODED-COLOUR 0');
    expect(await run(['components/button', '--product', 'acme'])).toEqual(flagged);
    expect(await run(['components/button'])).toEqual(await run(['--part', 'components/button']));
  }, 60_000);

  it('rejects a positional part it cannot honour with a hint to --part', async () => {
    const target = acme();
    const errors: string[] = [];

    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void errors.push(String(line)));

    expect(
      await checkDesign({ target, argv: ['elements/hero', '--part', 'pages/home'], invocation: 'et design' }),
    ).toBe(2);
    expect(await checkDesign({ target, argv: ['hero'], invocation: 'et design' })).toBe(2);
    expect(await checkDesign({ target, argv: ['--product', 'acme', 'elements/hero'], invocation: 'et design' })).toBe(
      2,
    );
    expect(errors).toEqual([
      expect.stringContaining('--part elements/hero'),
      expect.stringContaining('--part hero'),
      expect.stringContaining('--part elements/hero'),
    ]);
  }, 60_000);

  it('reports and lists only the part a positional names', async () => {
    const target = acme();
    const config = readConfig(target) ?? {};
    const product = resolveProduct({ target, name: 'acme', config: config.products?.['acme'] ?? {} });

    markPartGo({ product, part: 'elements/hero', by: 'tom', via: 'design go' });

    const lines = output();

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await checkDesign({ target, argv: ['components/button', '--product', 'acme'], invocation: 'et design' });

    expect(lines.filter((line) => line.includes('elements/hero'))).toEqual([]);
    expect(lines.at(-1)).toMatch(/^check complete: 1 part, /);
  }, 60_000);

  it('rejects an argument the check does not read', async () => {
    const target = acme();
    const errors: string[] = [];

    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void errors.push(String(line)));

    expect(await checkDesign({ target, argv: ['--product', 'acme', '--bogus'], invocation: 'et design' })).toBe(2);
    expect(await checkDesign({ target, argv: ['--prodcut', 'acme'], invocation: 'et design' })).toBe(2);
    expect(
      await checkDesign({
        target,
        argv: ['--part', 'elements/hero', '--live', '--product', 'acme'],
        invocation: 'et design',
      }),
    ).toBe(2);
    expect(errors).toEqual([
      'check does not read --bogus - see et design check --help',
      'check does not read --prodcut - see et design check --help',
      'check does not read --part with --live - see et design check --help',
    ]);
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
    expect(lines).toContain('ok');
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
    expect(withoutBrowserLines(lines)).toEqual([
      expect.stringMatching(/^TYPE-ERROR .*sketches\/elements-hero\/b: \n[^]*TS2322/),
    ]);
  }, 60_000);

  it('fails while a part an open sketch replaces changed since the sketch, until the sketch is rebased', async () => {
    const target = acme();
    const lines = output();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] });

    if (typeof sketch === 'string') throw new Error(sketch);

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'yarn design' })).toBe(1);
    expect(withoutBrowserLines(lines)).toEqual([
      'SKETCH-BASE-STALE acme elements/hero: elements/hero changed since the sketch was drawn - bring each variant up to date, then run yarn design sketch rebase elements/hero --product acme --by <model id>',
    ]);

    rebaseSketch({ product, sketch });
    lines.length = 0;

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'yarn design' })).toBe(0);
    expect(lines).toContain('SKETCH-BASE-STALE 0');
  }, 60_000);

  it('reports a stale base on a picked sketch and skips a discarded one', async () => {
    const target = acme();
    const lines = output();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] });

    if (typeof sketch === 'string') throw new Error(sketch);

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    const picked = decideSketch({ sketch: { ...sketch, status: 'ready' }, decision: { kind: 'pick', variant: 'a' } });

    if (typeof picked === 'string') throw new Error(picked);

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'yarn design' })).toBe(1);
    expect(lines).toContain('SKETCH-BASE-STALE 1');

    const discarded = decideSketch({ sketch: picked, decision: { kind: 'discard' } });

    if (typeof discarded === 'string') throw new Error(discarded);

    lines.length = 0;

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'yarn design' })).toBe(0);
    expect(lines).toContain('SKETCH-BASE-STALE 0');
  }, 60_000);

  it('checks one product with --product', async () => {
    const lines = output();

    expect(await checkDesign({ target: acme(), argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(
      withoutOpenPoints(lines).filter(
        (line) => !/^RENDER CHECK (SKIPPED|FAILED)/.test(line) && !line.startsWith('CONTROL-UNDECLARED'),
      ),
    ).toEqual(['ok']);
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
      'OPEN POINTS acme: 8 in 3 parts',
      '  components/button: no controls declared; 1 open comment (c-1); 2 missing motions (default -> long, long -> default)',
      '  components/card: no controls declared; 2 missing motions (default -> long, long -> default)',
      '  elements/hero: no controls declared',
      'UNLINKED acme: components/button, pages/home',
    ]);
    expect(lines).toContain('ok');
  }, 60_000);

  it('prints the instant line of a part that declares instant switches, like sketch ready', async () => {
    const target = acme();
    const lines = output();
    const home = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');

    writeFileSync(
      home,
      readFileSync(home, 'utf8').replace(
        'definePart<HomeProps>({',
        "definePart<HomeProps>({ instant: 'The page swaps without motion.',",
      ),
    );

    await checkDesign({ target, argv: ['--product', 'acme', '--part', 'pages/home'], invocation: 'et design' });

    expect(lines).toContain(
      'pages/home declares instant state switches (no motion between its states): The page swaps without motion.',
    );

    lines.length = 0;
    await checkDesign({ target, argv: ['--product', 'acme', '--part', 'components/button'], invocation: 'et design' });

    expect(lines.some((line) => line.includes('declares instant'))).toBe(false);
  }, 60_000);

  it('lists the contrasts the render found and the missing states', async (context) => {
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

    const code = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

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

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(code).toBe(0);
    expect(withoutOpenPoints(lines).filter((line) => line.includes('components/card'))).toEqual([]);
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^\d+ findings? in base product acme-base \((?:[A-Z-]+ \d+(?:, )?)+\) - they do not block this product; run et design check --product acme-base for the base's own$/,
      ),
    );
    expect(await checkDesign({ target, argv: ['--product', 'acme-base'], invocation: 'et design' })).toBe(1);
  }, 120_000);

  it('fails on an element without an action in a part with no check record, and warns once for a part with one', async (context) => {
    const target = acme();
    const lines = output();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void lines.push(String(line)));
    writeFileSync(
      hero,
      readFileSync(hero, 'utf8').replace(
        'styles: styles + play.styles,',
        "styles: styles + play.styles, setup: (root) => root.querySelector('h1')?.addEventListener('click', () => undefined),",
      ),
    );

    const ungone = await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' });

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

    expect(ungone).toBe(1);
    expect(lines).toContainEqual(expect.stringMatching(/^ACTION-UNDECLARED acme elements\/hero default at /));

    const config = readConfig(target) ?? {};
    const product = resolveProduct({ target, name: 'acme', config: config.products?.['acme'] ?? {} });

    writePartRecord({ product, part: 'elements/hero' });
    lines.length = 0;

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(lines.filter((line) => line.includes('ACTION-UNDECLARED acme'))).toEqual([
      expect.stringMatching(
        /^WARNING ACTION-UNDECLARED acme elements\/hero: \d+ hits? on 1 element, unchanged since its go - first .*h1: h1 ".+" is interactive but declares no action$/,
      ),
    ]);
  }, 180_000);

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

    if (lines.some((line) => /^RENDER CHECK (SKIPPED|FAILED)/.test(line))) return context.skip('no browser');

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
  }, 60_000);

  it('finds the product of a part without --product, and refuses an unknown part', async () => {
    const lines = output();

    expect(await checkDesign({ target: acme(), argv: ['--part', 'pages/home'], invocation: 'et design' })).toBe(0);
    expect(lines.filter((line) => /^PARTS? /u.test(line))).toEqual([expect.stringMatching(/^PART acme pages\/home: /)]);
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

  it('ends with the done count over the own parts', () => {
    expect(summaryText({ product: 'acme', parts: ['a/x', 'a/y'], tally: new Map(), done: 1 })).toEqual([
      'PARTS acme: 2 of 2 clean',
      'DONE acme: 1 of 2',
    ]);
  });

  it('fails a part check without a browser on a dev machine and names what it looked for', async () => {
    vi.stubEnv('CI', '');
    const target = acme();
    const lines = output();
    const code = await checkSystemRendered({
      target,
      config: readConfig(target) ?? {},
      products: ['acme'],
      part: 'elements/hero',
      chromiumOf: noBrowser,
    });

    expect(code).toBe(1);
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^RENDER CHECK FAILED - no usable browser: neither .+ nor this package .+ resolves playwright/,
      ),
    );
  });

  it('skips the render check without a browser under CI', async () => {
    vi.stubEnv('CI', '1');
    const target = acme();
    const lines = output();
    const code = await checkSystemRendered({
      target,
      config: readConfig(target) ?? {},
      products: ['acme'],
      part: 'elements/hero',
      chromiumOf: noBrowser,
    });

    expect(code).toBe(0);
    expect(lines).toContainEqual(expect.stringMatching(/^RENDER CHECK SKIPPED - neither /));
    expect(lines.some((line) => line.startsWith('RENDER CHECK FAILED'))).toBe(false);
  });
});
