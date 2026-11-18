import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const STUDIO_PLAN_DIR = 'plans/studio';
export const STUDIO_ROW_FILES = ['STATUS.md', 'queue.md', 'rows.md'];

/** The text of every Studio file that holds queue lines and table rows, STATUS.md first. */
export const studioRowsText = (root) =>
  STUDIO_ROW_FILES.map((name) => join(root, STUDIO_PLAN_DIR, name))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
