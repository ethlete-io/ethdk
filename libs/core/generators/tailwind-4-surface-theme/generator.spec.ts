import { Tree } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import { migrateSurfaceRolesInFile } from '../migrate-surface-roles/surface-roles';
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
    expect(content).toContain('--color-et-surface-card-background: rgb(255 255 255);');
    expect(content).toContain('--color-et-surface-sheet-text: rgb(255 255 255);');
    expect(content).toContain('.et-surface--card {');
  });

  it('writes the colorThemeVariants of a surface into its scope rule', async () => {
    tree.write(
      'src/surface-themes.ts',
      CARD_AND_SHEET.replace(
        'elevation: 2,',
        "elevation: 2,\n      colorThemeVariants: { brand: 'brand-on-dark', 'warning': 'amberDeep' },",
      ),
    );

    await migrate(tree, { themesPath: 'src/surface-themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

    const content = tree.read('src/styles/tw.css', 'utf-8') ?? '';

    expect(content).toMatch(
      /\.et-surface--sheet \{[^}]*--et-surface-color-theme-variants: brand brand-on-dark, warning amberdeep;/u,
    );
    expect(content).not.toMatch(/\.et-surface--card \{[^}]*--et-surface-color-theme-variants/u);
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
    expect(content).toContain('--color-et-surface-card-background: rgb(255 255 255);');
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
    expect(content).toContain('--color-fut-surface-card-background: rgb(255 255 255);');
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
    expect(content).toContain('--color-fut-surface-card-background: rgb(255 255 255);');
    expect(content).toContain('--color-fut-surface-background: var(--et-surface-background);');
    expect(content).toContain('--color-fut-surface-control-text: var(--et-surface-control-text);');

    // The runtime theme-swap selectors and variables use the runtime prefix, not the
    // Tailwind utility prefix.
    expect(content).toContain('.et-surface--default-light, .et-surface--card {');
    expect(content).toContain('--et-surface-background: rgb(255 255 255);');
    expect(content).not.toContain('fut-surface--');
    expect(content).not.toContain('--fut-surface-background');

    // The per-scope re-declaration also follows the runtime prefix.
    expect(content).toContain('[class*="et-surface--"]');
    expect(content).toContain('--color-fut-surface-text: var(--et-surface-text);');
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
    expect(content).toContain('--custom-surface-background: rgb(255 255 255);');
  });

  describe('tint and controlText', () => {
    const withRoles = (roles: string) => `
      export const CARD = {
        name: 'card',
        type: 'light',
        elevation: 1,
        isDefault: true,
        ${roles}
        background: '255 255 255',
        color: '0 0 0',
        colorMuted: '100 100 100',
        colorSubtle: '200 200 200',
        border: '220 220 220',
      } as const;

      export const SURFACE_THEMES = [CARD] satisfies SurfaceTheme[];
    `;

    const COLOR_MAP = `{ default: '115 115 115', hover: '64 64 64', focus: '60 60 60', active: '23 23 23', disabled: '180 180 180' }`;

    const generate = async () => {
      await migrate(tree, { themesPath: 'src/surface-themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

      return tree.read('src/styles/tw.css', 'utf-8') ?? '';
    };

    it('emits the tint and the control text ladder', async () => {
      tree.write('src/surface-themes.ts', withRoles(`tint: '115 115 115', controlText: ${COLOR_MAP},`));

      const content = await generate();
      expect(content).toContain('--et-surface-tint: rgb(115 115 115);');
      expect(content).toContain('--et-surface-control-text-active: rgb(23 23 23);');
      expect(content).toContain('--color-et-surface-card-control-text-hover: rgb(64 64 64);');
      expect(content).toContain('--color-et-surface-card-tint: rgb(115 115 115);');
      expect(content).not.toContain('interaction');
    });

    it('fills the control text states left out', async () => {
      tree.write('src/surface-themes.ts', withRoles(`controlText: { default: '23 23 23', hover: '64 64 64' },`));

      const content = await generate();
      expect(content).toContain('--et-surface-control-text-focus: rgb(64 64 64);');
      expect(content).toContain('--et-surface-control-text-disabled: rgb(23 23 23);');
      expect(content).not.toContain('--et-surface-tint: rgb(');
    });

    it('emits the reserved surface color scope, following the runtime prefix', async () => {
      tree.write('src/surface-themes.ts', withRoles(`controlText: ${COLOR_MAP},`));

      await migrate(tree, {
        themesPath: 'src/surface-themes.ts',
        outputPath: 'src/styles/tw.css',
        prefix: 'fut',
        runtimePrefix: 'et',
        skipFormat: true,
      });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      expect(content).toContain('.et-color--surface {');
      expect(content).toContain('--et-tone-fill-rest: var(--et-surface-control-text, var(--et-surface-text));');
      expect(content).toContain('--et-tone-on-fill-rest: var(--et-surface-background);');
      expect(content).toContain('--et-tone-text-rest: var(--et-surface-text);');
      expect(content).not.toContain('.fut-color--surface');
    });

    it.each([
      ['swatch', `interactionColor: { color: ${COLOR_MAP} },`],
      ['flat map', `interactionColor: ${COLOR_MAP},`],
    ])('points at the migration when a theme still uses the interactionColor %s', async (_, roles) => {
      tree.write('src/surface-themes.ts', withRoles(roles));

      await expect(generate()).rejects.toThrow(/migrate-surface-roles/u);

      expect(tree.exists('src/styles/tw.css')).toBe(false);
    });

    it('should resolve a control text map shared through a const by several themes', async () => {
      tree.write(
        'src/surface-themes.ts',
        `
        const LADDER = ${COLOR_MAP};

        export const CARD = {
          name: 'card',
          type: 'light',
          elevation: 1,
          isDefault: true,
          controlText: LADDER,
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
          controlText: LADDER,
          background: '10 10 10',
          color: '255 255 255',
          colorMuted: '180 180 180',
          colorSubtle: '80 80 80',
          border: '40 40 40',
        } as const;

        export const SURFACE_THEMES = [CARD, SHEET] satisfies SurfaceTheme[];
      `,
      );

      const content = await generate();
      expect(content).toContain('--color-et-surface-card-control-text-hover: rgb(64 64 64);');
      expect(content).toContain('--color-et-surface-sheet-control-text-hover: rgb(64 64 64);');
    });

    it('should fail the generator when a control text map cannot be resolved', async () => {
      tree.write(
        'src/surface-themes.ts',
        `
        export const BROKEN = {
          name: 'broken',
          type: 'dark',
          elevation: 2,
          isDefault: true,
          controlText: MISSING,
          background: '10 10 10',
          color: '255 255 255',
          colorMuted: '180 180 180',
          colorSubtle: '80 80 80',
          border: '40 40 40',
        } as const;

        export const SURFACE_THEMES = [BROKEN] satisfies SurfaceTheme[];
      `,
      );

      await expect(generate()).rejects.toThrow(/BROKEN.*cannot be resolved/u);

      expect(tree.exists('src/styles/tw.css')).toBe(false);
    });
  });

  describe('state utilities for apps', () => {
    const LADDER = `
      export const GROUND = {
        name: 'ground',
        type: 'light',
        elevation: 0,
        isDefault: true,
        background: '245 245 245',
        color: '0 0 0',
        colorMuted: '100 100 100',
        colorSubtle: '200 200 200',
        border: '220 220 220',
      } as const;

      export const RAISED = {
        name: 'raised',
        type: 'light',
        elevation: 1,
        background: '255 255 255',
        color: '0 0 0',
        colorMuted: '100 100 100',
        colorSubtle: '200 200 200',
        border: '220 220 220',
      } as const;

      export const NIGHT = {
        name: 'night',
        type: 'dark',
        elevation: 0,
        isDefault: true,
        background: '10 10 10',
        color: '255 255 255',
        colorMuted: '180 180 180',
        colorSubtle: '80 80 80',
        border: '40 40 40',
      } as const;

      export const SURFACE_THEMES = [GROUND, RAISED, NIGHT] satisfies SurfaceTheme[];
    `;

    const scopeOf = (content: string, selector: string) => {
      const start = content.indexOf(`${selector} {`);

      return content.slice(start, content.indexOf('}', start));
    };

    const generate = async () => {
      await migrate(tree, { themesPath: 'src/surface-themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

      return tree.read('src/styles/tw.css', 'utf-8') ?? '';
    };

    beforeEach(() => {
      tree.write('src/surface-themes.ts', LADDER);
    });

    it('declares the tint and the next level background as utilities of the nearest surface', async () => {
      const themeBlock = (await generate()).split('@layer base')[0] ?? '';

      expect(themeBlock).toContain('--color-et-surface-tint: var(--et-surface-tint, var(--et-surface-text));');
      expect(themeBlock).toContain('--color-et-surface-next-background: var(--et-surface-next-background);');
    });

    it('writes the background of the next elevation of the same type into each surface scope', async () => {
      const content = await generate();

      expect(scopeOf(content, '.et-surface--default-light, .et-surface--ground')).toContain(
        '--et-surface-next-background: rgb(255 255 255);',
      );
    });

    it('mixes the tint over the background on a surface without a next level', async () => {
      const content = await generate();
      const topmost =
        'color-mix(in srgb, var(--et-surface-tint, var(--et-surface-text)) 9%, var(--et-surface-background))';

      expect(scopeOf(content, '.et-surface--raised')).toContain(`--et-surface-next-background: ${topmost};`);
      expect(scopeOf(content, '.et-surface--default-dark, .et-surface--night')).toContain(
        `--et-surface-next-background: ${topmost};`,
      );
    });
  });

  describe('real app themes after migrate-surface-roles', () => {
    const generate = async () => {
      await migrate(tree, { themesPath: 'src/surface-themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

      return tree.read('src/styles/tw.css', 'utf-8') ?? '';
    };

    it.each(['app-a', 'app-b'])('generates the tint and the control text ladder for %s', async (app) => {
      const source = readFileSync(join(__dirname, `__fixtures__/${app}/surface-themes.ts.txt`), 'utf-8');
      const migrated = migrateSurfaceRolesInFile('src/surface-themes.ts', source);

      expect(migrated.changed).toBe(true);
      tree.write('src/surface-themes.ts', migrated.content);

      const content = await generate();
      expect(content).toContain('--et-surface-tint: rgb(');
      expect(content).toContain('--et-surface-control-text-hover: rgb(');
      expect(content).not.toContain('interaction');
    });
  });

  it('should read a negative elevation written as a unary minus', async () => {
    tree.write(
      'src/surface-themes.ts',
      `
      export const BASE = {
        name: 'base',
        type: 'light',
        elevation: -1,
        isDefault: true,
        background: '250 250 250',
        color: '0 0 0',
        colorMuted: '100 100 100',
        colorSubtle: '200 200 200',
        border: '220 220 220',
      } as const;

      export const SURFACE_THEMES = [BASE] satisfies SurfaceTheme[];
    `,
    );

    await migrate(tree, { themesPath: 'src/surface-themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

    expect(tree.read('src/styles/tw.css', 'utf-8')).toContain('--color-et-surface-base-background: rgb(250 250 250);');
  });

  it('should fail the generator when a theme cannot be parsed', async () => {
    tree.write(
      'src/surface-themes.ts',
      `
      export const BROKEN = {
        name: 'broken',
        type: 'light',
        elevation: 1 + 1,
        isDefault: true,
        background: '250 250 250',
        color: '0 0 0',
        colorMuted: '100 100 100',
        colorSubtle: '200 200 200',
        border: '220 220 220',
      } as const;

      export const SURFACE_THEMES = [BROKEN] satisfies SurfaceTheme[];
    `,
    );

    await expect(
      migrate(tree, { themesPath: 'src/surface-themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true }),
    ).rejects.toThrow(/BROKEN/u);
  });

  it('should read themes written as inline literals in the SURFACE_THEMES array', async () => {
    tree.write(
      'src/surface-themes.ts',
      `
      export const SURFACE_THEMES = [
        {
          name: 'card',
          type: 'light',
          elevation: 1,
          isDefault: true,
          background: '255 255 255',
          color: '0 0 0',
          colorMuted: '100 100 100',
          colorSubtle: '200 200 200',
          border: '220 220 220',
        },
      ] satisfies SurfaceTheme[];
    `,
    );

    await migrate(tree, { themesPath: 'src/surface-themes.ts', outputPath: 'src/styles/tw.css', skipFormat: true });

    const content = tree.read('src/styles/tw.css', 'utf-8');
    expect(content).toContain('--color-et-surface-card-background: rgb(255 255 255);');
    expect(content).toContain('.et-surface--card {');
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

  describe('root defaults', () => {
    const DARK_ONLY = `
    export const NIGHT = {
      name: 'night',
      type: 'dark',
      elevation: 0,
      isDefault: true,
      background: '10 10 10',
      color: '255 255 255',
      colorMuted: '180 180 180',
      colorSubtle: '80 80 80',
      border: '40 40 40',
    } as const;

    export const SURFACE_THEMES = [NIGHT] satisfies SurfaceTheme[];
  `;

    it('should switch the root default per prefers-color-scheme when both schemes are registered', async () => {
      tree.write('src/surface-themes.ts', CARD_AND_SHEET);

      await migrate(tree, {
        themesPath: 'src/surface-themes.ts',
        outputPath: 'src/styles/tw.css',
        skipFormat: true,
      });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      expect(content).toContain('@media (prefers-color-scheme: light) {\n  :root {');
      expect(content).toContain('@media (prefers-color-scheme: dark) {\n  :root {');
      expect(content).toContain('    color-scheme: light;');
      expect(content).toContain('    color-scheme: dark;');
    });

    it('should let a scheme class on the root override prefers-color-scheme', async () => {
      tree.write('src/surface-themes.ts', CARD_AND_SHEET);

      await migrate(tree, {
        themesPath: 'src/surface-themes.ts',
        outputPath: 'src/styles/tw.css',
        skipFormat: true,
      });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      expect(content).toContain(':root.et-scheme--light {\n  --et-surface-background: rgb(255 255 255);');
      expect(content).toContain(':root.et-scheme--dark {\n  --et-surface-background: rgb(10 10 10);');
      expect(content).toMatch(/:root\.et-scheme--dark \{[^}]*color-scheme: dark;/);
    });

    it('should paint the root unconditionally when a single scheme is registered', async () => {
      tree.write('src/surface-themes.ts', DARK_ONLY);

      await migrate(tree, {
        themesPath: 'src/surface-themes.ts',
        outputPath: 'src/styles/tw.css',
        skipFormat: true,
      });

      const content = tree.read('src/styles/tw.css', 'utf-8');
      expect(content).not.toContain('prefers-color-scheme');
      expect(content).toContain(':root {\n  --et-surface-background: rgb(10 10 10);');
      expect(content).toContain('  color-scheme: dark;');
    });
  });

  describe('theme names with a type cast', () => {
    const farn = migrateSurfaceRolesInFile(
      'farn-surface-themes.ts',
      readFileSync(join(__dirname, '__fixtures__/farn-surface-themes.ts.txt'), 'utf-8'),
    ).content;
    const castFree = farn.replace(/ as SurfaceTheme\['name'\]/, '');

    it('should write the same CSS as from a cast-free copy', async () => {
      expect(farn).not.toBe(castFree);

      const generate = async (source: string) => {
        const scratch = createTreeWithEmptyWorkspace();
        scratch.write('src/surface-themes.ts', source);
        await migrate(scratch, { themesPath: 'src/surface-themes.ts', outputPath: 'src/out.css', skipFormat: true });

        return scratch.read('src/out.css', 'utf-8');
      };

      const fromCast = await generate(farn);

      expect(fromCast).toContain('farn');
      expect(fromCast).toBe(await generate(castFree));
    });
  });
});
