import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { openSketchProblemsOf, typecheckVariant } from './check-sketches';
import { createSketch, Sketch } from './sketch';

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
});
