import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmdirSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { check, resolveConfig } from 'prettier';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkSystem } from './system/check-system';
import { resolveProduct } from './system/resolve-product';
import { configPathOf, DESIGN_DIR, readConfig } from './design-config';
import { designProduct, newProductAnswer, productBaseAnswer } from './product-command';
import { designLint } from './lint-command';

const make = () => mkdtempSync(join(tmpdir(), 'cli-design-product-'));

const run = (target: string, ...argv: string[]) => designProduct({ target, argv, invocation: 'et design' });

describe('designProduct', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates config.json, the layer folders and fixtures.ts, and passes the check', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    expect(run(target, 'new', 'shop')).toBe(0);

    expect(readConfig(target)).toEqual({
      products: { shop: { presets: { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } } } },
    });
    expect(readdirSync(join(target, DESIGN_DIR, 'shop')).sort()).toEqual([
      'components',
      'elements',
      'fixtures.ts',
      'foundations',
      'pages',
    ]);
    expect(checkSystem({ target, config: readConfig(target) ?? {}, products: ['shop'] })).toBe(0);
  }, 60_000);

  it('still passes the check once git drops the empty layer folders', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    run(target, 'new', 'shop');
    for (const layer of ['components', 'elements', 'pages']) rmdirSync(join(target, DESIGN_DIR, 'shop', layer));

    expect(checkSystem({ target, config: readConfig(target) ?? {}, products: ['shop'] })).toBe(0);
  }, 60_000);

  it('writes no presets with a base', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    run(target, 'new', 'shop', '--base', '@ethlete/components');

    expect(readConfig(target)?.products?.['shop']).toEqual({ base: '@ethlete/components' });
  });

  it("writes no fixtures.ts with a base, so the base's fixture set shows through", () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    run(target, 'new', 'kit');
    writeFileSync(join(target, DESIGN_DIR, 'kit/fixtures.ts'), 'export const films = [];\n');
    run(target, 'new', 'shop', '--base', `${DESIGN_DIR}/kit`);

    const config = readConfig(target)?.products?.['shop'] ?? {};

    expect(resolveProduct({ target, name: 'shop', config }).fixtures).toBe(join(target, DESIGN_DIR, 'kit/fixtures.ts'));
  });

  it('copies styles, head, providers and themes from a project and leaves the project alone', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();
    const project = { styles: ['a.css'], head: 'h.html', providers: 'p.ts', themes: { color: ['x'] }, other: 1 };

    mkdirSync(join(target, DESIGN_DIR), { recursive: true });
    writeFileSync(configPathOf(target), JSON.stringify({ projects: { app: project } }));

    expect(run(target, 'new', 'shop', '--from-project', 'app')).toBe(0);

    const config = readConfig(target);
    expect(config?.products?.['shop']).toMatchObject({ styles: ['a.css'], head: 'h.html', providers: 'p.ts' });
    expect(config?.products?.['shop']).not.toHaveProperty('other');
    expect(config?.projects?.['app']).toEqual(project);
  });

  it('writes config.json in the layout prettier leaves as it is', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();
    const long = Array.from({ length: 8 }, (_, index) => `src/styles/a-rather-long-stylesheet-name-${index}.css`);
    const project = { styles: ['a.css', 'b.css'], themes: { color: ['brand', 'danger'], surface: [] }, empty: {} };

    mkdirSync(join(target, DESIGN_DIR), { recursive: true });
    writeFileSync(
      configPathOf(target),
      JSON.stringify({ projects: { app: project, wide: { styles: long, nested: [[1, 2], [3]], list: [{ a: 1 }] } } }),
    );

    expect(run(target, 'new', 'shop', '--from-project', 'app')).toBe(0);

    const path = configPathOf(target);
    const options = await resolveConfig(join(process.cwd(), 'config.json'));

    expect(await check(readFileSync(path, 'utf8'), { ...options, filepath: path })).toBe(true);
  });

  it('exits 1 and changes nothing when the entry or the folder exists', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = make();

    run(target, 'new', 'shop');
    const before = readFileSync(configPathOf(target), 'utf8');

    expect(run(target, 'new', 'shop')).toBe(1);
    expect(error.mock.calls.flat().join('')).toContain('PRODUCT EXISTS');

    mkdirSync(join(target, DESIGN_DIR, 'other'));

    expect(run(target, 'new', 'other')).toBe(1);
    expect(readFileSync(configPathOf(target), 'utf8')).toBe(before);
    expect(existsSync(join(target, DESIGN_DIR, 'other/fixtures.ts'))).toBe(false);
  });

  it('starts a dark colors foundation with the accent as primary colour, and passes the check', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    expect(run(target, 'new', 'tomflix', '--colors', 'dark', '--accent', '#e50914')).toBe(0);

    const dir = join(target, DESIGN_DIR, 'tomflix', 'foundations', 'colors');
    const css = readFileSync(join(dir, 'colors.css'), 'utf8');
    const ts = readFileSync(join(dir, 'colors.ts'), 'utf8');

    expect(css).toContain(':root,\n  .et-surface--dark {\n    --et-surface-background: 0 0 0;');
    expect(css).not.toContain('et-surface--light');
    expect(css).not.toContain('prefers-color-scheme');
    expect(css).toContain('--et-color-primary: 229 9 20;');
    expect(css).toContain('--et-color-on-primary: 255 255 255;');
    expect(ts).toContain("'surface-dark': { group: 'surface', surface: 'dark' }");
    expect(ts).not.toContain('surface-light');
    expect(readConfig(target)?.products?.['tomflix']?.schemes).toEqual(['dark']);
    expect(checkSystem({ target, config: readConfig(target) ?? {}, products: ['tomflix'] })).toBe(0);
  }, 60_000);

  it('derives each surface and accent state of the tomflix colors foundation of client run 1109, in the layout of the SDK colours page', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    expect(run(target, 'new', 'tomflix', '--colors', 'dark', '--accent', '#e50914')).toBe(0);

    const dir = join(target, DESIGN_DIR, 'tomflix', 'foundations', 'colors');
    const css = readFileSync(join(dir, 'colors.css'), 'utf8');
    const ts = readFileSync(join(dir, 'colors.ts'), 'utf8');
    const valueOf = (token: string) => new RegExp(`--et-${token}: ([\\d ]+);`, 'u').exec(css)?.[1] ?? '';
    const distinct = (tokens: string[]) => new Set(tokens.map(valueOf)).size;
    const luminanceOf = (rgb: string) => {
      const [r = 0, g = 0, b = 0] = rgb.split(' ').map((channel) => {
        const c = Number(channel) / 255;

        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratioOf = (text: string, on: string) => {
      const [high = 0, low = 0] = [luminanceOf(valueOf(text)), luminanceOf(valueOf(on))].sort((x, y) => y - x);

      return (high + 0.05) / (low + 0.05);
    };

    expect(css).not.toContain('128 128 128');
    expect(valueOf('color-primary')).toBe('229 9 20');
    expect(distinct(['color-primary', 'color-primary-hover', 'color-primary-active', 'color-primary-disabled'])).toBe(
      4,
    );
    expect(valueOf('color-primary-focus')).toBe(valueOf('color-primary-hover'));
    expect(
      distinct([
        'surface-interaction',
        'surface-interaction-hover',
        'surface-interaction-active',
        'surface-interaction-disabled',
      ]),
    ).toBe(4);
    expect(valueOf('surface-interaction-focus')).toBe(valueOf('surface-interaction-hover'));
    expect(Number(valueOf('surface-interaction').split(' ')[0])).toBeLessThanOrEqual(160);
    expect(valueOf('color-on-primary-disabled')).not.toBe(valueOf('color-on-primary'));
    expect(
      distinct([
        'surface-color',
        'surface-color-muted',
        'surface-color-subtle',
        'surface-border',
        'surface-interaction-hover',
        'surface-interaction-disabled',
      ]),
    ).toBe(6);

    for (const text of ['surface-color', 'surface-color-muted', 'color-primary-ink'])
      expect(ratioOf(text, 'surface-background')).toBeGreaterThanOrEqual(4.5);

    for (const state of ['', '-hover', '-focus', '-active'])
      expect(ratioOf(`color-on-primary${state}`, `color-primary${state}`)).toBeGreaterThanOrEqual(4.5);

    expect(ts).toContain('measureContrastPairs');
    expect(ts).toMatch(/'surface-dark'[\s\S]*'accent-dark'[\s\S]*'contrast-dark'/u);
    expect(checkSystem({ target, config: readConfig(target) ?? {}, products: ['tomflix'] })).toBe(0);
  }, 60_000);

  it('starts the tomflix foundation of client run 1751 with an error and a warning theme, and passes the check', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    expect(run(target, 'new', 'tomflix', '--colors', 'dark', '--accent', '#2dd4cc')).toBe(0);

    const dir = join(target, DESIGN_DIR, 'tomflix', 'foundations', 'colors');
    const css = readFileSync(join(dir, 'colors.css'), 'utf8');

    expect(css).toMatch(/\.et-color--error \{\s*--et-color-theme-type: error;\s*--et-color-primary: 220 38 38;/u);
    expect(css).toMatch(/\.et-color--warning \{\s*--et-color-theme-type: warning;/u);
    expect(readFileSync(join(dir, 'colors.ts'), 'utf8')).toContain("const THEMES = ['error', 'warning'];");
    expect(checkSystem({ target, config: readConfig(target) ?? {}, products: ['tomflix'] })).toBe(0);
  }, 60_000);

  // The accent chosen at the start binds: it stays the primary, and another colour may only be an extra variant next to it.
  it('refuses the brass primary of client run 1029 on a product started with the accent #e50914', () => {
    const out: string[] = [];

    vi.spyOn(console, 'log').mockImplementation((line: string) => void out.push(line));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = make();

    expect(run(target, 'new', 'tomflix', '--colors', 'dark', '--accent', '#e50914')).toBe(0);
    expect(readConfig(target)?.products?.['tomflix']?.accent).toBe('#e50914');

    const css = join(target, DESIGN_DIR, 'tomflix', 'foundations', 'colors', 'colors.css');

    writeFileSync(css, readFileSync(join(__dirname, '__fixtures__/client-run-1029-colors/colors.css'), 'utf8'));

    expect(designLint({ target, argv: [css], invocation: 'et design' })).toBe(1);
    expect(out).toContainEqual(
      expect.stringMatching(
        /^ACCENT-PRIMARY .*colors\.css: --et-color-primary is 224 164 82, but tomflix was started with the accent #e50914 \(229 9 20\) - set --et-color-primary to 229 9 20; show another colour only as an extra variant/u,
      ),
    );
  }, 60_000);

  it('records, changes and drops the accent of an existing product with product set', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = make();

    expect(run(target, 'new', 'shop')).toBe(0);
    expect(run(target, 'set', 'shop', '--accent', 'red')).toBe(1);
    expect(run(target, 'set', 'shop', '--accent', '#fc0')).toBe(0);
    expect(readConfig(target)?.products?.['shop']?.accent).toBe('#fc0');
    expect(run(target, 'set', 'shop', '--accent', 'none')).toBe(0);
    expect(readConfig(target)?.products?.['shop']?.accent).toBeUndefined();
  });

  it('starts both surfaces without --colors, so no grey placeholder is left', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    expect(run(target, 'new', 'shop')).toBe(0);

    const css = readFileSync(join(target, DESIGN_DIR, 'shop', 'foundations', 'colors', 'colors.css'), 'utf8');

    expect(css).toContain('.et-surface--light');
    expect(css).toContain('.et-surface--dark');
    expect(readConfig(target)?.products?.['shop']?.schemes).toBeUndefined();
  });

  it('starts both surfaces with the accent, and refuses an unknown colour base or accent', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = make();

    expect(await post(target, { name: 'shop', colors: 'both', accent: '#fc0' })).toMatchObject({ status: 201 });

    const css = readFileSync(join(target, DESIGN_DIR, 'shop', 'foundations', 'colors', 'colors.css'), 'utf8');

    expect(css).toContain('.et-surface--light');
    expect(css).toContain('.et-surface--dark');
    expect(css).toContain('--et-color-primary: 255 204 0;');
    expect(css).toContain('--et-color-on-primary: 0 0 0;');
    expect(readConfig(target)?.products?.['shop']?.schemes).toBeUndefined();
    expect(run(target, 'new', 'web', '--colors', 'grey')).toBe(1);
    expect(await post(target, { name: 'app', accent: 'red' })).toMatchObject({ status: 400 });
    expect(readConfig(target)?.products?.['web']).toBeUndefined();
    expect(readConfig(target)?.products?.['app']).toBeUndefined();
  });

  it('sets the SDK as base of an existing product, removes it with none, and refuses an unknown product', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = make();

    run(target, 'new', 'tomflix', '--colors', 'dark');

    expect(run(target, 'set', 'tomflix', '--base', '@ethlete/components')).toBe(0);
    expect(readConfig(target)?.products?.['tomflix']).toMatchObject({ base: '@ethlete/components', schemes: ['dark'] });

    expect(run(target, 'set', 'tomflix', '--base', 'none')).toBe(0);
    expect(readConfig(target)?.products?.['tomflix']).not.toHaveProperty('base');

    const before = readFileSync(configPathOf(target), 'utf8');

    expect(run(target, 'set', 'shop', '--base', '@ethlete/components')).toBe(1);
    expect(run(target, 'set', 'tomflix')).toBe(1);
    expect(run(target, 'set', 'tomflix', '--base', '@ethlete/components', '--colors', 'dark')).toBe(1);
    expect(readFileSync(configPathOf(target), 'utf8')).toBe(before);
  });

  it('refuses an unknown flag and creates nothing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = make();

    expect(run(target, 'new', 'shop', '--bogus')).toBe(2);
    expect(error.mock.calls.flat().join('')).toContain(
      'unknown flag --bogus (flags: --base, --from-project, --colors, --accent)',
    );
    expect(existsSync(join(target, DESIGN_DIR, 'shop'))).toBe(false);
  });

  it('creates a product over POST with another product as its base', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    run(target, 'new', 'web');

    expect(await post(target, { name: 'shop', base: 'web' })).toEqual({ status: 201, body: { name: 'shop' } });
    expect(readConfig(target)?.products?.['shop']).toEqual({ base: '.ethlete/design/web' });
    expect(checkSystem({ target, config: readConfig(target) ?? {}, products: ['shop'] })).toBe(0);
  }, 60_000);

  it('creates a product over POST on the built-in base', async () => {
    const target = make();

    expect(await post(target, { name: 'shop', base: '@ethlete/components' })).toEqual({
      status: 201,
      body: { name: 'shop' },
    });
    expect(readConfig(target)?.products?.['shop']).toEqual({ base: '@ethlete/components' });
  });

  it('starts both surfaces over POST without colors', async () => {
    const target = make();

    expect(await post(target, { name: 'shop' })).toEqual({ status: 201, body: { name: 'shop' } });

    const css = readFileSync(join(target, DESIGN_DIR, 'shop', 'foundations', 'colors', 'colors.css'), 'utf8');

    expect(css).toContain('.et-surface--light');
    expect(css).toContain('.et-surface--dark');
    expect(readConfig(target)?.products?.['shop']?.schemes).toBeUndefined();
  });

  it('sets and removes the SDK base of an existing product over POST', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    run(target, 'new', 'tomflix', '--colors', 'dark');

    expect(await postBase(target, { name: 'tomflix', base: '@ethlete/components' })).toEqual({
      status: 200,
      body: { name: 'tomflix', base: '@ethlete/components' },
    });
    expect(readConfig(target)?.products?.['tomflix']).toMatchObject({ base: '@ethlete/components', schemes: ['dark'] });

    expect(await postBase(target, { name: 'tomflix', base: 'none' })).toMatchObject({ status: 200 });
    expect(readConfig(target)?.products?.['tomflix']).not.toHaveProperty('base');

    const before = readFileSync(configPathOf(target), 'utf8');

    expect(await postBase(target, { name: 'shop', base: 'none' })).toMatchObject({
      status: 400,
      body: { error: expect.stringContaining('NO PRODUCT') },
    });
    expect(await postBase(target, { name: 'tomflix' })).toMatchObject({ status: 400 });
    expect(readFileSync(configPathOf(target), 'utf8')).toBe(before);
  });

  it('refuses over POST a name that exists, an unknown base and a GET', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    run(target, 'new', 'web');
    const before = readFileSync(configPathOf(target), 'utf8');

    expect(await post(target, { name: 'web' })).toMatchObject({
      status: 409,
      body: { error: expect.stringContaining('PRODUCT EXISTS') },
    });
    expect(await post(target, { name: 'shop', base: 'nope' })).toMatchObject({ status: 400 });
    expect(await post(target, { name: 'Shop' })).toMatchObject({
      status: 400,
      body: { error: expect.stringContaining('BAD NAME') },
    });
    expect(
      await newProductAnswer({
        target,
        request: Object.assign(Readable.from([]), { method: 'GET' }) as unknown as IncomingMessage,
      }),
    ).toMatchObject({ status: 405 });
    expect(readFileSync(configPathOf(target), 'utf8')).toBe(before);
  });
});

const post = (target: string, body: unknown) =>
  newProductAnswer({
    target,
    request: Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
      method: 'POST',
    }) as unknown as IncomingMessage,
  });

const postBase = (target: string, body: unknown) =>
  productBaseAnswer({
    target,
    request: Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
      method: 'POST',
    }) as unknown as IncomingMessage,
  });
