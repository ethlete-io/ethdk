import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { checkSystem } from './check-system';
import { renderIssueLineOf, renderIssuesOf } from './render-check';

const PARTS: Record<string, { body: string; extra?: string }> = {
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
  'components/wrapped': { body: '<button style="width: 60px">Save the draft now</button>' },
  'components/empty': { body: '<div></div>' },
  'components/clean': { body: '<p style="margin: 0">Fine</p>' },
};

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-render-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(design, { recursive: true });
  writeFileSync(
    join(design, 'config.json'),
    JSON.stringify({ products: { shop: { presets: { desktop: { width: 400, height: 300 } } } } }),
  );

  for (const [key, { body, extra = '' }] of Object.entries(PARTS)) {
    const [layer = '', name = ''] = key.split('/');
    const dir = join(design, 'shop', layer, name);

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.ts`),
      `import { definePart, drawing, html } from '@design-system';

export default definePart({
  note: 'A fixture.',
  states: { default: {} },
  ${extra}
  render: () => drawing({ body: html\`${body}\`, styles: '' }),
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
      'OVERFLOW pages/tall desktop',
      'WRAP components/wrapped fitted',
      'ZERO-SIZE components/empty fitted',
    ]);
    expect(rendered.issues.map(renderIssueLineOf).filter((line) => line.startsWith('WRAP'))).toEqual([
      'WRAP shop components/wrapped default at fitted: button[data-et-part=components/wrapped] - "Save the draft now" breaks onto 4 lines',
    ]);
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
