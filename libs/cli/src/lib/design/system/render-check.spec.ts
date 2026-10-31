import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { checkSystem } from './check-system';
import { completenessOf } from './complete';
import { resolveProduct } from './resolve-product';
import { groupedIssueLinesOf, renderIssueLineOf, renderIssuesOf } from './render-check';

const PARTS: Record<string, { body: string; extra?: string; css?: string; states?: string }> = {
  'pages/tall': { body: '<div style="height: 300px; border: 1px solid">Tall</div>' },
  'components/cut': {
    body: '<div style="width: 100px; overflow: hidden"><div style="width: 300px">Wide</div></div>',
  },
  'components/cut-on-purpose': {
    body: '<div style="width: 100px; overflow: hidden"><div style="width: 300px">Wide</div></div>',
    extra: "checks: { skip: ['CLIPPED'] },",
  },
  'components/cut-element': {
    body: '<div><div data-et-skip="CLIPPED" style="width: 100px; overflow: hidden"><div style="width: 300px">Wide</div></div></div>',
  },
  'components/label': {
    body: '<div style="width: 120px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis">A label that is cut with dots</div>',
  },
  'components/embed': {
    body: '<div data-et-embed-box style="overflow: hidden; width: 288px; height: 180px"><iframe style="display: block; border: 0; width: 1440px; height: 900px; transform: scale(0.2); transform-origin: 0 0"></iframe></div>',
  },
  'components/embed-cut': {
    body: '<div data-et-embed-box style="overflow: hidden; width: 288px; height: 100px"><iframe style="display: block; border: 0; width: 1440px; height: 900px; transform: scale(0.2); transform-origin: 0 0"></iframe></div>',
  },
  'components/embed-twice': {
    body: '<div style="transform: scale(0.5); transform-origin: 0 0"><div data-et-embed-box style="overflow: hidden; width: 288px; height: 180px"><iframe data-et-embed="pages/tall" data-et-embed-scale="0.2" data-et-embed-drawn style="display: block; border: 0; width: 1440px; height: 900px; transform: scale(0.2); transform-origin: 0 0"></iframe></div></div>',
  },
  'components/embed-once': {
    body: '<div style="transform: translateX(4px)"><div data-et-embed-box style="overflow: hidden; width: 288px; height: 180px"><iframe data-et-embed="pages/tall" data-et-embed-scale="0.2" data-et-embed-drawn style="display: block; border: 0; width: 1440px; height: 900px; transform: scale(0.2); transform-origin: 0 0"></iframe></div></div>',
  },
  'components/wrapped': { body: '<button style="width: 60px">Save the draft now</button>' },
  'components/themed': {
    body: '<style>.et-color--known { color: red }</style><div class="et-color--known et-color--inherited"><p class="et-color--ghost" style="margin: 0">Themed</p></div>',
  },
  'components/ring-cut': {
    body: '<div style="overflow: hidden"><button style="display: block; outline: 3px solid">Go</button></div>',
  },
  'components/shadow-cut': {
    body: '<div style="overflow: hidden"><p style="margin: 0; box-shadow: 0 0 0 4px currentColor">Lifted</p></div>',
  },
  'components/ring-frame': { body: '<p style="margin: 0; outline: 2px solid; outline-offset: 20px">Ring</p>' },
  'components/ring-room': {
    body: '<div style="overflow: hidden; padding: 8px"><button style="display: block; outline: 3px solid; box-shadow: 0 0 0 9px transparent, 0 8px 24px currentColor, inset 0 0 0 20px currentColor">Go</button></div>',
  },
  'components/underline-cut': {
    body: '<p style="margin: 0; width: 80px; overflow: hidden; font-size: 16px; line-height: 16px"><span style="text-decoration: underline wavy; text-underline-offset: 3px">Spelt</span></p>',
  },
  'components/underline-room': {
    body: '<p style="margin: 0; width: 80px; overflow: hidden; padding-bottom: 12px; font-size: 16px; line-height: 16px; text-decoration: underline wavy; text-underline-offset: 3px">Spelt</p>',
  },
  'components/gridded': {
    body: '<p style="margin: 0">Grid</p>',
    extra: "grid: { columns: ['x', 'y'], rows: { r1: { x: 'default', y: 'default' } } },",
  },
  'components/styled': {
    body: '<p class="shop-known shop-gone loose" style="margin: 0"><span class="shop-ghost">Styled</span></p>',
    css: '.shop-known { color: red; }',
  },
  'components/empty': { body: '<div></div>' },
  'components/clean': { body: '<p style="margin: 0">Fine</p>' },
};

const checkout = (parts: typeof PARTS = PARTS) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-render-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(design, { recursive: true });
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ products: { shop: { presets: { desktop: { width: 400, height: 300 } } } } }),
  );

  for (const [key, { body, extra = '', css, states = 'default: {}' }] of Object.entries(parts)) {
    const [layer = '', name = ''] = key.split('/');
    const dir = join(design, 'shop', layer, name);

    mkdirSync(dir, { recursive: true });
    if (css) writeFileSync(join(dir, `${name}.css`), css);
    writeFileSync(
      join(dir, `${name}.ts`),
      `import { definePart, drawing, html } from '@design-system';
${css ? `import styles from './${name}.css?inline';` : ''}

export default definePart({
  note: 'A fixture.',
  states: { ${states} },
  ${extra}
  render: () => drawing({ body: html\`${body}\`, styles: ${css ? 'styles' : "''"} }),
});
`,
    );
  }

  return target;
};

const cwd = process.cwd();

afterEach(() => {
  process.chdir(cwd);
  vi.restoreAllMocks();
});

describe('renderIssuesOf', () => {
  it('hints merged gaps and blocks only newly missing values in sketches', async (context) => {
    const target = checkout({
      'components/example': {
        body: '<div>Example</div>',
        states: "small: { size: 'sm' }, medium: { size: 'md' }",
        extra: "grid: { columns: ['rest'], rows: { small: { rest: 'small' }, medium: { rest: 'medium' } } },",
      },
    });
    const dir = join(target, DESIGN_DIR, 'shop/components/example');
    const path = join(dir, 'example.ts');
    writeFileSync(join(dir, 'mock.ts'), "export type ButtonMockOptions = { size: 'sm' | 'md' | 'lg' };\n");
    writeFileSync(path, `import type { ButtonMockOptions } from './mock';\n${readFileSync(path, 'utf8')}`);
    const shop = join(target, DESIGN_DIR, 'shop');
    const sketches = join(shop, 'sketches/components-example');
    const source = readFileSync(path, 'utf8');
    mkdirSync(sketches, { recursive: true });
    writeFileSync(join(sketches, 'sketch.json'), JSON.stringify({ target: 'components/example', status: 'ready' }));
    for (const variant of ['same', 'dropped', 'added']) {
      const part = join(sketches, variant, 'components/example');
      mkdirSync(part, { recursive: true });
      writeFileSync(
        join(part, 'example.ts'),
        variant === 'dropped' ? source.replace("medium: { rest: 'medium' }", '') : source,
      );
      writeFileSync(
        join(part, 'mock.ts'),
        `export type ButtonMockOptions = { size: 'sm' | 'md' | 'lg'${variant === 'added' ? " | 'xl'" : ''} };`,
      );
    }
    const newPart = join(sketches, 'added/components/new');
    mkdirSync(newPart, { recursive: true });
    writeFileSync(join(newPart, 'new.ts'), source);
    writeFileSync(join(newPart, 'mock.ts'), "export type ButtonMockOptions = { size: 'sm' | 'md' | 'lg' };");
    const config = readConfig(target) ?? {};
    const rendered = await renderIssuesOf({
      target,
      config,
      jobs: [null, ...['same', 'dropped', 'added'].map((variant) => ({ target: 'components/example', variant }))].map(
        (sketch) => ({ product: 'shop', sketch, parts: null }),
      ),
    });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    expect(
      rendered.warnings.filter((issue) => issue.rule === 'OPTION-VALUE-MISSING').map((issue) => issue.detail),
    ).toEqual([expect.stringContaining('lg')]);
    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'OPTION-VALUE-MISSING')
        .map((issue) => [issue.sketch?.variant, issue.detail]),
    ).toEqual([
      ['dropped', expect.stringContaining('md')],
      ['added', expect.stringContaining('xl')],
      ['added', expect.stringContaining('lg')],
    ]);
    const product = resolveProduct({ target, name: 'shop', config: config.products?.['shop'] ?? {} });
    const complete = await completenessOf({ target, config, product, part: 'components/example' });
    expect('gaps' in complete && complete.gaps.some((gap) => gap.code === 'OPTION-VALUE-MISSING')).toBe(false);
    expect('hints' in complete && complete.hints?.some((hint) => hint.includes('OPTION-VALUE-MISSING'))).toBe(true);
  }, 120_000);

  it('finds the drawings the other checks pass: overflow, clipping, wrapping and zero size', async (context) => {
    const target = checkout();
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(checkSystem({ target, config, products: ['shop'] })).toBe(0);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    expect(rendered.issues.map((issue) => `${issue.rule} ${issue.part} ${issue.size}`).sort()).toEqual([
      'CLIPPED components/cut fitted',
      'CLIPPED components/embed-cut fitted',
      'CLIPPED components/ring-cut fitted',
      'CLIPPED components/ring-frame fitted',
      'CLIPPED components/shadow-cut fitted',
      'CLIPPED components/underline-cut fitted',
      'CONTRAST components/styled fitted',
      'CONTRAST components/themed fitted',
      'GRID components/gridded -',
      'OVERFLOW pages/tall desktop',
      'UNKNOWN-THEME components/themed fitted',
      'WRAP components/wrapped fitted',
      'ZERO-SIZE components/empty fitted',
    ]);
    expect(rendered.warnings.map(renderIssueLineOf)).toEqual([
      'EMBED-SCALE shop components/embed-twice default at fitted: div[data-et-part=components/embed-twice] - scales an embedPage of scale 0.2 with transform matrix(0.5, 0, 0, 0.5, 0, 0), so the page shrinks twice: set the scale in one place',
      'UNDEFINED-CLASS shop components/styled default at fitted: p[data-et-part=components/styled] - class "shop-gone" is defined by no stylesheet of the frame',
      'UNDEFINED-CLASS shop components/styled default at fitted: p[data-et-part=components/styled] > span.shop-ghost - class "shop-ghost" is defined by no stylesheet of the frame',
    ]);
    expect(rendered.issues.map(renderIssueLineOf).filter((line) => line.startsWith('WRAP'))).toEqual([
      'WRAP shop components/wrapped default at fitted: button[data-et-part=components/wrapped] - "Save the draft now" breaks onto 4 lines; on purpose: data-et-skip="WRAP" on the element, or definePart({ checks: { skip: [\'WRAP\'] } })',
    ]);
    expect(
      rendered.issues
        .filter((issue) => issue.part.startsWith('components/ring-') || issue.part === 'components/shadow-cut')
        .map((issue) => issue.detail.split(';')[0])
        .sort(),
    ).toEqual([
      'box-shadow 4px past div[data-et-part=components/shadow-cut]',
      'outline 3px past div[data-et-part=components/ring-cut]',
      'outline 6px past the frame',
    ]);
    expect(rendered.issues.find((issue) => issue.part === 'components/underline-cut')?.detail).toMatch(
      /^underline \d+px past p\[data-et-part=components\/underline-cut\];/,
    );
    expect(rendered.issues.find((issue) => issue.rule === 'GRID')?.detail).toBe(
      'grid names the state default twice (r1 x, r1 y)',
    );
    expect(rendered.grids).toEqual([
      { product: 'shop', part: 'components/gridded', sketch: null, line: 'grid 1 row x 2 columns ok' },
    ]);
    expect(rendered.issues.find((issue) => issue.part === 'components/cut')?.detail).toBe(
      'content 300x18 in 100x18; on purpose: data-et-skip="CLIPPED" on the element, or definePart({ checks: { skip: [\'CLIPPED\'] } })',
    );
  }, 120_000);

  it('measures text contrast in the dark scheme of a product that renders one', async (context) => {
    const target = checkout({
      'components/mode': {
        body: '<p class="mode" style="margin: 0">Selected</p>',
        css: '.mode { color: #222; background: #fff; } @media (prefers-color-scheme: dark) { .mode { color: #222; background: #111; } }',
      },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    expect(rendered.issues.map((issue) => `${issue.rule} ${issue.part}: ${issue.detail.split(';')[0]}`)).toEqual([
      expect.stringMatching(/^CONTRAST components\/mode: "Selected" 1\.\d+:1 in the dark scheme, needs 4\.50:1$/),
    ]);
    expect(rendered.drawn).toHaveLength(1);
  });

  it('blocks only interaction states added or changed by a sketch', async (context) => {
    const target = checkout({
      'elements/shell': {
        body: '<p style="margin: 0">Shell</p>',
        states: "rest: {}, 'row-hover': {}",
      },
      'components/row': {
        body: '<button data-et-control="row">Row</button>',
        states: "rest: {}, 'rest-hover': {}",
        extra: "controls: { row: { kind: 'row', input: [] } },",
      },
    });
    const config = readConfig(target) ?? {};
    const shop = join(target, DESIGN_DIR, 'shop');
    const dir = join(shop, 'sketches', 'elements-shell');
    const source = readFileSync(join(shop, 'elements/shell/shell.ts'), 'utf8');

    for (const variant of ['same', 'added', 'changed', 'width'])
      mkdirSync(join(dir, variant, 'elements/shell'), { recursive: true });
    writeFileSync(
      join(dir, 'sketch.json'),
      JSON.stringify({ target: 'elements/shell', status: 'ready', createdAt: '2026-01-01T00:00:00.000Z' }),
    );
    writeFileSync(join(dir, 'same/elements/shell/shell.ts'), source);
    writeFileSync(
      join(dir, 'width/elements/shell/shell.ts'),
      source.replace("note: 'A fixture.',", "note: 'A fixture.', widths: [320],"),
    );
    writeFileSync(
      join(dir, 'added/elements/shell/shell.ts'),
      source.replace("'row-hover': {}", "'row-hover': {}, 'collapse-focus': {}"),
    );
    writeFileSync(join(dir, 'changed/elements/shell/shell.ts'), source.replace('>Shell</p>', '>Changed</p>'));

    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({
      target,
      config,
      jobs: [
        null,
        ...['same', 'added', 'changed', 'width'].map((variant) => ({ target: 'elements/shell', variant })),
      ].map((sketch) => ({ product: 'shop', sketch, parts: null })),
    });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'CONTROL-STATE')
        .map((issue) => `${issue.sketch?.variant}: ${issue.detail.split(' - ').at(-1)}`),
    ).toEqual([
      'added: extract the collapse as its own control part and draw this state there',
      'changed: extract the row as its own control part and draw this state there',
    ]);
  }, 120_000);

  it('compares pixels of merged interaction states when sketch CSS changes', async (context) => {
    const target = checkout({
      'components/shell': {
        body: '<div class="shell">Shell</div>',
        css: '.shell { color: black; }',
        states: "rest: {}, 'row-hover': {}",
      },
    });
    const shop = join(target, DESIGN_DIR, 'shop');
    const dir = join(shop, 'sketches/components-shell');
    const source = readFileSync(join(shop, 'components/shell/shell.ts'), 'utf8');

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'sketch.json'),
      JSON.stringify({ target: 'components/shell', status: 'ready', createdAt: '2026-01-01T00:00:00.000Z' }),
    );
    for (const [variant, css] of [
      ['same', '.shell { color: black; } .sized .shell { min-width: 0; }'],
      ['changed', '.shell { color: red; }'],
    ] as const) {
      const part = join(dir, variant, 'components/shell');
      mkdirSync(part, { recursive: true });
      writeFileSync(join(part, 'shell.ts'), source);
      writeFileSync(join(part, 'shell.css'), css);
    }

    const rendered = await renderIssuesOf({
      target,
      config: readConfig(target) ?? {},
      jobs: ['same', 'changed'].map((variant) => ({
        product: 'shop',
        sketch: { target: 'components/shell', variant },
        parts: ['components/shell'],
      })),
    });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    expect(
      rendered.issues.filter((issue) => issue.rule === 'CONTROL-STATE').map((issue) => issue.sketch?.variant),
    ).toEqual(['changed']);
  }, 120_000);

  it('answers why it can not draw when no browser resolves', async () => {
    const target = checkout();

    await expect(
      renderIssuesOf({
        target,
        config: readConfig(target) ?? {},
        jobs: [{ product: 'shop', sketch: null, parts: null }],
        chromiumOf: async () => null,
      }),
    ).resolves.toEqual({ unavailable: 'neither the checkout nor this package resolves playwright or playwright-core' });
  });

  it('keeps the skips of each sketch variant apart', async (context) => {
    const target = checkout();
    const dir = join(target, DESIGN_DIR, 'shop', 'sketches', 'components-cut');
    const cut = readFileSync(join(target, DESIGN_DIR, 'shop', 'components', 'cut', 'cut.ts'), 'utf8');

    mkdirSync(join(dir, 'a', 'components', 'cut'), { recursive: true });
    mkdirSync(join(dir, 'b', 'components', 'cut'), { recursive: true });
    writeFileSync(
      join(dir, 'sketch.json'),
      JSON.stringify({ target: 'components/cut', status: 'ready', createdAt: '2026-01-01T00:00:00.000Z' }),
    );
    writeFileSync(join(dir, 'a', 'components', 'cut', 'cut.ts'), cut);
    writeFileSync(
      join(dir, 'b', 'components', 'cut', 'cut.ts'),
      cut.replace('states: { default: {} },', "states: { default: {} }, checks: { skip: ['CLIPPED'] },"),
    );

    const rendered = await renderIssuesOf({
      target,
      config: readConfig(target) ?? {},
      jobs: ['a', 'b'].map((variant) => ({
        product: 'shop',
        sketch: { target: 'components/cut', variant },
        parts: ['components/cut'],
      })),
    });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    expect(rendered.issues.map((issue) => `${issue.rule} ${issue.sketch?.variant}`)).toEqual(['CLIPPED a']);
  }, 120_000);

  it("draws a page with a named helper of another part, the sketched part's helper in a variant", async (context) => {
    const target = checkout();
    const shop = join(target, DESIGN_DIR, 'shop');
    const sketch = join(shop, 'sketches', 'pages-uses');
    const helper = (markup: string) => `${readFileSync(join(shop, 'components/clean/clean.ts'), 'utf8')}
export const filler = (): string => '${markup}';
`;
    const page = `import { definePart, drawing, html } from '@design-system';
import { filler } from '@system/components/clean';

export default definePart({
  note: 'A fixture.',
  states: { default: {} },
  render: () => drawing({ body: html\`<main>\${filler()}</main>\`, styles: '' }),
});
`;

    mkdirSync(join(shop, 'pages/uses'), { recursive: true });
    mkdirSync(join(sketch, 'a/pages/uses'), { recursive: true });
    mkdirSync(join(sketch, 'a/components/clean'), { recursive: true });
    writeFileSync(join(sketch, 'a/components/clean/clean.ts'), helper('<div style="height: 900px">Tall</div>'));
    writeFileSync(join(shop, 'components/clean/clean.ts'), helper('<p style="margin: 0">Short</p>'));
    writeFileSync(join(shop, 'pages/uses/uses.ts'), page);
    writeFileSync(join(sketch, 'a/pages/uses/uses.ts'), page);
    writeFileSync(
      join(sketch, 'sketch.json'),
      JSON.stringify({ target: 'pages/uses', status: 'ready', createdAt: '2026-01-01T00:00:00.000Z' }),
    );

    const rendered = await renderIssuesOf({
      target,
      config: readConfig(target) ?? {},
      jobs: [null, { target: 'pages/uses', variant: 'a' }].map((drawn) => ({
        product: 'shop',
        sketch: drawn,
        parts: ['pages/uses'],
      })),
    });

    if ('unavailable' in rendered) return context.skip(rendered.unavailable);

    expect(rendered.issues.map((issue) => `${issue.rule} ${issue.sketch?.variant ?? 'base'}`)).toEqual(['OVERFLOW a']);
  }, 120_000);
});

describe('groupedIssueLinesOf', () => {
  const issue = (variant: string, state: string, detail: string) => ({
    rule: 'CONTRAST',
    product: 'studio',
    part: 'pages/inbox',
    state,
    size: 'desktop',
    path: 'nav.rail',
    detail,
    sketch: { target: 'elements/shell', variant },
  });

  it('prints a finding that repeats across states, schemes and variants once, with where it was found', () => {
    const light = 'border 1.63:1 in the light scheme, needs 3.00:1';
    const dark = 'border 1.63:1 in the dark scheme, needs 3.00:1';

    expect(
      groupedIssueLinesOf([
        issue('a', 'open', light),
        issue('a', 'open', dark),
        issue('a', 'empty', light),
        issue('b', 'open', light),
        issue('b', 'open', 'border 2.10:1 in the light scheme, needs 3.00:1'),
      ]),
    ).toEqual([
      'elements/shell a, b: CONTRAST studio pages/inbox open, empty at desktop: nav.rail - border 1.63:1 in the light and dark scheme, needs 3.00:1 (4 times)',
      'elements/shell b: CONTRAST studio pages/inbox open at desktop: nav.rail - border 2.10:1 in the light scheme, needs 3.00:1',
    ]);
  });
});
