import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { partKeyOf, resolveProduct } from '../resolve-product';
import {
  addVariant,
  authorsOf,
  createSketch,
  decideSketch,
  editRound,
  findSketch,
  listSketches,
  markSketchReady,
  parseTarget,
  readSketch,
  readSketchReport,
  rebaseSketch,
  rejectionOf,
  reportSketch,
  Sketch,
  SketchMerge,
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

const open = (target: string, sketch: string, variants = ['a', 'b'], merge?: SketchMerge) => {
  const parsed = parseTarget(sketch);

  if (typeof parsed === 'string') throw new Error(parsed);

  const created = createSketch({ product: resolveAcme(target), sketch: parsed, variants, merge });

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
    expect(existsSync(join(dir, 'b/assets'))).toBe(true);
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

describe('a sketch with several targets', () => {
  const several = (target: string) =>
    createSketch({
      merge: 'override',
      product: resolveAcme(target),
      sketch: { layer: 'components', name: 'button' },
      others: [
        { layer: 'elements', name: 'hero' },
        { layer: 'components', name: 'card' },
      ],
      variants: ['a'],
    });

  it('copies every target into each variant and records them in sketch.json, the first as the target', () => {
    const target = acme();
    const created = several(target) as Sketch;
    const variant = join(target, DESIGN_DIR, 'acme/sketches/components-button/a');

    expect(created.targets).toEqual(['components/button', 'elements/hero', 'components/card']);
    expect(existsSync(join(variant, 'components/button/button.ts'))).toBe(true);
    expect(existsSync(join(variant, 'elements/hero/hero.ts'))).toBe(true);
    expect(existsSync(join(variant, 'components/card/card.ts'))).toBe(true);
    expect(sketchJson(target, 'components-button')).toEqual(
      expect.objectContaining({
        target: 'components/button',
        targets: ['components/button', 'elements/hero', 'components/card'],
      }),
    );
  });

  it('is found by any of its targets, and holds them against a second sketch', () => {
    const target = acme();
    const productDir = join(target, DESIGN_DIR, 'acme');

    several(target);

    expect(
      (findSketch({ productDir, product: 'acme', sketch: { layer: 'elements', name: 'hero' } }) as Sketch).target,
    ).toBe('components/button');
    expect(
      createSketch({ product: resolveAcme(target), sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }),
    ).toBe('elements/hero already has an open sketch - merge or discard it first');
  });

  it('reads a one-target sketch.json without targets as one target, and writes none back', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');

    expect(sketch.targets).toEqual(['elements/hero']);
    expect(sketchJson(target, 'elements-hero')).not.toHaveProperty('targets');
  });

  it('refuses a target named twice, and --like with several targets', () => {
    const target = acme();
    const product = resolveAcme(target);
    const hero = { layer: 'elements' as const, name: 'hero' };

    expect(createSketch({ product, sketch: hero, others: [hero], variants: ['a'] })).toBe('name each target once');
    expect(
      createSketch({
        product,
        sketch: hero,
        others: [{ layer: 'components', name: 'card' }],
        variants: ['a'],
        like: { folder: '', name: 'hero', shared: null },
      }),
    ).toContain('--like starts one target');
  });
});

describe('createSketch on a part the product overrides', () => {
  it('refuses without --override or --into-base and names both', () => {
    const target = acme();
    const refused = createSketch({
      product: resolveAcme(target),
      sketch: { layer: 'components', name: 'button' },
      variants: ['a'],
    });

    expect(refused).toContain('acme overrides the acme-base base part components/button');
    expect(refused).toContain('--into-base');
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button'))).toBe(false);
  });

  it('records the merge mode in sketch.json', () => {
    const target = acme();

    expect(open(target, 'components/button', ['a'], 'into-base').merge).toBe('into-base');
    expect(
      JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/sketches/components-button/sketch.json'), 'utf8')),
    ).toMatchObject({ merge: 'into-base' });
  });

  it('refuses --into-base on a part the product does not override', () => {
    expect(
      createSketch({
        product: resolveAcme(acme()),
        sketch: { layer: 'components', name: 'card' },
        variants: ['a'],
        merge: 'into-base',
      }),
    ).toBe('--into-base: acme has no override of components/card');
  });
});

describe('listSketches and findSketch', () => {
  it('skips an entry that vanished before it was read', () => {
    const target = acme();
    const productDir = join(target, DESIGN_DIR, 'acme');

    open(target, 'elements/hero');
    symlinkSync(join(target, 'gone'), join(productDir, 'sketches/elements-gone'));

    const listed = listSketches({ productDir, product: 'acme' });

    expect(listed.map((entry) => (entry as Sketch).target)).toEqual(['elements/hero']);
  });

  it('reads every sketch folder and reports one without sketch.json', () => {
    const target = acme();
    const productDir = join(target, DESIGN_DIR, 'acme');

    open(target, 'elements/hero');
    open(target, 'components/button', ['x'], 'override');
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
  });

  it('refuses a report on a ready sketch without reopen, moves it back to in progress with it, and refuses a decided one', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');
    const ready = markSketchReady({ checkout: target, sketch }) as Sketch;

    expect(reportSketch({ checkout: target, sketch: ready, variant: 'a', author: 'gpt-5.6-sol', message: 'fix' })).toBe(
      'elements/hero is ready - a report moves it back to in progress, so nothing was recorded; add --reopen if the user asked for a change',
    );
    expect(sketchJson(target, 'elements-hero')['status']).toBe('ready');
    expect(readSketchReport({ checkout: target, sketch })).toBeNull();

    const reopened = reportSketch({
      checkout: target,
      sketch: ready,
      variant: 'a',
      author: 'gpt-5.6-sol',
      message: 'fix',
      reopen: true,
    });

    expect((reopened as Sketch).status).toBe('in progress');
    expect(sketchJson(target, 'elements-hero')['status']).toBe('in progress');
    expect(readSketchReport({ checkout: target, sketch })?.message).toBe('fix');

    const again = markSketchReady({ checkout: target, sketch: reopened as Sketch }) as Sketch;
    const decided = decideSketch({ sketch: again, decision: { kind: 'pick', variant: 'a' } }) as Sketch;

    expect(
      reportSketch({ checkout: target, sketch: decided, variant: 'a', author: 'gpt-5.6-sol', message: 'late' }),
    ).toBe('elements/hero is decided (pick) - a report would reopen it, so nothing was recorded');
    expect(sketchJson(target, 'elements-hero')['status']).toBe('ready');
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

describe('variant verdicts', () => {
  const ready = (target: string) =>
    markSketchReady({ checkout: target, sketch: open(target, 'elements/hero') }) as Sketch;

  it('rejects a variant, refuses its pick, keeps the other variants pickable, and survives a reload', () => {
    const target = acme();
    const rejected = decideSketch({
      sketch: ready(target),
      decision: { kind: 'reject', variant: 'a', reason: 'too loud', by: 'designer' },
    }) as Sketch;

    expect(sketchJson(target, 'elements-hero')['rejections']).toEqual({
      a: [{ by: 'designer', decidedAt: expect.any(String), reason: 'too loud', reasonBy: 'designer' }],
    });

    const reloaded = readSketch({ product: 'acme', dir: rejected.dir }) as Sketch;

    expect(rejectionOf(reloaded, 'a')).toMatchObject({ reason: 'too loud' });
    expect(rejectionOf(reloaded, 'b')).toBeNull();
    expect(decideSketch({ sketch: reloaded, decision: { kind: 'pick', variant: 'a' } })).toBe(
      'elements/hero variant a is rejected by the designer: too loud - reopen it first',
    );
    expect(decideSketch({ sketch: reloaded, decision: { kind: 'pick', variant: 'b' } })).toMatchObject({
      decision: { kind: 'pick', variant: 'b' },
    });
  });

  it('rejects without a reason, then records a reason with its own origin', () => {
    const target = acme();
    const rejected = decideSketch({
      sketch: ready(target),
      decision: { kind: 'reject', variant: 'a', by: 'agent' },
    }) as Sketch;

    expect(rejectionOf(rejected, 'a')).toEqual({ by: 'agent', decidedAt: expect.any(String) });
    expect(decideSketch({ sketch: rejected, decision: { kind: 'reject', variant: 'a', by: 'agent' } })).toContain(
      'is already rejected',
    );

    const reasoned = decideSketch({
      sketch: rejected,
      decision: { kind: 'reason', variant: 'a', reason: 'off brand', by: 'designer' },
    }) as Sketch;

    expect(rejectionOf(reasoned, 'a')).toEqual({
      by: 'agent',
      decidedAt: expect.any(String),
      reason: 'off brand',
      reasonBy: 'designer',
    });
  });

  it('reopens with the earlier verdict kept, and rejects again on top of it', () => {
    const target = acme();
    const rejected = decideSketch({
      sketch: ready(target),
      decision: { kind: 'reject', variant: 'a', reason: 'too loud', by: 'agent' },
    }) as Sketch;
    const reopened = decideSketch({
      sketch: rejected,
      decision: { kind: 'reopen', variant: 'a', reason: 'worth a second look', by: 'designer' },
    }) as Sketch;

    expect(rejectionOf(reopened, 'a')).toBeNull();
    expect(decideSketch({ sketch: reopened, decision: { kind: 'reopen', variant: 'a', by: 'designer' } })).toBe(
      'elements/hero variant a is not rejected',
    );
    expect(decideSketch({ sketch: reopened, decision: { kind: 'pick', variant: 'a' } })).toMatchObject({
      decision: { kind: 'pick', variant: 'a' },
    });

    const again = decideSketch({
      sketch: readSketch({ product: 'acme', dir: reopened.dir }) as Sketch,
      decision: { kind: 'reject', variant: 'a', by: 'designer' },
    }) as Sketch;

    expect(again.decision).toBeUndefined();
    expect(sketchJson(target, 'elements-hero')['rejections']).toEqual({
      a: [
        {
          by: 'agent',
          decidedAt: expect.any(String),
          reason: 'too loud',
          reasonBy: 'agent',
          reopened: { by: 'designer', decidedAt: expect.any(String), reason: 'worth a second look' },
        },
        { by: 'designer', decidedAt: expect.any(String) },
      ],
    });
  });

  it('refuses a verdict on an unknown variant', () => {
    expect(
      decideSketch({ sketch: ready(acme()), decision: { kind: 'reject', variant: 'z', by: 'designer' } }),
    ).toContain('has no variant "z"');
  });

  it('refuses a sketch.json with malformed rejections', () => {
    const target = acme();
    const sketch = ready(target);
    const file = join(sketch.dir, 'sketch.json');
    const write = (rejections: unknown) =>
      writeFileSync(file, JSON.stringify({ ...sketchJson(target, 'elements-hero'), rejections }));

    write({ a: [{ by: 'someone', decidedAt: 'now' }] });
    expect(readSketch({ product: 'acme', dir: sketch.dir })).toContain('rejections must be');
    write({
      a: [
        { by: 'agent', decidedAt: 'now' },
        { by: 'agent', decidedAt: 'later' },
      ],
    });
    expect(readSketch({ product: 'acme', dir: sketch.dir })).toContain('each but the last reopened');
    write({ a: [{ by: 'agent', decidedAt: 'now', reopened: { by: 'designer', decidedAt: 'later' } }] });
    expect(readSketch({ product: 'acme', dir: sketch.dir })).toMatchObject({ variants: ['a', 'b'] });
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

  it('keeps relative links in variant shared files pointing into the copied variant', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');
    const shared = join(sketch.dir, 'a/shared');

    mkdirSync(shared);
    writeFileSync(join(shared, 'data.ts'), 'export const data = 1;\n');
    symlinkSync('data.ts', join(shared, 'linked.ts'));
    addVariant({ sketch, variant: 'c', from: 'a' });
    writeFileSync(join(sketch.dir, 'c/shared/data.ts'), 'export const data = 2;\n');

    expect(readFileSync(join(sketch.dir, 'c/shared/linked.ts'), 'utf8')).toBe('export const data = 2;\n');
    expect(readFileSync(join(shared, 'linked.ts'), 'utf8')).toBe('export const data = 1;\n');
  });

  it('copies a variant into the running round, back to in progress and without the pick', () => {
    const target = acme();
    const sketch = open(target, 'elements/hero');
    const dir = sketch.dir;

    writeFileSync(join(dir, 'b/elements/hero/hero.css'), '.acme-hero { gap: 1rem; }');
    rmSync(join(dir, 'b/assets'), { recursive: true });
    decideSketch({
      sketch: markSketchReady({ checkout: target, sketch }) as Sketch,
      decision: { kind: 'pick', variant: 'a' },
    });

    const added = addVariant({ sketch: find(target), variant: 'c', from: 'b' }) as Sketch;

    expect(added.variants).toEqual(['a', 'b', 'c']);
    expect(readFileSync(join(dir, 'c/elements/hero/hero.css'), 'utf8')).toBe('.acme-hero { gap: 1rem; }');
    expect(existsSync(join(dir, 'c/assets'))).toBe(true);
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
    editRound({ sketch: find(target), round: 'r1', note: 'pill and square' });

    addVariant({
      sketch: find(target),
      variant: 'c',
      from: 'a',
      round: { title: 'Solid a, outline b', lostNote: 'pill or square; the user wants both', note: 'two buttons' },
    });
    addVariant({ sketch: find(target), variant: 'd', from: 'c' });

    expect(find(target).rounds).toEqual([
      { key: 'r1', title: '', note: 'pill and square', lost: 'pill or square; the user wants both' },
      { key: 'r2', title: 'Solid a, outline b', note: 'two buttons' },
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

  it('refuses several targets whose shared folders hold the same path with different contents', () => {
    const target = acme();
    const product = resolveAcme(target);
    const folderOf = (key: string) => join(product.parts.find((part) => partKeyOf(part) === key)?.file ?? '', '..');
    const openOnTwo = () =>
      createSketch({
        product: resolveAcme(target),
        sketch: { layer: 'elements', name: 'hero' },
        others: [{ layer: 'components', name: 'card' }],
        variants: ['a'],
      });

    for (const [key, source] of [
      ['elements/hero', 'export const data = 1;\n'],
      ['components/card', 'export const data = 2;\n'],
    ] as const) {
      mkdirSync(join(folderOf(key), 'shared'));
      writeFileSync(join(folderOf(key), 'shared/data.ts'), source);
    }

    expect(openOnTwo()).toContain('elements/hero and components/card each hold a different shared/data.ts');

    writeFileSync(join(folderOf('components/card'), 'shared/data.ts'), 'export const data = 1;\n');

    expect(typeof openOnTwo()).toBe('object');
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
