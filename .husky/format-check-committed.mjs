#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const [base, head] = process.argv.slice(2);

if (!base || !head) {
  console.error('usage: format-check-committed.mjs <base> <head>');
  process.exit(2);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const ignorePath = resolve(root, '.prettierignore');
const files = git('diff', '--name-only', '--no-renames', '--diff-filter=d', '-z', base, head)
  .split('\0')
  .filter(Boolean);

const results = await Promise.all(
  files.map(async (file) => {
    const filepath = resolve(root, file);
    const { ignored, inferredParser } = await prettier.getFileInfo(filepath, { ignorePath, resolveConfig: true });

    if (ignored || !inferredParser) return null;

    const options = { ...(await prettier.resolveConfig(filepath)), filepath };
    const source = git('show', `${head}:${file}`);

    return (await prettier.check(source, options)) ? null : file;
  }),
);

const unformatted = results.filter(Boolean);

if (unformatted.length > 0) {
  console.error(`Not formatted in ${head.slice(0, 9)} (run \`npx prettier --write\` and commit):`);
  unformatted.forEach((file) => console.error(`  ${file}`));
  process.exit(1);
}

console.log(`✔ ${files.length} changed file(s) formatted.`);
