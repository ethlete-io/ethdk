import { originOf } from '../write-origin';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../design-config';
import { commitAll, initGitRepo } from '../git-repo.fixtures';
import { Problem } from '../problem';
import { resolveProduct } from '../resolve-product';
import { mergeSketch } from './merge';
import { recordMerged } from './merged-parts';
import { createSketch, decideSketch, listSketches, markSketchReady, Sketch, variantDirOf } from './sketch';
import { openPointsText } from '../open-points';
import { partPointsOf, readOpenPoints } from '../read-open-points';
import { undesignedLiveProblemOf } from '../live-compare';
import {
  BUILT_VARIANT,
  openUndesignedSketch,
  openUndesignedSketches,
  withoutWaitingUndesigned,
} from './undesigned-sketch';

const HERO = 'elements/hero';
const BRANCH = '@if (!film().title)';
const MISSING = { state: 'untitled', props: { film: { title: '' } } };
const PICTURE = Buffer.from('built look');

const acme = (heroEdit?: (source: string) => string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-undesigned-sketch-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  if (heroEdit) {
    const hero = join(resolveAcme(target).dir, HERO, 'hero.ts');

    writeFileSync(hero, heroEdit(readFileSync(hero, 'utf8')));
  }
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');
  recordMerged({ product: resolveAcme(target), parts: [HERO] });
  initGitRepo(target, 'base');

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const hit = (target: string, missing: Problem['missing'] | null = MISSING): Problem => ({
  rule: 'STATE-UNDESIGNED',
  file: join(resolveAcme(target).dir, HERO, 'hero.ts'),
  message: `${BRANCH} in hero.component.ts renders something no design state draws`,
  at: BRANCH,
  ...(missing ? { missing } : {}),
});

const sketchesOf = (target: string) =>
  listSketches({ productDir: resolveAcme(target).dir, product: 'acme' }).filter(
    (sketch): sketch is Sketch => typeof sketch !== 'string',
  );

describe('openUndesignedSketch (B251b)', () => {
  it('opens <part>@<state> with the built look as its variant: the state declared, drawn as the app picture', () => {
    const target = acme();
    const sketch = openUndesignedSketch({
      target,
      product: resolveAcme(target),
      part: HERO,
      branch: BRANCH,
      missing: MISSING,
      picture: PICTURE,
    }) as Sketch;
    const built = join(sketch.dir, BUILT_VARIANT, HERO);

    expect(sketch.target).toBe(`${HERO}@untitled`);
    expect(sketch.variants).toEqual([BUILT_VARIANT]);
    expect(sketch.undesigned).toEqual([BRANCH]);
    expect(readFileSync(join(built, 'hero.ts'), 'utf8')).toContain(`'untitled': ${JSON.stringify(MISSING.props)}`);
    expect(readFileSync(join(built, 'untitled.built.ts'), 'utf8')).toContain(
      `data:image/png;base64,${PICTURE.toString('base64')}`,
    );
  });

  it('wraps a part that already declares Props and states into a variant the design server can transform', async () => {
    const target = acme(
      (source) =>
        `${source.replace('export type HeroProps', 'type Props = { film: Film };\nexport type HeroProps')}\nexport const states = {};\n`,
    );
    const sketch = openUndesignedSketch({
      target,
      product: resolveAcme(target),
      part: HERO,
      branch: BRANCH,
      missing: MISSING,
      picture: PICTURE,
    }) as Sketch;
    const file = join(sketch.dir, BUILT_VARIANT, HERO, 'hero.ts');

    const { transformWithOxc } = await import('vite');
    await expect(transformWithOxc(readFileSync(file, 'utf8'), file)).resolves.toBeDefined();
  });

  it('lets the hit wait while the sketch is open, and fails it again once the sketch has a pick', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = openUndesignedSketch({
      target,
      product,
      part: HERO,
      branch: BRANCH,
      missing: MISSING,
      picture: PICTURE,
    }) as Sketch;

    expect(withoutWaitingUndesigned(product, [hit(target)])).toEqual([]);
    expect(withoutWaitingUndesigned(product, [{ ...hit(target), at: '@if (other())' }])).toHaveLength(1);

    decideSketch({ sketch, decision: { kind: 'pick', variant: BUILT_VARIANT, ...originOf('spec') } });

    expect(withoutWaitingUndesigned(resolveAcme(target), [hit(target)])).toHaveLength(1);
  });

  it('declares the state in the part once the pick of the built look merges', () => {
    const target = acme();
    const sketch = openUndesignedSketch({
      target,
      product: resolveAcme(target),
      part: HERO,
      branch: BRANCH,
      missing: MISSING,
      picture: PICTURE,
    }) as Sketch;
    const picked = decideSketch({
      sketch,
      decision: { kind: 'pick', variant: BUILT_VARIANT, ...originOf('spec') },
    }) as Sketch;

    mergeSketch({ target, config: readConfig(target) ?? {}, product: resolveAcme(target), sketch: picked });

    const heroDir = join(resolveAcme(target).dir, HERO);

    expect(readFileSync(join(heroDir, 'hero.ts'), 'utf8')).toMatch(/untitled'?: \{ film: \{ title: '' \} \}/u);
    expect(existsSync(join(heroDir, 'untitled.built.ts'))).toBe(true);
  });
});

describe('built placeholder (B251)', () => {
  const mergedBuilt = () => {
    const target = acme();
    const sketch = openUndesignedSketch({
      target,
      product: resolveAcme(target),
      part: HERO,
      branch: BRANCH,
      missing: MISSING,
      picture: PICTURE,
    }) as Sketch;
    const picked = decideSketch({ sketch, decision: { kind: 'pick', variant: BUILT_VARIANT, ...originOf('spec') } });

    mergeSketch({ target, config: readConfig(target) ?? {}, product: resolveAcme(target), sketch: picked as Sketch });

    return target;
  };

  it('leaves the merged state of a built pick as one redraw open point', () => {
    const target = mergedBuilt();
    const points = partPointsOf(readOpenPoints(resolveAcme(target)), HERO);

    expect(points).toContainEqual({ kind: 'redraw', state: MISSING.state });
    expect(openPointsText('acme', readOpenPoints(resolveAcme(target))).join('\n')).toMatch(
      new RegExp(`${HERO}: .*state untitled shows the app picture as a placeholder - redraw it in a sketch`, 'u'),
    );
  });

  it('clears the redraw point once a merged sketch draws the state for real', () => {
    const target = mergedBuilt();

    commitAll(target, 'built placeholder');
    expect(partPointsOf(readOpenPoints(resolveAcme(target)), HERO)).toContainEqual({
      kind: 'redraw',
      state: MISSING.state,
    });

    const redrawn = createSketch({
      product: resolveAcme(target),
      sketch: { layer: 'elements', name: 'hero', sketch: 'untitled-drawn' },
      variants: ['a'],
    }) as Sketch;
    const drawn = join(variantDirOf(redrawn, 'a'), HERO, 'hero.ts');

    const fixture = join(__dirname, '..', '__fixtures__', '.ethlete', 'design', 'acme', HERO, 'hero.ts');

    writeFileSync(
      drawn,
      readFileSync(fixture, 'utf8')
        .replace("default: { film: films[0] ?? { title: '' } }", `$&, untitled: ${JSON.stringify(MISSING.props)}`)
        .replace("check its title.' },", "check its title.', untitled: 'A film without a title.' },"),
    );
    const ready = markSketchReady({ checkout: target, sketch: redrawn }) as Sketch;
    const picked = decideSketch({ sketch: ready, decision: { kind: 'pick', variant: 'a', ...originOf('spec') } });

    expect(
      mergeSketch({ target, config: readConfig(target) ?? {}, product: resolveAcme(target), sketch: picked as Sketch }),
    ).toEqual(expect.any(Array));

    expect(readFileSync(join(resolveAcme(target).dir, HERO, 'hero.ts'), 'utf8')).toContain('untitled:');
    expect(partPointsOf(readOpenPoints(resolveAcme(target)), HERO)).not.toContainEqual(
      expect.objectContaining({ kind: 'redraw' }),
    );
  });
});

describe('openUndesignedSketches (B251b)', () => {
  it('shoots and opens one sketch per hit with a missing state, once, and names a hit it cannot take', async () => {
    const target = acme();
    const shoot = vi.fn(async () => PICTURE);
    const log = vi.fn();
    const run = () =>
      openUndesignedSketches({
        target,
        product: resolveAcme(target),
        problems: [hit(target), { ...hit(target, null), at: '@if (other())' }],
        shoot,
        log,
      });

    await run();
    await run();

    expect(shoot).toHaveBeenCalledTimes(1);
    expect(shoot).toHaveBeenCalledWith(
      expect.objectContaining({ part: HERO, state: 'untitled', props: MISSING.props }),
    );
    expect(sketchesOf(target).map((sketch) => sketch.target)).toEqual([`${HERO}@untitled`]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('@if (other())'));
  });
});

describe('undesignedLiveProblemOf (B251b)', () => {
  const live = (target: string) =>
    undesignedLiveProblemOf({
      product: resolveAcme(target),
      part: HERO,
      state: 'no-title',
      design: MISSING.state,
      states: { default: {} },
    });

  it('fails a live state naming a missing design state, and waits while <part>@<state> is open', () => {
    const target = acme();

    expect(live(target)).toContain('STATE-UNDESIGNED: the app state "no-title"');

    createSketch({
      product: resolveAcme(target),
      sketch: { layer: 'elements', name: 'hero', sketch: MISSING.state },
      variants: ['a'],
    });

    expect(live(target)).toBeNull();
  });

  it('waits on the sketch the slow runner opened for the branch, until its pick', () => {
    const target = acme();
    const sketch = openUndesignedSketch({
      target,
      product: resolveAcme(target),
      part: HERO,
      branch: BRANCH,
      missing: MISSING,
      picture: PICTURE,
    }) as Sketch;

    expect(live(target)).toBeNull();

    decideSketch({ sketch, decision: { kind: 'pick', variant: BUILT_VARIANT, ...originOf('spec') } });

    expect(live(target)).toContain('STATE-UNDESIGNED');
  });
});
