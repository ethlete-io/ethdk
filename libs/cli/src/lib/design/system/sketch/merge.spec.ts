import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { createComment, DesignComment, replyToComment } from '../comments/comment';
import { resolveProduct } from '../resolve-product';
import { discardSketch, mergeSketch } from './merge';
import {
  createSketch,
  decideSketch,
  markSketchReady,
  rebaseSketch,
  reportSketch,
  Sketch,
  sketchReportPath,
  SketchTarget,
} from './sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-merge-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const readySketch = (target: string, sketch: SketchTarget = { layer: 'elements', name: 'hero' }) => {
  const product = resolveAcme(target);
  const created = createSketch({ product, sketch, variants: ['a', 'b'] }) as Sketch;

  return { product, sketch: markSketchReady({ checkout: target, sketch: created }) as Sketch };
};

const picked = (sketch: Sketch, variant = 'b') =>
  decideSketch({ sketch, decision: { kind: 'pick', variant } }) as Sketch;

const merge = (target: string, found: { product: ReturnType<typeof resolveAcme>; sketch: Sketch }) =>
  mergeSketch({
    target,
    config: readConfig(target) ?? {},
    product: resolveAcme(target),
    sketch: found.sketch,
    note: 'Variant b, because it is calmer.',
  });

const heroOf = (target: string) => join(target, DESIGN_DIR, 'acme/elements/hero');

describe('mergeSketch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('copies the variant over the product, sets the note, checks and deletes the sketch', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };
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
    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };
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

    expect(mergeSketch({ target, config, product, sketch, note: 'x' })).toBe(
      'elements/hero is in progress - mark it ready before a merge',
    );

    const ready = markSketchReady({ checkout: target, sketch }) as Sketch;

    expect(mergeSketch({ target, config, product, sketch: ready, note: 'x' })).toBe(
      'elements/hero has no pick - the user picks a variant in Studio before a merge',
    );
    expect(mergeSketch({ target, config, product, sketch: picked(ready, 'a'), note: ' ' })).toContain('needs --note');
    expect(
      mergeSketch({ target, config, product, sketch: { ...picked(ready, 'a'), variants: [] }, note: 'x' }),
    ).toContain('no variant "a", the one picked');

    const card = createSketch({ product, sketch: { layer: 'components', name: 'card' }, variants: ['a'] }) as Sketch;

    writeFileSync(join(card.dir, 'a/components/card/card.ts'), 'export default 1;');
    expect(
      mergeSketch({
        target,
        config,
        product,
        sketch: picked(markSketchReady({ checkout: target, sketch: card }) as Sketch, 'a'),
        note: 'x',
      }),
    ).toContain("holds no definePart({ note: '…' })");
  });

  it('refuses when a part the variant replaces changed in the product, until the sketch is rebased', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };

    writeFileSync(join(heroOf(target), 'hero.css'), '.acme-hero { padding: 0; }');

    expect(merge(target, found)).toBe(
      'elements/hero changed in the product since the sketch on elements/hero was created - bring variant "b" up to date, then run sketch rebase elements/hero',
    );
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).toBe('.acme-hero { padding: 0; }');

    const rebased = rebaseSketch({ product: resolveAcme(target), sketch: found.sketch });

    expect(merge(target, { ...found, sketch: rebased })).toEqual(['elements/hero']);
  }, 120_000);

  it('refuses a sketch that records no baseline', () => {
    const target = acme();
    const ready = readySketch(target);
    expect(merge(target, { ...ready, sketch: { ...picked(ready.sketch), baseline: undefined } })).toContain(
      'records no baseline of the product',
    );
  });

  it('copies a target the product takes from its base into the product to carry the note', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target, { layer: 'components', name: 'card' });
    const found = { ...ready, sketch: picked(ready.sketch) };
    const variantDir = join(found.sketch.dir, 'b');

    rmSync(join(variantDir, 'components'), { recursive: true });
    cpSync(join(target, DESIGN_DIR, 'acme-base/foundations/tokens'), join(variantDir, 'foundations/tokens'), {
      recursive: true,
    });

    expect(merge(target, found)).toEqual(['components/card', 'foundations/tokens']);
    expect(readFileSync(join(target, DESIGN_DIR, 'acme/components/card/card.ts'), 'utf8')).toContain(
      "note: 'Variant b, because it is calmer.'",
    );
    expect(resolveAcme(target).parts.find((part) => part.name === 'card')?.origin).toBe('overridden');
  }, 120_000);

  it('refuses while the sketch has open comments', () => {
    const target = acme();
    const found = readySketch(target);
    const comment = createComment({
      product: found.product,
      comment: {
        part: 'elements/hero',
        state: 'default',
        size: 'phone',
        text: 'Bigger.',
        sketch: { target: 'elements/hero', variant: 'a' },
      },
    });

    expect(typeof comment).toBe('object');
    expect(merge(target, { ...found, sketch: picked(found.sketch) })).toContain('elements/hero has 1 open comment(s)');
    expect(discardSketch({ target, sketch: found.sketch })).toContain('elements/hero has 1 open comment(s)');
    expect(existsSync(found.sketch.dir)).toBe(true);

    replyToComment({
      products: [{ name: found.product.name, dir: found.product.dir }],
      id: (comment as DesignComment).id,
      by: 'agent',
      text: 'Bigger how?',
    });

    expect(merge(target, { ...found, sketch: picked(found.sketch) })).toContain('elements/hero has 1 open comment(s)');
    expect(discardSketch({ target, sketch: found.sketch })).toContain('elements/hero has 1 open comment(s)');
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
