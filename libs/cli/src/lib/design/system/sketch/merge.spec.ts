import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { createComment } from '../comments/comment';
import { resolveProduct } from '../resolve-product';
import { discardSketch, mergeSketch } from './merge';
import { createSketch, markSketchReady, reportSketch, Sketch, sketchReportPath } from './sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-merge-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const readySketch = (target: string) => {
  const product = resolveAcme(target);
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a', 'b'] }) as Sketch;

  return { product, sketch: markSketchReady({ checkout: target, sketch }) as Sketch };
};

const merge = (target: string, found: { product: ReturnType<typeof resolveAcme>; sketch: Sketch }, variant = 'b') =>
  mergeSketch({
    target,
    config: readConfig(target) ?? {},
    ...found,
    variant,
    note: 'Variant b, because it is calmer.',
  });

const heroOf = (target: string) => join(target, DESIGN_DIR, 'acme/elements/hero');

describe('mergeSketch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('copies the variant over the product, sets the note, checks and deletes the sketch', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const found = readySketch(target);
    const variantDir = join(found.sketch.dir, 'b');

    writeFileSync(join(variantDir, 'elements/hero/hero.css'), '.acme-hero { background: var(--acme-accent); }');
    mkdirSync(join(variantDir, 'components/card'), { recursive: true });
    cpSync(join(target, DESIGN_DIR, 'acme-base/components/card'), join(variantDir, 'components/card'), {
      recursive: true,
    });
    reportSketch({ checkout: target, sketch: found.sketch, message: 'variant b' });

    expect(merge(target, found)).toEqual(['components/card', 'elements/hero']);
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).toContain('--acme-accent');
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain("note: 'Variant b, because it is calmer.'");
    expect(existsSync(join(target, DESIGN_DIR, 'acme/components/card/card.ts'))).toBe(true);
    expect(existsSync(found.sketch.dir)).toBe(false);
    expect(existsSync(sketchReportPath({ checkout: target, sketch: found.sketch }))).toBe(false);
  }, 120_000);

  it('puts the old files back and keeps the sketch when the check fails', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const found = readySketch(target);
    const before = readFileSync(join(heroOf(target), 'hero.ts'), 'utf8');

    writeFileSync(join(found.sketch.dir, 'b/elements/hero/hero.css'), '.acme-hero { color: #fff; }');
    mkdirSync(join(found.sketch.dir, 'b/components/badge'), { recursive: true });
    writeFileSync(join(found.sketch.dir, 'b/components/badge/badge.ts'), 'export default 1;');

    expect(merge(target, found)).toContain('the check failed');
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toBe(before);
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).not.toContain('#fff');
    expect(existsSync(join(target, DESIGN_DIR, 'acme/components/badge'))).toBe(false);
    expect(existsSync(found.sketch.dir)).toBe(true);
  }, 120_000);

  it('refuses before any write', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;
    const config = readConfig(target) ?? {};

    expect(mergeSketch({ target, config, product, sketch, variant: 'a', note: 'x' })).toBe(
      'elements/hero is in progress - mark it ready before a merge',
    );

    const ready = markSketchReady({ checkout: target, sketch }) as Sketch;

    expect(mergeSketch({ target, config, product, sketch: ready, variant: 'z', note: 'x' })).toContain(
      'no variant "z"',
    );
    expect(mergeSketch({ target, config, product, sketch: ready, variant: 'a', note: ' ' })).toContain('needs --note');

    const card = createSketch({ product, sketch: { layer: 'components', name: 'card' }, variants: ['a'] }) as Sketch;

    writeFileSync(join(card.dir, 'a/components/card/card.ts'), 'export default 1;');
    expect(
      mergeSketch({
        target,
        config,
        product,
        sketch: markSketchReady({ checkout: target, sketch: card }) as Sketch,
        variant: 'a',
        note: 'x',
      }),
    ).toContain("holds no definePart({ note: '…' })");
  });

  it('refuses while the sketch has open comments', () => {
    const target = acme();
    const found = readySketch(target);
    const comment = createComment({
      product: found.product,
      comment: {
        part: 'elements/hero',
        state: 'default',
        preset: 'phone',
        text: 'Bigger.',
        sketch: { target: 'elements/hero', variant: 'a' },
      },
    });

    expect(typeof comment).toBe('object');
    expect(merge(target, found)).toContain('elements/hero has 1 open comment(s)');
    expect(discardSketch({ target, sketch: found.sketch })).toContain('elements/hero has 1 open comment(s)');
    expect(existsSync(found.sketch.dir)).toBe(true);
  });
});

describe('discardSketch', () => {
  it('deletes the sketch with its variants', () => {
    const target = acme();
    const { sketch } = readySketch(target);

    expect(discardSketch({ target, sketch })).toBeNull();
    expect(existsSync(sketch.dir)).toBe(false);
    expect(existsSync(join(heroOf(target), 'hero.ts'))).toBe(true);
  });
});
