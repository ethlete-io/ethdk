import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUEUE_HEADING = /^### Warteschlange\s*$/;
const HEADING = /^#{1,6} /;
const QUEUE_ITEM = /^\d+\. \*\*([A-Z]\d+)\*\*/;

export const queueLines = (statusText) => {
  const lines = statusText.split('\n');
  const start = lines.findIndex((line) => QUEUE_HEADING.test(line));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => HEADING.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).filter((line) => QUEUE_ITEM.test(line));
};

export const rowOf = (statusText, id) => statusText.split('\n').find((line) => line.startsWith(`| ${id} |`)) ?? null;

const main = (argv) => {
  const statusPath = resolve(fileURLToPath(new URL('../../plans/ethlete-studio/STATUS.md', import.meta.url)));
  const statusText = readFileSync(statusPath, 'utf8');
  const id = argv[0];
  if (id) {
    const row = rowOf(statusText, id);
    if (!row) {
      process.stderr.write(`No row ${id} in plans/ethlete-studio/STATUS.md.\n`);
      return 1;
    }
    process.stdout.write(`${row.replace(/\s{2,}/g, ' ')}\n`);
    return 0;
  }
  const queue = queueLines(statusText);
  if (queue.length === 0) {
    process.stderr.write('No queue found: plans/ethlete-studio/STATUS.md has no "### Warteschlange" list.\n');
    return 1;
  }
  process.stdout.write(`${queue.join('\n')}\n`);
  return 0;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exit(main(process.argv.slice(2)));
