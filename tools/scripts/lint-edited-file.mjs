#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { projectDirOf } from './lint-staged-files.mjs';

const root = resolve(import.meta.dirname, '../..');
const LINTED = /^(libs|apps)\/.+\.(ts|mjs|js)$/;

export const lintTargetOf = (hookInput, exists) => {
  const path = hookInput?.tool_input?.file_path;
  if (typeof path !== 'string') return undefined;
  const file = relative(root, resolve(root, path));
  if (!LINTED.test(file)) return undefined;
  const dir = projectDirOf(file, exists);
  return dir ? { dir, file: relative(dir, file) } : undefined;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = lintTargetOf(JSON.parse(readFileSync(0, 'utf8') || '{}'));
  if (!target) process.exit(0);
  const run = spawnSync(join(root, 'node_modules/.bin/eslint'), ['--no-warn-ignored', target.file], {
    cwd: join(root, target.dir),
    encoding: 'utf8',
  });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim();
  if (!output) process.exit(0);
  process.stderr.write(`ESLint on ${join(target.dir, target.file)}:\n${output}\n`);
  process.exit(2);
}
