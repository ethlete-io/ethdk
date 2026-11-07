import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { Layer } from '../layers';
import { resolveProduct } from '../resolve-product';
import { openSketchProblemsOf } from '../sketch/check-sketches';
import { createSketch, Sketch } from '../sketch/sketch';
import { ruleProblemsOf } from '../check-system';
import { EXEMPTIBLE_RULES, ExemptibleRule, isExemptFrom } from './exemptions';

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const part = (markup: string, styles = '') =>
  `import { definePart } from '@design-system';\nexport default definePart({ note: '', states: {}, render: () => ({ body: \`${markup}\`, styles: '${styles}' }) });\n`;

const OFFENDING: Record<ExemptibleRule, string> = {
  'HARD-CODED-COLOUR': part('<div style="color: #ff0000"></div>'),
  'HARD-CODED-MOTION': part('<div></div>', '.a { transition: opacity 200ms ease; }'),
  'INLINE-SVG': part('<svg viewBox="0 0 1 1"></svg>'),
  'UTILITY-CSS': part('<div style="display: flex"></div>', 'display: flex'),
  'DENIED-CLASS': part('<div style="background: var(--accent)"></div>'),
};

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-exemptions-'));

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
          deniedClasses: [{ pattern: '^var\\(--accent', fix: 'use --et-theme-color-*' }],
        },
      },
    }),
  );
  write(target, 'acme/styles.css', '@import "tailwindcss";\n');

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const nameOf = (file: string) => file.split('/').pop();

const productRulesOf = (target: string, rule: string) =>
  ruleProblemsOf(resolveAcme(target))
    .filter((problem) => problem.rule === rule)
    .map((problem) => nameOf(problem.file));

const sketchRulesOf = (target: string, layer: Layer, rule: string) => {
  const product = resolveAcme(target);
  const sketch = createSketch({ product, sketch: { layer, name: 'probe' }, variants: ['a'] }) as Sketch;

  return openSketchProblemsOf(product)
    .variants.flatMap(({ problems, before }) =>
      [...problems, ...before].filter((problem) => problem.file.startsWith(sketch.dir)),
    )
    .filter((problem) => problem.rule === rule)
    .map((problem) => nameOf(problem.file));
};

describe('rule exemptions', { timeout: 60_000 }, () => {
  const layers: Layer[] = ['foundations', 'components'];

  it.each(EXEMPTIBLE_RULES.flatMap((rule) => layers.map((layer) => [rule, layer] as const)))(
    '%s: the product check and the sketch check of a copy of a %s part agree',
    (rule, layer) => {
      const target = acme();

      write(target, `acme/${layer}/probe/probe.ts`, OFFENDING[rule]);

      const product = productRulesOf(target, rule);
      const copy = sketchRulesOf(target, layer, rule);

      expect(copy.length > 0).toBe(product.length > 0);
      expect(product.length === 0).toBe(isExemptFrom(rule, { layer }));
    },
  );
});
