import { Tree } from '@nx/devkit';
import {
  RemovedExportsMigrationSchema,
  runRemovedExportsMigration,
} from '../removed-exports/run-removed-exports-migration.js';
import { YOUTUBE_PLAYER_SLOT_DIRECTIVE_REMOVALS } from './youtube-player-slot-directive.js';

export const YOUTUBE_PLAYER_SLOT_DIRECTIVE_REPORT_PATH = 'youtube-player-slot-directive-migration-tasks.md';

export default async function migrateYoutubePlayerSlotDirective(tree: Tree, schema: RemovedExportsMigrationSchema) {
  return runRemovedExportsMigration(tree, schema, {
    title: 'Removing YoutubePlayerSlotDirective and YOUTUBE_PLAYER_SLOT_TOKEN',
    removed: YOUTUBE_PLAYER_SLOT_DIRECTIVE_REMOVALS,
    reportPath: YOUTUBE_PLAYER_SLOT_DIRECTIVE_REPORT_PATH,
  });
}
