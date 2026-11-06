import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
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
      ['libs/queries/src/lib/team.facade.ts', 'libs/core/src/lib/roster.ts', 'libs/core/src/lib/plain.ts'],
      report,
    );

    expect(report.tasks.map((task) => [task.id, task.locations[0]!.filePath])).toEqual([
      [MODULE_RESOLUTION_TASK, 'libs/queries/tsconfig.lib.json'],
    ]);
    expect(report.tasks[0]!.summary).toContain('`node`');
  });

  it('ignores projects that do not import the interop', () => {
    reportLegacyModuleResolution(tree, ['libs/core/src/lib/plain.ts'], report);

    expect(report.tasks).toEqual([]);
  });
});
