import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { migrateLegacyColorThemesInFile } from './legacy-color-themes';
import migrateLegacyColorThemes, { LEGACY_COLOR_THEMES_GUIDE, LEGACY_COLOR_THEMES_REPORT_PATH } from './migration';

const APP_CONFIG = `import { ApplicationConfig } from '@angular/core';
import { provideColorThemes, provideViewportConfig } from '@ethlete/core';
import { THEMES } from '@my-org/theme';

export const appConfig: ApplicationConfig = {
  providers: [provideViewportConfig(), provideColorThemes(THEMES)],
};
`;

describe('migrateLegacyColorThemesInFile', () => {
  it('rewrites the call and the import', () => {
    const result = migrateLegacyColorThemesInFile('app.config.ts', APP_CONFIG);

    expect(result.changed).toBe(true);
    expect(result.content).toContain(
      "import { provideColorThemesWithTailwind4, provideViewportConfig } from '@ethlete/core';",
    );
    expect(result.content).toContain('provideColorThemesWithTailwind4(THEMES)');
    expect(result.content).not.toMatch(/provideColorThemes\b/);
    expect(result.providerSites).toEqual([
      { file: 'app.config.ts', line: 6, themes: 'THEMES', themesFrom: '@my-org/theme' },
    ]);
  });

  it('changes nothing in an already migrated file', () => {
    const migrated = migrateLegacyColorThemesInFile('app.config.ts', APP_CONFIG).content;
    const second = migrateLegacyColorThemesInFile('app.config.ts', migrated);

    expect(second.changed).toBe(false);
    expect(second.content).toBe(migrated);
  });

  it('drops the old specifier when the Tailwind 4 provider is already imported', () => {
    const source = `import { provideColorThemes, provideColorThemesWithTailwind4 } from '@ethlete/core';
export const a = provideColorThemes([]);
export const b = provideColorThemesWithTailwind4([]);
`;

    const result = migrateLegacyColorThemesInFile('a.ts', source);

    expect(result.content).toContain("import { provideColorThemesWithTailwind4 } from '@ethlete/core';");
    expect(result.content.match(/provideColorThemesWithTailwind4\(\[\]\)/g)).toHaveLength(2);
  });

  it('renames only the imported name of an aliased import', () => {
    const source = `import { provideColorThemes as provideThemes } from '@ethlete/core';
export const providers = [provideThemes(THEMES)];
`;

    const result = migrateLegacyColorThemesInFile('a.ts', source);

    expect(result.content).toContain('import { provideColorThemesWithTailwind4 as provideThemes }');
    expect(result.content).toContain('provideThemes(THEMES)');
    expect(result.providerSites).toHaveLength(1);
  });

  it('rewrites a namespace member', () => {
    const source = `import * as core from '@ethlete/core';
export const providers = [core.provideColorThemes(THEMES)];
`;

    const result = migrateLegacyColorThemesInFile('a.ts', source);

    expect(result.content).toContain('core.provideColorThemesWithTailwind4(THEMES)');
    expect(result.providerSites).toEqual([{ file: 'a.ts', line: 2, themes: 'THEMES' }]);
  });

  it('leaves a provideColorThemes from another package alone', () => {
    const source = `import { provideColorThemes } from './my-theming';
export const providers = [provideColorThemes(THEMES)];
`;

    expect(migrateLegacyColorThemesInFile('a.ts', source).changed).toBe(false);
  });

  it('does not rename an unrelated property of the same name', () => {
    const source = `import { provideColorThemes } from '@ethlete/core';
const config = { provideColorThemes: true };
export const providers = [provideColorThemes(THEMES), config.provideColorThemes];
`;

    const result = migrateLegacyColorThemesInFile('a.ts', source);

    expect(result.content).toContain('{ provideColorThemes: true }');
    expect(result.content).toContain('config.provideColorThemes]');
    expect(result.content).toContain('[provideColorThemesWithTailwind4(THEMES)');
  });

  it('keeps the names a shorthand property and a local export publish', () => {
    const source = `import { provideColorThemes } from '@ethlete/core';
export const api = { provideColorThemes };
export { provideColorThemes };
`;

    const result = migrateLegacyColorThemesInFile('a.ts', source);

    expect(result.content).toContain('{ provideColorThemes: provideColorThemesWithTailwind4 }');
    expect(result.content).toContain('export { provideColorThemesWithTailwind4 as provideColorThemes };');
  });

  it('reports the Tailwind 3 helpers without changing them', () => {
    const source = `import { createTailwindColorThemes } from '@ethlete/core';
export default { theme: { extend: { colors: createTailwindColorThemes(THEMES, 'gg') } } };
`;

    const result = migrateLegacyColorThemesInFile('tailwind.config.ts', source);

    expect(result.changed).toBe(false);
    expect(result.helperSites).toEqual([{ file: 'tailwind.config.ts', line: 2, helper: 'createTailwindColorThemes' }]);
  });

  it('notices an existing surface theme provider', () => {
    const source = `import { provideColorThemes, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
export const providers = [provideColorThemes(THEMES), provideSurfaceThemesWithTailwind4(SURFACES)];
`;

    expect(migrateLegacyColorThemesInFile('a.ts', source).providesSurfaceThemes).toBe(true);
  });
});

describe('migrate-legacy-color-themes', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('apps/web/src/app/app.config.ts', APP_CONFIG);
    tree.write(
      'tailwind.config.ts',
      `import { createTailwindColorThemes } from '@ethlete/core';
export default { theme: { extend: { colors: createTailwindColorThemes(THEMES, 'gg') } } };
`,
    );
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['ETHLETE_SCAN_FILE'];
  });

  it('rewrites the provider and writes the tasks for the Tailwind 4 setup', async () => {
    await migrateLegacyColorThemes(tree, { skipFormat: true });

    expect(tree.read('apps/web/src/app/app.config.ts', 'utf-8')).toContain('provideColorThemesWithTailwind4(THEMES)');

    const report = tree.read(LEGACY_COLOR_THEMES_REPORT_PATH, 'utf-8') ?? '';

    expect(report).toContain(LEGACY_COLOR_THEMES_GUIDE);
    expect(report).toContain('apps/web/src/app/app.config.ts:6 - themes `THEMES`');
    expect(report).toContain('tailwind.config.ts:2 - `createTailwindColorThemes`');
    expect(report).toContain('## Add surface themes');
    expect(report).toContain('nx g @ethlete/core:tailwind-4-surface-theme');
  });

  it('reports the Tailwind 3 helpers in a JavaScript config', async () => {
    tree.rename('tailwind.config.ts', 'tailwind.config.js');

    await migrateLegacyColorThemes(tree, { skipFormat: true });

    expect(tree.read(LEGACY_COLOR_THEMES_REPORT_PATH, 'utf-8')).toContain(
      'tailwind.config.js:2 - `createTailwindColorThemes`',
    );
  });

  it('skips the surface task when the workspace already provides surface themes', async () => {
    tree.write(
      'apps/web/src/app/surfaces.ts',
      `import { provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
export const surfaces = provideSurfaceThemesWithTailwind4([]);
`,
    );

    await migrateLegacyColorThemes(tree, { skipFormat: true });

    expect(tree.read(LEGACY_COLOR_THEMES_REPORT_PATH, 'utf-8')).not.toContain('## Add surface themes');
  });

  it('writes nothing when no file calls provideColorThemes', async () => {
    tree.delete('apps/web/src/app/app.config.ts');

    await migrateLegacyColorThemes(tree, { skipFormat: true });

    expect(tree.exists(LEGACY_COLOR_THEMES_REPORT_PATH)).toBe(false);
  });

  it('lists the affected files and changes nothing in a scan', async () => {
    const scanFile = join(mkdtempSync(join(tmpdir(), 'legacy-color-themes-')), 'scan.json');
    process.env['ETHLETE_SCAN_FILE'] = scanFile;

    await migrateLegacyColorThemes(tree, { skipFormat: true });

    expect(JSON.parse(readFileSync(scanFile, 'utf8'))).toEqual(['apps/web/src/app/app.config.ts']);
    expect(tree.read('apps/web/src/app/app.config.ts', 'utf-8')).toBe(APP_CONFIG);
    expect(tree.exists(LEGACY_COLOR_THEMES_REPORT_PATH)).toBe(false);
  });
});
