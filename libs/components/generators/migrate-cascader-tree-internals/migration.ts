import { Tree } from '@nx/devkit';
import {
  RemovedExportsMigrationSchema,
  runRemovedExportsMigration,
} from '../removed-exports/run-removed-exports-migration.js';
import { CASCADER_TREE_INTERNALS_REMOVALS } from './cascader-tree-internals.js';

export const CASCADER_TREE_INTERNALS_REPORT_PATH = 'cascader-tree-internals-migration-tasks.md';

export default async function migrateCascaderTreeInternals(tree: Tree, schema: RemovedExportsMigrationSchema) {
  await runRemovedExportsMigration(tree, schema, {
    title: 'Removing the cascader tree helpers from @ethlete/components',
    removed: CASCADER_TREE_INTERNALS_REMOVALS,
    reportPath: CASCADER_TREE_INTERNALS_REPORT_PATH,
  });
}
