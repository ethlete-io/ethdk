import { Tree } from '@nx/devkit';
import {
  RemovedExportsMigrationSchema,
  runRemovedExportsMigration,
} from '../removed-exports/run-removed-exports-migration.js';
import { REMOVED_SELECTORS, replaceSetActiveSide, TIME_PICKER_RING_REMOVALS } from './time-picker-ring.js';

export const TIME_PICKER_RING_REPORT_PATH = 'time-picker-ring-migration-tasks.md';

export default async function migrateTimePickerRing(tree: Tree, schema: RemovedExportsMigrationSchema) {
  await runRemovedExportsMigration(tree, schema, {
    title: 'Moving the time picker to the ring API',
    removed: TIME_PICKER_RING_REMOVALS,
    reportPath: TIME_PICKER_RING_REPORT_PATH,
    rewrite: (_tree, filePath, content) => {
      if (REMOVED_SELECTORS.test(content)) {
        console.warn(
          `\n⚠️  ${filePath} uses etTimePickerColumn or etTimePickerOption, which are removed. See the time picker guide: /components/time-picker.`,
        );
      }

      return replaceSetActiveSide(content);
    },
  });
}
