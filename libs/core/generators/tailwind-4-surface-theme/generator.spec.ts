import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import migrate from './generator';

describe('tailwind-4-surface-theme generator', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const CARD_AND_SHEET = `
    export const CARD = {
      name: 'card',
      type: 'light',
      elevation: 1,
      isDefault: true,
      background: '255 255 255',
      color: '0 0 0',
      colorMuted: '100 100 100',
      colorSubtle: '200 200 200',
      border: '220 220 220',
    } as const;

    export const SHEET = {
      name: 'sheet',
      type: 'dark',
      elevation: 2,
      isDefault: true,
      background: '10 10 10',
      color: '255 255 255',
      colorMuted: '180 180 180',
      colorSubtle: '80 80 80',
      border: '40 40 40',
    } as const;

    export const SURFACE_THEMES = [CARD, SHEET] satisfies SurfaceTheme[];
  `;

  it('should fail when surface themes file does not exist', async () => {
    await migrate(tree, { themesPath: 'src/surface-themes.ts' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Surface themes file not found'));
  });

  it('should generate CSS from a real surface theme setup', async () => {
    tree.write('src/surface-themes.ts', CARD_AND_SHEET);

    await migrate(tree, {
      themesPath: 'src/surface-themes.ts',
      outputPath: 'src/styles/tailwind-surface-themes.css',
      skipFormat: true,
    });

    expect(tree.exists('src/styles/tailwind-surface-themes.css')).toBe(true);

    const content = tree.read('src/styles/tailwind-surface-themes.css', 'utf-8');
    expect(content).toContain('@theme {');
    expect(content).toContain('--color-et-surface-card-bg: rgb(255 255 255);');
    expect(content).toContain('--color-et-surface-sheet: rgb(255 255 255);');
    expect(content).toContain('.et-surface--card {');
  });

  it('should parse individual surface theme objects using `satisfies X` instead of `as const`', async () => {
    const themesContent = `
      import { type SurfaceTheme as EthleteSurfaceTheme } from '@ethlete/core';

      export const CARD = {
        name: 'card',
        type: 'light',
        elevation: 1,
        isDefault: true,
        background: '255 255 255',
        color: '0 0 0',
        colorMuted: '100 100 100',
        colorSubtle: '200 200 200',
        border: '220 220 220',
      } satisfies EthleteSurfaceTheme;

      export const SHEET = {
        name: 'sheet',
        type: 'dark',
        elevation: 2,
        isDefault: true,
        background: '10 10 10',
        color: '255 255 255',
        colorMuted: '180 180 180',
        colorSubtle: '80 80 80',
        border: '40 40 40',
      } satisfies EthleteSurfaceTheme;

      export const SURFACE_THEMES = [CARD, SHEET] satisfies EthleteSurfaceTheme[];
    `;

    tree.write('src/surface-themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/surface-themes.ts',
      outputPath: 'src/styles/tailwind-surface-themes.css',
      skipFormat: true,
    });

    expect(consoleWarnSpy).not.toHaveBeenCalledWith(expect.stringContaining('is not an object literal'));

    const content = tree.read('src/styles/tailwind-surface-themes.css', 'utf-8');
    expect(content).toContain('--color-et-surface-card-bg: rgb(255 255 255);');
  });

  it('should generate an EthleteSurfaceThemeNameRegistry augmentation next to the CSS by default', async () => {
    tree.write('src/surface-themes.ts', CARD_AND_SHEET);

    await migrate(tree, {
      themesPath: 'src/surface-themes.ts',
      outputPath: 'src/styles/tailwind-surface-themes.css',
      skipFormat: true,
    });

    expect(tree.exists('src/styles/tailwind-surface-themes.d.ts')).toBe(true);

    const content = tree.read('src/styles/tailwind-surface-themes.d.ts', 'utf-8');
    expect(content).toContain(`declare module '@ethlete/core'`);
    expect(content).toContain('interface EthleteSurfaceThemeNameRegistry');
    expect(content).toContain(`name: 'card' | 'sheet';`);
    expect(content).toContain('export {};');
  });

  it('should honor a custom typesOutputPath', async () => {
    tree.write('src/surface-themes.ts', CARD_AND_SHEET);

    await migrate(tree, {
      themesPath: 'src/surface-themes.ts',
      outputPath: 'src/styles/tw-surfaces.css',
      typesOutputPath: 'src/types/surface-names.d.ts',
      skipFormat: true,
    });

    expect(tree.exists('src/types/surface-names.d.ts')).toBe(true);
    expect(tree.exists('src/styles/tw-surfaces.d.ts')).toBe(false);

    const content = tree.read('src/types/surface-names.d.ts', 'utf-8');
    expect(content).toContain(`name: 'card' | 'sheet';`);
  });

  it('should use a custom prefix', async () => {
    tree.write('src/surface-themes.ts', CARD_AND_SHEET);

    await migrate(tree, {
      themesPath: 'src/surface-themes.ts',
      outputPath: 'src/styles/tw.css',
      prefix: 'fut',
      skipFormat: true,
    });

    const content = tree.read('src/styles/tw.css', 'utf-8');
    expect(content).toContain('--color-fut-surface-card-bg: rgb(255 255 255);');
    expect(content).toContain('.fut-surface--card {');
  });

  it('should decouple the Tailwind utility prefix from the runtime theme-swap prefix', async () => {
    tree.write('src/surface-themes.ts', CARD_AND_SHEET);

    await migrate(tree, {
      themesPath: 'src/surface-themes.ts',
      outputPath: 'src/styles/tw.css',
      prefix: 'fut',
      runtimePrefix: 'et',
      skipFormat: true,
    });

    const content = tree.read('src/styles/tw.css', 'utf-8');

    // Static per-theme utility classes and the dynamic "current surface" utility use the
    // Tailwind utility prefix.
    expect(content).toContain('--color-fut-surface-card-bg: rgb(255 255 255);');
    expect(content).toContain('--color-fut-surface-bg: rgb(var(--et-surface-background));');
    expect(content).toContain('--color-fut-surface-interaction: rgb(var(--et-surface-interaction));');

    // The runtime theme-swap selectors and variables use the runtime prefix, not the
    // Tailwind utility prefix.
    expect(content).toContain('.et-surface--default-light, .et-surface--card {');
    expect(content).toContain('--et-surface-background: 255 255 255;');
    expect(content).not.toContain('fut-surface--');
    expect(content).not.toContain('--fut-surface-background');

    // The convenience alias block also follows the runtime prefix.
    expect(content).toContain('[class*="et-surface--"]');
    expect(content).toContain('--et-surface-background-rgb: var(--et-surface-background);');
  });

  it('should default runtimePrefix to prefix when not specified', async () => {
    tree.write('src/surface-themes.ts', CARD_AND_SHEET);

    await migrate(tree, {
      themesPath: 'src/surface-themes.ts',
      outputPath: 'src/styles/tw.css',
      prefix: 'custom',
      skipFormat: true,
    });

    const content = tree.read('src/styles/tw.css', 'utf-8');
    expect(content).toContain('.custom-surface--default-light, .custom-surface--card {');
    expect(content).toContain('--custom-surface-background: 255 255 255;');
  });
});
