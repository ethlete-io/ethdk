import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { checkDesign } from '../../check';
import { ruleProblemsOf } from '../check-system';
import { resolveProduct } from '../resolve-product';
import { openSketchProblemsOf } from '../sketch/check-sketches';
import { createSketch, Sketch } from '../sketch/sketch';
import { undefinedClassesOf } from './undefined-class';

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const acme = (stylesheet = '') => {
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
        acme: { ...config.products?.['acme'], styles: [`${DESIGN_DIR}/acme/styles.css`] },
      },
    }),
  );
  write(
    target,
    'acme/styles.css',
    `@import ${JSON.stringify(require.resolve('tailwindcss/index.css'))};\n@theme { --color-surface-raised: oklch(0.3 0 0); }\n${stylesheet}`,
  );

  return target;
};

const part = (markup: string, styles = '') =>
  `import { definePart } from '@design-system';\nexport default definePart({ note: '', states: {}, render: () => ({ body: \`${markup}\`, styles: '${styles}' }) });\n`;

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const messagesOf = (target: string) =>
  undefinedClassesOf(resolveAcme(target)).map((problem) => `${problem.file.split('/').pop()}: ${problem.message}`);

const report = (name: string) =>
  `The class \`${name}\` compiles to no CSS against the product's stylesheets - Tailwind generates no utility of that name; use a value the product's theme defines`;

describe('undefinedClassesOf', { timeout: 30_000 }, () => {
  it('reports a utility whose theme value the product does not define, in a part and in a file below it', () => {
    const target = acme();

    write(target, 'acme/pages/home/home.ts', part('<div class="bg-surface-raised bg-surface-sunken"></div>'));
    write(target, 'acme/pages/home/shared/row.ts', `export const row = 'hover:text-surface-sunken';\n`);

    expect(messagesOf(target)).toEqual([
      `home.ts: ${report('bg-surface-sunken')}`,
      `row.ts: ${report('hover:text-surface-sunken')}`,
    ]);
  });

  it('passes SDK classes, names Tailwind does not parse, and classes the product or the part styles', () => {
    const target = acme('.bg-legacy-panel { color: red; }\n');

    write(
      target,
      'acme/pages/home/home.ts',
      part(
        '<div class="flex bg-surface-raised et-button acme-home Sign-in bg-legacy-panel bg-local-card"></div>',
        '.bg-local-card { color: red; }',
      ),
    );

    expect(messagesOf(target)).toEqual([]);
  });

  it('reads the options of a design renderer as no classes, except class', () => {
    const target = acme();
    const dialog = `import { anchoredDialog } from '@ethlete/components/design/anchored-dialog';\nexport const a = anchoredDialog({ placement: 'bottom-start', content: '<div class="p-3"></div>' });\n`;
    const button = `import { button } from '@ethlete/components/design/button';\nexport const b = button({ class: 'bottom-start' });\n`;

    write(target, 'acme/pages/home/home.ts', part('<div class="flex"></div>'));
    write(target, 'acme/pages/home/shared/dialog.ts', dialog);
    expect(messagesOf(target)).toEqual([]);

    write(target, 'acme/pages/home/shared/button.ts', button);
    expect(messagesOf(target)).toEqual([`button.ts: ${report('bottom-start')}`]);
  });

  it('runs as part of design check', () => {
    const target = acme();

    write(target, 'acme/pages/home/home.ts', part('<div class="bg-surface-sunken"></div>'));

    expect(ruleProblemsOf(resolveAcme(target)).filter((problem) => problem.rule === 'CLASS-UNDEFINED')).toHaveLength(1);
  });

  it('fails design check', async () => {
    const target = acme();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    write(target, 'acme/pages/home/home.ts', part('<div class="bg-surface-sunken"></div>'));

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(error.mock.calls.flat().some((line) => /^CLASS-UNDEFINED/.test(String(line)))).toBe(true);

    error.mockRestore();
  });

  it('blocks a sketch variant only on a class it adds', () => {
    const target = acme();
    const hero = join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts');

    writeFileSync(hero, readFileSync(hero, 'utf8').replace('class="acme-hero"', 'class="acme-hero bg-surface-sunken"'));

    const product = resolveAcme(target);
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const added = join(sketch.dir, 'b/elements/hero/hero.ts');

    writeFileSync(
      added,
      readFileSync(added, 'utf8').replace('bg-surface-sunken', 'bg-surface-sunken text-surface-sunken'),
    );

    const classProblems = openSketchProblemsOf(product).variants.map(({ variant, problems }) => [
      variant,
      problems.filter((problem) => problem.rule === 'CLASS-UNDEFINED').map((problem) => problem.message),
    ]);

    expect(classProblems).toEqual([
      ['a', []],
      ['b', [report('text-surface-sunken')]],
    ]);
  });
});
