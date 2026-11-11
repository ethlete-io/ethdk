import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const KEPT = 5;
let counter = 0;

export const startRunLog = (base, log = console.log) => {
  const dir = dirname(base);
  const stem = basename(base).replace(/\.log$/, '');
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  const file = join(dir, `${stem}-${stamp}-${process.pid}-${counter++}.log`);

  mkdirSync(dir, { recursive: true });
  writeFileSync(file, '');
  writeFileSync(base, `latest run log: ${file}\n`);

  const older = readdirSync(dir)
    .filter((name) => name.startsWith(`${stem}-`) && name.endsWith('.log'))
    .sort()
    .slice(0, -KEPT);

  for (const name of older) rmSync(join(dir, name), { force: true });

  log(`run log: ${file}`);

  return file;
};
