import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import {
  addVariant,
  authorsOf,
  createSketch,
  decideSketch,
  findSketch,
  listSketches,
  markSketchReady,
  parseTarget,
  readSketch,
  readSketchReport,
  rebaseSketch,
  reportSketch,
  Sketch,
  sketchReportPath,
  sketchSourceOf,
} from './sketch';
import { baselineOf } from './baseline';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const open = (target: string, sketch: string, variants = ['a', 'b']) => {
  const parsed = parseTarget(sketch);

  if (typeof parsed === 'string') throw new Error(parsed);

  const created = createSketch({ product: resolveAcme(target), sketch: parsed, variants });

  if (typeof created === 'string') throw new Error(created);

  return created;
};

const sketchJson = (target: string, folder: string) =>
  JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/sketches', folder, 'sketch.json'), 'utf8')) as Record<
    string,
    unknown
  >;

describe('parseTarget', () => {
  it('reads <layer>/<name> and refuses anything else', () => {
    expect(parseTarget('elements/hero')).toEqual({ layer: 'elements', name: 'hero' });
    expect(parseTarget('widgets/hero')).toEqual(expect.stringContaining('is no target'));
    expect(parseTarget('elements/hero/x')).toEqual(expect.stringContaining('is no target'));
    expect(parseTarget(undefined)).toEqual(expect.stringContaining('is no target'));
  });
});

describe('createSketch', () => {
  it('scaffolds a new page with madeBy and the product widths, and no tokens import or stylesheet, since the frame loads the tokens', () => {
    const target = acme();
    const parsed = parseTarget('pages/start');

    if (typeof parsed === 'string') throw new Error(parsed);

    const created = createSketch({ product: resolveAcme(target), sketch: parsed, variants: ['a'], author: 'model-x' });

    if (typeof created === 'string') throw new Error(created);

    const folder = join(target, DESIGN_DIR, 'acme/sketches/pages-start/a/pages/start');
    const source = readFileSync(join(folder, 'start.ts'), 'utf8');

    expect(source).not.toContain('tokens');
    expect(source).toContain("madeBy: ['model-x']");
    expect(source).toContain('widths: [390, 1280]');
    expect(existsSync(join(folder, 'start.css'))).toBe(false);
  });

  it('writes sketch.json in progress with the baseline and starts each variant from the resolved part', () => {
    const target = acme();
    const sketch = open(target, 'components/card');
    const dir = join(target, DESIGN_DIR, 'acme/sketches/components-card');

    expect(sketch.variants).toEqual(['a', 'b']);
    expect(sketchJson(target, 'components-card')).toEqual({
      target: 'components/card',
      status: 'in progress',
      createdAt: expect.any(String),
      baseline: baselineOf(resolveAcme(target)),
      rounds: [{ key: 'r1', title: '', note: '' }],
      variantInfo: { a: { round: 'r1' }, b: { round: 'r1' } },
    });
    expect(readFileSync(join(dir, 'b/components/card/card.ts'), 'utf8')).toContain("note: 'A card with one action.'");
    expect(existsSync(join(dir, 'a/components/card/card.css'))).toBe(true);
  });

  it('starts a new part from a stub', () => {
    const target = acme();

    open(target, 'elements/header', ['a']);

    const stub = readFileSync(
      join(target, DESIGN_DIR, 'acme/sketches/elements-header/a/elements/header/header.ts'),
      'utf8',
    );

    expect(stub).toContain('export default definePart({');
    expect(stub).toContain('render: (props: Props) =>');
    expect(stub).toContain("import styles from './header.css?inline';");
  });

  it('keeps one open sketch per target', () => {
    const target = acme();
    const parsed = { layer: 'elements' as const, name: 'hero' };

    open(target, 'elements/hero');

    expect(createSketch({ product: resolveAcme(target), sketch: parsed, variants: ['c'] })).toBe(
      'elements/hero already has an open sketch - merge or discard it first',
    );
  });

  it('refuses bad variant names', () => {
    const target = acme();
    const sketch = { layer: 'elements' as const, name: 'hero' };

    expect(createSketch({ product: resolveAcme(target), sketch, variants: [] })).toBe('name at least one variant');
    expect(createSketch({ product: resolveAcme(target), sketch, variants: ['B'] })).toContain('is no variant name');
    expect(createSketch({ product: resolveAcme(target), sketch, variants: ['a', 'a'] })).toContain('unique');
  });
});

describe('listSketches and findSketch', () => {
  it('reads every sketch folder and reports one without sketch.json', () => {
    const target = acme();
    const productDir = join(target, DESIGN_DIR, 'acme');

    open(target, 'elements/hero');
    open(target, 'components/button', ['x']);
    rmSync(join(productDir, 'sketches/components-button/sketch.json'));

    const listed = listSketches({ productDir, product: 'acme' });

    expect(listed[0]).toEqual(expect.stringContaining('holds no sketch.json'));
    expect((listed[1] as Sketch).target).toBe('elements/hero');
    expect(findSketch({ productDir, product: 'acme', sketch: { layer: 'pages', name: 'home' } })).toBeNull();
    expect(
      (findSketch({ productDir, product: 'acme', sketch: { layer: 'elements', name: 'hero' } }) as Sketch).variants,
    ).toEqual(['a', 'b']);
  });
});

describe('status', () => {
  it('goes from in progress to ready, and ends the live report', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');

    reportSketch({ checkout: target, sketch, variant: 'b', author: 'gpt-5.6-sol', message: 'phone' });

    const path = sketchReportPath({ checkout: target, sketch });

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(expect.objectContaining({ message: 'phone' }));
    expect(readSketchReport({ checkout: target, sketch })).toMatchObject({
      message: 'phone',
      variant: 'b',
      author: 'gpt-5.6-sol',
    });

    reportSketch({ checkout: target, sketch, variant: 'a', author: 'gpt-5.6-sol', message: 'variant b, desktop' });

    expect(readSketchReport({ checkout: target, sketch })?.variant).toBe('a');

    const ready = markSketchReady({ checkout: target, sketch });

    expect(sketchJson(target, 'elements-hero')['status']).toBe('ready');
    expect(existsSync(path)).toBe(false);
    expect(readSketchReport({ checkout: target, sketch })).toBeNull();
    expect(markSketchReady({ checkout: target, sketch: ready as Sketch })).toBe(
      'elements/hero is ready, not in progress',
    );
    expect(
      reportSketch({ checkout: target, sketch: ready as Sketch, variant: 'a', author: 'gpt-5.6-sol', message: 'late' }),
    ).toBe(
      'elements/hero is ready, not in progress - Studio shows a report only while the sketch is in progress, so nothing was recorded',
    );
    expect(existsSync(path)).toBe(false);
  });

  it('keeps the authors of each variant in the order of their first report, without duplicates', () => {
    const target = acme();
    const report = (variant: string, author: string) => {
      const sketch = findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'elements', name: 'hero' },
      }) as Sketch;

      return reportSketch({ checkout: target, sketch, variant, author, message: 'phone' });
    };

    open(target, 'elements/hero');
    report('a', 'gemini-3-argon');
    report('a', 'claude-opus-5-5');
    report('a', 'gemini-3-argon');
    report('b', 'gpt-5.6-sol');

    expect(sketchJson(target, 'elements-hero')['variantInfo']).toEqual({
      a: { authors: ['gemini-3-argon', 'claude-opus-5-5'], round: 'r1' },
      b: { authors: ['gpt-5.6-sol'], round: 'r1' },
    });
    expect(report('c', 'gpt-5.6-sol')).toBe('elements/hero has no variant "c" - it has a, b');
  });

  it('reads a sketch and a report written before authors and rounds were recorded', () => {
    const target = acme();
    const dir = open(target, 'elements/hero').dir;

    writeFileSync(
      join(dir, 'sketch.json'),
      JSON.stringify({ target: 'elements/hero', status: 'ready', createdAt: '2026-10-01T00:00:00.000Z' }),
    );

    const sketch = readSketch({ product: 'acme', dir }) as Sketch;

    expect(sketch.rounds).toEqual([{ key: 'r1', title: '', note: '' }]);
    expect(sketch.variantInfo).toEqual({ a: { round: 'r1' }, b: { round: 'r1' } });

    writeFileSync(
      sketchReportPath({ checkout: target, sketch }),
      JSON.stringify({ state: 'drawing', updatedAt: '2026-10-01T00:00:00.000Z', message: 'variant b, phone' }),
    );

    expect(authorsOf(sketch, 'a')).toEqual([]);
    expect(readSketchReport({ checkout: target, sketch })).toMatchObject({ variant: null, author: null });
  });

  it('takes a pick only once ready, and a discard at any time', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');

    expect(decideSketch({ sketch, decision: { kind: 'pick', variant: 'a' } })).toContain('a variant is picked once');
    decideSketch({ sketch, decision: { kind: 'discard' } });
    expect(sketchJson(target, 'elements-hero')['decision']).toEqual({ kind: 'discard', decidedAt: expect.any(String) });

    const ready = markSketchReady({ checkout: target, sketch }) as Sketch;

    expect(decideSketch({ sketch: ready, decision: { kind: 'pick', variant: 'z' } })).toContain('has no variant "z"');
    decideSketch({ sketch: ready, decision: { kind: 'pick', variant: 'b', comment: 'bolder' } });
    expect(sketchJson(target, 'elements-hero')['decision']).toEqual({
      kind: 'pick',
      variant: 'b',
      comment: 'bolder',
      decidedAt: expect.any(String),
    });
  });
});

describe('rebaseSketch', () => {
  it('records the product as it is now as the baseline', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');
    const before = sketch.baseline?.['elements/hero'];

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero {}');

    const rebased = rebaseSketch({ product: resolveAcme(target), sketch });

    expect(rebased.baseline?.['elements/hero']).not.toBe(before);
    expect(sketchJson(target, 'elements-hero')).toMatchObject({ baseline: rebased.baseline, status: 'in progress' });
  });
});

describe('addVariant', () => {
  const find = (target: string) =>
    findSketch({
      productDir: join(target, DESIGN_DIR, 'acme'),
      product: 'acme',
      sketch: { layer: 'elements', name: 'hero' },
    }) as Sketch;

  it('copies a variant into the running round, back to in progress and without the pick', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');
    const dir = sketch.dir;

    writeFileSync(join(dir, 'b/elements/hero/hero.css'), '.acme-hero { gap: 1rem; }');
    decideSketch({
      sketch: markSketchReady({ checkout: target, sketch }) as Sketch,
      decision: { kind: 'pick', variant: 'a' },
    });

    const added = addVariant({ sketch: find(target), variant: 'c', from: 'b' }) as Sketch;

    expect(added.variants).toEqual(['a', 'b', 'c']);
    expect(readFileSync(join(dir, 'c/elements/hero/hero.css'), 'utf8')).toBe('.acme-hero { gap: 1rem; }');
    expect(sketchJson(target, 'elements-hero')).toMatchObject({
      status: 'in progress',
      rounds: [{ key: 'r1', title: '', note: '' }],
      variantInfo: { a: { round: 'r1' }, b: { round: 'r1' }, c: { round: 'r1' } },
    });
    expect(sketchJson(target, 'elements-hero')['decision']).toBeUndefined();
  });

  it('refuses while the decision is a discard and changes nothing', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');

    decideSketch({
      sketch: markSketchReady({ checkout: target, sketch }) as Sketch,
      decision: { kind: 'discard' },
    });

    expect(addVariant({ sketch: find(target), variant: 'c', from: 'a' })).toBe(
      'The user decided to discard elements/hero. The user must pick a variant first to go on.',
    );
    expect(find(target).variants).toEqual(['a', 'b']);
    expect(sketchJson(target, 'elements-hero')).toMatchObject({ decision: { kind: 'discard' } });
  });

  it('starts a new round with the note on the running one, and continues the letters', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');

    reportSketch({ checkout: target, sketch, variant: 'a', author: 'gpt-5.6-sol', message: 'phone' });

    addVariant({
      sketch: find(target),
      variant: 'c',
      from: 'a',
      round: { title: 'Solid a, outline b', lostNote: 'pill or square; the user wants both' },
    });
    addVariant({ sketch: find(target), variant: 'd', from: 'c' });

    expect(find(target).rounds).toEqual([
      { key: 'r1', title: '', note: 'pill or square; the user wants both' },
      { key: 'r2', title: 'Solid a, outline b', note: '' },
    ]);
    expect(find(target).variantInfo).toEqual({
      a: { authors: ['gpt-5.6-sol'], round: 'r1' },
      b: { round: 'r1' },
      c: { round: 'r2' },
      d: { round: 'r2' },
    });
  });

  it('refuses an unknown source, a taken or bad name, and a new round without a note', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');

    expect(addVariant({ sketch, variant: 'c', from: 'z' })).toBe('elements/hero has no variant "z" - it has a, b');
    expect(addVariant({ sketch, variant: 'b', from: 'a' })).toBe('elements/hero already has a variant "b"');
    expect(addVariant({ sketch, variant: 'C', from: 'a' })).toContain('is no variant name');
    expect(addVariant({ sketch, variant: 'c', from: 'a', round: { title: 'x', lostNote: ' ' } })).toContain(
      'needs a note on the running round',
    );
    expect(find(target).variants).toEqual(['a', 'b']);
  });

  it('refuses a sketch.json whose variant names an unknown round', () => {
    const target = acme();
    const dir = open(target, 'elements/hero').dir;

    writeFileSync(
      join(dir, 'sketch.json'),
      JSON.stringify({
        target: 'elements/hero',
        status: 'ready',
        createdAt: '2026-10-01T00:00:00.000Z',
        rounds: [{ key: 'r1', title: '', note: '' }],
        variantInfo: { a: { round: 'r9' } },
      }),
    );

    expect(readSketch({ product: 'acme', dir })).toContain('variant a names round "r9"');
  });
});

describe('the shared folder of a sketch', () => {
  it('is no variant, and no variant may be called shared', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');

    mkdirSync(join(sketch.dir, 'shared'));
    writeFileSync(join(sketch.dir, 'shared/data.ts'), 'export const data = 1;\n');

    expect((readSketch({ product: 'acme', dir: sketch.dir }) as Sketch).variants).toEqual(['a', 'b']);
    expect(addVariant({ sketch, variant: 'shared', from: 'a' })).toContain('not "shared"');
    expect(
      createSketch({ product: resolveAcme(target), sketch: { layer: 'pages', name: 'x' }, variants: ['shared'] }),
    ).toContain('not "shared"');
  });
});

describe('a sketch on a part with a shared folder', () => {
  it("moves the part's shared folder into the sketch's and imports it as @shared/", () => {
    const target = acme();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero');

    mkdirSync(join(hero, 'shared'));
    writeFileSync(join(hero, 'shared/data.ts'), "export { more as data } from './more';\n");
    writeFileSync(join(hero, 'shared/more.ts'), 'export const more = 1;\n');
    writeFileSync(
      join(hero, 'hero.ts'),
      `import { data } from './shared/data';\n${readFileSync(join(hero, 'hero.ts'), 'utf8')}`,
    );

    const sketch = open(target, 'elements/hero');

    for (const variant of ['a', 'b']) {
      expect(existsSync(join(sketch.dir, variant, 'elements/hero/shared'))).toBe(false);
      expect(readFileSync(join(sketch.dir, variant, 'elements/hero/hero.ts'), 'utf8')).toContain("from '@shared/data'");
    }
    expect(readFileSync(join(sketch.dir, 'shared/data.ts'), 'utf8')).toContain("from '@shared/more'");
    expect(existsSync(join(sketch.dir, 'shared/more.ts'))).toBe(true);
    expect(existsSync(join(hero, 'shared/data.ts'))).toBe(true);
  });
});

describe('sketch new --like', () => {
  it('starts each variant as a copy of the named part, renamed to the target and without madeBy', () => {
    const target = acme();
    const product = resolveAcme(target);
    const heroFile = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(heroFile, readFileSync(heroFile, 'utf8').replace("note: '", "madeBy: ['claude-x'],\n  note: '"));

    const like = sketchSourceOf({ product: resolveAcme(target), like: 'elements/hero' });

    if (typeof like === 'string') throw new Error(like);

    const created = createSketch({ product, sketch: { layer: 'elements', name: 'banner' }, variants: ['a'], like });

    if (typeof created === 'string') throw new Error(created);

    const folder = join(created.dir, 'a/elements/banner');
    const source = readFileSync(join(folder, 'banner.ts'), 'utf8');

    expect(existsSync(join(folder, 'banner.css'))).toBe(true);
    expect(existsSync(join(folder, 'hero.ts'))).toBe(false);
    expect(source).toContain("from './banner.css?inline'");
    expect(source).toContain('One featured film');
    expect(source).not.toContain('madeBy');
  });

  it("copies a variant of an open sketch with the sketch's shared folder", () => {
    const target = acme();
    const source = open(target, 'elements/hero');

    mkdirSync(join(source.dir, 'shared'));
    writeFileSync(join(source.dir, 'shared/data.ts'), 'export const data = 1;\n');
    writeFileSync(join(source.dir, 'b/elements/hero/hero.css'), '.b {}\n');

    const product = resolveAcme(target);
    const like = sketchSourceOf({ product, like: 'elements/hero:b' });

    if (typeof like === 'string') throw new Error(like);

    const created = createSketch({ product, sketch: { layer: 'elements', name: 'banner' }, variants: ['a'], like });

    if (typeof created === 'string') throw new Error(created);

    expect(readFileSync(join(created.dir, 'a/elements/banner/banner.css'), 'utf8')).toBe('.b {}\n');
    expect(readFileSync(join(created.dir, 'shared/data.ts'), 'utf8')).toContain('data = 1');
    expect(created.variants).toEqual(['a']);
  });

  it('answers why a source is unknown', () => {
    const target = acme();
    const product = resolveAcme(target);

    open(target, 'elements/hero');

    expect(sketchSourceOf({ product, like: 'elements/nope' })).toContain('has no part elements/nope');
    expect(sketchSourceOf({ product, like: 'pages/home:a' })).toContain('has no open sketch');
    expect(sketchSourceOf({ product, like: 'elements/hero:z' })).toContain('has no variant "z"');
    expect(sketchSourceOf({ product, like: 'hero' })).toContain('names no part');
  });
});
