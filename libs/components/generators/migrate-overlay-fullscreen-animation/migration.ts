import { Tree } from '@nx/devkit';
import {
  RemovedExportsMigrationSchema,
  runRemovedExportsMigration,
} from '../removed-exports/run-removed-exports-migration.js';
import { OVERLAY_FULLSCREEN_ANIMATION_REMOVALS } from './overlay-fullscreen-animation.js';

export const OVERLAY_FULLSCREEN_ANIMATION_REPORT_PATH = 'overlay-fullscreen-animation-migration-tasks.md';

export default async function migrateOverlayFullscreenAnimation(tree: Tree, schema: RemovedExportsMigrationSchema) {
  return runRemovedExportsMigration(tree, schema, {
    title: 'Removing the overlay fullscreen animation internals from @ethlete/components',
    removed: OVERLAY_FULLSCREEN_ANIMATION_REMOVALS,
    reportPath: OVERLAY_FULLSCREEN_ANIMATION_REPORT_PATH,
  });
}
