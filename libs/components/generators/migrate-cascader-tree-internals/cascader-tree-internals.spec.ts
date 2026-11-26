import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import { MIGRATION_TODO, migrateRemovedExportsInFile } from '../removed-exports/removed-exports';
import { CASCADER_TREE_INTERNALS_REMOVALS } from './cascader-tree-internals';
import migrateCascaderTreeInternals, { CASCADER_TREE_INTERNALS_REPORT_PATH } from './migration';

const FILE = 'apps/shop/src/app/places.ts';

const migrate = (content: string) => migrateRemovedExportsInFile(FILE, content, CASCADER_TREE_INTERNALS_REMOVALS);

describe('migrate-cascader-tree-internals', () => {
  it('keeps the exports that stay public', () => {
    const source =
      "import { canHaveChildren, defaultCompareWith, type CascaderNode, type CascaderDataSource } from '@ethlete/components';";

    expect(migrate(source).next).toBeNull();
  });

  it('marks the use of a helper it cannot rewrite', () => {
    const { next, tasks } = migrate(
      [
        "import { CascaderDataSource, toChildrenObservable } from '@ethlete/components';",
        '',
        'export const source: CascaderDataSource<string> = { loadChildren: () => toChildrenObservable([]) };',
      ].join('\n'),
    );

    expect(next).toContain("import { CascaderDataSource, toChildrenObservable } from '@ethlete/components';");
    expect(next).toContain(`// ${MIGRATION_TODO}: toChildrenObservable is no longer exported`);
    expect(tasks.map((task) => task.name)).toEqual(['toChildrenObservable']);
  });

  it('leaves the same names imported from elsewhere alone', () => {
    expect(migrate("import { nodesEqual } from './tree';").next).toBeNull();
  });

  it('writes a report for the uses it marked', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      FILE,
      [
        "import { indexOfNode, defaultCompareWith } from '@ethlete/components';",
        'export const index = indexOfNode({ nodes: [], node: null, compareWith: defaultCompareWith });',
        '',
      ].join('\n'),
    );

    await migrateCascaderTreeInternals(tree, { skipFormat: true });

    expect(tree.read(FILE, 'utf-8')).toContain(MIGRATION_TODO);
    expect(tree.read(CASCADER_TREE_INTERNALS_REPORT_PATH, 'utf-8')).toContain('indexOfNode');
  });
});
