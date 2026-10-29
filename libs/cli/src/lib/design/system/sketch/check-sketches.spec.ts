import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { openSketchProblemsOf, typecheckVariant, variantWarningsOf } from './check-sketches';
import { createSketch, editRound, Sketch } from './sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-check-sketches-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

describe('openSketchProblemsOf', () => {
  it('runs the rules on each variant laid over the product', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const css = join(sketch.dir, 'b/elements/hero/hero.css');

    writeFileSync(css, '.acme-hero { color: #fff; }');

    const { unreadable, variants } = openSketchProblemsOf(product);

    expect(unreadable).toEqual([]);
    expect(variants.map(({ variant, problems }) => [variant, problems])).toEqual([
      ['a', []],
      ['b', [{ rule: 'HARD-CODED-COLOUR', file: css, message: '#fff outside foundations - use a foundations token' }]],
    ]);
  });

  it('rejects a target whose factory export cannot receive merge metadata', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const file = join(sketch.dir, 'a/elements/hero/hero.ts');

    writeFileSync(file, "import { inbox } from '@shared/inbox';\nexport default inbox(true);\n");

    const variants = openSketchProblemsOf(product).variants;

    expect(variants.find(({ variant }) => variant === 'a')?.problems).toContainEqual({
      rule: 'SKETCH',
      file,
      message:
        "merge cannot write metadata to elements/hero - define it with definePart({ ..., note: '...' }) in this file",
    });
    expect(variants.find(({ variant }) => variant === 'b')?.problems).toEqual([]);

    writeFileSync(
      file,
      "import { definePart } from '@design-system';\nconst part = definePart({ note: `hello` });\nexport default part;\n",
    );
    expect(openSketchProblemsOf(product).variants.find(({ variant }) => variant === 'a')?.problems).toEqual([]);
  });

  it('keeps a problem the product already has apart from the ones a variant brings in', () => {
    const target = acme();
    const productDir = join(target, DESIGN_DIR, 'acme');
    const buttonCss = join(productDir, 'components/button/button.css');
    const heroCss = join(productDir, 'elements/hero/hero.css');

    writeFileSync(buttonCss, `${readFileSync(buttonCss, 'utf8')}\n.acme-button-x { color: #000; }`);
    writeFileSync(heroCss, `${readFileSync(heroCss, 'utf8')}\n.acme-hero-x { color: #111; }`);

    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const sketchedCss = join(sketch.dir, 'b/elements/hero/hero.css');

    writeFileSync(sketchedCss, `${readFileSync(sketchedCss, 'utf8')}\n.acme-hero-y { color: #fff; }`);

    const entries = openSketchProblemsOf(product).variants.map(({ variant, problems, before }) => ({
      variant,
      problems: problems.map(({ file, message }) => [file, message]),
      before: before.map(({ file, message }) => [file, message]),
    }));

    expect(entries).toEqual([
      {
        variant: 'a',
        problems: [],
        before: [
          [buttonCss, '#000 outside foundations - use a foundations token'],
          [join(sketch.dir, 'a/elements/hero/hero.css'), '#111 outside foundations - use a foundations token'],
        ],
      },
      {
        variant: 'b',
        problems: [[sketchedCss, '#fff outside foundations - use a foundations token']],
        before: [
          [buttonCss, '#000 outside foundations - use a foundations token'],
          [sketchedCss, '#111 outside foundations - use a foundations token'],
        ],
      },
    ]);
  });

  it('reports a state a variant drops from the part, and no new part', () => {
    const target = acme();
    const heroOf = (dir: string) => join(dir, 'elements/hero/hero.ts');
    const productHero = heroOf(join(target, DESIGN_DIR, 'acme'));
    const withStates = (source: string, states: string) =>
      source.replace(/states: \{ default: .*\} \},/u, `states: { ${states} },`);
    const film = 'default: { film: films[0] ?? { title: "" } }';

    writeFileSync(
      productHero,
      withStates(readFileSync(productHero, 'utf8'), `${film}, empty: { film: { title: "" } }`),
    );

    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b', 'c'],
    }) as Sketch;
    const source = readFileSync(productHero, 'utf8');
    const banner = join(sketch.dir, 'c/elements/banner/banner.ts');

    writeFileSync(heroOf(join(sketch.dir, 'b')), withStates(source, film));
    writeFileSync(
      heroOf(join(sketch.dir, 'c')),
      withStates(source, `${film}, empty: { film: { title: "" } }, long: { film: { title: "x" } }`),
    );
    mkdirSync(join(sketch.dir, 'c/elements/banner'), { recursive: true });
    writeFileSync(
      banner,
      "import { definePart, drawing } from '@design-system';\nexport default definePart({ note: '', states: { only: {} }, render: () => drawing({ body: '', styles: '' }) });\n",
    );

    expect(openSketchProblemsOf(product).variants.map(({ variant, problems }) => [variant, problems])).toEqual([
      ['a', []],
      [
        'b',
        [
          {
            rule: 'STATES',
            file: heroOf(join(sketch.dir, 'b')),
            message: 'drops the state empty that elements/hero has in acme - a variant keeps every state of the part',
          },
        ],
      ],
      ['c', []],
    ]);
  });

  it('lets the round of a variant drop a state on purpose, and no other', () => {
    const target = acme();
    const heroOf = (dir: string) => join(dir, 'elements/hero/hero.ts');
    const productHero = heroOf(join(target, DESIGN_DIR, 'acme'));
    const withStates = (source: string, states: string) =>
      source.replace(/states: \{ default: .*\} \},/u, `states: { ${states} },`);
    const film = 'default: { film: films[0] ?? { title: "" } }';

    writeFileSync(
      productHero,
      withStates(
        readFileSync(productHero, 'utf8'),
        `${film}, empty: { film: { title: "" } }, long: { film: { title: "x" } }`,
      ),
    );

    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;

    writeFileSync(heroOf(join(sketch.dir, 'b')), withStates(readFileSync(productHero, 'utf8'), film));

    const messageOf = () =>
      openSketchProblemsOf(product).variants.find(({ variant }) => variant === 'b')?.problems[0]?.message;

    expect(messageOf()).toContain('drops the states empty, long');

    editRound({ sketch, round: 'r1', drops: ['empty'] });

    expect(messageOf()).toContain('drops the state long that');

    editRound({ sketch, round: 'r1', drops: ['empty', 'long'] });

    expect(messageOf()).toBeUndefined();
  });

  it('reports a sketch folder without sketch.json', () => {
    const target = acme();
    const product = resolveAcme(target);

    cpSync(
      join(target, DESIGN_DIR, 'acme/elements'),
      join(target, DESIGN_DIR, 'acme/sketches/elements-hero/a/elements'),
      {
        recursive: true,
      },
    );

    expect(openSketchProblemsOf(product).unreadable).toEqual([
      { rule: 'SKETCH', file: product.dir, message: expect.stringContaining('holds no sketch.json') },
    ]);
  });
});

describe('typecheckVariant', () => {
  it('types one variant over the product', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;

    writeFileSync(
      join(sketch.dir, 'b/elements/hero/hero.ts'),
      "import { definePart } from '@design-system';\nexport default definePart<{ a: string }>({ note: '', states: { default: { a: 1 } }, render: () => ({ body: '', styles: '' }) });\n",
    );

    expect(typecheckVariant({ target, product, sketch, variant: 'a' })).toEqual({ kind: 'ok' });
    expect(typecheckVariant({ target, product, sketch, variant: 'b' })).toEqual({
      kind: 'failed',
      output: expect.stringContaining('hero.ts'),
    });
  }, 120_000);

  it("types a variant's @shared/ imports, so a type error there fails the variant", () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;

    mkdirSync(join(sketch.dir, 'shared'), { recursive: true });
    writeFileSync(join(sketch.dir, 'shared/data.ts'), 'export const count: number = 3;\n');

    for (const [variant, type] of [
      ['a', 'number'],
      ['b', 'string'],
    ]) {
      const ts = join(sketch.dir, variant ?? '', 'elements/hero/hero.ts');

      writeFileSync(
        ts,
        `import { count } from '@shared/data';\nexport const label: ${type} = count;\n${readFileSync(ts, 'utf8')}`,
      );
    }

    expect(typecheckVariant({ target, product, sketch, variant: 'a' })).toEqual({ kind: 'ok' });
    expect(typecheckVariant({ target, product, sketch, variant: 'b' })).toEqual({
      kind: 'failed',
      output: expect.stringContaining("Type 'number' is not assignable to type 'string'"),
    });
  }, 120_000);

  it("types a page that imports a named helper of the variant's own foundation", () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'pages', name: 'home' },
      variants: ['a', 'b'],
    }) as Sketch;
    const palette = join(product.dir, 'foundations/palette');

    for (const variant of ['a', 'b']) {
      const home = join(sketch.dir, variant, 'pages/home/home.ts');

      writeFileSync(
        home,
        `import { accent } from '@system/foundations/palette';\n${readFileSync(home, 'utf8').replace('<main>', '<main>${accent()}')}`,
      );
    }

    cpSync(palette, join(sketch.dir, 'a/foundations/palette'), { recursive: true });
    writeFileSync(
      join(sketch.dir, 'a/foundations/palette/palette.ts'),
      `${readFileSync(join(palette, 'palette.ts'), 'utf8')}\nexport const accent = (): string => 'Accent';\n`,
    );

    expect(typecheckVariant({ target, product, sketch, variant: 'a' })).toEqual({ kind: 'ok' });
    expect(typecheckVariant({ target, product, sketch, variant: 'b' })).toEqual({
      kind: 'failed',
      output: expect.stringContaining("no exported member 'accent'"),
    });
  }, 120_000);
});

describe('variantWarningsOf', () => {
  it('warns when two stylesheets loaded by one part define the same class', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const folder = join(sketch.dir, 'b/elements/hero');
    const ts = join(folder, 'hero.ts');

    mkdirSync(join(sketch.dir, 'shared'), { recursive: true });
    writeFileSync(join(sketch.dir, 'shared/data.css'), '.sk-head { color: red; }');
    writeFileSync(join(folder, 'hero.css'), '.sk-head { color: blue; }');
    writeFileSync(ts, `import data from '@shared/data.css?inline';\n${readFileSync(ts, 'utf8')}`);

    expect(variantWarningsOf({ target, product, sketch, variant: 'a' })).toEqual([]);
    expect(variantWarningsOf({ target, product, sketch, variant: 'b' })).toEqual([
      expect.stringMatching(/^WARNING elements\/hero: \.sk-head is defined in .*hero\.css and .*shared\/data\.css/),
    ]);
  });

  it("warns when a variant restyles a class of the sketch's shared/ stylesheets", () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;

    mkdirSync(join(sketch.dir, 'shared'), { recursive: true });
    writeFileSync(join(sketch.dir, 'shared/frame.css'), '.sk-frame { padding: 0; }');
    writeFileSync(join(sketch.dir, 'a/elements/hero/hero.css'), '.sk-frame .hero-label { gap: 0; }');
    writeFileSync(join(sketch.dir, 'b/elements/hero/hero.css'), '.hero:has(.x) .sk-frame:has(.hero-label) { gap: 0; }');

    expect(variantWarningsOf({ target, product, sketch, variant: 'a' })).toEqual([]);
    expect(variantWarningsOf({ target, product, sketch, variant: 'b' })).toEqual([
      expect.stringMatching(
        /^WARNING elements\/hero: .*b\/elements\/hero\/hero\.css restyles \.sk-frame of .*shared\/frame\.css/,
      ),
    ]);
  });

  it('warns of a file in a variant that nothing imports', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const ts = join(sketch.dir, 'b/elements/hero/hero.ts');

    for (const variant of ['a', 'b']) {
      writeFileSync(join(sketch.dir, variant, 'elements/hero/grid.ts'), 'export const grid = 1;\n');
      writeFileSync(join(sketch.dir, variant, 'elements/hero/grid.css'), '.grid { gap: 0; }\n');
    }

    writeFileSync(
      ts,
      `import { grid } from './grid';\nimport css from './grid.css?inline';\nvoid grid; void css;\n${readFileSync(ts, 'utf8')}`,
    );

    expect(variantWarningsOf({ target, product, sketch, variant: 'b' })).toEqual([]);
    expect(variantWarningsOf({ target, product, sketch, variant: 'a' })).toEqual([
      expect.stringMatching(/^WARNING .*a\/elements\/hero\/grid\.css: nothing in variant a imports it/),
      expect.stringMatching(/^WARNING .*a\/elements\/hero\/grid\.ts: nothing in variant a imports it/),
    ]);
  });

  it("warns of an export in the sketch's shared/ that the variant does not import", () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const ts = join(sketch.dir, 'b/elements/hero/hero.ts');

    mkdirSync(join(sketch.dir, 'shared'), { recursive: true });
    writeFileSync(join(sketch.dir, 'shared/data.ts'), 'export const rows = [];\nexport const flowList = [];\n');
    writeFileSync(ts, `import { rows } from '@shared/data';\nvoid rows;\n${readFileSync(ts, 'utf8')}`);

    expect(variantWarningsOf({ target, product, sketch, variant: 'b' })).toEqual([
      expect.stringMatching(
        /^WARNING .*shared\/data\.ts: flowList is exported, but nothing in variant b imports it - delete it or drop the export$/,
      ),
    ]);
    expect(variantWarningsOf({ target, product, sketch, variant: 'a' })).toEqual([
      expect.stringMatching(/^WARNING .*shared\/data\.ts: rows is exported, but nothing in variant a imports it/),
      expect.stringMatching(/^WARNING .*shared\/data\.ts: flowList is exported, but nothing in variant a imports it/),
    ]);
  });
});
