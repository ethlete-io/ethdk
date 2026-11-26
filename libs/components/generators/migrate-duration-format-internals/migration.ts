import { Tree } from '@nx/devkit';
import {
  RemovedExportsMigrationSchema,
  runRemovedExportsMigration,
} from '../removed-exports/run-removed-exports-migration.js';
import { DURATION_FORMAT_INTERNALS_REMOVALS } from './duration-format-internals.js';

export const DURATION_FORMAT_INTERNALS_REPORT_PATH = 'duration-format-internals-migration-tasks.md';

export default async function migrateDurationFormatInternals(tree: Tree, schema: RemovedExportsMigrationSchema) {
  await runRemovedExportsMigration(tree, schema, {
    title: 'Removing the duration format helpers from @ethlete/components',
    removed: DURATION_FORMAT_INTERNALS_REMOVALS,
    reportPath: DURATION_FORMAT_INTERNALS_REPORT_PATH,
  });
}
