import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import migrate from './generator';

describe('tailwind-4-theme generator', () => {
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
    expect(content).toContain('--color-et-pitch-green: rgb(7 244 104);');
    expect(content).toContain('--color-et-red: rgb(239 68 68);');
    expect(content).toContain('--color-et-on-pitch-green: rgb(21 22 22);');

    // Add assertion for alt theme runtime CSS
    expect(content).toContain(':root, .et-theme-alt--default, .et-theme-alt--alt-test {');
    expect(content).toContain('--et-color-alt-primary: 7 244 104;');
    expect(content).toContain('--et-color-alt-primary-hover: 58 245 133;');
    expect(content).toContain('--et-color-alt-on-primary: 21 22 22;');
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
    expect(content).toContain('--color-custom-brand: rgb(0 0 0);');
    expect(content).toContain('--color-custom-on-brand: rgb(255 255 255);');
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
    expect(content).toContain('--color-et-pitch-green: rgb(7 244 104);');
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
    expect(content).toContain('--color-et-blue: rgb(10 127 255);');
    expect(content).toContain('--color-et-blue-hover: rgb(47 146 255);');
    expect(content).toContain('--color-et-blue-active: rgb(9 114 230);');
    expect(content).toContain('--color-et-blue-disabled: rgb(30 77 128);');

    // Check that spread color values are correctly extracted
    expect(content).toContain('--color-et-on-blue: rgb(10 13 16);');
    expect(content).toContain('--color-et-on-blue-disabled: rgb(30 77 128);'); // Override from spread

    // Check blue-inverse theme
    expect(content).toContain('--color-et-blue-inverse: rgb(10 127 255);');
    expect(content).toContain('--color-et-on-blue-inverse: rgb(255 255 255);'); // From onColorLight
    expect(content).toContain('--color-et-on-blue-inverse-disabled: rgb(30 77 128);'); // Override

    // Check runtime CSS variables for default theme
    expect(content).toContain(':root, .et-theme--default, .et-theme--blue {');
    expect(content).toContain('--et-color-primary: 10 127 255;');
    expect(content).toContain('--et-color-primary-hover: 47 146 255;');
    expect(content).toContain('--et-color-on-primary: 10 13 16;');
    expect(content).toContain('--et-color-on-primary-disabled: 30 77 128;');

    // Check runtime CSS for non-default theme
    expect(content).toContain('.et-theme--blue-inverse {');
    expect(content).toContain('--et-color-primary: 10 127 255;');
    expect(content).toContain('--et-color-primary-hover: 40 49 64;');
    expect(content).toContain('--et-color-on-primary: 255 255 255;');

    // Verify fallbacks work correctly
    expect(content).toContain('--color-et-on-blue-hover: rgb(10 13 16);'); // Falls back to default
    expect(content).toContain('--color-et-on-blue-focus: rgb(10 13 16);'); // Falls back to hover -> default
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
    expect(content).toContain('--color-et-blue: rgb(10 127 255);');

    // Check dynamic theme variables that reference runtime CSS variables
    expect(content).toContain('--color-et-primary: rgb(var(--et-color-primary));');
    expect(content).toContain('--color-et-primary-hover: rgb(var(--et-color-primary-hover));');
    expect(content).toContain('--color-et-on-primary: rgb(var(--et-color-on-primary));');

    // Check alt theme dynamic variables
    expect(content).toContain('--color-et-alt-primary: rgb(var(--et-color-alt-primary));');
    expect(content).toContain('--color-et-alt-on-primary: rgb(var(--et-color-alt-on-primary));');
  });

  it('should generate secondary and tertiary dynamic variables when present', async () => {
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

    // Check secondary dynamic variables
    expect(content).toContain('--color-et-secondary: rgb(var(--et-color-secondary));');
    expect(content).toContain('--color-et-on-secondary: rgb(var(--et-color-on-secondary));');

    // Check tertiary dynamic variables
    expect(content).toContain('--color-et-tertiary: rgb(var(--et-color-tertiary));');
    expect(content).toContain('--color-et-on-tertiary: rgb(var(--et-color-on-tertiary));');

    // Check runtime CSS for secondary/tertiary
    expect(content).toContain('--et-color-secondary: 100 200 50;');
    expect(content).toContain('--et-color-tertiary: 200 100 50;');
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

  it('should error when a theme has both isDefault and isDefaultAlt', async () => {
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

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('has both isDefault and isDefaultAlt'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('theme1'));
  });

  it('should error when multiple themes are marked as default alt', async () => {
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

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Multiple default alt themes found'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('alt1, alt2'));
  });
});
