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
    console.log(content);

    expect(content).toContain('@theme {');
    expect(content).toContain('--color-et-pitch-green: rgb(7 244 104);');
    expect(content).toContain('--color-et-red: rgb(239 68 68);');
    expect(content).toContain('--color-et-on-pitch-green: rgb(21 22 22);');
  });

  it('should use custom prefix', async () => {
    const themesContent = `
    export const BRAND = { 
      name: 'brand',
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
});
