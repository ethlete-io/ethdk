import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandFor } from './spec-stress.mjs';

/** Names in `after` that are not in `before`, sorted. */
export const newEntries = (before, after) => {
  const seen = new Set(before);
  return after.filter((name) => !seen.has(name)).sort();
};

/** One line per spec that left entries, naming up to `limit` of them. */
export const reportLines = (results, limit = 5) =>
  results
    .filter(({ leaked }) => leaked.length)
    .map(({ spec, leaked }) => {
      const shown = leaked.slice(0, limit).join(', ');
      const more = leaked.length > limit ? `, +${leaked.length - limit} more` : '';
      return `${spec}: ${leaked.length} new ${tmpdir()} entries (${shown}${more})`;
    });

const main = () => {
  const specs = process.argv.slice(2);
  if (!specs.length) {
    console.error('usage: yarn spec:tmp-leaks <spec file>...');
    process.exit(2);
  }
  const repo = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const results = specs.map((spec) => {
    const before = readdirSync(tmpdir());
    const [cmd, args] = commandFor(repo, spec);
    const run = spawnSync(cmd, args, { cwd: repo, stdio: ['ignore', 'ignore', 'inherit'] });
    if (run.status !== 0) console.error(`${spec}: spec failed (exit ${run.status ?? run.signal})`);
    return { spec, leaked: newEntries(before, readdirSync(tmpdir())) };
  });
  const lines = reportLines(results);
  for (const line of lines) console.error(line);
  if (lines.length) process.exit(1);
  console.log(`${specs.length} spec file(s) left no new ${tmpdir()} entries`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
