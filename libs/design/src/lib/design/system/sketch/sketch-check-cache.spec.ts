import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { cachedCheckOf } from './sketch-check-cache';
import { openSketchListingAt, ruleProblemsAt } from './sketch-checker';
import { createSketch, Sketch } from './sketch';

type Request = { kind: 'sketches' | 'rules'; target: string; product: string };

const FIXTURES = join(__dirname, '..', '__fixtures__');

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, path)), { recursive: true });
  writeFileSync(join(target, path), content);
};

const acme = () => {
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-sketch-check-cache-')));

  cpSync(FIXTURES, target, { recursive: true });

  return target;
};

const withConfig = (target: string, acmeConfig: Record<string, unknown>) => {
  const config = readConfig(target) ?? {};

  write(
    target,
    `${DESIGN_DIR}/config.json`,
    JSON.stringify({
      ...config,
      products: { ...config.products, acme: { ...config.products?.['acme'], ...acmeConfig } },
    }),
  );
};

const HERO_CSS = `${DESIGN_DIR}/acme/elements/hero/hero.css`;

const SDK_TYPES = 'node_modules/@ethlete/components/index.d.ts';

const sdkDeclarations = () => readFileSync(join(FIXTURES, 'ethlete-components-buttons.d.ts.txt'), 'utf8');

const withSdk = (target: string) => {
  write(
    target,
    'node_modules/@ethlete/components/package.json',
    JSON.stringify({ name: '@ethlete/components', exports: { '.': { types: './index.d.ts' } } }),
  );
  write(target, SDK_TYPES, sdkDeclarations());
  write(target, HERO_CSS, ".acme-hero { opacity: 1; }\n.et-button[data-variant='ghost'] { opacity: 0.5; }\n");
};

const THEME = (token: string) =>
  `@import ${JSON.stringify(require.resolve('tailwindcss/index.css'))};\n@theme { --color-${token}: oklch(0.3 0 0); }\n`;

const withTheme = (target: string) => {
  withConfig(target, { styles: [`${DESIGN_DIR}/acme/styles.css`] });
  write(target, `${DESIGN_DIR}/acme/styles.css`, THEME('surface-raised'));
  write(
    target,
    `${DESIGN_DIR}/acme/pages/home/home.ts`,
    "import { definePart } from '@design-system';\nexport default definePart({ note: '', states: {}, render: () => ({ body: `<div class=\"bg-surface-raised\"></div>`, styles: '' }) });\n",
  );
};

const withSketch = (target: string) => {
  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a', 'b'] }) as Sketch;

  return join(sketch.dir, 'b/elements/hero/hero.css');
};

const freshOf = (request: Request) =>
  request.kind === 'rules' ? ruleProblemsAt(request) : openSketchListingAt(request);

const countedCheck = () => {
  let runs = 0;
  const check = cachedCheckOf((request: Request) => {
    runs++;

    return freshOf(request);
  });

  return Object.assign(check, { runsOf: () => runs });
};

const rulesOf = (found: ReturnType<typeof freshOf>) =>
  typeof found === 'string'
    ? [found]
    : Array.isArray(found)
      ? found.map(({ rule }) => rule)
      : found.variants.flatMap(({ problems }) => problems.map(({ rule }) => rule));

describe('cachedCheckOf', { timeout: 120_000 }, () => {
  it('answers a second check with unchanged inputs from the first run, per kind and product', () => {
    const target = acme();
    const check = countedCheck();
    const rules: Request = { kind: 'rules', target, product: 'acme' };
    const sketches: Request = { kind: 'sketches', target, product: 'acme' };

    withSketch(target);

    const first = check(rules);
    const listing = check(sketches);

    expect(check(rules)).toBe(first);
    expect(check(sketches)).toBe(listing);
    expect(check.runsOf()).toBe(2);
    expect(first).toEqual(freshOf(rules));
    expect(listing).toEqual(freshOf(sketches));
  });

  it.each<{
    input: string;
    kind: Request['kind'];
    setUp?: (target: string) => string | void;
    change: (target: string, at: string) => void;
    rule?: string;
    gone?: string;
  }>([
    {
      input: 'a part stylesheet',
      kind: 'rules',
      change: (target) => write(target, HERO_CSS, '.acme-hero { color: #fff; }\n'),
      rule: 'HARD-CODED-COLOUR',
    },
    {
      input: 'the file list of a part folder',
      kind: 'rules',
      change: (target) => write(target, `${DESIGN_DIR}/acme/elements/hero/extra.css`, '.acme-extra { color: #fff; }\n'),
    },
    {
      input: 'the design config',
      kind: 'rules',
      change: (target) => withConfig(target, { presets: { phone: { width: 400, height: 800 } } }),
    },
    {
      input: 'a sketch variant',
      kind: 'sketches',
      setUp: withSketch,
      change: (_, variantCss) => writeFileSync(variantCss, '.acme-hero { color: #fff; }\n'),
      rule: 'HARD-CODED-COLOUR',
    },
    {
      input: 'the SDK declaration file a rule reads',
      kind: 'rules',
      setUp: withSdk,
      change: (target) => write(target, SDK_TYPES, sdkDeclarations().replaceAll('"tonal"', '"ghost"')),
      gone: 'SDK-ATTRIBUTE-VALUE',
    },
    {
      input: 'a product stylesheet Tailwind reads',
      kind: 'rules',
      setUp: withTheme,
      change: (target) => write(target, `${DESIGN_DIR}/acme/styles.css`, THEME('surface-sunken')),
      rule: 'CLASS-UNDEFINED',
    },
  ])(
    'runs again after a change to $input and answers what a fresh run finds',
    ({ kind, setUp, change, rule, gone }) => {
      const target = acme();
      const at = setUp?.(target) ?? '';
      const check = countedCheck();
      const request: Request = { kind, target, product: 'acme' };
      const before = check(request);

      expect(check(request)).toBe(before);

      change(target, at);

      const after = check(request);

      expect(check.runsOf()).toBe(2);
      expect(after).toEqual(freshOf(request));
      if (rule)
        expect([rulesOf(before), rulesOf(after)]).toEqual([
          expect.not.arrayContaining([rule]),
          expect.arrayContaining([rule]),
        ]);
      if (gone)
        expect([rulesOf(before), rulesOf(after)]).toEqual([
          expect.arrayContaining([gone]),
          expect.not.arrayContaining([gone]),
        ]);
    },
  );
});
