import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createModuleGraph } from '../migrate-to-query-v3/module-graph';
import { MODULE_RESOLUTION_TASK, reportLegacyModuleResolution } from './module-resolution';
import { ToolkitMigrationReport } from './report';

const json = (value: unknown) => JSON.stringify(value, null, 2);

describe('reportLegacyModuleResolution', () => {
  let tree: Tree;
  let report: ToolkitMigrationReport;

  const writeProject = (root: string, lib: object, base: object) => {
    tree.write(`${root}/project.json`, json({ name: root.split('/').pop() }));
    tree.write(`${root}/tsconfig.json`, json(base));
    tree.write(`${root}/tsconfig.lib.json`, json(lib));
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    report = new ToolkitMigrationReport();

    tree.write(
      'tsconfig.base.json',
      `{
  // fifagg-frontend tsconfig.base.json at the pre-migration commit
  "compilerOptions": { "moduleResolution": "node", "target": "es2015", "module": "esnext" }
}`,
    );
    writeProject(
      'libs/queries',
      { extends: './tsconfig.json', compilerOptions: { outDir: '../../dist/out-tsc', declaration: true } },
      { extends: '../../tsconfig.base.json', compilerOptions: { target: 'es2022' } },
    );
    writeProject(
      'libs/core',
      { extends: './tsconfig.json', compilerOptions: { moduleResolution: 'bundler' } },
      { extends: '../../tsconfig.base.json', compilerOptions: { moduleResolution: 'bundler' } },
    );
    tree.write('libs/queries/src/lib/team.facade.ts', `import { toolkitCall } from '@ethlete/query/ngrx-toolkit';\n`);
    tree.write('libs/core/src/lib/roster.ts', `import { toolkitCall } from '@ethlete/query/ngrx-toolkit';\n`);
    tree.write('libs/core/src/lib/plain.ts', `import { createQuery } from '@ethlete/query';\n`);
  });

  it('names the tsconfig that inherits moduleResolution node from the base config', () => {
    reportLegacyModuleResolution(
      tree,
      createModuleGraph(tree),
      ['libs/queries/src/lib/team.facade.ts', 'libs/core/src/lib/roster.ts', 'libs/core/src/lib/plain.ts'],
      report,
    );

    expect(report.tasks.map((task) => [task.id, task.locations[0]!.filePath])).toEqual([
      [MODULE_RESOLUTION_TASK, 'libs/queries/tsconfig.lib.json'],
    ]);
    expect(report.tasks[0]!.summary).toContain('`node`');
  });

  it('ignores projects that do not import the interop', () => {
    reportLegacyModuleResolution(tree, createModuleGraph(tree), ['libs/core/src/lib/plain.ts'], report);

    expect(report.tasks).toEqual([]);
  });
});

describe('reportLegacyModuleResolution through path aliases', () => {
  let tree: Tree;
  let report: ToolkitMigrationReport;

  const writeProject = (root: string, ownCompilerOptions: object = {}) => {
    const up = root
      .split('/')
      .map(() => '..')
      .join('/');

    tree.write(`${root}/project.json`, json({ name: root.split('/').slice(1).join('-') }));
    tree.write(
      `${root}/tsconfig.json`,
      json({
        compilerOptions: { target: 'es2022', useDefineForClassFields: false, ...ownCompilerOptions },
        files: [],
        include: [],
        references: [{ path: './tsconfig.lib.json' }, { path: './tsconfig.spec.json' }],
        extends: `${up}/tsconfig.base.json`,
      }),
    );
    tree.write(
      `${root}/tsconfig.lib.json`,
      json({ extends: './tsconfig.json', compilerOptions: { outDir: `${up}/dist/out-tsc`, declaration: true } }),
    );
    tree.write(
      `${root}/tsconfig.spec.json`,
      json({ extends: './tsconfig.json', compilerOptions: { module: 'commonjs', types: ['jest', 'node'] } }),
    );
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    report = new ToolkitMigrationReport();

    tree.write(
      'tsconfig.base.json',
      json({
        compilerOptions: {
          rootDir: '.',
          moduleResolution: 'node',
          baseUrl: '.',
          paths: {
            '@fifa-gg/env': ['libs/env/src/index.ts'],
            '@fifa-gg/queries': ['libs/queries/src/index.ts'],
            '@fifa-gg/types': ['libs/types/src/index.ts'],
            '@fifa-gg/uikit/mocks': ['libs/uikit/mocks/src/index.ts'],
            '@fifa-gg/uikit/common': ['libs/uikit/common/src/index.ts'],
          },
        },
      }),
    );

    writeProject('libs/types', { module: 'preserve', moduleResolution: 'bundler' });
    writeProject('libs/env');
    writeProject('libs/queries');
    writeProject('libs/uikit/mocks');
    writeProject('libs/uikit/common', { moduleResolution: 'bundler' });

    tree.write('libs/types/src/index.ts', `export * from './lib/interfaces';\n`);
    tree.write('libs/types/src/lib/interfaces/index.ts', `export * from './file.interfaces';\n`);
    tree.write(
      'libs/types/src/lib/interfaces/file.interfaces.ts',
      `import { ToolkitError as Error } from '@ethlete/query/ngrx-toolkit';\n\nexport interface FileState {\n  error: Error | null;\n}\n`,
    );
    tree.write('libs/env/src/index.ts', `export * from './lib/env';\n`);
    tree.write('libs/env/src/lib/env.ts', `import { Environment } from '@fifa-gg/types';\n`);
    tree.write('libs/queries/src/index.ts', `export * from './lib/gg-api/gg-api.client';\n`);
    tree.write('libs/queries/src/lib/gg-api/gg-api.client.ts', `import { ENVIRONMENT } from '@fifa-gg/env';\n`);
    tree.write('libs/uikit/mocks/src/index.ts', `export * from './lib/mocks';\n`);
    tree.write('libs/uikit/mocks/src/lib/mocks.ts', `import { MediaView } from '@fifa-gg/types';\n`);
    tree.write('libs/uikit/common/src/index.ts', `import { FileState } from '@fifa-gg/types';\n`);
  });

  it('names every node-resolving project that reaches the interop import through a path alias', () => {
    reportLegacyModuleResolution(
      tree,
      createModuleGraph(tree),
      ['libs/types/src/lib/interfaces/file.interfaces.ts'],
      report,
    );

    expect(report.tasks.map((task) => task.summary)).toEqual([
      'libs/env/tsconfig.lib.json resolves modules with `node` and reaches `@ethlete/query/ngrx-toolkit` through `@fifa-gg/types`.',
      'libs/env/tsconfig.spec.json resolves modules with `node` and reaches `@ethlete/query/ngrx-toolkit` through `@fifa-gg/types`.',
      'libs/queries/tsconfig.lib.json resolves modules with `node` and reaches `@ethlete/query/ngrx-toolkit` through `@fifa-gg/env`.',
      'libs/queries/tsconfig.spec.json resolves modules with `node` and reaches `@ethlete/query/ngrx-toolkit` through `@fifa-gg/env`.',
      'libs/uikit/mocks/tsconfig.lib.json resolves modules with `node` and reaches `@ethlete/query/ngrx-toolkit` through `@fifa-gg/types`.',
      'libs/uikit/mocks/tsconfig.spec.json resolves modules with `node` and reaches `@ethlete/query/ngrx-toolkit` through `@fifa-gg/types`.',
    ]);
  });
});
