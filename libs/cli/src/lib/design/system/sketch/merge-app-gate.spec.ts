import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { originOf } from '../write-origin';
import { mergeSketch } from './merge';
import { appGatedMergeOf, AppSpecRunner } from './merge-app-gate';
import { studioMergeOf } from './merge-runner';
import { createSketch, decideSketch, markSketchReady, Sketch } from './sketch';

const FONT_URL = "url('@assets/fonts/noto-sans.woff2')";

const OLD_BUILD = { styles: ['apps/shop/src/styles.css'], assets: [] };
const FIXED_BUILD = {
  styles: ['apps/shop/src/styles.css'],
  assets: [{ glob: '**/*', input: '.ethlete/design/acme/assets', output: '@assets' }],
  externalDependencies: ['@assets'],
};

const checkoutWithApp = (build: object) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-merge-app-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  mkdirSync(join(target, 'apps/shop/src'), { recursive: true });
  writeFileSync(
    join(target, 'apps/shop/project.json'),
    JSON.stringify({ name: 'shop', targets: { build: { options: build } } }),
  );
  writeFileSync(
    join(target, 'apps/shop/src/styles.css'),
    "@import 'tailwindcss';\n@import '../../../.ethlete/design/acme/elements/hero/hero.css';\n",
  );
  writeFileSync(
    join(target, 'apps/shop/src/styles.spec.ts'),
    "const stylesPath = new URL('./styles.css', import.meta.url);\n",
  );

  return target;
};

const fontPairSketch = (target: string) => {
  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const drafted = createSketch({
    product,
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a', 'c'],
  }) as Sketch;
  const variantDir = join(drafted.dir, 'c');

  writeFileSync(join(variantDir, 'elements/hero/hero.css'), `.acme-hero {\n  background: ${FONT_URL};\n}\n`);
  mkdirSync(join(variantDir, 'assets/fonts'), { recursive: true });
  writeFileSync(join(variantDir, 'assets/fonts/noto-sans.woff2'), 'font');

  const ready = markSketchReady({ checkout: target, sketch: drafted }) as Sketch;

  return {
    product,
    sketch: decideSketch({ sketch: ready, decision: { kind: 'pick', variant: 'c', ...originOf('spec') } }) as Sketch,
  };
};

const mergeWith = (target: string, runAppSpecs: AppSpecRunner) => {
  const { product, sketch } = fontPairSketch(target);
  const result = appGatedMergeOf({
    target,
    product,
    sketch,
    runAppSpecs,
    merge: () => mergeSketch({ target, config: readConfig(target) ?? {}, product, sketch }),
  });

  return { sketch, result, reason: Array.isArray(result) ? null : result.reason };
};

const heroCss = (target: string) => readFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), 'utf8');

describe('mergeSketch app gate', { timeout: 60_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('refuses a stylesheet url() the app build cannot resolve, naming the url', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = checkoutWithApp(OLD_BUILD);
    const before = heroCss(target);
    const { sketch } = fontPairSketch(target);
    const result = studioMergeOf({ target, product: 'acme', sketch });
    const reason = Array.isArray(result) ? null : result.reason;

    expect(reason).toContain(
      '.ethlete/design/acme/elements/hero/hero.css: url(@assets/fonts/noto-sans.woff2) does not resolve in the shop build',
    );
    expect(heroCss(target)).toBe(before);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/assets/fonts/noto-sans.woff2'))).toBe(false);
    expect(existsSync(sketch.dir)).toBe(true);
  });

  it('merges the url() once the app build maps @assets to the product assets, and runs the app specs that read its stylesheet', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = checkoutWithApp(FIXED_BUILD);
    const runs: { cwd: string; files: string[] }[] = [];
    const { result } = mergeWith(target, (run) => {
      runs.push(run);
      return [];
    });

    expect(result).toEqual(['elements/hero']);
    expect(heroCss(target)).toContain('@assets/fonts/noto-sans.woff2');
    expect(runs).toEqual([
      {
        cwd: join(target, 'apps/shop'),
        files: expect.arrayContaining([
          join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'),
          join(target, 'apps/shop/src/styles.spec.ts'),
        ]),
      },
    ]);
  });

  it('refuses on a red app spec, names it and puts the old files back', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = checkoutWithApp(FIXED_BUILD);
    const before = heroCss(target);
    const { sketch, reason } = mergeWith(target, () => ['src/styles.spec.ts']);

    expect(reason).toContain('apps/shop/src/styles.spec.ts');
    expect(heroCss(target)).toBe(before);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/assets/fonts/noto-sans.woff2'))).toBe(false);
    expect(existsSync(sketch.dir)).toBe(true);
  });
});
