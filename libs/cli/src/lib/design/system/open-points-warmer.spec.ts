import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { setImmediate as nextTurn } from 'timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { cachedOpenPointsOf } from './open-points-cache';
import { openPointsOf } from './open-points-runner';
import { createOpenPointsWarmer, OpenPointsWarmer } from './open-points-warmer';
import { ResolvedProduct } from './resolve-product';
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
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-open-points-warmer-')));
  const design = join(target, DESIGN_DIR);

  mkdirSync(join(design, 'app-a/elements/rating'), { recursive: true });
  writeFileSync(
    join(design, 'app-a/elements/rating/rating.ts'),
    "export default definePart({ implements: 'libs/rating.ts', states: { default: {} } });\n",
  );
  writeFileSync(join(design, 'app-a/styles.css'), "@import 'tailwindcss';\n");
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ products: { 'app-a': { styles: [`${DESIGN_DIR}/app-a/styles.css`] } } }),
  );

  return target;
};

const productOf = (target: string) =>
  oneProductOf({ target, config: readConfig(target) ?? {}, asked: 'app-a' }) as ResolvedProduct;

const rulesRunBy = (run: () => unknown) => {
  const before = ruleRuns.count;

  run();

  return ruleRuns.count - before;
};

const warmers: OpenPointsWarmer[] = [];

const warmedCheckout = () => {
  const target = checkout();
  const sketch = createSketch({
    product: productOf(target),
    sketch: { layer: 'elements', name: 'rating' },
    variants: ['a'],
  });
  const ready = markSketchReady({ checkout: target, sketch: sketch as Sketch }) as Sketch;

  writeFileSync(join(variantDirOf(ready, 'a'), 'elements/rating/rating.css'), '.rating { display: flex; }\n');

  const runs = { warmStarted: 0, warmRules: 0, inlineRules: 0 };
  const warmer = createOpenPointsWarmer({
    productsOf: () => [productOf(target)],
    warm: async (product) => {
      runs.warmStarted++;
      await nextTurn();
      runs.warmRules += rulesRunBy(() => cachedOpenPointsOf(product));
    },
    ask: async (request) => {
      let answer: ReturnType<typeof openPointsOf> | undefined;

      runs.inlineRules += rulesRunBy(() => (answer = openPointsOf(request)));

      return answer as ReturnType<typeof openPointsOf>;
    },
    settleMs: 20,
  });

  warmers.push(warmer);

  const ask = () => warmer.ask({ product: productOf(target), part: null });
  const editPart = () =>
    writeFileSync(
      join(target, DESIGN_DIR, 'app-a/elements/rating/rating.ts'),
      "export default definePart({ implements: 'libs/rating.ts', states: { default: {}, busy: {} } });\n",
    );

  return { warmer, runs, ask, editPart };
};

describe('open-points warmer', { timeout: 30_000 }, () => {
  afterEach(() => {
    for (const warmer of warmers.splice(0)) warmer.close();
  });

  it('runs no rules inline on the first ask after start', async () => {
    const { runs, ask } = warmedCheckout();

    await ask();

    expect(runs.inlineRules).toBe(0);
    expect(runs.warmRules).toBeGreaterThan(0);
  });

  it('runs no rules inline on the first ask after a part edit', async () => {
    const { warmer, runs, ask, editPart } = warmedCheckout();

    await ask();
    runs.warmRules = 0;
    editPart();
    warmer.changed();
    await ask();

    expect(runs.inlineRules).toBe(0);
    expect(runs.warmRules).toBeGreaterThan(0);
  });

  it('lets asks during a background run wait for it instead of starting a second run', async () => {
    const { warmer, runs, ask, editPart } = warmedCheckout();

    await ask();
    runs.warmStarted = 0;
    runs.warmRules = 0;
    editPart();
    warmer.changed();
    await vi.waitFor(() => expect(runs.warmStarted).toBe(1));

    const answers = await Promise.all([ask(), ask()]);

    expect(answers[0]).toEqual(answers[1]);
    expect(runs.inlineRules).toBe(0);
    expect(runs.warmStarted).toBe(1);
    expect(runs.warmRules).toBeGreaterThan(0);
  });

  it('warms again after a change that lands during a run', async () => {
    const { warmer, runs, ask, editPart } = warmedCheckout();

    await ask();
    runs.warmStarted = 0;
    warmer.changed();
    await vi.waitFor(() => expect(runs.warmStarted).toBe(1));
    editPart();
    warmer.changed();
    await vi.waitFor(() => expect(runs.warmStarted).toBe(2));
    await ask();

    expect(runs.inlineRules).toBe(0);
  });
});
