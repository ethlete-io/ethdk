import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../design-config';
import { assetRoot } from '../package-root';
import { designProduct } from '../product-command';
import { partKeyOf, resolveProduct } from './resolve-product';
import { createSystemModules } from './system-modules';

const SDK_BUTTON = resolve(__dirname, '../../../../../../.ethlete/design/sdk/components/button');
const INSTALLED = 'node_modules/@ethlete/components/design';

const writeJson = (file: string, value: unknown) => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(value), 'utf8');
};

const tomflix = (options: { installed: boolean }) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-built-in-base-'));

  const config = {
    styles: ['.ethlete/design/styles.css'],
    base: '@ethlete/components',
    schemes: ['dark'],
    accent: '#e50914',
  } as const;

  writeJson(join(target, DESIGN_DIR, 'config.json'), { products: { tomflix: config } });
  mkdirSync(join(target, DESIGN_DIR, 'tomflix'), { recursive: true });

  if (options.installed) {
    cpSync(SDK_BUTTON, join(target, INSTALLED, 'sdk/components/button'), { recursive: true });
    writeJson(join(target, INSTALLED, 'config.json'), {
      products: { sdk: { presets: { desktop: { width: 1440 } } } },
    });
  }

  return resolveProduct({
    target,
    name: 'tomflix',
    config: { ...config, schemes: [...config.schemes], styles: [...config.styles] },
  });
};

const buttonOf = (product: ReturnType<typeof resolveProduct>) =>
  product.parts.find((part) => partKeyOf(part) === 'components/button');

describe('the built-in @ethlete/components base', () => {
  it('inherits the SDK button its installed package ships', () => {
    const product = tomflix({ installed: true });
    const button = buttonOf(product);

    expect(product.problems).toEqual([]);
    expect(button?.origin).toBe('base');
    expect(button?.file.endsWith(join(INSTALLED, 'sdk/components/button/button.ts'))).toBe(true);
    expect(button?.source).toBe(readFileSync(join(SDK_BUTTON, 'button.ts'), 'utf8'));
    expect(button?.source).toMatch(/tonal: \{[\s\S]*outline: \{|outline: \{[\s\S]*tonal: \{/);
  });

  it("falls back to the CLI's stand-in without an installed package", () => {
    const button = buttonOf(tomflix({ installed: false }));

    expect(button?.file).toBe(join(assetRoot(), 'systems/ethlete-components/components/button/button.ts'));
  });

  it('draws the tomflix foundation of client run 1751 under its colours without an installed package', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = mkdtempSync(join(tmpdir(), 'cli-built-in-base-'));
    const argv = ['new', 'tomflix', '--base', '@ethlete/components', '--colors', 'dark', '--accent', '#2dd4cc'];

    expect(designProduct({ target, argv, invocation: 'et design' })).toBe(0);

    const system = createSystemModules({ target, config: readConfig(target) ?? {} });

    expect(system.tokenStylesheetsOf({ product: 'tomflix' })).toEqual([
      join(target, DESIGN_DIR, 'tomflix/foundations/colors/colors.css'),
    ]);
    vi.restoreAllMocks();
  }, 60_000);
});
