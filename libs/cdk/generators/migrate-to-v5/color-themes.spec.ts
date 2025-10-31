import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import migrateColorThemes from './color-themes';

describe('migrate-to-v5 -> provideThemes to provideColorThemes and import migration', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should merge imports when @ethlete/cdk import already exists', async () => {
    tree.write(
      'app.config.ts',
      `import { provideRouter } from '@angular/router';
import { SomeExport } from '@ethlete/cdk';
import { provideThemes, ThemeConfig } from '@ethlete/theming';

export const appConfig = {
  providers: [provideThemes(), provideRouter([])]
};`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');

    // Should merge into single @ethlete/cdk import
    expect(result).toContain("import { SomeExport, provideColorThemes, ThemeConfig } from '@ethlete/cdk'");

    // Should not have duplicate imports
    const cdkImportCount = (result!.match(/from ['"]@ethlete\/cdk['"]/g) || []).length;
    expect(cdkImportCount).toBe(1);

    // Should not have @ethlete/theming import
    expect(result).not.toContain('@ethlete/theming');
  });

  it('should merge multiple @ethlete/theming imports with existing @ethlete/cdk import', async () => {
    tree.write(
      'app.config.ts',
      `import { ExistingExport } from '@ethlete/cdk';
import { provideThemes } from '@ethlete/theming';
import { ThemeConfig, ColorPalette } from '@ethlete/theming';

export const appConfig = {
  providers: [provideThemes()]
};`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');

    // Should have all imports in single line
    expect(result).toContain(
      "import { ExistingExport, provideColorThemes, ThemeConfig, ColorPalette } from '@ethlete/cdk'",
    );

    // Should only have one @ethlete/cdk import
    const cdkImportCount = (result!.match(/from ['"]@ethlete\/cdk['"]/g) || []).length;
    expect(cdkImportCount).toBe(1);

    expect(result).not.toContain('@ethlete/theming');
  });

  it('should deduplicate imports when merging', async () => {
    tree.write(
      'app.config.ts',
      `import { ThemeConfig } from '@ethlete/cdk';
import { provideThemes, ThemeConfig } from '@ethlete/theming';

export const config = { providers: [provideThemes()] };`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');

    // ThemeConfig should only appear once
    expect(result).toContain("import { ThemeConfig, provideColorThemes } from '@ethlete/cdk'");

    // Count occurrences of ThemeConfig in the import
    const importLine = result!.match(/import\s*{[^}]*}\s*from\s*['"]@ethlete\/cdk['"]/)?.[0] || '';
    const themeConfigCount = (importLine.match(/ThemeConfig/g) || []).length;
    expect(themeConfigCount).toBe(1);
  });

  it('should preserve import order when merging', async () => {
    tree.write(
      'app.config.ts',
      `import { AlphaExport, BetaExport } from '@ethlete/cdk';
import { provideThemes, ZetaConfig } from '@ethlete/theming';

export const config = { providers: [provideThemes()] };`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');

    // Should maintain existing order and append new imports
    const importMatch = result!.match(/import\s*{([^}]*)}\s*from\s*['"]@ethlete\/cdk['"]/);
    expect(importMatch).toBeTruthy();

    const imports = importMatch![1]!.split(',').map((s) => s.trim());
    expect(imports).toContain('AlphaExport');
    expect(imports).toContain('BetaExport');
    expect(imports).toContain('provideColorThemes');
    expect(imports).toContain('ZetaConfig');
  });

  it('should replace provideThemes with provideColorThemes and move import to @ethlete/cdk', async () => {
    tree.write(
      'app.config.ts',
      `import { provideThemes } from '@ethlete/theming';
import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [provideThemes()]
};`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');
    expect(result).toContain("import { provideColorThemes } from '@ethlete/cdk'");
    expect(result).toContain('providers: [provideColorThemes()]');
    expect(result).not.toContain('provideThemes');
    expect(result).not.toContain('@ethlete/theming');
  });

  it('should move imports with multiple named imports', async () => {
    tree.write(
      'app.config.ts',
      `import { provideThemes, ThemeConfig, ColorPalette } from '@ethlete/theming';

export const appConfig = {
  providers: [provideThemes()]
};`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');
    expect(result).toContain("import { provideColorThemes, ThemeConfig, ColorPalette } from '@ethlete/cdk'");
    expect(result).not.toContain('@ethlete/theming');
  });

  it('should handle files with only @ethlete/theming imports (no provideThemes)', async () => {
    tree.write(
      'theme.service.ts',
      `import { ThemeConfig, ColorPalette } from '@ethlete/theming';

export class ThemeService {
  config: ThemeConfig;
}`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('theme.service.ts', 'utf-8');
    expect(result).toContain("import { ThemeConfig, ColorPalette } from '@ethlete/cdk'");
    expect(result).not.toContain('@ethlete/theming');
  });

  it('should handle multiple imports from @ethlete/theming in the same file', async () => {
    tree.write(
      'app.config.ts',
      `import { provideThemes } from '@ethlete/theming';
import { ThemeConfig } from '@ethlete/theming';

export const appConfig = {
  providers: [provideThemes()]
};`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');
    expect(result).toContain("import { provideColorThemes } from '@ethlete/cdk'");
    expect(result).toContain("import { ThemeConfig } from '@ethlete/cdk'");
    expect(result).not.toContain('@ethlete/theming');
  });

  it('should handle single quotes and double quotes in imports', async () => {
    tree.write(
      'app.config.ts',
      `import { provideThemes } from "@ethlete/theming";

export const config = { providers: [provideThemes()] };`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');
    expect(result).toContain("from '@ethlete/cdk'");
    expect(result).not.toContain('@ethlete/theming');
  });

  it('should handle multiple files', async () => {
    tree.write(
      'app.config.ts',
      `import { provideThemes } from '@ethlete/theming';
export const config = { providers: [provideThemes()] };`,
    );

    tree.write(
      'test.config.ts',
      `import { ThemeConfig } from '@ethlete/theming';
export const testConfig: ThemeConfig = {};`,
    );

    await migrateColorThemes(tree);

    const result1 = tree.read('app.config.ts', 'utf-8');
    const result2 = tree.read('test.config.ts', 'utf-8');

    expect(result1).toContain("from '@ethlete/cdk'");
    expect(result1).toContain('provideColorThemes');
    expect(result1).not.toContain('@ethlete/theming');

    expect(result2).toContain("from '@ethlete/cdk'");
    expect(result2).not.toContain('@ethlete/theming');
  });

  it('should not modify files without provideThemes or @ethlete/theming', async () => {
    const original = `import { provideSomethingElse } from '@ethlete/core';
export const config = { providers: [provideSomethingElse()] };`;

    tree.write('app.config.ts', original);

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');
    expect(result).toBe(original);
  });

  it('should handle provideThemes with arguments', async () => {
    tree.write(
      'app.config.ts',
      `import { provideThemes } from '@ethlete/theming';

export const appConfig = {
  providers: [
    provideThemes({
      theme: 'dark',
      customColors: {}
    })
  ]
};`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');
    expect(result).toContain("from '@ethlete/cdk'");
    expect(result).toContain('provideColorThemes({');
    expect(result).not.toContain('provideThemes');
    expect(result).not.toContain('@ethlete/theming');
  });

  it('should skip non-TypeScript files', async () => {
    tree.write('README.md', 'This mentions @ethlete/theming and provideThemes but should not be changed');

    await migrateColorThemes(tree);

    const result = tree.read('README.md', 'utf-8');
    expect(result).toContain('@ethlete/theming');
    expect(result).toContain('provideThemes');
  });

  it('should handle multiline imports', async () => {
    tree.write(
      'app.config.ts',
      `import {
  provideThemes,
  ThemeConfig,
  ColorPalette
} from '@ethlete/theming';

export const config = { providers: [provideThemes()] };`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');
    expect(result).toContain("from '@ethlete/cdk'");
    expect(result).toContain('provideColorThemes');
    expect(result).not.toContain('@ethlete/theming');
    expect(result).not.toContain('provideThemes');
  });

  it('should preserve other imports from different packages', async () => {
    tree.write(
      'app.config.ts',
      `import { provideThemes } from '@ethlete/theming';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

export const appConfig = {
  providers: [
    provideThemes(),
    provideHttpClient(),
    provideRouter([])
  ]
};`,
    );

    await migrateColorThemes(tree);

    const result = tree.read('app.config.ts', 'utf-8');
    expect(result).toContain("from '@ethlete/cdk'");
    expect(result).toContain("from '@angular/common/http'");
    expect(result).toContain("from '@angular/router'");
    expect(result).toContain('provideColorThemes()');
    expect(result).toContain('provideHttpClient()');
    expect(result).toContain('provideRouter([])');
    expect(result).not.toContain('@ethlete/theming');
    expect(result).not.toContain('provideThemes()');
  });

  describe('package.json migration', () => {
    it('should remove @ethlete/theming from dependencies in root package.json', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          name: 'test-workspace',
          dependencies: {
            '@ethlete/theming': '^1.0.0',
            '@ethlete/cdk': '^2.0.0',
            '@angular/core': '^18.0.0',
          },
        }),
      );

      await migrateColorThemes(tree);

      const packageJson = JSON.parse(tree.read('package.json', 'utf-8')!);
      expect(packageJson.dependencies['@ethlete/theming']).toBeUndefined();
      expect(packageJson.dependencies['@ethlete/cdk']).toBe('^2.0.0');
      expect(packageJson.dependencies['@angular/core']).toBe('^18.0.0');
    });

    it('should remove @ethlete/theming from devDependencies', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          name: 'test-workspace',
          devDependencies: {
            '@ethlete/theming': '^1.0.0',
            '@nx/angular': '^18.0.0',
          },
        }),
      );

      await migrateColorThemes(tree);

      const packageJson = JSON.parse(tree.read('package.json', 'utf-8')!);
      expect(packageJson.devDependencies['@ethlete/theming']).toBeUndefined();
      expect(packageJson.devDependencies['@nx/angular']).toBe('^18.0.0');
    });

    it('should remove @ethlete/theming from peerDependencies', async () => {
      tree.write(
        'libs/my-lib/package.json',
        JSON.stringify({
          name: '@my-org/my-lib',
          peerDependencies: {
            '@ethlete/theming': '^1.0.0',
            '@angular/core': '^18.0.0',
          },
        }),
      );

      await migrateColorThemes(tree);

      const packageJson = JSON.parse(tree.read('libs/my-lib/package.json', 'utf-8')!);
      expect(packageJson.peerDependencies['@ethlete/theming']).toBeUndefined();
      expect(packageJson.peerDependencies['@angular/core']).toBe('^18.0.0');
    });

    it('should handle package.json without @ethlete/theming', async () => {
      const original = {
        name: 'test-workspace',
        dependencies: {
          '@angular/core': '^18.0.0',
        },
      };

      tree.write('package.json', JSON.stringify(original));

      await migrateColorThemes(tree);

      const packageJson = JSON.parse(tree.read('package.json', 'utf-8')!);
      expect(packageJson).toEqual(original);
    });

    it('should remove from all dependency types in same package.json', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          name: 'test-workspace',
          dependencies: {
            '@ethlete/theming': '^1.0.0',
          },
          devDependencies: {
            '@ethlete/theming': '^1.0.0',
          },
          peerDependencies: {
            '@ethlete/theming': '^1.0.0',
          },
        }),
      );

      await migrateColorThemes(tree);

      const packageJson = JSON.parse(tree.read('package.json', 'utf-8')!);
      expect(packageJson.dependencies['@ethlete/theming']).toBeUndefined();
      expect(packageJson.devDependencies['@ethlete/theming']).toBeUndefined();
      expect(packageJson.peerDependencies['@ethlete/theming']).toBeUndefined();
    });

    it('should update multiple package.json files', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          name: 'root',
          dependencies: { '@ethlete/theming': '^1.0.0' },
        }),
      );

      tree.write(
        'apps/my-app/package.json',
        JSON.stringify({
          name: '@my-org/my-app',
          dependencies: { '@ethlete/theming': '^1.0.0' },
        }),
      );

      tree.write(
        'libs/my-lib/package.json',
        JSON.stringify({
          name: '@my-org/my-lib',
          peerDependencies: { '@ethlete/theming': '^1.0.0' },
        }),
      );

      await migrateColorThemes(tree);

      const rootPackageJson = JSON.parse(tree.read('package.json', 'utf-8')!);
      const appPackageJson = JSON.parse(tree.read('apps/my-app/package.json', 'utf-8')!);
      const libPackageJson = JSON.parse(tree.read('libs/my-lib/package.json', 'utf-8')!);

      expect(rootPackageJson.dependencies['@ethlete/theming']).toBeUndefined();
      expect(appPackageJson.dependencies['@ethlete/theming']).toBeUndefined();
      expect(libPackageJson.peerDependencies['@ethlete/theming']).toBeUndefined();
    });
  });
});
