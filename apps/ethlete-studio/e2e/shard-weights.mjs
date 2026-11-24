import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHARD_WEIGHTS_FILE = join(dirname(fileURLToPath(import.meta.url)), 'shard-weights.json');

const ROW = /^\s*(\d+(?:\.\d+)?)s {2}(\S+)\s+(.+?)\s*$/;

export const caseTimesOf = (log) => {
  const lines = log.split('\n').map((line) => line.replace(/^\S+Z /, ''));
  const start = lines.findIndex((line) => line.startsWith('Time per case, slowest first:'));

  if (start < 0) return [];

  const rows = [];

  for (const line of lines.slice(start + 1)) {
    const match = ROW.exec(line);

    if (!match) break;
    rows.push({ key: `${match[2]} :: ${match[3]}`, seconds: Number(match[1]) });
  }

  return rows;
};

const medianOf = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = sorted.length >> 1;

  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const weightsOf = (logs) => {
  const byKey = Object.groupBy(
    logs.flatMap((log) => caseTimesOf(log)),
    (row) => row.key,
  );

  return Object.fromEntries(
    Object.entries(byKey)
      .map(([key, rows]) => [key, Math.round(medianOf(rows.map((row) => row.seconds)) * 10) / 10])
      .toSorted(([a], [b]) => a.localeCompare(b)),
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const logs = process.argv.slice(2);

  if (!logs.length) {
    console.error(
      'usage: node shard-weights.mjs <studio e2e log>... (writes the median case times to shard-weights.json)',
    );
    process.exit(2);
  }

  const weights = weightsOf(logs.map((file) => readFileSync(file, 'utf8')));

  writeFileSync(SHARD_WEIGHTS_FILE, `${JSON.stringify(weights, null, 2)}\n`);
  console.log(`${Object.keys(weights).length} case weights from ${logs.length} log(s) -> ${SHARD_WEIGHTS_FILE}`);
}
