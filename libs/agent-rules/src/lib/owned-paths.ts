import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const OWNED_DIRECTORIES = ['.agents/ethlete', '.claude/rules/ethlete'];
const OWNED_PARENTS = [
  { dir: '.claude/skills', match: (entry: string) => entry.startsWith('ethlete-') },
  { dir: '.cursor/rules', match: (entry: string) => entry.startsWith('ethlete-') && entry.endsWith('.mdc') },
  {
    dir: '.github/instructions',
    match: (entry: string) => entry.startsWith('ethlete-') && entry.endsWith('.instructions.md'),
  },
];

const walk = (root: string, absoluteDir: string): string[] => {
  if (!existsSync(absoluteDir)) return [];

  return readdirSync(absoluteDir).flatMap((entry) => {
    const absolute = join(absoluteDir, entry);

    if (statSync(absolute).isDirectory()) return walk(root, absolute);

    return [relative(root, absolute).split(sep).join('/')];
  });
};

/**
 * Everything the generator owns lives under an `ethlete` directory or an `ethlete-` prefix, so a
 * file that disappears from the package can be pruned without ever touching a hand-written one.
 * Marker-block files (`AGENTS.md`, `copilot-instructions.md`) are deliberately absent: those are
 * shared with the repo and are only ever edited between the markers.
 */
export const collectOwnedPaths = (root: string) => {
  const owned = OWNED_DIRECTORIES.flatMap((dir) => walk(root, join(root, dir)));

  for (const parent of OWNED_PARENTS) {
    const absoluteParent = join(root, parent.dir);

    if (!existsSync(absoluteParent)) continue;

    for (const entry of readdirSync(absoluteParent)) {
      if (!parent.match(entry)) continue;

      const absolute = join(absoluteParent, entry);

      owned.push(...(statSync(absolute).isDirectory() ? walk(root, absolute) : [`${parent.dir}/${entry}`]));
    }
  }

  return owned;
};
