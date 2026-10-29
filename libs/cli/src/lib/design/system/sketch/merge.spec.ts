import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { commentsOnSketch, CommentFile, createComment, DesignComment, replyToComment } from '../comments/comment';
import { resolveProduct } from '../resolve-product';
import { discardSketch, mergeSketch } from './merge';
import { changedOutsideSketchOf, readMerged, recordMerged } from './merged-parts';
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

const reasonOf = (result: ReturnType<typeof mergeSketch>) => (Array.isArray(result) ? result : result.reason);

const mergeResult = (target: string, found: { product: ReturnType<typeof resolveAcme>; sketch: Sketch }) =>
  mergeSketch({
    target,
    config: readConfig(target) ?? {},
    product: resolveAcme(target),
    sketch: found.sketch,
    note: 'Variant b, because it is calmer.',
  });

const merge = (target: string, found: { product: ReturnType<typeof resolveAcme>; sketch: Sketch }) =>
  reasonOf(mergeResult(target, found));

const addressedOf = (comment: DesignComment) =>
  (JSON.parse(readFileSync(comment.file, 'utf8')) as CommentFile).addressed;

const commentOn = (product: ReturnType<typeof resolveAcme>, sketch?: { target: string; variant: string }) =>
  createComment({
    product,
    comment: { part: 'elements/hero', state: 'default', size: 'phone', text: 'Bigger.', ...(sketch ? { sketch } : {}) },
  }) as DesignComment;

const heroOf = (target: string) => join(target, DESIGN_DIR, 'acme/elements/hero');

describe('mergeSketch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('records the merged parts, so a later change outside a sketch shows', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);

    expect(merge(target, { ...ready, sketch: picked(ready.sketch) })).toEqual(['elements/hero']);
    expect(Object.keys(readMerged(join(target, DESIGN_DIR, 'acme')))).toEqual(['elements/hero']);
    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);

    writeFileSync(join(heroOf(target), 'hero.css'), '.acme-hero { padding: 0; }');

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual(['elements/hero']);
  });

  it('copies the variant over the product, sets the note, checks and deletes the sketch', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const product = resolveAcme(target);
    let drafted = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const variantDir = join(drafted.dir, 'b');

    writeFileSync(join(variantDir, 'elements/hero/hero.css'), '.acme-hero { background: var(--acme-accent); }');
    mkdirSync(join(variantDir, 'components/card'), { recursive: true });
    cpSync(join(target, DESIGN_DIR, 'acme-base/components/card'), join(variantDir, 'components/card'), {
      recursive: true,
    });
    drafted = reportSketch({
      checkout: target,
      sketch: drafted,
      variant: 'b',
      author: 'gpt-5.6-sol',
      message: 'phone',
    }) as Sketch;
    drafted = reportSketch({
      checkout: target,
      sketch: drafted,
      variant: 'b',
      author: 'claude-opus-5-5',
      message: 'phone',
    }) as Sketch;

    const found = {
      product,
      sketch: picked(markSketchReady({ checkout: target, sketch: drafted }) as Sketch),
    };

    expect(merge(target, found)).toEqual(['components/card', 'elements/hero']);
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain(
      "madeBy: ['gpt-5.6-sol', 'claude-opus-5-5']",
    );
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).toContain('--acme-accent');
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain("note: 'Variant b, because it is calmer.'");
    expect(existsSync(join(target, DESIGN_DIR, 'acme/components/card/card.ts'))).toBe(true);
    expect(existsSync(found.sketch.dir)).toBe(false);
    expect(existsSync(sketchReportPath({ checkout: target, sketch: found.sketch }))).toBe(false);
  }, 120_000);

  it('keeps the note and madeBy of the variant file without a note or authors, and adds new authors to madeBy', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const config = readConfig(target) ?? {};
    const heroFile = (dir: string) => join(dir, 'b/elements/hero/hero.ts');
    const mergeWithoutNote = (sketch: Sketch) =>
      reasonOf(mergeSketch({ target, config, product: resolveAcme(target), sketch: picked(sketch) }));
    const first = readySketch(target).sketch;

    writeFileSync(
      heroFile(first.dir),
      readFileSync(heroFile(first.dir), 'utf8').replace(
        "note: 'One featured film with its play button.',",
        "note: 'Calm hero.',\n  madeBy: ['gpt-5.6-sol'],",
      ),
    );

    expect(mergeWithoutNote(first)).toEqual(['elements/hero']);
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain(
      "note: 'Calm hero.',\n  madeBy: ['gpt-5.6-sol'],",
    );

    const product = resolveAcme(target);
    const created = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
      author: 'claude-opus-5-5',
    }) as Sketch;

    expect(mergeWithoutNote(markSketchReady({ checkout: target, sketch: created }) as Sketch)).toEqual([
      'elements/hero',
    ]);
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain(
      "note: 'Calm hero.',\n  madeBy: ['gpt-5.6-sol', 'claude-opus-5-5'],",
    );
  }, 240_000);

  it('gives a new part the picked variant note when the merge names none', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const created = createSketch({
      product: resolveAcme(target),
      sketch: { layer: 'elements', name: 'badge' },
      variants: ['a', 'b'],
      variantNotes: new Map([['b', 'Round badge.']]),
    }) as Sketch;
    const sketch = picked(markSketchReady({ checkout: target, sketch: created }) as Sketch);

    expect(
      reasonOf(mergeSketch({ target, config: readConfig(target) ?? {}, product: resolveAcme(target), sketch })),
    ).toEqual(['elements/badge']);
    expect(readFileSync(join(target, DESIGN_DIR, 'acme/elements/badge/badge.ts'), 'utf8')).toContain(
      "note: 'Round badge.'",
    );
  }, 240_000);

  it('merges past a problem the product already had and prints it as a note', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();

    mkdirSync(join(target, DESIGN_DIR, 'acme/assets'), { recursive: true });
    writeFileSync(join(target, DESIGN_DIR, 'acme/assets/mark.svg'), '<svg viewBox="0 0 8 8"/>');

    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };

    expect(merge(target, found)).toEqual(['elements/hero']);
    expect(existsSync(found.sketch.dir)).toBe(false);
    expect([...log.mock.calls, ...warn.mock.calls].flat().join('\n')).toContain('SVG-ASSET');
  }, 240_000);

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

    expect(reasonOf(mergeSketch({ target, config, product, sketch, note: 'x' }))).toBe(
      'elements/hero is in progress - mark it ready before a merge',
    );

    const ready = markSketchReady({ checkout: target, sketch }) as Sketch;

    expect(reasonOf(mergeSketch({ target, config, product, sketch: ready, note: 'x' }))).toBe(
      'elements/hero has no pick - the user picks a variant in Studio before a merge',
    );
    expect(
      reasonOf(mergeSketch({ target, config, product, sketch: { ...picked(ready, 'a'), variants: [] }, note: 'x' })),
    ).toContain('no variant "a", the one picked');

    const card = createSketch({ product, sketch: { layer: 'components', name: 'card' }, variants: ['a'] }) as Sketch;

    writeFileSync(join(card.dir, 'a/components/card/card.ts'), 'export default 1;');
    expect(
      reasonOf(
        mergeSketch({
          target,
          config,
          product,
          sketch: picked(markSketchReady({ checkout: target, sketch: card }) as Sketch, 'a'),
          note: 'x',
        }),
      ),
    ).toContain("holds no definePart({ note: '…' })");
  });

  it('refuses when a part the variant replaces changed in the product, until the sketch is rebased', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };

    writeFileSync(join(heroOf(target), 'hero.css'), '.acme-hero { padding: 0; }');

    expect(mergeResult(target, found)).toEqual({
      reason:
        'elements/hero changed in the product since the sketch on elements/hero was created - bring variant "b" up to date, then run sketch rebase elements/hero',
      changed: ['elements/hero'],
    });
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).toBe('.acme-hero { padding: 0; }');

    const rebased = rebaseSketch({ product: resolveAcme(target), sketch: found.sketch });

    expect(merge(target, { ...found, sketch: rebased })).toEqual(['elements/hero']);
  }, 120_000);

  it('refuses a sketch that records no baseline', () => {
    const target = acme();
    const ready = readySketch(target);
    const refused = mergeResult(target, { ...ready, sketch: { ...picked(ready.sketch), baseline: undefined } });

    expect(refused).toMatchObject({ changed: [] });
    expect(reasonOf(refused)).toContain('records no baseline of the product');
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

  it('marks the open comments on the sketch addressed and keeps those on the product part open', () => {
    const target = acme();
    const found = readySketch(target);
    const onSketch = commentOn(found.product, { target: 'elements/hero', variant: 'a' });
    const onPart = commentOn(found.product);

    replyToComment({
      products: [{ name: found.product.name, dir: found.product.dir }],
      id: onSketch.id,
      by: 'agent',
      author: 'gpt-5.6-sol',
      text: 'Bigger how?',
    });

    expect(merge(target, { ...found, sketch: picked(found.sketch) })).toEqual(['elements/hero']);
    expect(addressedOf(onSketch)).toMatchObject({ by: 'user', reason: 'merge' });
    expect(addressedOf(onPart)).toBeUndefined();
    expect(commentsOnSketch({ productDir: found.product.dir, product: 'acme', sketch: found.sketch })).toEqual([]);
  }, 120_000);
});

describe('mergeSketch with assets', () => {
  afterEach(() => vi.restoreAllMocks());

  it("copies the variant's assets into the product's, keeps the others and records the hash with them", () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const assets = join(target, DESIGN_DIR, 'acme/assets');

    mkdirSync(assets);
    writeFileSync(join(assets, 'mark.png'), 'old');
    writeFileSync(join(assets, 'keep.png'), 'keep');

    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };
    const variant = join(found.sketch.dir, 'b');
    const hero = join(variant, 'elements/hero/hero.ts');

    mkdirSync(join(variant, 'assets/icons'), { recursive: true });
    writeFileSync(join(variant, 'assets/mark.png'), 'new');
    writeFileSync(join(variant, 'assets/icons/dot.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    writeFileSync(
      hero,
      `import mark from '@assets/mark.png';\n${readFileSync(hero, 'utf8')}\nexport const url = mark;\n`,
    );

    expect(merge(target, found)).toEqual(['elements/hero']);
    expect(readFileSync(join(assets, 'mark.png'), 'utf8')).toBe('new');
    expect(readFileSync(join(assets, 'icons/dot.svg'), 'utf8')).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(readFileSync(join(assets, 'keep.png'), 'utf8')).toBe('keep');
    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);

    writeFileSync(join(assets, 'mark.png'), 'newer');

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual(['elements/hero']);
  }, 120_000);
});

describe('mergeSketch with an asset another part uses', () => {
  afterEach(() => vi.restoreAllMocks());

  const withDependents = (options: { foreignEdit: boolean }) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = acme();
    const assets = join(target, DESIGN_DIR, 'acme/assets');
    const home = join(target, DESIGN_DIR, 'acme/pages/home');
    const homeFile = join(home, 'home.ts');

    mkdirSync(assets);
    writeFileSync(join(assets, 'mark.png'), 'old');
    writeFileSync(
      homeFile,
      `import mark from '@assets/mark.png';\n${readFileSync(homeFile, 'utf8')}\nexport const m = mark;\n`,
    );
    recordMerged({ product: resolveAcme(target), parts: ['pages/home'] });

    if (options.foreignEdit) writeFileSync(join(home, 'home.css'), '.acme-home { margin: 0; }');

    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };

    mkdirSync(join(found.sketch.dir, 'b/assets'), { recursive: true });
    writeFileSync(join(found.sketch.dir, 'b/assets/mark.png'), 'new');

    expect(merge(target, found)).toEqual(['elements/hero']);

    return { target, log };
  };

  it('re-records the hash of a part that uses the changed asset, and lists it', () => {
    const { target, log } = withDependents({ foreignEdit: false });

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);
    expect(log).toHaveBeenCalledWith('Asset change also updates: pages/home');
  }, 120_000);

  it('keeps a part with a foreign edit before the merge showing as changed outside a sketch', () => {
    const { target, log } = withDependents({ foreignEdit: true });

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual(['pages/home']);
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Asset change also updates'));
  }, 120_000);
});

describe('mergeSketch with a shared folder', () => {
  afterEach(() => vi.restoreAllMocks());

  const withShared = (target: string) => {
    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };
    const hero = join(found.sketch.dir, 'b/elements/hero/hero.ts');

    mkdirSync(join(found.sketch.dir, 'shared'));
    writeFileSync(join(found.sketch.dir, 'shared/data.ts'), "export { more as data } from '@shared/more';\n");
    writeFileSync(join(found.sketch.dir, 'shared/more.ts'), 'export const more = 1;\n');
    writeFileSync(
      hero,
      `import { data } from '@shared/data';\n${readFileSync(hero, 'utf8')}\nexport const shared = data;\n`,
    );

    return found;
  };

  it("moves the sketch's shared folder into the target and makes its imports relative", () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();

    expect(merge(target, withShared(target))).toEqual(['elements/hero']);
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain("from './shared/data'");
    expect(readFileSync(join(heroOf(target), 'shared/data.ts'), 'utf8')).toContain("from './more'");
    expect(existsSync(join(heroOf(target), 'shared/more.ts'))).toBe(true);
  }, 120_000);

  it('refuses when a part other than the target imports @shared/', () => {
    const target = acme();
    const found = withShared(target);
    const card = join(found.sketch.dir, 'b/components/card');

    cpSync(join(target, DESIGN_DIR, 'acme-base/components/card'), card, { recursive: true });
    writeFileSync(join(card, 'card.ts'), `import '@shared/more';\n${readFileSync(join(card, 'card.ts'), 'utf8')}`);

    expect(merge(target, found)).toContain('components/card import @shared/');
    expect(existsSync(join(heroOf(target), 'shared'))).toBe(false);
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

  it('marks the open comments on the sketch addressed and keeps those on the product part open', () => {
    const target = acme();
    const { product, sketch } = readySketch(target);
    const onSketch = commentOn(product, { target: 'elements/hero', variant: 'b' });
    const onPart = commentOn(product);

    expect(discardSketch({ target, sketch, author: 'gpt-5.6-sol' })).toBeNull();
    expect(existsSync(sketch.dir)).toBe(false);
    expect(addressedOf(onSketch)).toMatchObject({ by: 'agent', author: 'gpt-5.6-sol', reason: 'discard' });
    expect(addressedOf(onPart)).toBeUndefined();
  });
});
