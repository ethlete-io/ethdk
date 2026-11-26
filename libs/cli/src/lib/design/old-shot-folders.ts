import { readdir, rm } from 'fs/promises';
import { join } from 'path';

const OLD_SHOT_FOLDER = /^shots-[0-9a-f]{10}$/;

/** Removes the path-keyed `shots-<10 hex>` folders an earlier store left in the work root; logs one line for each it cannot remove. */
export const removeOldShotFolders = async (workRoot: string) => {
  const entries = await readdir(workRoot, { withFileTypes: true }).catch(() => []);

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && OLD_SHOT_FOLDER.test(entry.name))
      .map((entry) =>
        rm(join(workRoot, entry.name), { recursive: true, force: true }).catch((error: unknown) => {
          console.error(`design-explore: could not remove ${entry.name}: ${(error as Error).message}`);
        }),
      ),
  );
};
