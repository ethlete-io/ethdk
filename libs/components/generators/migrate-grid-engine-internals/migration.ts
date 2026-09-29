import { Tree } from '@nx/devkit';
import {
  RemovedExportsMigrationSchema,
  runRemovedExportsMigration,
} from '../removed-exports/run-removed-exports-migration.js';
import { GRID_ENGINE_INTERNALS_REMOVALS } from './grid-engine-internals.js';

export const GRID_ENGINE_INTERNALS_REPORT_PATH = 'grid-engine-internals-migration-tasks.md';

export default async function migrateGridEngineInternals(tree: Tree, schema: RemovedExportsMigrationSchema) {
  return runRemovedExportsMigration(tree, schema, {
    title: 'Removing the grid engine internals from @ethlete/components',
    removed: GRID_ENGINE_INTERNALS_REMOVALS,
    reportPath: GRID_ENGINE_INTERNALS_REPORT_PATH,
  });
}
