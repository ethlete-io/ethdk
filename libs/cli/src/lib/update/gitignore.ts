import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ignoredByGit } from '../api/git';

export const UPDATE_IGNORE_ENTRY = '.ethlete/update/';

/** Appends `entry` to `.gitignore` unless git ignores `probe` already. True when it wrote the line. */
export const ignoreEntry = (options: { root: string; entry: string; probe?: string }) => {
  const { root, entry, probe = entry } = options;

  if (ignoredByGit(root, probe) !== false) return false;

  const path = join(root, '.gitignore');
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const separator = current.length === 0 || current.endsWith('\n') ? '' : '\n';

  writeFileSync(path, `${current}${separator}${entry}\n`, 'utf8');

  return true;
};

export const ignoreUpdateDir = (root: string) =>
  ignoreEntry({ root, entry: UPDATE_IGNORE_ENTRY, probe: `${UPDATE_IGNORE_ENTRY}pending.json` });
