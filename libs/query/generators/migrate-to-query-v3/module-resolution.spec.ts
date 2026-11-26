import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';
import { createMigrationScope } from './migration-scope';
import { reportLegacyModuleResolution } from './module-resolution';
import { QueryV3MigrationReport } from './report';

const json = (value: unknown) => JSON.stringify(value, null, 2);

describe('migrate-to-query-v3 module resolution', () => {
  let tree: Tree;
  let report: QueryV3MigrationReport;

  const writeProject = (root: string, ownCompilerOptions: object = {}) => {
    tree.write(`${root}/project.json`, json({ name: root.split('/').pop() }));
    tree.write(
      `${root}/tsconfig.json`,
      json({ extends: '../../tsconfig.base.json', compilerOptions: { target: 'es2022', ...ownCompilerOptions } }),
    );
    tree.write(`${root}/tsconfig.app.json`, json({ extends: './tsconfig.json', compilerOptions: { outDir: 'dist' } }));
  };

  const summaries = () => {
    reportLegacyModuleResolution(tree, createMigrationScope(tree, {}), report);

    return report.tasks.map((task) => task.summary);
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    report = new QueryV3MigrationReport();

    vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });

    tree.write(
      'tsconfig.base.json',
      json({
        compilerOptions: {
          moduleResolution: 'node',
          baseUrl: '.',
          paths: { '@acme/testing': ['libs/testing/src/index.ts'] },
        },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names a node-resolving project that imports an @ethlete subpath', () => {
    writeProject('apps/web');
    tree.write('apps/web/src/main.ts', `import { provideQueryTesting } from '@ethlete/query/testing';\n`);

    expect(summaries()).toEqual([
      'apps/web/tsconfig.app.json resolves modules with `node` and imports `@ethlete/query/testing`.',
    ]);
  });

  it('ignores bundler-resolving projects and root package imports', () => {
    writeProject('apps/web', { moduleResolution: 'bundler' });
    writeProject('apps/admin');
    tree.write('apps/web/src/main.ts', `import { QueryDevtoolsLazyComponent } from '@ethlete/query-devtools/lazy';\n`);
    tree.write('apps/admin/src/main.ts', `import { createQueryClient } from '@ethlete/query';\n`);

    expect(summaries()).toEqual([]);
  });

  it('names a node-resolving project that reaches a subpath through a path alias', () => {
    writeProject('libs/testing', { moduleResolution: 'bundler' });
    writeProject('apps/web');
    tree.write('libs/testing/src/index.ts', `export { provideQueryTesting } from '@ethlete/query/testing';\n`);
    tree.write('apps/web/src/main.ts', `import { provideQueryTesting } from '@acme/testing';\n`);

    expect(summaries()).toEqual([
      'apps/web/tsconfig.app.json resolves modules with `node` and reaches an `@ethlete/*` subpath through `@acme/testing`.',
    ]);
  });

  it('reports the devtools subpath the migration itself adds', async () => {
    writeProject('apps/web');
    tree.write(
      'apps/web/src/client.ts',
      `import { V2QueryClient } from '@ethlete/query';\n\nexport const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });\n`,
    );
    tree.write(
      'apps/web/src/app.config.ts',
      `import { provideQueryClientForDevtools } from '@ethlete/query';\nimport { apiClient } from './client';\n\nexport const appConfig = { providers: [provideQueryClientForDevtools({ client: apiClient, displayName: 'API' })] };\n`,
    );

    await migration(tree, { skipFormat: true });

    expect(tree.read('query-v3-migration-tasks.md', 'utf-8')).toContain(
      'apps/web/tsconfig.app.json resolves modules with `node` and imports `@ethlete/query-devtools/lazy`.',
    );
  });
});
