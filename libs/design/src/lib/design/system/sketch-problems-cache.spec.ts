import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { cachedOpenPointsOf } from './open-points-cache';
import { readOpenPoints } from './read-open-points';
import { ResolvedProduct } from './resolve-product';
import { variantProblemsOf } from './sketch/check-sketches';
import { oneProductOf } from './sketch/cli-args';
import { createSketch, markSketchReady, Sketch, variantDirOf } from './sketch/sketch';

const ruleRuns = vi.hoisted(() => ({ count: 0 }));

vi.mock('./rules/utility-css', async (importOriginal) => {
  const original = await importOriginal<typeof import('./rules/utility-css')>();

  return {
    ...original,
    utilityCssOf: (...args: Parameters<typeof original.utilityCssOf>) => {
      ruleRuns.count++;

      return original.utilityCssOf(...args);
    },
  };
});

const checkout = () => {
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-sketch-problems-cache-')));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, source: string) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(join(design, 'app-a', path, `${path.split('/')[1]}.ts`), source);
  };

  part('elements/rating', "export default definePart({ implements: 'libs/rating.ts', states: { default: {} } });\n");
  part('elements/badge', "export default definePart({ implements: 'libs/badge.ts', states: { default: {} } });\n");
  writeFileSync(join(design, 'app-a/styles.css'), "@import 'tailwindcss';\n");
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ products: { 'app-a': { styles: [`${DESIGN_DIR}/app-a/styles.css`] } } }),
  );

  return target;
};

const productOf = (target: string) =>
  oneProductOf({ target, config: readConfig(target) ?? {}, asked: 'app-a' }) as ResolvedProduct;

const readySketch = (target: string, name: string, css: string) => {
  const sketch = createSketch({
    product: productOf(target),
    sketch: { layer: 'elements', name },
    variants: ['a', 'b'],
  });
  const ready = markSketchReady({ checkout: target, sketch: sketch as Sketch }) as Sketch;

  writeFileSync(join(variantDirOf(ready, 'a'), `elements/${name}/${name}.css`), css);

  return ready;
};

const sketchProblemsOf = (target: string) =>
  readOpenPoints(productOf(target), { sketchProblems: true }).flatMap(({ points }) =>
    points.flatMap((point) => (point.kind === 'sketch-problem' && point.rule === 'UTILITY-CSS' ? [point] : [])),
  );

describe('sketch problems of ready sketch variants', { timeout: 30_000 }, () => {
  it('runs the rules of no variant again while neither the product nor a file its check read changed', () => {
    const target = checkout();

    readySketch(target, 'rating', '.rating { display: flex; }\n');

    const first = sketchProblemsOf(target);

    ruleRuns.count = 0;

    expect(sketchProblemsOf(target)).toEqual(first);
    expect(ruleRuns.count).toBe(0);
  });

  it('lets the open-points cache see a change to a variant whose problems it took from the variant cache', () => {
    const target = checkout();
    const rating = readySketch(target, 'rating', '.rating { display: flex; }\n');
    const cachedProblemsOf = () =>
      cachedOpenPointsOf(productOf(target)).points.flatMap(({ points }) =>
        points.flatMap((point) =>
          point.kind === 'sketch-problem' && point.rule === 'UTILITY-CSS' ? [point.message] : [],
        ),
      );

    sketchProblemsOf(target);

    expect(cachedProblemsOf()).toEqual([expect.stringContaining('display: flex')]);

    writeFileSync(join(variantDirOf(rating, 'a'), 'elements/rating/rating.css'), '.rating { display: block; }\n');

    expect(cachedProblemsOf()).toEqual([expect.stringContaining('display: block')]);
  });

  it('runs the rules again for the variant whose files changed and keeps the answer of the others', () => {
    const target = checkout();
    const rating = readySketch(target, 'rating', '.rating { display: flex; }\n');

    readySketch(target, 'badge', '.badge { display: grid; }\n');
    sketchProblemsOf(target);
    writeFileSync(join(variantDirOf(rating, 'a'), 'elements/rating/rating.css'), '.rating { display: block; }\n');
    ruleRuns.count = 0;

    const problems = sketchProblemsOf(target);

    expect(ruleRuns.count).toBe(2);
    expect(problems.map(({ sketch, variant, rule, message }) => ({ sketch, variant, rule, message }))).toEqual([
      { sketch: 'badge', variant: 'a', rule: 'UTILITY-CSS', message: expect.stringContaining('display: grid') },
      { sketch: 'rating', variant: 'a', rule: 'UTILITY-CSS', message: expect.stringContaining('display: block') },
    ]);
  });

  it('runs every variant again after a part file changes', () => {
    const target = checkout();

    readySketch(target, 'rating', '.rating { display: flex; }\n');
    sketchProblemsOf(target);
    writeFileSync(
      join(target, DESIGN_DIR, 'app-a/elements/badge/badge.ts'),
      "export default definePart({ implements: 'libs/badge.ts', states: { default: {}, busy: {} } });\n",
    );
    ruleRuns.count = 0;

    expect(sketchProblemsOf(target)).toHaveLength(1);
    expect(ruleRuns.count).toBe(3);
  });

  it('lists the same sketch problems as a check of every variant of each ready sketch', () => {
    const target = checkout();

    const sketches = [
      readySketch(target, 'rating', '.rating { display: flex; }\n'),
      readySketch(target, 'badge', '.badge { display: grid; }\n'),
    ];

    sketchProblemsOf(target);

    const product = productOf(target);
    const expected = sketches.flatMap((sketch) =>
      variantProblemsOf({ product, sketch }).flatMap(({ variant, problems }) =>
        problems.map(({ rule, message }) => ({ part: sketch.target, sketch: sketch.name, variant, rule, message })),
      ),
    );
    const listed = readOpenPoints(product, { sketchProblems: true }).flatMap(({ part, points }) =>
      points.flatMap((point) =>
        point.kind === 'sketch-problem'
          ? [{ part, sketch: point.sketch, variant: point.variant, rule: point.rule, message: point.message }]
          : [],
      ),
    );

    expect(expected.length).toBeGreaterThan(2);
    expect(new Set(listed.map((point) => JSON.stringify(point)))).toEqual(
      new Set(expected.map((point) => JSON.stringify(point))),
    );
    expect(listed).toHaveLength(new Set(expected.map((point) => JSON.stringify(point))).size);
  });
});
