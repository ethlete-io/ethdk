import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmdirSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkSystem } from './system/check-system';
import { resolveProduct } from './system/resolve-product';
import { configPathOf, DESIGN_DIR, readConfig } from './paths';
import { designProduct, newProductAnswer } from './product-command';

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
    for (const layer of ['foundations', 'components', 'elements', 'pages'])
      rmdirSync(join(target, DESIGN_DIR, 'shop', layer));

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
