import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, DesignDeniedClass, readConfig } from '../../paths';
import { checkDesign } from '../../check';
import { resolveProduct } from '../resolve-product';
import { openSketchProblemsOf } from '../sketch/check-sketches';
import { createSketch, Sketch } from '../sketch/sketch';
import { deniedClassesOf } from './denied-class';

const DENIED: DesignDeniedClass[] = [
  { pattern: '^(bg|text|border)-surface(-raised)?$', fix: 'use the et-surface tokens of a data-et-surface scope' },
  { pattern: '^var\\(--accent', fix: 'use --et-theme-color-*' },
];

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const acme = (options: { stylesheet?: string; denied?: DesignDeniedClass[] } = {}) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const config = readConfig(target) ?? {};

  write(
    target,
    'config.json',
    JSON.stringify({
      ...config,
      products: {
        ...config.products,
        acme: {
          ...config.products?.['acme'],
          styles: [`${DESIGN_DIR}/acme/styles.css`],
          deniedClasses: options.denied ?? DENIED,
        },
      },
    }),
  );
  write(target, 'acme/styles.css', options.stylesheet ?? '');

  return target;
};

const part = (markup: string, styles = '') =>
  `import { definePart } from '@design-system';\nexport default definePart({ note: '', states: {}, render: () => ({ body: \`${markup}\`, styles: '${styles}' }) });\n`;

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const linesOf = (target: string) =>
  deniedClassesOf(resolveAcme(target)).map(
    (problem) => `${problem.rule} ${problem.file.split('/').pop()}: ${problem.message}`,
  );

describe('deniedClassesOf', () => {
  it('reports a denied class with its variants and opacity stripped, and a denied var() in markup and CSS', () => {
    const target = acme();

    write(
      target,
      'acme/pages/home/home.ts',
      part('<div class="hover:bg-surface/50 text-surface-sunken flex" style="color: var(--accent-text)"></div>'),
    );
    write(target, 'acme/pages/home/home.css', '.acme-home { border-color: var( --accent); }');
    write(target, 'acme/pages/home/shared/row.ts', `export const row = 'md:!border-surface-raised';\n`);

    expect(linesOf(target)).toEqual([
      'DENIED-CLASS home.ts: `bg-surface` is denied in this product - use the et-surface tokens of a data-et-surface scope',
      'DENIED-CLASS home.ts: `var(--accent-text)` is denied in this product - use --et-theme-color-*',
      'DENIED-CLASS row.ts: `border-surface-raised` is denied in this product - use the et-surface tokens of a data-et-surface scope',
      'DENIED-CLASS home.css: `var(--accent)` is denied in this product - use --et-theme-color-*',
    ]);
  });

  it('exempts foundations parts and foundations stylesheets', () => {
    const target = acme({ stylesheet: "@import './foundations/colors/colors.css';\n" });

    write(target, 'acme/foundations/colors/colors.ts', part('<div class="bg-surface"></div>'));
    write(target, 'acme/foundations/colors/colors.css', ':root { --accent: oklch(0.7 0.1 190); }');

    expect(linesOf(target)).toEqual([]);
  });

  it('reports what the product stylesheet defines that exposes a denied class or var()', () => {
    const target = acme({
      stylesheet: [
        '@theme { --color-surface-raised: oklch(0.3 0 0); --color-et-surface-bg: var(--et-surface-bg-solid); }',
        ':root { --accent-hover: red; }',
        '@utility bg-surface { background: black; }',
        '.text-surface { color: white; }',
      ].join('\n'),
    });

    expect(linesOf(target)).toEqual([
      'DENIED-STYLESHEET styles.css: `--color-surface-raised` exposes the denied `bg-surface-raised` - the product stylesheet defines only the inputs of the SDK themes; use the et-surface tokens of a data-et-surface scope',
      'DENIED-STYLESHEET styles.css: `--accent-hover` exposes the denied `var(--accent-hover)` - the product stylesheet defines only the inputs of the SDK themes; use --et-theme-color-*',
      'DENIED-STYLESHEET styles.css: `@utility bg-surface` exposes the denied `bg-surface` - the product stylesheet defines only the inputs of the SDK themes; use the et-surface tokens of a data-et-surface scope',
      'DENIED-STYLESHEET styles.css: `.text-surface` exposes the denied `text-surface` - the product stylesheet defines only the inputs of the SDK themes; use the et-surface tokens of a data-et-surface scope',
    ]);
  });

  it('reports a pattern that is no regular expression', () => {
    const target = acme({ denied: [{ pattern: '^bg-(', fix: 'x' }] });

    expect(linesOf(target)).toEqual([
      expect.stringMatching(
        /^DENIED-CLASS-CONFIG config\.json: deniedClasses of acme: the pattern `\^bg-\(` is no valid/u,
      ),
    ]);
  });

  it('warns in design check but does not fail it', async () => {
    const target = acme();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    write(target, 'acme/pages/home/home.ts', part('<div class="bg-surface"></div>'));

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(warn.mock.calls.flat().some((line) => /^WARNING .*DENIED-CLASS /.test(String(line)))).toBe(true);

    warn.mockRestore();
  });

  it('blocks a sketch variant only on a denied class it adds', () => {
    const target = acme();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(hero, readFileSync(hero, 'utf8').replace('class="acme-hero"', 'class="acme-hero bg-surface"'));

    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const added = join(sketch.dir, 'b/elements/hero/hero.ts');

    writeFileSync(added, readFileSync(added, 'utf8').replace('bg-surface', 'bg-surface text-surface'));

    const denied = openSketchProblemsOf(product).variants.map(({ variant, problems }) => [
      variant,
      problems.filter((problem) => problem.rule === 'DENIED-CLASS').map((problem) => problem.message),
    ]);

    expect(denied).toEqual([
      ['a', []],
      ['b', ['`text-surface` is denied in this product - use the et-surface tokens of a data-et-surface scope']],
    ]);
  });
});
