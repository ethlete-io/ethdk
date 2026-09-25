import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ignoredByGit } from '../api/git';

export const UPDATE_IGNORE_ENTRY = '.ethlete/update/';

export const ignoreUpdateDir = (root: string) => {
  if (ignoredByGit(root, `${UPDATE_IGNORE_ENTRY}pending.json`) !== false) return false;

  const path = join(root, '.gitignore');
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const separator = current.length === 0 || current.endsWith('\n') ? '' : '\n';

  writeFileSync(path, `${current}${separator}${UPDATE_IGNORE_ENTRY}\n`, 'utf8');

  return true;
};
