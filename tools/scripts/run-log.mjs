import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const KEPT = 5;
const STAMP = String.raw`\d{8}T\d{9}Z-\d+-\d+`;
let counter = 0;

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const startRunLog = (base, log = console.log) => {
  const dir = dirname(base);
  const stem = basename(base).replace(/\.log$/, '');
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  const file = join(dir, `${stem}-${stamp}-${process.pid}-${counter++}.log`);

  mkdirSync(dir, { recursive: true });
  writeFileSync(file, '');
  writeFileSync(base, `latest run log: ${file}\n`);

  const rotating = new RegExp(`^${escape(stem)}-${STAMP}\\.log$`);
  const older = readdirSync(dir)
    .filter((name) => rotating.test(name))
    .sort()
    .slice(0, -KEPT);

  for (const name of older) rmSync(join(dir, name), { force: true });

  log(`run log: ${file}`);

  return file;
};

export const markRunLogFailed = (file) => {
  const dir = dirname(file);
  const name = basename(file);
  const match = new RegExp(`^(.+)-${STAMP}\\.log$`).exec(name);
  if (!match) return file;

  const failed = join(dir, name.replace(/\.log$/, '-failed.log'));
  renameSync(file, failed);

  const base = join(dir, `${match[1]}.log`);
  try {
    if (readFileSync(base, 'utf8') === `latest run log: ${file}\n`) writeFileSync(base, `latest run log: ${failed}\n`);
  } catch {
    // base missing: nothing to repoint
  }

  return failed;
};
