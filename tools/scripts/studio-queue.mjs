import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { studioRowsText } from './studio-plan.mjs';

const QUEUE_HEADING = /^### Warteschlange(, Rest)?\s*$/;
const HEADING = /^#{1,6} /;
const QUEUE_ITEM = /^\d+\. \*\*(?:.+ \()?[A-Z]\d+b?\)?\*\*/;
const BARE_ITEM = /^\d+\. \*\*[A-Z]\d+b?\*\*/;

export const queueLines = (statusText) => {
  const queue = [];
  let inQueue = false;
  for (const line of statusText.split('\n')) {
    if (HEADING.test(line)) inQueue = QUEUE_HEADING.test(line);
    else if (inQueue && QUEUE_ITEM.test(line)) queue.push(line);
  }
  return queue;
};

export const bareQueueLines = (queue) => queue.filter((line) => BARE_ITEM.test(line));

export const rowOf = (statusText, id) => statusText.split('\n').find((line) => line.startsWith(`| ${id} |`)) ?? null;

export const rowWithName = (row) => {
  const [id, name] = row
    .split('|')
    .slice(1, 3)
    .map((cell) => cell.trim());
  return name ? `${name} (${id}): ${row}` : row;
};

const main = (argv) => {
  const statusText = studioRowsText(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  const id = argv[0];
  if (id) {
    const row = rowOf(statusText, id);
    if (!row) {
      process.stderr.write(`No row ${id} in plans/studio/STATUS.md, queue.md or rows.md.\n`);
      return 1;
    }
    process.stdout.write(`${rowWithName(row.replace(/\s{2,}/g, ' '))}\n`);
    return 0;
  }
  const queue = queueLines(statusText);
  if (queue.length === 0) {
    process.stderr.write('No queue found: plans/studio/STATUS.md has no "### Warteschlange" list.\n');
    return 1;
  }
  const bare = bareQueueLines(queue);
  if (bare.length)
    process.stderr.write(
      `${bare.length} queue lines have no short name: ${bare.map((line) => line.match(/B\d+b?/)[0]).join(' ')}\n`,
    );
  process.stdout.write(`${queue.join('\n')}\n`);
  return 0;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exit(main(process.argv.slice(2)));
