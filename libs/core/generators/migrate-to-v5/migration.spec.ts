import { addProjectConfiguration, logger, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import migration from './migration';

describe('migrate-to-v5', () => {
  let tree: Tree;
  let loggerInfoSpy: MockInstance;
  let loggerWarnSpy: MockInstance;

  const info = () => loggerInfoSpy.mock.calls.flat().join('\n');
  const warnings = () => loggerWarnSpy.mock.calls.flat().join('\n');

  const themedFile = `import { ProvideThemeDirective } from '@ethlete/core';
import { Memo } from '@ethlete/core';

export const directives = [ProvideThemeDirective];
`;

  const fixtures: Record<string, string> = {
    'themed.ts': themedFile,
    'provider.ts': `import { createProvider } from '@ethlete/cdk';\n\nexport const [provideX, injectX] = createProvider(() => ({}));\n`,
    'router.ts': `import { RouterStateService } from '@ethlete/core';

export class MyComponent {
  private _routerStateService = inject(RouterStateService);

  route$ = this._routerStateService.route$;
}
`,
    'viewport.ts': `import { ViewportService } from '@ethlete/core';

class Dummy {
  private viewportService = inject(ViewportService);

  get isSmallScreen() {
    return this.viewportService.isXs;
  }
}
`,
  };

  const writeFixtures = (root: string) => {
    for (const [name, content] of Object.entries(fixtures)) tree.write(`${root}/${name}`, content);
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {
      // noop
    });
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should skip formatting when skipFormat is true', async () => {
    const content = `
import { Foo    } from '@somewhere';
    `.trim();

    tree.write('test.ts', content);
    await migration(tree, { skipFormat: true });

    const result = tree.read('test.ts', 'utf-8');
    expect(result).toContain('Foo   ');
  });

  it('should leave files outside the scope byte-identical', async () => {
    addProjectConfiguration(tree, 'app-a', { root: 'apps/app-a' });
    addProjectConfiguration(tree, 'app-b', { root: 'apps/app-b' });
    writeFixtures('apps/app-a/src');
    writeFixtures('apps/app-b/src');
    writeFixtures('libs/shared/src');

    await migration(tree, { skipFormat: true, projects: ['app-a'] });

    for (const [name, content] of Object.entries(fixtures)) {
      expect(tree.read(`apps/app-a/src/${name}`, 'utf-8')).not.toBe(content);
      expect(tree.read(`apps/app-b/src/${name}`, 'utf-8')).toBe(content);
      expect(tree.read(`libs/shared/src/${name}`, 'utf-8')).toBe(content);
    }
    expect(info()).toContain('Scope: apps/app-a');
    expect(warnings()).toContain('apps/app-a/src/themed.ts: Memo was removed');
    expect(warnings()).not.toContain('app-b');
  });

  it('should accept path prefixes through include', async () => {
    tree.write('apps/app-a/src/a.ts', themedFile);
    tree.write('apps/app-b/src/b.ts', themedFile);

    await migration(tree, { skipFormat: true, include: ['apps/app-b/'] });

    expect(tree.read('apps/app-a/src/a.ts', 'utf-8')).toBe(themedFile);
    expect(tree.read('apps/app-b/src/b.ts', 'utf-8')).toContain('ProvideColorDirective');
  });

  it('should report one summary per transform with the files to review', async () => {
    tree.write('src/themed.ts', themedFile);
    tree.write('src/star.ts', `export * from '@ethlete/cdk';\n// createProvider\n`);

    await migration(tree, { skipFormat: true, migrateViewportService: false });

    expect(info()).toContain('Scope: the whole workspace');
    expect(info()).toContain('• createProvider: 0 file(s) changed, 1 to review manually');
    expect(info()).toContain('• RouterStateService: 0 file(s) changed');
    expect(info()).toContain('• Theme → color naming: 1 file(s) changed');
    expect(info()).toContain('• Removed exports: 0 file(s) changed, 1 to review manually');
    expect(info()).not.toContain('ViewportService');
    expect(warnings()).toContain(`src/star.ts: "export * from '@ethlete/cdk'" may re-export createProvider`);
    expect(warnings()).toContain('src/themed.ts: Memo was removed');
  });
});
