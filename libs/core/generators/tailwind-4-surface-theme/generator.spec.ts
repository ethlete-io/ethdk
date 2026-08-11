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

  describe('interactionColor swatch', () => {
    const withInteractionColor = (interactionColor: string) => `
      export const CARD = {
        name: 'card',
        type: 'light',
        elevation: 1,
        isDefault: true,
        interactionColor: ${interactionColor},
        background: '255 255 255',
        color: '0 0 0',
        colorMuted: '100 100 100',
        colorSubtle: '200 200 200',
        border: '220 220 220',
      } as const;

      export const SURFACE_THEMES = [CARD] satisfies SurfaceTheme[];
    `;

    const COLOR_MAP = `{ default: '115 115 115', hover: '64 64 64', focus: '60 60 60', active: '23 23 23', disabled: '180 180 180' }`;

    it('emits the tint ladder from the swatch color map', async () => {
      tree.write('src/surface-themes.ts', withInteractionColor(`{ color: ${COLOR_MAP} }`));

      await migrate(tree, { themesPath: 'src/surface-themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      expect(content).toContain('--et-surface-interaction: 115 115 115;');
      expect(content).toContain('--et-surface-interaction-active: 23 23 23;');
      expect(content).toContain('--color-et-surface-card-interaction-hover: rgb(64 64 64);');
      expect(content).not.toContain('--et-surface-on-interaction:');
    });

    it('emits on-interaction and ink variables, filling the states left out', async () => {
      tree.write(
        'src/surface-themes.ts',
        withInteractionColor(
          `{ color: ${COLOR_MAP}, onColor: { default: '255 255 255', hover: '250 250 250' }, inkColor: { default: '23 23 23' } }`,
        ),
      );

      await migrate(tree, { themesPath: 'src/surface-themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      expect(content).toContain('--et-surface-on-interaction: 255 255 255;');
      expect(content).toContain('--et-surface-on-interaction-hover: 250 250 250;');
      // focus falls back to hover, active and disabled to default
      expect(content).toContain('--et-surface-on-interaction-focus: 250 250 250;');
      expect(content).toContain('--et-surface-on-interaction-active: 255 255 255;');
      expect(content).toContain('--et-surface-interaction-ink-disabled: 23 23 23;');
    });

    it('emits the reserved surface color scope, following the runtime prefix', async () => {
      tree.write('src/surface-themes.ts', withInteractionColor(`{ color: ${COLOR_MAP} }`));

      await migrate(tree, {
        themesPath: 'src/surface-themes.ts',
        outputPath: 'src/styles/tw.css',
        prefix: 'fut',
        runtimePrefix: 'et',
        skipFormat: true,
      });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      expect(content).toContain('.et-color--surface {');
      expect(content).toContain('--et-color-primary: var(--et-surface-interaction, var(--et-surface-color));');
      expect(content).toContain(
        '--et-color-on-primary: var(--et-surface-on-interaction, var(--et-surface-background));',
      );
      expect(content).toContain('--et-color-primary-ink: var(--et-surface-interaction-ink, var(--et-surface-color));');
      expect(content).not.toContain('.fut-color--surface');
    });

    it('points at the migration when a theme still uses the flat map', async () => {
      tree.write('src/surface-themes.ts', withInteractionColor(COLOR_MAP));

      await migrate(tree, { themesPath: 'src/surface-themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('migrate-surface-interaction-swatch'));
      expect(tree.exists('src/styles/tw.css')).toBe(false);
    });
  });

  describe('defaultLightTheme / defaultDarkTheme options', () => {
    const TWO_PER_TYPE = `
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

    export const PAPER = {
      name: 'paper',
      type: 'light',
      elevation: 2,
      background: '250 250 250',
      color: '0 0 0',
      colorMuted: '100 100 100',
      colorSubtle: '200 200 200',
      border: '220 220 220',
    } as const;

    export const SHEET = {
      name: 'sheet',
      type: 'dark',
      elevation: 1,
      isDefault: true,
      background: '10 10 10',
      color: '255 255 255',
      colorMuted: '180 180 180',
      colorSubtle: '80 80 80',
      border: '40 40 40',
    } as const;

    export const PANEL = {
      name: 'panel',
      type: 'dark',
      elevation: 2,
      background: '20 20 20',
      color: '255 255 255',
      colorMuted: '180 180 180',
      colorSubtle: '80 80 80',
      border: '40 40 40',
    } as const;

    export const SURFACE_THEMES = [CARD, PAPER, SHEET, PANEL] satisfies SurfaceTheme[];
  `;

    it('should override the isDefault flag of the matching type only', async () => {
      tree.write('src/surface-themes.ts', TWO_PER_TYPE);

      await migrate(tree, {
        themesPath: 'src/surface-themes.ts',
        outputPath: 'src/styles/tw.css',
        defaultDarkTheme: 'panel',
        skipFormat: true,
      });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      // dark default moved to panel, light default untouched
      expect(content).toContain('.et-surface--default-dark, .et-surface--panel {');
      expect(content).toContain('.et-surface--default-light, .et-surface--card {');
      expect(content).not.toContain('.et-surface--default-dark, .et-surface--sheet {');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should allow overriding both types and record the flags in the regenerate command', async () => {
      tree.write('src/surface-themes.ts', TWO_PER_TYPE);

      await migrate(tree, {
        themesPath: 'src/surface-themes.ts',
        outputPath: 'src/styles/tw.css',
        defaultLightTheme: 'paper',
        defaultDarkTheme: 'panel',
        skipFormat: true,
      });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      expect(content).toContain('.et-surface--default-light, .et-surface--paper {');
      expect(content).toContain('.et-surface--default-dark, .et-surface--panel {');
      expect(content).toContain('--defaultLightTheme=paper --defaultDarkTheme=panel');
      expect(tree.read('src/styles/tw.d.ts', 'utf-8')).toContain('--defaultLightTheme=paper --defaultDarkTheme=panel');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should error when the named theme has the wrong type', async () => {
      tree.write('src/surface-themes.ts', TWO_PER_TYPE);

      await migrate(tree, {
        themesPath: 'src/surface-themes.ts',
        outputPath: 'src/styles/tw.css',
        defaultLightTheme: 'panel',
        skipFormat: true,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`has type 'dark'`));
      expect(tree.exists('src/styles/tw.css')).toBe(false);
    });

    it('should error when the named theme does not exist', async () => {
      tree.write('src/surface-themes.ts', TWO_PER_TYPE);

      await migrate(tree, {
        themesPath: 'src/surface-themes.ts',
        outputPath: 'src/styles/tw.css',
        defaultDarkTheme: 'nope',
        skipFormat: true,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No surface theme named "nope"'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('sheet, panel'));
      expect(tree.exists('src/styles/tw.css')).toBe(false);
    });
  });
});
