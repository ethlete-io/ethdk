#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

export const projectDirOf = (file, exists = existsSync) => {
  const parts = file.split('/');
  const dir = parts.slice(0, 2).join('/');
  return parts.length > 2 && exists(join(root, dir, 'eslint.config.mjs')) ? dir : undefined;
};

export const groupByProject = (files, exists = existsSync) => {
  const groups = new Map();
  for (const file of files) {
    const dir = projectDirOf(file, exists);
    if (dir) groups.set(dir, [...(groups.get(dir) ?? []), relative(dir, file)]);
  }
  return groups;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  let status = 0;
  for (const [dir, files] of groupByProject(process.argv.slice(2))) {
    const run = spawnSync('npx', ['eslint', '--no-warn-ignored', ...files], {
      cwd: join(root, dir),
      stdio: 'inherit',
    });
    if (run.status !== 0) status = 1;
  }
  process.exit(status);
}
