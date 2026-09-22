#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const listFiles = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? listFiles(path) : [path];
    });

const [dir] = process.argv.slice(2);
if (!dir) {
  process.stderr.write('Usage: hash.mjs <dir>\n');
  process.exit(1);
}

const root = resolve(dir);
const hash = createHash('sha256');
for (const file of listFiles(root)) {
  hash.update(relative(root, file).split(sep).join('/'));
  hash.update('\0');
  hash.update(readFileSync(file));
  hash.update('\0');
}
process.stdout.write(`${hash.digest('hex')}\n`);
