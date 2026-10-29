import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const entriesOf = (dir: string) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []);
const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory();

/** Renames every staged file over its built twin, so a reader never finds the build missing. */
export const moveIntoPlace = (staging: string, target: string) => {
  mkdirSync(target, { recursive: true });

  const staged = entriesOf(staging);
  const stagedNames = new Set(staged.map((entry) => entry.name));

  for (const entry of staged) {
    const from = join(staging, entry.name);
    const to = join(target, entry.name);

    if (entry.isDirectory()) {
      if (existsSync(to) && !isDirectory(to)) rmSync(to);
      moveIntoPlace(from, to);
    } else {
      if (isDirectory(to)) rmSync(to, { recursive: true });
      renameSync(from, to);
    }
  }

  for (const entry of entriesOf(target)) {
    if (!stagedNames.has(entry.name)) rmSync(join(target, entry.name), { recursive: true, force: true });
  }

  rmSync(staging, { recursive: true, force: true });
};

if (import.meta.main) {
  const [staging, target] = process.argv.slice(2);

  if (!staging || !target) throw new Error('usage: move-into-place.mts <staging> <target>');

  moveIntoPlace(resolve(staging), resolve(target));
}
