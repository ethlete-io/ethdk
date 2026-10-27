import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkSystem } from './system/check-system';
import { configPathOf, DESIGN_DIR, readConfig } from './paths';
import { designProduct } from './product-command';

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

  it('writes no presets with a base', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = make();

    run(target, 'new', 'shop', '--base', '@ethlete/components');

    expect(readConfig(target)?.products?.['shop']).toEqual({ base: '@ethlete/components' });
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
});
