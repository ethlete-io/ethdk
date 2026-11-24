import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { designLint } from '../../lint-command';
import { ruleProblemsOf } from '../check-system';
import { resolveProduct } from '../resolve-product';
import { LOGO_SECTIONS } from '../rules/logo-sections';
import { stateNamesOf } from './part-definition';
import { foundationSkeletonOf } from './foundation-skeletons';
import { createSketch, Sketch } from './sketch';

const REPO = join(__dirname, '../../../../../../..');

const PARTS = [
  { layer: 'foundations', name: 'colors' },
  { layer: 'foundations', name: 'logo' },
] as const;

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-foundation-skeletons-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const opened = (target: string, part: (typeof PARTS)[number]) =>
  createSketch({ product: productOf(target), sketch: part, variants: ['a', 'b'] }) as Sketch;

const lint = (target: string, files: string[]) => {
  const out: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line: string) => void out.push(line));
  vi.spyOn(console, 'error').mockImplementation((line: string) => void out.push(line));

  const code = designLint({ target, argv: files, invocation: 'et design', cwd: target });

  vi.restoreAllMocks();

  return { code, out };
};

const partFilesOf = (sketch: Sketch, variant: string, name: string) =>
  Object.keys(foundationSkeletonOf(`foundations/${name}`)?.files ?? {}).map((file) =>
    join(sketch.dir, variant, 'foundations', name, file),
  );

const declaredIn = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));

  return [...body.matchAll(/(--[\w-]+):/gu)].map(([, name]) => name ?? '');
};

afterEach(() => vi.restoreAllMocks());

describe('foundation skeletons', () => {
  it.each(PARTS)('gives every variant of a new $name part the same skeleton', (part) => {
    const target = acme();
    const sketch = opened(target, part);
    const [a, b] = sketch.variants.map((variant) =>
      partFilesOf(sketch, variant, part.name).map((file) => readFileSync(file, 'utf8')),
    );

    expect(a).toEqual(b);
    expect(a?.every((source) => source.length > 0)).toBe(true);
  });

  it.each(PARTS)('writes $name files that the live check passes', (part) => {
    const target = acme();
    const sketch = opened(target, part);

    expect(lint(target, partFilesOf(sketch, 'a', part.name))).toEqual({ code: 0, out: [] });
  });

  it.each(PARTS)('passes the rules of a merged $name part', (part) => {
    const target = acme();
    const sketch = opened(target, part);
    const productDir = join(target, DESIGN_DIR, 'acme');

    cpSync(join(sketch.dir, 'a', 'foundations'), join(productDir, 'foundations'), { recursive: true });
    cpSync(join(sketch.dir, 'a', 'assets'), join(productDir, 'assets'), { recursive: true });

    expect(ruleProblemsOf(productOf(target), [`foundations/${part.name}`])).toEqual([]);
  });

  it('keeps an agent edit of a generated file clean', () => {
    const target = acme();
    const sketch = opened(target, PARTS[0]);
    const [ts = '', css = ''] = partFilesOf(sketch, 'b', 'colors');

    writeFileSync(
      css,
      readFileSync(css, 'utf8')
        .replace(/--et-surface-border: [\d ]+;/u, '--et-surface-border: 200 200 200;')
        .replace(
          '--et-color-primary: 128 128 128;',
          '--et-color-primary: 128 128 128;\n    --et-color-secondary: 64 64 64;',
        ),
    );

    expect(lint(target, [ts, css])).toEqual({ code: 0, out: [] });
  });

  it('declares every token the theme generator writes for a surface and a colour theme', () => {
    const css = foundationSkeletonOf('foundations/colors')?.files['colors.css'] ?? '';
    const generated = readFileSync(join(REPO, '.ethlete/design/sdk/foundations/colors/colors.css'), 'utf8');
    const all = [...css.matchAll(/(--[\w-]+):/gu)].map(([, name]) => name);

    for (const selector of [
      '.et-surface--light',
      '.et-surface--dark',
      ":where([class*='et-surface--'])",
      ":where([class*='et-color--'])",
    ]) {
      expect(declaredIn(css, selector)).toEqual(
        expect.arrayContaining(declaredIn(generated, selector).filter((name) => !name.endsWith('theme-variants'))),
      );
    }

    expect(all).toEqual(expect.arrayContaining(declaredIn(generated, '.et-color--brand')));
  });

  it('gives the logo part a state for every logo section', () => {
    const ts = foundationSkeletonOf('foundations/logo')?.files['logo.ts'] ?? '';

    expect(stateNamesOf(ts)).toEqual(expect.arrayContaining(LOGO_SECTIONS));
  });

  it('writes texts that stand alone, without a look', () => {
    const texts = PARTS.flatMap(({ name }) => {
      const skeleton = foundationSkeletonOf(`foundations/${name}`);

      return [...Object.values(skeleton?.files ?? {}), ...Object.values(skeleton?.assets ?? {})];
    });

    for (const text of texts) {
      expect(text).not.toMatch(/\bADR\b|\b[A-Z]\d{3,}\b|libs\/|tools\/|\.ethlete\/|apps\//u);
      expect(text).not.toMatch(/#[\da-f]{3,8}\b|oklch\(|<path|<rect|<circle/iu);
    }
  });

  it('leaves a part with no skeleton on the empty stub', () => {
    const target = acme();
    const sketch = createSketch({
      product: productOf(target),
      sketch: { layer: 'foundations', name: 'motion' },
      variants: ['a'],
    }) as Sketch;

    expect(foundationSkeletonOf('foundations/motion')).toBeNull();
    expect(readFileSync(join(sketch.dir, 'a/foundations/motion/motion.css'), 'utf8')).toBe('');
    expect(existsSync(join(sketch.dir, 'a/assets/logo.svg'))).toBe(false);
  });
});
