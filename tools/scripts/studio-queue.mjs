import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { studioRowsText } from './studio-plan.mjs';

const QUEUE_HEADING = /^### Warteschlange(, Rest)?\s*$/;
const HEADING = /^#{1,6} /;
const QUEUE_ITEM = /^\d+\. \*\*([A-Z]\d+)\*\*/;

export const queueLines = (statusText) => {
  const queue = [];
  let inQueue = false;
  for (const line of statusText.split('\n')) {
    if (HEADING.test(line)) inQueue = QUEUE_HEADING.test(line);
    else if (inQueue && QUEUE_ITEM.test(line)) queue.push(line);
  }
  return queue;
};

export const rowOf = (statusText, id) => statusText.split('\n').find((line) => line.startsWith(`| ${id} |`)) ?? null;

const main = (argv) => {
  const statusText = studioRowsText(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  const id = argv[0];
  if (id) {
    const row = rowOf(statusText, id);
    if (!row) {
      process.stderr.write(`No row ${id} in plans/studio/STATUS.md, queue.md or rows.md.\n`);
      return 1;
    }
    process.stdout.write(`${row.replace(/\s{2,}/g, ' ')}\n`);
    return 0;
  }
  const queue = queueLines(statusText);
  if (queue.length === 0) {
    process.stderr.write('No queue found: plans/studio/STATUS.md has no "### Warteschlange" list.\n');
    return 1;
  }
  process.stdout.write(`${queue.join('\n')}\n`);
  return 0;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exit(main(process.argv.slice(2)));
