import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import {
  createSketch,
  decideSketch,
  findSketch,
  listSketches,
  markSketchReady,
  parseTarget,
  reportSketch,
  Sketch,
  sketchReportPath,
} from './sketch';

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
  it('writes sketch.json in progress and starts each variant from the resolved part', () => {
    const target = acme();
    const sketch = open(target, 'components/card');
    const dir = join(target, DESIGN_DIR, 'acme/sketches/components-card');

    expect(sketch.variants).toEqual(['a', 'b']);
    expect(sketchJson(target, 'components-card')).toEqual({
      target: 'components/card',
      status: 'in progress',
      createdAt: expect.any(String),
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

    expect(stub).toContain('definePart');
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

    reportSketch({ checkout: target, sketch, message: 'variant b, phone' });

    const path = sketchReportPath({ checkout: target, sketch });

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(expect.objectContaining({ message: 'variant b, phone' }));

    const ready = markSketchReady({ checkout: target, sketch });

    expect(sketchJson(target, 'elements-hero')['status']).toBe('ready');
    expect(existsSync(path)).toBe(false);
    expect(markSketchReady({ checkout: target, sketch: ready as Sketch })).toBe(
      'elements/hero is ready, not in progress',
    );
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
