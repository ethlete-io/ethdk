import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { resolveProduct } from './resolve-product';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

describe('resolveProduct', () => {
  it('lists own parts, base parts and overrides, in layer order', () => {
    const product = resolveAcme(acme());

    expect(product.parts.map((part) => [part.layer, part.name, part.origin])).toEqual([
      ['foundations', 'palette', 'product'],
      ['foundations', 'tokens', 'base'],
      ['components', 'button', 'overridden'],
      ['components', 'card', 'base'],
      ['elements', 'hero', 'product'],
      ['pages', 'home', 'product'],
    ]);
    expect(product.parts.find((part) => part.name === 'button')?.file).toContain('/acme/components/button/');
    expect(product.base?.name).toBe('acme-base');
    expect(product.fixtures).toMatch(/acme\/fixtures\.ts$/);
    expect(Object.keys(product.presets)).toEqual(['phone', 'desktop']);
    expect(product.problems).toEqual([]);
  });

  it('hides inherited parts but retains product overrides', () => {
    const target = acme();
    const config = readConfig(target)?.products?.['acme'] ?? {};
    const product = resolveProduct({
      target,
      name: 'acme',
      config: { ...config, hideBaseParts: ['foundations/tokens', 'components/button'] },
    });

    expect(product.parts.some((part) => part.name === 'tokens')).toBe(false);
    expect(product.parts.find((part) => part.name === 'button')?.origin).toBe('overridden');
  });

  it('takes the presets of the base when the product has none', () => {
    const target = acme();

    expect(resolveProduct({ target, name: 'acme', config: { base: '.ethlete/design/acme-base' } }).presets).toEqual({
      desktop: { width: 1280, height: 800 },
    });
  });

  it('takes the token parts of the base when the product has none', () => {
    const target = acme();

    write(
      target,
      'config.json',
      JSON.stringify({
        products: {
          'acme-base': { tokens: ['foundations/tokens', 'foundations/palette'] },
          acme: { base: '.ethlete/design/acme-base' },
        },
      }),
    );

    expect(resolveAcme(target).tokens).toEqual(['foundations/tokens', 'foundations/palette']);
    expect(
      resolveProduct({ target, name: 'acme', config: { base: '.ethlete/design/acme-base', tokens: [] } }).tokens,
    ).toEqual([]);
    expect(resolveProduct({ target, name: 'acme-base', config: {} }).tokens).toEqual(['foundations/tokens']);
  });

  it('reports a product without presets anywhere', () => {
    const product = resolveProduct({ target: acme(), name: 'acme-base', config: {} });

    expect(product.problems.map((problem) => problem.rule)).toEqual(['PRESETS']);
  });

  it('refuses a base that has a base of its own', () => {
    const target = acme();

    write(
      target,
      'config.json',
      JSON.stringify({
        products: { 'acme-base': { base: '@ethlete/components' }, acme: { base: '.ethlete/design/acme-base' } },
      }),
    );

    expect(resolveAcme(target).problems.map((problem) => problem.message)).toContainEqual(
      expect.stringContaining('a base has no base of its own'),
    );
  });

  it('reports a part folder without its part file', () => {
    const target = acme();

    write(target, 'acme/elements/footer/footer.css', '');

    expect(resolveAcme(target).problems).toEqual([
      expect.objectContaining({ rule: 'PART', message: 'holds no footer.ts' }),
    ]);
  });

  it('resolves the built-in @ethlete/components base from this package', () => {
    const product = resolveProduct({ target: acme(), name: 'acme', config: { base: '@ethlete/components' } });

    expect(product.parts.find((part) => part.name === 'button')?.origin).toBe('overridden');
    expect(Object.keys(product.presets)).toEqual(['phone', 'desktop']);
    expect(product.problems).toEqual([]);
  });
});
