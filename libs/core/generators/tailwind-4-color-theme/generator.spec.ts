import { Tree } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import migrate from './generator';

describe('tailwind-4-color-theme generator', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleErrorSpy: MockInstance;
  let consoleInfoSpy: MockInstance;

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
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  it('should fail when themes file does not exist', async () => {
    await migrate(tree, { themesPath: 'src/themes.ts' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Themes file not found'));
  });

  it('should fail when themes export is not found', async () => {
    tree.write('src/themes.ts', 'export const somethingElse = [];');

    await migrate(tree, { themesPath: 'src/themes.ts', skipFormat: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse themes file'));
  });

  it('should generate CSS file from real theme setup', async () => {
    const themesContent = `
    import { type Theme as EthleteTheme } from '@ethlete/cdk';

    export const PITCH_GREEN = {
      name: 'pitch-green',
      isDefault: true,
      primary: {
        color: {
          default: '7 244 104',
          hover: '58 245 133',
        },
        onColor: {
          default: '21 22 22',
        },
      },
    } as const;

    export const ALT_TEST = {
      name: 'alt-test',
      isDefaultAlt: true,
      primary: {
        color: {
          default: '7 244 104',
          hover: '58 245 133',
        },
        onColor: {
          default: '21 22 22',
        },
      },
    } as const;

    export const RED = {
      name: 'red',
      primary: {
        color: {
          default: '239 68 68',
        },
        onColor: {
          default: '252 252 247',
        },
      },
    } as const;

    export const THEMES = [PITCH_GREEN, RED, ALT_TEST] satisfies EthleteTheme[];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tailwind-themes.css',
      skipFormat: true,
    });

    expect(tree.exists('src/styles/tailwind-themes.css')).toBe(true);

    const content = tree.read('src/styles/tailwind-themes.css', 'utf-8');

    expect(content).toContain('@theme {');
    expect(content).toContain('--color-et-tone-pitch-green-fill: rgb(7 244 104);');
    expect(content).toContain('--color-et-tone-red-fill: rgb(239 68 68);');
    expect(content).toContain('--color-et-tone-pitch-green-on-fill: rgb(21 22 22);');

    // isDefaultAlt is not yet supported; alt-test is treated as a regular non-default theme
    expect(content).toContain('.et-color--alt-test {');
    expect(content).toContain('--et-tone-fill-rest: rgb(7 244 104);');
    expect(content).toContain('--et-tone-fill-hover: rgb(58 245 133);');
    expect(content).toContain('--et-tone-on-fill-rest: rgb(21 22 22);');
  });

  it('should parse individual theme objects using `satisfies X` instead of `as const`', async () => {
    const themesContent = `
    import { type ColorTheme as EthleteTheme } from '@ethlete/core';

    export const PITCH_GREEN = {
      name: 'pitch-green',
      isDefault: true,
      type: 'success',
      primary: {
        color: {
          default: '7 244 104',
          hover: '58 245 133',
        },
        onColor: {
          default: '21 22 22',
        },
      },
    } satisfies EthleteTheme;

    export const RED = {
      name: 'red',
      type: 'error',
      primary: {
        color: {
          default: '239 68 68',
        },
        onColor: {
          default: '252 252 247',
        },
      },
    } satisfies EthleteTheme;

    export const THEMES = [PITCH_GREEN, RED] satisfies EthleteTheme[];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tailwind-themes.css',
      skipFormat: true,
    });

    expect(consoleWarnSpy).not.toHaveBeenCalledWith(expect.stringContaining('is not an object literal'));

    const content = tree.read('src/styles/tailwind-themes.css', 'utf-8');
    expect(content).toContain('--color-et-tone-pitch-green-fill: rgb(7 244 104);');
    expect(content).toContain('--color-et-tone-red-fill: rgb(239 68 68);');
    expect(content).toContain('.et-color--pitch-green');
  });

  it('writes the type of a typed theme into its scope rule', async () => {
    tree.write(
      'src/themes.ts',
      `
      export const BRAND = { name: 'brand', isDefault: true, primary: { color: { default: '0 0 255' }, onColor: { default: '255 255 255' } } };
      export const AMBER = { name: 'amber', type: 'warning', primary: { color: { default: '255 200 0' }, onColor: { default: '0 0 0' } } };
      export const THEMES = [BRAND, AMBER];
    `,
    );

    await migrate(tree, { themesPath: 'src/themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

    const content = tree.read('src/styles/tw.css', 'utf-8') ?? '';

    expect(content).toMatch(/\.et-color--amber \{\s*--et-color-theme-type: warning;/u);
    expect(content.match(/--et-color-theme-type:/gu)).toHaveLength(1);
  });

  it('should generate an EthleteColorThemeNames augmentation next to the CSS by default', async () => {
    const themesContent = `
    export const PITCH_GREEN = {
      name: 'pitch-green',
      isDefault: true,
      primary: { color: { default: '7 244 104' }, onColor: { default: '21 22 22' } },
    } as const;
    export const RED = {
      name: 'red',
      primary: { color: { default: '239 68 68' }, onColor: { default: '252 252 247' } },
    } as const;
    export const THEMES = [PITCH_GREEN, RED];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tailwind-themes.css',
      skipFormat: true,
    });

    expect(tree.exists('src/styles/tailwind-themes.d.ts')).toBe(true);

    const content = tree.read('src/styles/tailwind-themes.d.ts', 'utf-8');
    expect(content).toContain(`declare module '@ethlete/core'`);
    expect(content).toContain('interface EthleteColorThemeNames');
    expect(content).toContain(`'pitch-green': true;`);
    expect(content).toContain(`'red': true;`);
    // Must be a module (not a global script) for the module augmentation to merge correctly.
    expect(content).toContain('export {};');
  });

  it('should honor a custom typesOutputPath', async () => {
    const themesContent = `
    export const BRAND = {
      name: 'brand',
      isDefault: true,
      primary: { color: { default: '0 0 0' }, onColor: { default: '255 255 255' } },
    } as const;
    export const THEMES = [BRAND];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tw.css',
      typesOutputPath: 'src/types/theme-names.d.ts',
      skipFormat: true,
    });

    expect(tree.exists('src/types/theme-names.d.ts')).toBe(true);
    expect(tree.exists('src/styles/tw.d.ts')).toBe(false);

    const content = tree.read('src/types/theme-names.d.ts', 'utf-8');
    expect(content).toContain(`'brand': true;`);
  });

  it('should use custom prefix', async () => {
    const themesContent = `
    export const BRAND = { 
      name: 'brand',
      isDefault: true,
      primary: {
        color: { default: '0 0 0' },
        onColor: { default: '255 255 255' }
      }
    } as const;
    export const themes = [BRAND];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tw.css',
      prefix: 'custom',
      skipFormat: true,
    });

    const content = tree.read('src/styles/tw.css', 'utf-8');
    expect(content).toContain('--color-custom-tone-brand-fill: rgb(0 0 0);');
    expect(content).toContain('--color-custom-tone-brand-on-fill: rgb(255 255 255);');
  });

  it('should decouple the Tailwind utility prefix from the runtime theme-swap prefix', async () => {
    const themesContent = `
    export const BRAND = {
      name: 'brand',
      isDefault: true,
      primary: {
        color: { default: '0 0 0', hover: '10 10 10' },
        onColor: { default: '255 255 255' }
      }
    } as const;
    export const themes = [BRAND];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tw.css',
      prefix: 'fut',
      runtimePrefix: 'et',
      skipFormat: true,
    });

    const content = tree.read('src/styles/tw.css', 'utf-8');

    // Static per-theme utility classes use the Tailwind utility prefix.
    expect(content).toContain('--color-fut-tone-brand-fill: rgb(0 0 0);');
    expect(content).toContain('--color-fut-tone-brand-on-fill: rgb(255 255 255);');

    // The dynamic "current theme" utility still uses the Tailwind utility prefix for its
    // own name, but reads the runtime prefix's CSS variable.
    expect(content).toContain('--color-fut-tone-fill: var(--et-tone-fill-rest);');
    expect(content).toContain('--color-fut-tone-on-fill: var(--et-tone-on-fill-rest);');

    // The runtime theme-swap selectors and variables use the runtime prefix, not the
    // Tailwind utility prefix.
    expect(content).toContain('.et-color--default, .et-color--brand {');
    expect(content).toContain('--et-tone-fill-rest: rgb(0 0 0);');
    expect(content).not.toContain('fut-color--');
    expect(content).not.toContain('--fut-tone-fill');

    // The convenience alias block also follows the runtime prefix.
    expect(content).toContain('[class*="et-color--"]');
    expect(content).toContain('--et-tone-fill: var(--et-tone-fill-rest);');
  });

  it('should default runtimePrefix to prefix when not specified', async () => {
    const themesContent = `
    export const BRAND = {
      name: 'brand',
      isDefault: true,
      primary: {
        color: { default: '0 0 0' },
        onColor: { default: '255 255 255' }
      }
    } as const;
    export const themes = [BRAND];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tw.css',
      prefix: 'custom',
      skipFormat: true,
    });

    const content = tree.read('src/styles/tw.css', 'utf-8');
    expect(content).toContain('.custom-color--default, .custom-color--brand {');
    expect(content).toContain('--custom-tone-fill-rest: rgb(0 0 0);');
  });

  it('should handle kebab-case theme names', async () => {
    const themesContent = `
    export const PITCH_GREEN = { 
      name: 'pitch-green',
      isDefault: true,
      primary: {
        color: { default: '7 244 104' },
        onColor: { default: '21 22 22' }
      }
    } as const;
    export const themes = [PITCH_GREEN];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/output.css',
      skipFormat: true,
    });

    const content = tree.read('src/output.css', 'utf-8');
    expect(content).toContain('--color-et-tone-pitch-green-fill: rgb(7 244 104);');
  });

  it('should handle complex spread operations', async () => {
    const themesContent = `
    import { type Theme as EthleteTheme, OnThemeColorMap, ThemeColorMap } from '@ethlete/cdk';

    const onColorDark: OnThemeColorMap = {
      default: '10 13 16',
    };

    const onColorLight: OnThemeColorMap = {
      default: '255 255 255',
    };

    const primaryColorBase: ThemeColorMap = {
      default: '10 127 255',
      hover: '47 146 255',
      active: '9 114 230',
      disabled: '30 77 128',
    };

    export const BLUE = {
      name: 'blue',
      isDefault: true,
      primary: {
        color: { ...primaryColorBase },
        onColor: { ...onColorDark, disabled: '30 77 128' },
      },
    } as const;

    export const BLUE_INVERSE = {
      name: 'blue-inverse',
      primary: {
        color: {
          default: '10 127 255',
          hover: '40 49 64',
          active: '25 34 45',
          disabled: '40 49 64',
        },
        onColor: {
          ...onColorLight,
          disabled: '30 77 128',
        },
      },
    } as const;

    export const THEMES = [BLUE, BLUE_INVERSE] satisfies EthleteTheme[];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tailwind-themes.css',
      skipFormat: true,
    });

    expect(tree.exists('src/styles/tailwind-themes.css')).toBe(true);

    const content = tree.read('src/styles/tailwind-themes.css', 'utf-8');

    // Check Tailwind @theme block
    expect(content).toContain('@theme {');
    expect(content).toContain('--color-et-tone-blue-fill: rgb(10 127 255);');
    expect(content).toContain('--color-et-tone-blue-fill-hover: rgb(47 146 255);');
    expect(content).toContain('--color-et-tone-blue-fill-active: rgb(9 114 230);');
    expect(content).toContain('--color-et-tone-blue-fill-disabled: rgb(30 77 128);');

    // Check that spread color values are correctly extracted
    expect(content).toContain('--color-et-tone-blue-on-fill: rgb(10 13 16);');
    expect(content).toContain('--color-et-tone-blue-on-fill-disabled: rgb(30 77 128);'); // Override from spread

    // Check blue-inverse theme
    expect(content).toContain('--color-et-tone-blue-inverse-fill: rgb(10 127 255);');
    expect(content).toContain('--color-et-tone-blue-inverse-on-fill: rgb(255 255 255);'); // From onColorLight
    expect(content).toContain('--color-et-tone-blue-inverse-on-fill-disabled: rgb(30 77 128);'); // Override

    // Check runtime CSS variables for default theme
    expect(content).toContain(':root, .et-color--default, .et-color--blue {');
    expect(content).toContain('--et-tone-fill-rest: rgb(10 127 255);');
    expect(content).toContain('--et-tone-fill-hover: rgb(47 146 255);');
    expect(content).toContain('--et-tone-on-fill-rest: rgb(10 13 16);');
    expect(content).toContain('--et-tone-on-fill-disabled: rgb(30 77 128);');

    // Check runtime CSS for non-default theme
    expect(content).toContain('.et-color--blue-inverse {');
    expect(content).toContain('--et-tone-fill-rest: rgb(10 127 255);');
    expect(content).toContain('--et-tone-fill-hover: rgb(40 49 64);');
    expect(content).toContain('--et-tone-on-fill-rest: rgb(255 255 255);');

    // Verify fallbacks work correctly
    expect(content).toContain('--color-et-tone-blue-on-fill-hover: rgb(10 13 16);'); // Falls back to default
    expect(content).toContain('--color-et-tone-blue-on-fill-focus: rgb(10 13 16);'); // Falls back to hover -> default
  });

  it('should resolve color maps referenced by identifier', async () => {
    const themesContent = `
      const BRAND = { default: '1 1 1', hover: '2 2 2', active: '3 3 3', disabled: '4 4 4' };
      const ON_BRAND = { default: '255 255 255' };
      export const BRAND_THEME = {
        name: 'brand',
        isDefault: true,
        primary: { color: BRAND, onColor: ON_BRAND },
      };
      export const THEMES = [BRAND_THEME];
    `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tw.css',
      skipFormat: true,
    });

    expect(tree.read('src/styles/tw.css', 'utf-8')).toContain('--et-tone-fill-rest: rgb(1 1 1);');
  });

  it('should generate dynamic theme variables', async () => {
    const themesContent = `
    import { type Theme as EthleteTheme } from '@ethlete/cdk';

    export const BLUE = {
      name: 'blue',
      isDefault: true,
      primary: {
        color: {
          default: '10 127 255',
          hover: '47 146 255',
          active: '9 114 230',
          disabled: '30 77 128',
        },
        onColor: {
          default: '10 13 16',
        },
      },
    } as const;

    export const THEMES = [BLUE] satisfies EthleteTheme[];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tailwind-themes.css',
      skipFormat: true,
    });

    const content = tree.read('src/styles/tailwind-themes.css', 'utf-8');

    // Check static theme colors
    expect(content).toContain('--color-et-tone-blue-fill: rgb(10 127 255);');

    // Check dynamic theme variables that reference runtime CSS variables
    expect(content).toContain('--color-et-tone-fill: var(--et-tone-fill-rest);');
    expect(content).toContain('--color-et-tone-fill-hover: var(--et-tone-fill-hover);');
    expect(content).toContain('--color-et-tone-on-fill: var(--et-tone-on-fill-rest);');

    // isDefaultAlt is not yet supported; no alt-theme dynamic variables are generated
  });

  it('should ignore secondary and tertiary swatches', async () => {
    const themesContent = `
    import { type Theme as EthleteTheme } from '@ethlete/cdk';

    export const FULL_THEME = {
      name: 'full',
      isDefault: true,
      primary: {
        color: { default: '10 127 255', hover: '47 146 255', active: '9 114 230', disabled: '30 77 128' },
        onColor: { default: '10 13 16' },
      },
      secondary: {
        color: { default: '100 200 50', hover: '120 220 70', active: '80 180 40', disabled: '50 100 30' },
        onColor: { default: '255 255 255' },
      },
      tertiary: {
        color: { default: '200 100 50', hover: '220 120 70', active: '180 80 40', disabled: '100 50 30' },
        onColor: { default: '0 0 0' },
      },
    } as const;

    export const THEMES = [FULL_THEME] satisfies EthleteTheme[];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tailwind-themes.css',
      skipFormat: true,
    });

    const content = tree.read('src/styles/tailwind-themes.css', 'utf-8');

    expect(content).toContain('--et-tone-fill-rest: rgb(10 127 255);');
    expect(content).not.toMatch(/secondary|tertiary|100 200 50|200 100 50/u);
  });

  it('should error when no default theme is provided', async () => {
    const themesContent = `
    export const THEME1 = { 
      name: 'theme1', 
      primary: { 
        color: { default: '1 1 1', hover: '2 2 2', active: '3 3 3', disabled: '4 4 4' }, 
        onColor: { default: '5 5 5' } 
      } 
    } as const;
    export const THEMES = [THEME1];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tw.css',
      skipFormat: true,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No default theme found'));
  });

  it('should error when multiple themes are marked as default', async () => {
    const themesContent = `
    export const THEME1 = { 
      name: 'theme1', 
      isDefault: true, 
      primary: { 
        color: { default: '1 1 1', hover: '2 2 2', active: '3 3 3', disabled: '4 4 4' }, 
        onColor: { default: '5 5 5' } 
      } 
    } as const;
    export const THEME2 = { 
      name: 'theme2', 
      isDefault: true, 
      primary: { 
        color: { default: '6 6 6', hover: '7 7 7', active: '8 8 8', disabled: '9 9 9' }, 
        onColor: { default: '10 10 10' } 
      } 
    } as const;
    export const THEMES = [THEME1, THEME2];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tw.css',
      skipFormat: true,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Multiple default themes found'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('theme1, theme2'));
  });

  it('should handle a theme with isDefaultAlt gracefully (feature not yet implemented)', async () => {
    const themesContent = `
    export const THEME1 = { 
      name: 'theme1', 
      isDefault: true,
      isDefaultAlt: true,
      primary: { 
        color: { default: '1 1 1', hover: '2 2 2', active: '3 3 3', disabled: '4 4 4' }, 
        onColor: { default: '5 5 5' } 
      } 
    } as const;
    export const THEMES = [THEME1];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tw.css',
      skipFormat: true,
    });

    // isDefaultAlt is currently ignored; the generator treats theme1 as the sole default theme
    expect(tree.exists('src/styles/tw.css')).toBe(true);
    const content = tree.read('src/styles/tw.css', 'utf-8');
    expect(content).toContain(':root, .et-color--default, .et-color--theme1 {');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should handle multiple themes marked as isDefaultAlt gracefully (feature not yet implemented)', async () => {
    const themesContent = `
    export const DEFAULT_THEME = { 
      name: 'default', 
      isDefault: true, 
      primary: { 
        color: { default: '1 1 1', hover: '2 2 2', active: '3 3 3', disabled: '4 4 4' }, 
        onColor: { default: '5 5 5' } 
      } 
    } as const;
    export const ALT1 = { 
      name: 'alt1', 
      isDefaultAlt: true, 
      primary: { 
        color: { default: '6 6 6', hover: '7 7 7', active: '8 8 8', disabled: '9 9 9' }, 
        onColor: { default: '10 10 10' } 
      } 
    } as const;
    export const ALT2 = { 
      name: 'alt2', 
      isDefaultAlt: true, 
      primary: { 
        color: { default: '11 11 11', hover: '12 12 12', active: '13 13 13', disabled: '14 14 14' }, 
        onColor: { default: '15 15 15' } 
      } 
    } as const;
    export const THEMES = [DEFAULT_THEME, ALT1, ALT2];
  `;

    tree.write('src/themes.ts', themesContent);

    await migrate(tree, {
      themesPath: 'src/themes.ts',
      outputPath: 'src/styles/tw.css',
      skipFormat: true,
    });

    // isDefaultAlt is currently ignored; alt1 and alt2 are treated as regular non-default themes
    expect(tree.exists('src/styles/tw.css')).toBe(true);
    const content = tree.read('src/styles/tw.css', 'utf-8');
    expect(content).toContain(':root, .et-color--default, .et-color--default {');
    expect(content).toContain('.et-color--alt1 {');
    expect(content).toContain('.et-color--alt2 {');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should read themes written as inline literals in the THEMES array', async () => {
    tree.write(
      'src/themes.ts',
      `
      export const THEMES = [
        { name: 'brand', isDefault: true, primary: { color: { default: '1 1 1' }, onColor: { default: '255 255 255' } } },
        { name: 'accent', primary: { color: { default: '9 9 9' }, onColor: { default: '0 0 0' } } },
      ];
    `,
    );

    await migrate(tree, { themesPath: 'src/themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

    const content = tree.read('src/styles/tw.css', 'utf-8');
    expect(content).toContain('--et-tone-fill-rest: rgb(1 1 1);');
    expect(content).toContain('9 9 9');
    expect(tree.read('src/styles/tw.d.ts', 'utf-8')).toContain(`'accent': true;`);
  });

  describe('scss output path', () => {
    const THEMES = `
      export const BRAND = { name: 'brand', isDefault: true, primary: { color: { default: '1 1 1' }, onColor: { default: '255 255 255' } } };
      export const THEMES = [BRAND];
    `;

    it('should write the CSS to a .scss path when the types path is given', async () => {
      tree.write('src/themes.ts', THEMES);

      await migrate(tree, {
        themesPath: 'src/themes.ts',
        outputPath: 'src/styles/tw.scss',
        typesOutputPath: 'src/styles/tw-types.d.ts',
        skipFormat: true,
      });

      expect(tree.read('src/styles/tw.scss', 'utf-8')).toContain('--et-tone-fill-rest: rgb(1 1 1);');
      expect(tree.exists('src/styles/tw-types.d.ts')).toBe(true);
    });

    it('should refuse a .scss path without a distinct types path', async () => {
      tree.write('src/themes.ts', THEMES);

      await expect(
        migrate(tree, { themesPath: 'src/themes.ts', outputPath: 'src/styles/tw.scss', skipFormat: true }),
      ).rejects.toThrow('typesOutputPath');
      expect(tree.exists('src/styles/tw.scss')).toBe(false);
    });
  });

  describe('spreads of imported consts', () => {
    const THEME = (imports: string) => `
    ${imports}

    export const BRAND = {
      name: 'brand',
      isDefault: true,
      primary: {
        color: { default: '1 2 3' },
        onColor: { ...ON_COLOR, hover: '9 9 9' },
      },
    } as const;

    export const THEMES = [BRAND] as const;
    `;

    it('should resolve a spread of a const imported from a relative file', async () => {
      tree.write('src/shared/on-color.ts', `export const ON_COLOR = { default: '200 201 202' } as const;`);
      tree.write('src/themes.ts', THEME(`import { ON_COLOR } from './shared/on-color';`));

      await migrate(tree, { themesPath: 'src/themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

      expect(tree.read('src/styles/tw.css', 'utf-8')).toContain('200 201 202');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn when a spread comes from a package import', async () => {
      tree.write('src/themes.ts', THEME(`import { ON_COLOR } from '@acme/tokens';`));

      await migrate(tree, { themesPath: 'src/themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve "ON_COLOR" imported from "@acme/tokens" in /src/themes.ts'),
      );
    });

    it('should warn when a relative import cannot be read from the tree', async () => {
      tree.write('src/themes.ts', THEME(`import { ON_COLOR } from './missing';`));

      await migrate(tree, { themesPath: 'src/themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not resolve "ON_COLOR"'));
    });
  });

  describe('defaultTheme option', () => {
    const TWO_THEMES = `
    export const THEME1 = {
      name: 'theme1',
      isDefault: true,
      primary: {
        color: { default: '1 1 1', hover: '2 2 2', active: '3 3 3', disabled: '4 4 4' },
        onColor: { default: '5 5 5' }
      }
    } as const;
    export const THEME2 = {
      name: 'theme2',
      primary: {
        color: { default: '6 6 6', hover: '7 7 7', active: '8 8 8', disabled: '9 9 9' },
        onColor: { default: '10 10 10' }
      }
    } as const;
    export const THEMES = [THEME1, THEME2];
  `;

    it('should override the isDefault flags from the definitions', async () => {
      tree.write('src/themes.ts', TWO_THEMES);

      await migrate(tree, {
        themesPath: 'src/themes.ts',
        outputPath: 'src/styles/tw.css',
        defaultTheme: 'theme2',
        skipFormat: true,
      });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      expect(content).toContain(':root, .et-color--default, .et-color--theme2 {');
      expect(content).toContain('.et-color--theme1 {');
      expect(content).not.toContain('.et-color--default, .et-color--theme1');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should satisfy validation when the definitions mark no default at all', async () => {
      const themesContent = `
      export const THEME1 = {
        name: 'theme1',
        primary: {
          color: { default: '1 1 1', hover: '2 2 2', active: '3 3 3', disabled: '4 4 4' },
          onColor: { default: '5 5 5' }
        }
      } as const;
      export const THEMES = [THEME1];
    `;

      tree.write('src/themes.ts', themesContent);

      await migrate(tree, {
        themesPath: 'src/themes.ts',
        outputPath: 'src/styles/tw.css',
        defaultTheme: 'theme1',
        skipFormat: true,
      });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      expect(content).toContain(':root, .et-color--default, .et-color--theme1 {');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should record the override in the regenerate command of the generated files', async () => {
      tree.write('src/themes.ts', TWO_THEMES);

      await migrate(tree, {
        themesPath: 'src/themes.ts',
        outputPath: 'src/styles/tw.css',
        defaultTheme: 'theme2',
        skipFormat: true,
      });

      expect(tree.read('src/styles/tw.css', 'utf-8')).toContain('--defaultTheme=theme2');
      expect(tree.read('src/styles/tw.d.ts', 'utf-8')).toContain('--defaultTheme=theme2');
    });

    it('should error when the named theme does not exist', async () => {
      tree.write('src/themes.ts', TWO_THEMES);

      await migrate(tree, {
        themesPath: 'src/themes.ts',
        outputPath: 'src/styles/tw.css',
        defaultTheme: 'nope',
        skipFormat: true,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No theme named "nope"'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('theme1, theme2'));
      expect(tree.exists('src/styles/tw.css')).toBe(false);
    });
  });

  describe('theme names with a type cast', () => {
    const farn = readFileSync(join(__dirname, '__fixtures__/farn-themes.ts.txt'), 'utf-8');
    const castFree = farn.replace(/ as ColorTheme\['name'\]/, '');

    it('should write the same CSS as from a cast-free copy', async () => {
      expect(farn).not.toBe(castFree);

      const generate = async (source: string) => {
        const scratch = createTreeWithEmptyWorkspace();
        scratch.write('src/themes.ts', source);
        await migrate(scratch, { themesPath: 'src/themes.ts', outputPath: 'src/out.css', skipFormat: true });

        return scratch.read('src/out.css', 'utf-8');
      };

      const fromCast = await generate(farn);

      expect(fromCast).toContain('farn');
      expect(fromCast).toBe(await generate(castFree));
    });
  });
});
