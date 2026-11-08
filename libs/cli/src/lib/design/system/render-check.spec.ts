import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chromium, chromiumOf } from '../browser';
import { DESIGN_DIR, readConfig } from '../design-config';
import { checkSystem } from './check-system';
import { completenessOf } from './complete';
import { resolveProduct } from './resolve-product';
import { groupedIssueLinesOf, renderIssueLineOf, renderIssuesOf, uniqueIssuesOf } from './render-check';

const skipWithoutBrowser = (context: { skip: (note?: string) => never }, reason: string) => {
  if (process.env['CI']) throw new Error(`No browser in CI: ${reason}`);

  return context.skip(reason);
};

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
  'components/spinner': {
    body: '<span class="et-spinner" style="display: block; width: 18px; height: 18px; overflow: hidden"><span style="display: block; width: 9px; height: 18px; overflow: hidden"><span style="display: block; width: 18px; height: 18px; transform: rotate(45deg)"></span></span></span>',
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
  'components/wrapped': { body: '<button data-et-action="emit:go" style="width: 60px">Save the draft now</button>' },
  'components/clamped': {
    body: '<button data-et-action="emit:go" style="width: 60px"><p style="margin: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden">Save the draft now please</p></button>',
  },
  'components/themed': {
    body: '<style>.et-color--known { color: red }</style><div class="et-color--known et-color--inherited"><p class="et-color--ghost" style="margin: 0">Themed</p></div>',
  },
  'components/ring-cut': {
    body: '<div style="overflow: hidden"><button data-et-action="emit:go" style="display: block; outline: 3px solid">Go</button></div>',
  },
  'components/shadow-cut': {
    body: '<div style="overflow: hidden"><p style="margin: 0; box-shadow: 0 0 0 4px currentColor">Lifted</p></div>',
  },
  'components/ring-frame': { body: '<p style="margin: 0; outline: 2px solid; outline-offset: 20px">Ring</p>' },
  'components/ring-room': {
    body: '<div style="overflow: hidden; padding: 8px"><button data-et-action="emit:go" style="display: block; outline: 3px solid; box-shadow: 0 0 0 9px transparent, 0 8px 24px currentColor, inset 0 0 0 20px currentColor">Go</button></div>',
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

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

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

  it('flags a disabled control whose hover or active look differs, and not one with the guard', async (context) => {
    const button = '<button disabled style="border: 1px solid">Save</button>';
    const target = checkout({
      'components/open': { body: button, css: 'button { background: white; } button:hover { background: red; }' },
      'components/guarded': {
        body: button,
        css: 'button { background: white; } button:not([disabled]):hover { background: red; }',
      },
      'components/active-open': {
        body: '<button aria-disabled="true">Save</button>',
        css: 'button:active { transform: scale(0.9); }',
      },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'DISABLED-INTERACTION')
        .map((issue) => [issue.part, issue.detail])
        .sort(),
    ).toEqual([
      [
        'components/active-open',
        'hover/active styles apply while disabled - add a :not([disabled]) guard (changes transform)',
      ],
      [
        'components/open',
        'hover/active styles apply while disabled - add a :not([disabled]) guard (changes backgroundColor)',
      ],
    ]);
  }, 120_000);

  it('aims an anchored arrow in the frame, reports a tip that cannot reach its anchor and a hand-moved arrow', async (context) => {
    const drawn = (attributes: string, arrow: string, buttonLeft = 100) =>
      `<div style="padding: 8px"><button id="go" style="display: block; margin-left: ${buttonLeft}px; box-sizing: border-box; width: 40px; height: 20px; padding: 0; border: 0">Go</button><div class="et-anchored-dialog-mock" data-overlay-placement="bottom-start" ${attributes} style="position: relative; width: 200px; height: 60px; margin-top: 10px"><div class="et-overlay-arrow" style="position: absolute; top: -10px; width: 20px; height: 20px; transform: var(--et-floating-arrow-translate); ${arrow}"></div></div></div>`;
    const target = checkout({
      'components/arrow-aimed': { body: drawn('data-et-arrow-anchor="#go"', 'left: 16px') },
      'components/arrow-out-of-reach': { body: drawn('data-et-arrow-anchor="#go"', 'left: 16px', 300) },
      'components/arrow-lost': { body: drawn('data-et-arrow-anchor="#gone"', 'left: 100px') },
      'components/arrow-by-hand': { body: drawn('', '--et-floating-arrow-translate: translate3d(100px, 0, 0)') },
      'components/arrow-default': { body: drawn('', 'left: 16px') },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'ARROW-ANCHOR')
        .map((issue) => [issue.part, issue.detail])
        .sort(),
    ).toEqual([
      ['components/arrow-by-hand', expect.stringContaining('moved by hand')],
      ['components/arrow-lost', 'the arrow anchor "#gone" matches no drawn element'],
      ['components/arrow-out-of-reach', 'the arrow tip is 146px left of the centre of "#go"'],
    ]);
  }, 120_000);

  it('flags a single line of text off the vertical centre of its pill, and an icon out of the pill', async (context) => {
    const pill = (padding: string, inner = 'Ready') =>
      `<div style="padding: 8px"><span style="display: inline-block; font: 12px/12px sans-serif; padding: ${padding}; background: rgb(20, 120, 60); color: white; border-radius: 99px">${inner}</span></div>`;
    const target = checkout({
      'components/pill-centred': { body: pill('4px 8px') },
      'components/pill-high': { body: pill('1px 8px 7px') },
      'components/pill-icon-out': {
        body: `<div style="padding: 8px"><span style="display: inline-flex; align-items: center; gap: 4px; height: 20px; font: 12px/12px sans-serif; padding: 0 8px; background: rgb(20, 120, 60); color: white"><svg style="flex: none; width: 24px; height: 24px"></svg>Ready</span></div>`,
      },
      'components/pill-trimmed-inline-flex': {
        body: `<div style="padding: 8px"><span style="display: inline-block; text-box: trim-both cap alphabetic; font: 12px/16px sans-serif; padding: 4px 8px; background: rgb(20, 120, 60); color: white"><span style="display: inline-flex; align-items: center; gap: 4px"><svg style="width: 12px; height: 12px"></svg>Ready</span></span></div>`,
      },
      'components/pill-trimmed-flex': {
        body: `<div style="padding: 8px"><span style="display: inline-block; font: 12px/16px sans-serif; padding: 4px 8px; background: rgb(20, 120, 60); color: white"><span style="display: flex; align-items: center; gap: 4px"><svg style="flex: none; width: 12px; height: 12px"></svg><span style="text-box: trim-both cap alphabetic">Ready</span></span></span></div>`,
      },
      'components/pill-card': {
        body: pill('1px 8px 40px', 'Title<div style="height: 30px; background: rgb(0, 0, 0)"></div>'),
      },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'OFF-CENTRE')
        .map((issue) => [issue.part, issue.detail.split(';')[0]])
        .sort(),
    ).toEqual([
      ['components/pill-high', expect.stringMatching(/^the text sits [\d.]+px high in its box/u)],
      ['components/pill-icon-out', expect.stringMatching(/^an icon sticks [\d.]+px out of the box$/u)],
      ['components/pill-trimmed-inline-flex', expect.stringMatching(/^the text sits [\d.]+px high in its box/u)],
    ]);
  }, 120_000);

  it('does not flag text whose centre the box does not set', async (context) => {
    const fill = 'background: rgb(20, 120, 60); color: white';
    const target = checkout({
      'components/high': {
        body: `<div style="padding: 8px"><span style="display: inline-block; font: 12px/12px sans-serif; padding: 1px 8px 7px; ${fill}">Ready</span></div>`,
      },
      'components/scaled': {
        body: `<div style="padding: 8px; transform: scale(0.25); transform-origin: 0 0"><span style="display: inline-block; font: 40px/40px sans-serif; padding: 16px 24px; ${fill}">Ready</span></div>`,
      },
      'components/underlined': {
        body: `<div style="padding: 8px"><span style="display: block; font: 12px/12px sans-serif; padding: 0 0 12px; border-bottom: 1px solid rgb(0, 0, 0)">Section</span></div>`,
      },
      'components/line-filled': {
        body: `<div style="padding: 8px"><span style="display: inline-block; font: 40px/40px sans-serif; ${fill}"><span style="position: relative; top: 6px">Ready</span></span></div>`,
      },
      'components/top-aligned': {
        body: `<div style="padding: 8px"><span style="display: flex; align-items: flex-start; height: 48px; font: 12px/12px sans-serif; padding: 4px 8px; ${fill}">Daily sync</span></div>`,
      },
      'components/with-input': {
        body: `<div style="padding: 8px"><label style="display: block; position: relative; width: 200px; font: 12px/12px sans-serif; padding: 4px 8px 32px; ${fill}">Name<input value="Ada" style="position: absolute; left: 8px; top: 10px; height: 30px; margin: 0; border: 0; padding: 0; font: 16px/30px sans-serif" /></label></div>`,
      },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'OFF-CENTRE')
        .map((issue) => issue.part)
        .sort(),
    ).toEqual(['components/high']);
  }, 120_000);

  it('flags text that shows through an open overlay pane, and not under an opaque one', async (context) => {
    const page = (pane: string) =>
      `<div style="position: relative; width: 300px; height: 160px"><p style="margin: 0; padding: 40px 8px">Round one text below</p>${pane}</div>`;
    const target = checkout({
      'components/see-through': {
        body: page(
          '<div class="et-overlay" role="dialog" style="position: absolute; top: 20px; left: 0; width: 280px; height: 80px">Pane</div>',
        ),
      },
      'components/half-opaque': {
        body: page(
          '<div class="et-overlay" role="dialog" style="position: absolute; top: 20px; left: 0; width: 280px; height: 80px; background: rgb(255 255 255 / 0.5)">Pane</div>',
        ),
      },
      'components/opaque': {
        body: page(
          '<div class="et-overlay" role="dialog" style="position: absolute; top: 20px; left: 0; width: 280px; height: 80px; background: white">Pane</div>',
        ),
      },
      'components/opaque-wrapper': {
        body: page(
          '<span style="position: absolute; top: 20px; left: 0; background: white"><div class="et-overlay" role="dialog" style="width: 280px; height: 80px">Pane</div></span>',
        ),
      },
      'components/opaque-panel': {
        body: page(
          '<div class="cdk-overlay-pane" style="position: absolute; top: 20px; left: 0"><div role="menu" style="width: 280px; height: 80px; background: white">Pane</div></div>',
        ),
      },
      'components/inline-dialog': {
        body: page('<div role="dialog" style="margin-top: -60px; height: 80px">Pane</div>'),
      },
      'components/painted-over': {
        body: '<div style="position: relative; width: 300px; height: 160px"><header style="position: absolute; z-index: 1; top: 0; left: 0"><div class="et-overlay" role="dialog" style="position: absolute; top: 20px; left: 0; width: 280px; height: 80px; background: white">Pane</div></header><p style="position: absolute; z-index: 1; top: 40px; left: 8px; margin: 0">Round picker on top</p></div>',
      },
      'components/pane-over-pane': {
        body: '<div style="position: relative; width: 300px; height: 160px"><div class="et-overlay" role="dialog" style="position: absolute; top: 20px; left: 0; width: 280px; height: 80px; background: white">Pane</div><div class="et-overlay" role="menu" style="position: absolute; top: 40px; left: 8px; background: white">Nested menu</div></div>',
      },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'SEE-THROUGH')
        .map((issue) => [issue.part, issue.detail.replace(/ at \d+ of \d+ points/u, '')])
        .sort(),
    ).toEqual([
      [
        'components/half-opaque',
        'the open overlay pane lets "Round one text below" (p) under it show through - give the pane an opaque background',
      ],
      [
        'components/painted-over',
        '"Round picker on top" (p) paints over the open overlay pane - lift the pane above it (z-index or stacking context)',
      ],
      [
        'components/see-through',
        'the open overlay pane lets "Round one text below" (p) under it show through - give the pane an opaque background',
      ],
    ]);
  }, 120_000);

  it('names the states whose render is busy or holds a loading button, and keeps them out of the issues', async (context) => {
    const target = checkout({
      'components/send-busy': { body: '<button type="button" aria-busy="true">Senden</button>', states: 'sending: {}' },
      'components/send-loading': { body: '<button type="button" data-loading="true">Senden</button>' },
      'components/send-idle': { body: '<button type="button" aria-busy="false">Senden</button>' },
    });
    const config = readConfig(target) ?? {};
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });
    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);
    expect(rendered.busy?.map(({ part, state }) => `${part} ${state}`).sort()).toEqual([
      'components/send-busy sending',
      'components/send-loading default',
    ]);
    expect(rendered.issues.filter((issue) => issue.rule === 'BUSY')).toEqual([]);
  }, 120_000);

  it('measures the contrast of text in an inert preview, which stays visible', async (context) => {
    const tile = (inner: string) =>
      `<div style="background: rgb(220 220 220); padding: 8px; width: 200px">${inner}</div>`;
    const target = checkout({
      'components/inert-tile': {
        body: tile('<div inert><p style="margin: 0; color: rgb(240 240 240)">Linux close</p></div>'),
      },
      'components/plain-tile': {
        body: tile('<div><p style="margin: 0; color: rgb(240 240 240)">Linux close</p></div>'),
      },
    });
    const config = readConfig(target) ?? {};
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });
    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);
    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'CONTRAST')
        .map((issue) => issue.part)
        .sort(),
    ).toEqual(['components/inert-tile', 'components/plain-tile']);
  }, 120_000);

  it('flags a nested scroll box whose content outgrows it, unless the part declares that it scrolls', async (context) => {
    const rows = '<p style="margin: 0; height: 40px">Row one</p><p style="margin: 0; height: 40px">Row two</p>';
    const target = checkout({
      'components/scrolls': {
        body: `<div style="width: 200px"><div style="height: 50px; overflow-y: auto">${rows}</div></div>`,
      },
      'components/scrolls-x': {
        body: '<div style="width: 100px; overflow-x: scroll"><div style="width: 300px">Wide</div></div>',
      },
      'components/fits': {
        body: `<div style="width: 200px"><div style="height: 100px; overflow: auto">${rows}</div></div>`,
      },
      'components/sdk-scroller': {
        body: `<div style="width: 200px"><et-scrollable style="display: block"><div style="height: 50px; overflow-y: auto">${rows}</div></et-scrollable></div>`,
      },
      'components/declared': {
        body: `<div style="width: 200px"><div style="height: 50px; overflow-y: auto">${rows}</div></div>`,
        extra: "checks: { skip: ['NESTED-SCROLL'] },",
      },
      'components/declared-element': {
        body: `<div style="width: 200px"><div data-et-skip="NESTED-SCROLL" style="height: 50px; overflow-y: auto">${rows}</div></div>`,
      },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'NESTED-SCROLL')
        .map((issue) => [issue.part, issue.path, issue.detail.split(';')[0]])
        .sort(),
    ).toEqual([
      [
        'components/scrolls',
        'div[data-et-part=components/scrolls] > div',
        'scrolls its content 200x80 in a 200x50 box, so no shot shows all of it - size the box to its content',
      ],
      [
        'components/scrolls-x',
        'div[data-et-part=components/scrolls-x]',
        'scrolls its content 300x18 in a 100x18 box, so no shot shows all of it - size the box to its content',
      ],
    ]);
  }, 120_000);

  it('flags a card that doubles the pane it fills and a card whose fill equals the surface around it', async (context) => {
    const card = (fill: string, edge = 'border: 1px solid rgb(90 90 90)') =>
      `<div class="card" style="background: ${fill}; ${edge}; padding: 8px"><p style="margin: 0">Kommentar</p></div>`;
    const pane = (inner: string) =>
      `<div class="pane" role="dialog" style="width: 300px; background: rgb(30 30 30); padding: 12px">${inner}</div>`;
    const target = checkout({
      'components/doubled': { body: pane(card('rgb(30 30 30)')) },
      'components/raised': { body: pane(card('rgb(50 50 50)')) },
      'components/beside-title': { body: pane(`<h2 style="margin: 0">Titel</h2>${card('rgb(30 30 30)')}`) },
      'components/on-canvas': {
        body: `<div style="width: 300px">${card('rgb(255 255 255)', 'box-shadow: 0 1px 3px rgb(0 0 0 / 0.3)')}</div>`,
      },
      'components/field': {
        body: '<div style="width: 300px"><textarea style="width: 200px; height: 60px; background: white; border: 1px solid gray"></textarea></div>',
      },
      'components/declared': { body: pane(card('rgb(30 30 30)')), extra: "checks: { skip: ['NESTED-SURFACE'] }," },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'NESTED-SURFACE' || issue.rule === 'LOST-SURFACE')
        .map((issue) => [issue.rule, issue.part, issue.path, issue.detail.split(';')[0]])
        .sort(),
    ).toEqual([
      [
        'LOST-SURFACE',
        'components/beside-title',
        'div[data-et-part=components/beside-title] > div.card',
        'fills with rgb(30, 30, 30), the fill of div[data-et-part=components/beside-title] around it, so only its edge shows the card - give it the surface it is placed on (data-et-auto-surface) or drop the fill',
      ],
      [
        'LOST-SURFACE',
        'components/on-canvas',
        'div[data-et-part=components/on-canvas] > div.card',
        'fills with rgb(255, 255, 255), the fill of the canvas around it, so only its edge shows the card - give it the surface it is placed on (data-et-auto-surface) or drop the fill',
      ],
      [
        'NESTED-SURFACE',
        'components/doubled',
        'div[data-et-part=components/doubled] > div.card',
        'is the only content of div[data-et-part=components/doubled], which draws the same fill rgb(30, 30, 30) with a band of 12/12/12/12px around it, so two surfaces draw as one - drop the card or the pane',
      ],
    ]);
  }, 120_000);

  it('does not flag a card that hides the dot pattern of the surface around it as a lost surface', async (context) => {
    const card = `<div class="card" style="width: 200px; background: rgb(30 30 30); border: 1px solid rgb(90 90 90); padding: 8px"><p style="margin: 0">Shot</p></div>`;
    const dots =
      'background-color: rgb(30 30 30); background-image: radial-gradient(rgb(90 90 90) 1px, transparent 1px); background-size: 8px 8px';
    const target = checkout({
      'components/on-dots': {
        body: `<div style="width: 300px; padding: 12px; ${dots}"><h2 style="margin: 0">Titel</h2>${card}</div>`,
      },
      'components/on-plain': {
        body: `<div style="width: 300px; padding: 12px; background: rgb(30 30 30)"><h2 style="margin: 0">Titel</h2>${card}</div>`,
      },
      'components/over-dotted-sibling': {
        body: `<div style="position: relative; width: 300px; height: 120px; background: rgb(30 30 30)"><main style="position: absolute; inset: 0; ${dots}"></main><aside style="position: absolute; top: 12px; left: 12px">${card}</aside></div>`,
      },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(rendered.issues.filter((issue) => issue.rule === 'LOST-SURFACE').map((issue) => issue.part)).toEqual([
      'components/on-plain',
    ]);
  }, 120_000);

  it('does not flag a full-width bar with a one-side divider as a lost surface, but a boxed one', async (context) => {
    const bar = (edge: string) =>
      `<div class="bar" style="width: 300px; background: rgb(255 255 255); ${edge}; padding: 8px"><p style="margin: 0">Titel</p></div>`;
    const target = checkout({
      'components/title-bar': { body: bar('border-bottom: 1px solid rgb(90 90 90)') },
      'components/boxed-bar': { body: bar('border: 1px solid rgb(90 90 90)') },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(rendered.issues.filter((issue) => issue.rule === 'LOST-SURFACE').map((issue) => issue.part)).toEqual([
      'components/boxed-bar',
    ]);
  }, 120_000);

  it('finds the drawings the other checks pass: overflow, clipping, wrapping and zero size', async (context) => {
    const target = checkout();
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(checkSystem({ target, config, products: ['shop'] })).toBe(0);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

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
    expect(rendered.warnings.filter((issue) => issue.rule !== 'CONTROL-PART-INPUT').map(renderIssueLineOf)).toEqual([
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

  it('flags a control cut by its clip, and a CLIPPED skip over controls', async (context) => {
    const pan = (style: string, inner = '<button>Übernehmen</button>', skip = '') =>
      `<div${skip} style="position: relative; width: 300px; height: 80px; ${style}"><div style="transform: translateX(-60px)">${inner}</div></div>`;
    const target = checkout({
      'components/pan-cut': { body: pan('overflow: clip', undefined, ' data-et-skip="CLIPPED"') },
      'components/pan-scrolls': { body: pan('overflow: auto') },
      'components/pan-gone': {
        body: '<div style="width: 300px; height: 80px; overflow: clip"><div style="transform: translateX(-400px)"><button>Übernehmen</button></div></div>',
      },
      'components/pan-hidden': {
        body: `<div style="visibility: hidden">${pan('overflow: clip')}</div>`,
      },
      'components/pan-faded': { body: `<div style="opacity: 0">${pan('overflow: clip')}</div>` },
      'components/pan-inert': { body: `<div inert>${pan('overflow: clip')}</div>` },
      'components/pan-aria-hidden': { body: `<div aria-hidden="true">${pan('overflow: clip')}</div>` },
      'components/pan-skipped': { body: `<div data-et-skip="CUT-CONTROL">${pan('overflow: clip')}</div>` },
      'components/pan-sticky': {
        body: '<div style="width: 300px; height: 80px; overflow: auto"><div style="display: flex; width: 600px"><button style="position: sticky; left: 0">Übernehmen</button></div></div>',
      },
      'components/pan-skip-over-inert': {
        body: pan('overflow: clip', '<div inert><button>Übernehmen</button></div>', ' data-et-skip="CLIPPED"'),
      },
      'components/pan-skip-on-clip': {
        body: '<div><div data-et-skip="CLIPPED" style="width: 100px; overflow: hidden"><div style="width: 300px">Wide</div></div></div>',
      },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'CUT-CONTROL' || issue.rule === 'SKIP-SCOPE')
        .map((issue) => `${issue.rule} ${issue.part}: ${issue.path} - ${issue.detail}`)
        .sort(),
    ).toEqual([
      'CUT-CONTROL components/pan-cut: div[data-et-part=components/pan-cut] > div > button - 60px of its width is cut by div[data-et-part=components/pan-cut], so the control is only partly reachable',
      'SKIP-SCOPE components/pan-cut: div[data-et-part=components/pan-cut] - data-et-skip=CLIPPED on div[data-et-part=components/pan-cut] covers interactive controls - put the skip on the clipped element itself',
    ]);
  }, 120_000);

  it('does not flag a ring cut at the edge of a pan or scroll container, but one cut by a box its content fits', async (context) => {
    const ring = '<figure style="margin: 0; width: 100px; height: 40px; box-shadow: 0 0 0 2px currentColor"></figure>';
    const target = checkout({
      'components/ring-panned': {
        body: `<div style="width: 300px; height: 80px; overflow: hidden"><div style="transform: translate(0px, 0px)">${ring}</div></div>`,
      },
      'components/ring-scrolled': {
        body: `<div style="width: 300px; height: 80px; overflow: hidden"><div style="height: 200px; padding: 0 8px">${ring}</div></div>`,
      },
      'components/ring-fits': {
        body: `<div style="width: 300px; height: 80px; overflow: hidden">${ring}</div>`,
      },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'CLIPPED')
        .map((issue) => `${issue.part}: ${issue.path} - ${issue.detail.split(';')[0]}`),
    ).toEqual([
      'components/ring-fits: div[data-et-part=components/ring-fits] > figure - box-shadow 2px past div[data-et-part=components/ring-fits]',
      'components/ring-scrolled: div[data-et-part=components/ring-scrolled] - content 300x200 in 300x80',
    ]);
  }, 120_000);

  it('does not flag content inside the clip margin, a grab-to-pan box or a box whose content is moved by a transform', async (context) => {
    const box = (style: string, inner: string) => `<div style="width: 100px; height: 40px; ${style}">${inner}</div>`;
    const ring = '<div style="width: 100px; height: 40px; outline: 2px solid currentColor; outline-offset: 2px"></div>';
    const wide = '<div style="width: 300px; height: 40px"></div>';
    const target = checkout({
      'components/clip-margin': {
        body: box('overflow: clip; overflow-clip-margin: 8px', ring + '<div style="width: 104px"></div>'),
      },
      'components/clip-margin-short': { body: box('overflow: clip; overflow-clip-margin: 2px', wide) },
      'components/grab-pan': { body: box('overflow: hidden; cursor: grab', wide) },
      'components/translated': {
        body: box('overflow: hidden', '<div style="width: 300px; height: 40px; translate: -60px 0"></div>'),
      },
      'components/scaled-cut': {
        body: box(
          'overflow: hidden',
          '<div style="width: 300px; height: 120px; transform: scale(0.5); transform-origin: 0 0"></div>',
        ),
      },
      'components/scaled': {
        body: box(
          'overflow: hidden',
          '<div style="width: 300px; height: 120px; transform: scale(0.33); transform-origin: 0 0"></div>',
        ),
      },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'CLIPPED')
        .map((issue) => `${issue.part}: ${issue.path} - ${issue.detail.split(';')[0]}`),
    ).toEqual([
      'components/clip-margin-short: div[data-et-part=components/clip-margin-short] - content 300x40 in 100x40',
      'components/scaled-cut: div[data-et-part=components/scaled-cut] - content 150x60 in 100x40',
    ]);
  }, 120_000);

  it('flags an SDK component whose styles rode in a slot the picture empties', async (context) => {
    const hidden =
      '.et-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }';
    const page = (shot: string) =>
      `<div><div data-et-projected="shot">${shot}<p style="margin: 0">shot</p></div><p style="margin: 0">Search <span class="et-visually-hidden">Control K</span></p></div>`;
    const target = checkout({
      'pages/styles-in-shot': { body: page(`<style>${hidden}</style>`) },
      'pages/styles-in-drawing': { body: page(''), css: hidden },
    });
    const config = readConfig(target) ?? {};

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rendered = await renderIssuesOf({ target, config, jobs: [{ product: 'shop', sketch: null, parts: null }] });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(rendered.issues.filter((issue) => issue.rule === 'UNSTYLED-SDK').map(renderIssueLineOf)).toEqual([
      'UNSTYLED-SDK shop pages/styles-in-shot default at desktop: div[data-et-part=pages/styles-in-shot] > p > span.et-visually-hidden - the visually hidden "Control K" draws in the picture, so an SDK component here renders without its styles',
    ]);
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

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(rendered.issues.map((issue) => `${issue.rule} ${issue.part}: ${issue.detail.split(';')[0]}`)).toEqual([
      expect.stringMatching(/^CONTRAST components\/mode: "Selected" 1\.\d+:1 in the dark scheme, needs 4\.50:1$/),
    ]);
    expect(rendered.drawn).toHaveLength(1);
  });

  it('blocks only interaction states a sketch adds, not merged ones it redraws', async (context) => {
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

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'CONTROL-STATE')
        .map((issue) => `${issue.sketch?.variant}: ${issue.detail.split(' - ').at(-1)}`),
    ).toEqual(['added: extract the collapse as its own control part and draw this state there']);
  }, 120_000);

  it('hints unmarked controls of merged parts and blocks only those a sketch adds', async (context) => {
    const target = checkout({
      'components/bar': {
        body: '<div><button>Save</button><a href="#" data-et-control="link">More</a><span role="switch">On</span></div>',
      },
      'foundations/swatch': { body: '<div><button>Swatch</button></div>' },
    });
    const config = readConfig(target) ?? {};
    const shop = join(target, DESIGN_DIR, 'shop');
    const dir = join(shop, 'sketches', 'components-bar');
    const source = readFileSync(join(shop, 'components/bar/bar.ts'), 'utf8');

    for (const variant of ['same', 'added']) mkdirSync(join(dir, variant, 'components/bar'), { recursive: true });
    mkdirSync(join(dir, 'added/components/fresh'), { recursive: true });
    writeFileSync(join(dir, 'sketch.json'), JSON.stringify({ target: 'components/bar', status: 'ready' }));
    writeFileSync(join(dir, 'same/components/bar/bar.ts'), source.replace('>Save<', '>Keep<'));
    writeFileSync(
      join(dir, 'added/components/bar/bar.ts'),
      source.replace(
        '</div>',
        '<input class="bar-name" placeholder="Name" /><details><summary>More</summary></details><div class="bar-focus" tabindex="0">Pick</div><div role="listbox" tabindex="-1">Rows</div><div role="dialog" tabindex="-1">Pane</div><div class="bar-canvas" tabindex="0" aria-label="Design Canvas"><style>.bar-x { color: red; }</style></div></div>',
      ),
    );
    writeFileSync(join(dir, 'added/components/fresh/fresh.ts'), source);

    const rendered = await renderIssuesOf({
      target,
      config,
      jobs: [null, ...['same', 'added'].map((variant) => ({ target: 'components/bar', variant }))].map((sketch) => ({
        product: 'shop',
        sketch,
        parts: null,
      })),
    });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    const linesOf = (found: typeof rendered.issues) =>
      found
        .filter((issue) => issue.rule === 'CONTROL-PART-INPUT')
        .map((issue) => `${issue.sketch?.variant ?? '-'} ${issue.part}: ${issue.detail.split(' is a control')[0]}`);

    expect(linesOf(rendered.warnings)).toEqual(['- components/bar: button "Save"', '- components/bar: span "On"']);
    expect(linesOf(rendered.issues)).toEqual([
      'added components/bar: input.bar-name "Name"',
      'added components/bar: summary "More"',
      'added components/bar: div.bar-focus "Pick"',
      'added components/bar: div.bar-canvas "Design Canvas"',
      'added components/fresh: button "Save"',
      'added components/fresh: span "On"',
    ]);
  }, 120_000);

  it('blocks only issues a sketch adds, also when it moves its demo frame out of render', async (context) => {
    const card =
      '<div class="card"><p style="margin: 0; color: #f00">Low</p><button data-et-action="emit:go">Go</button></div>';
    const target = checkout({
      'components/card': { body: `<div class="card-frame" style="padding: 8px">${card}</div>` },
    });
    const shop = join(target, DESIGN_DIR, 'shop');
    const dir = join(shop, 'sketches', 'components-card');
    const source = readFileSync(join(shop, 'components/card/card.ts'), 'utf8');
    const variants = {
      same: source,
      moved: source
        .replace('<div class="card-frame" style="padding: 8px">', '')
        .replace('</div></div>`', '</div>`')
        .replace(
          'render:',
          'frame: (body: string) => `<div class="card-frame" style="padding: 8px">${body}</div>`,\n  render:',
        ),
      fresh: source.replace('<button ', '<span style="color: #f88">New</span><button '),
    };

    for (const [variant, file] of Object.entries(variants)) {
      mkdirSync(join(dir, variant, 'components/card'), { recursive: true });
      writeFileSync(join(dir, variant, 'components/card/card.ts'), file);
    }

    writeFileSync(join(dir, 'sketch.json'), JSON.stringify({ target: 'components/card', status: 'ready' }));

    const rendered = await renderIssuesOf({
      target,
      config: readConfig(target) ?? {},
      jobs: [null, ...Object.keys(variants).map((variant) => ({ target: 'components/card', variant }))].map(
        (sketch) => ({ product: 'shop', sketch, parts: null }),
      ),
    });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(variants.moved).toContain('frame:');
    expect(
      rendered.issues.map(
        (issue) => `${issue.sketch?.variant ?? '-'} ${issue.rule}: ${issue.detail.split(' ')[0]} ${issue.path}`,
      ),
    ).toEqual([
      '- CONTRAST: "Low" div[data-et-part=components/card] > div.card > p',
      'fresh CONTRAST: "New" div[data-et-part=components/card] > div.card > span',
    ]);
  }, 120_000);

  it('answers the issues the product part has now when asked for them before a sketch that fixes them', async (context) => {
    const target = checkout({
      'components/card': { body: '<p style="margin: 0; color: #f00">Low</p>' },
    });
    const shop = join(target, DESIGN_DIR, 'shop');
    const dir = join(shop, 'sketches', 'components-card');
    const source = readFileSync(join(shop, 'components/card/card.ts'), 'utf8');

    mkdirSync(join(dir, 'fixed', 'components/card'), { recursive: true });
    writeFileSync(join(dir, 'fixed', 'components/card/card.ts'), source.replace('color: #f00', 'color: #000'));
    writeFileSync(join(dir, 'sketch.json'), JSON.stringify({ target: 'components/card', status: 'ready' }));

    const rendered = await renderIssuesOf({
      target,
      config: readConfig(target) ?? {},
      jobs: [{ product: 'shop', sketch: { target: 'components/card', variant: 'fixed' }, parts: null }],
      before: [{ product: 'shop', part: 'components/card' }],
    });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(rendered.issues).toEqual([]);
    expect(
      rendered.before?.map((issue) => `${issue.sketch?.variant ?? '-'} ${issue.rule}: ${issue.detail.split(' ')[0]}`),
    ).toEqual(['- CONTRAST: "Low"']);
  }, 120_000);

  it('draws the product part asked for before alongside the sketch, in one pass instead of two', async (context) => {
    const target = checkout({
      'components/card': { body: '<p style="margin: 0; color: #f00">Low</p>', states: 'default: {}, other: {}' },
    });
    const shop = join(target, DESIGN_DIR, 'shop');
    const dir = join(shop, 'sketches', 'components-card');
    const source = readFileSync(join(shop, 'components/card/card.ts'), 'utf8');

    mkdirSync(join(dir, 'fixed', 'components/card'), { recursive: true });
    writeFileSync(join(dir, 'fixed', 'components/card/card.ts'), source.replace('color: #f00', 'color: #000'));
    writeFileSync(join(dir, 'sketch.json'), JSON.stringify({ target: 'components/card', status: 'ready' }));

    let open = 0;
    let mostOpen = 0;
    const countingChromiumOf: typeof chromiumOf = async (at) => {
      const resolved = await chromiumOf(at);

      if (!resolved) return null;

      const launch = resolved.chromium.launch.bind(resolved.chromium);
      const chromium = Object.create(resolved.chromium) as Chromium;

      chromium.launch = async (...args) => {
        const browser = await launch(...args);
        const newContext = browser.newContext.bind(browser);

        browser.newContext = async (...contextArgs) => {
          const created = await newContext(...contextArgs);
          const close = created.close.bind(created);

          mostOpen = Math.max(mostOpen, ++open);
          created.close = async (...closeArgs) => {
            open--;

            return close(...closeArgs);
          };

          return created;
        };

        return browser;
      };

      return { ...resolved, chromium };
    };

    const rendered = await renderIssuesOf({
      target,
      config: readConfig(target) ?? {},
      jobs: [{ product: 'shop', sketch: { target: 'components/card', variant: 'fixed' }, parts: null }],
      before: [{ product: 'shop', part: 'components/card' }],
      chromiumOf: countingChromiumOf,
    });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(rendered.before?.map((issue) => `${issue.state} ${issue.rule}`)).toEqual([
      'default CONTRAST',
      'other CONTRAST',
    ]);
    expect(mostOpen).toBe(2);
  }, 120_000);

  it('answers no verdict instead of a before problem when the product part does not draw in time', async (context) => {
    const target = checkout({
      'components/card': { body: '<p style="margin: 0; color: #f00">Low</p>' },
    });
    const shop = join(target, DESIGN_DIR, 'shop');
    const dir = join(shop, 'sketches', 'components-card');
    const source = readFileSync(join(shop, 'components/card/card.ts'), 'utf8');

    mkdirSync(join(dir, 'fixed', 'components/card'), { recursive: true });
    writeFileSync(join(dir, 'fixed', 'components/card/card.ts'), source.replace('color: #f00', 'color: #000'));
    writeFileSync(join(dir, 'sketch.json'), JSON.stringify({ target: 'components/card', status: 'ready' }));

    const rendered = await renderIssuesOf({
      target,
      config: readConfig(target) ?? {},
      jobs: [{ product: 'shop', sketch: { target: 'components/card', variant: 'fixed' }, parts: null }],
      before: [{ product: 'shop', part: 'components/card' }],
      partTimeoutMs: 1,
    });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(rendered.noVerdict?.noVerdict).toContain('the base of components/card did not draw within 0s');
    expect(rendered.before).toEqual([]);
  }, 120_000);

  it('does not block merged interaction states when sketch CSS restyles them', async (context) => {
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

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues.filter((issue) => issue.rule === 'CONTROL-STATE').map((issue) => issue.sketch?.variant),
    ).toEqual([]);
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
    ).resolves.toEqual({
      unavailable: expect.stringMatching(
        new RegExp(`^neither ${target} nor this package \\(.+\\) resolves playwright or playwright-core`),
      ),
    });
  });

  it('keeps the skips of each sketch variant apart', async (context) => {
    const target = checkout();
    const dir = join(target, DESIGN_DIR, 'shop', 'sketches', 'components-cut');
    const merged = join(target, DESIGN_DIR, 'shop', 'components', 'cut', 'cut.ts');
    const cut = readFileSync(merged, 'utf8');

    writeFileSync(
      merged,
      cut.replace('states: { default: {} },', "states: { default: {} }, checks: { skip: ['CLIPPED'] },"),
    );

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

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

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

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

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

  it('flags an interactive element that declares no action while drawing', async (context) => {
    const target = checkout({});
    const dir = join(target, DESIGN_DIR, 'shop/components/hold');

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'hold.ts'),
      `import { definePart, drawing, html } from '@design-system';

export default definePart({
  note: 'A fixture.',
  states: { default: {} },
  controls: { hold: { kind: 'button', input: ['pointer'] }, canvas: { kind: 'field', part: 'components/canvas' } },
  render: () =>
    drawing({
      body: html\`<div class="hold-row">
        <span data-et-control="hold"><button type="button" aria-expanded="false" data-sk-hold>Paused</button></span>
        <button type="button" data-et-action="emit:save">Save</button>
        <span role="button" tabindex="0" data-et-skip="ACTION-UNDECLARED">Skipped</span>
        <button type="button" disabled>Off</button>
        <div data-et-control="canvas"><button type="button">Zoom</button></div>
        <div class="hold-pick">Pick</div>
        <p data-sk-hold-reason hidden>Why</p>
      </div>\`,
      setup: (root) => {
        root.querySelector('.hold-row').addEventListener('click', () => undefined);
        root.querySelector('.hold-pick').addEventListener('click', () => undefined);
      },
    }),
});
`,
    );

    const rendered = await renderIssuesOf({
      target,
      config: readConfig(target) ?? {},
      jobs: [{ product: 'shop', sketch: null, parts: null }],
    });

    if ('unavailable' in rendered) return skipWithoutBrowser(context, rendered.unavailable);

    expect(
      rendered.issues
        .filter((issue) => issue.rule === 'ACTION-UNDECLARED')
        .map((issue) => `${issue.part}: ${issue.detail.split(' is interactive')[0]}`),
    ).toEqual(['components/hold: button "Paused"', 'components/hold: div.hold-pick "Pick"']);
  }, 120_000);

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

describe('uniqueIssuesOf', () => {
  const issue = {
    rule: 'LOST-SURFACE',
    product: 'app',
    part: 'card',
    state: 'default',
    size: 'md',
    path: 'div > span',
    detail: 'surface lost',
    sketch: null,
  };

  it('keeps one issue found in both colour schemes', () => {
    expect(uniqueIssuesOf([issue, { ...issue }])).toEqual([issue]);
  });

  it('keeps one SKIP-SCOPE for a skip site found in two states', () => {
    const skip = { ...issue, rule: 'SKIP-SCOPE' };

    expect(uniqueIssuesOf([skip, { ...skip, state: 'hover', size: 'lg' }])).toEqual([skip]);
  });

  it('keeps issues whose detail differs', () => {
    expect(uniqueIssuesOf([issue, { ...issue, detail: 'other colour' }])).toHaveLength(2);
  });
});
