import { cpSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Makes a temp checkout of `root`: every top-level entry but `.ethlete`, `.git` and `tmp` is a symlink, and
 * `.ethlete/design` is a copy. A run that writes fixtures there and is killed leaves nothing in `root`.
 */
export const tempCheckout = (root, prefix, temp = tmpdir()) => {
  const dir = mkdtempSync(join(temp, prefix));

  for (const entry of readdirSync(root)) {
    if (entry !== '.ethlete' && entry !== '.git' && entry !== 'tmp') symlinkSync(join(root, entry), join(dir, entry));
  }

  mkdirSync(join(dir, 'tmp'));
  cpSync(join(root, '.ethlete/design'), join(dir, '.ethlete/design'), { recursive: true });

  return dir;
};
