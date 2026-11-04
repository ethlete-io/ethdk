import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStatusRows } from './studio-status.mjs';

const FINDING_START = /^(\d+)\\\. /;
const DATE = /\b(\d{4})-(\d{2})-\d{2}\b/;

export const doneFindingNumbers = (rows) => {
  const open = new Set();
  const done = new Set();
  for (const row of rows) for (const n of row.findings) (row.done ? done : open).add(n);
  return new Set([...done].filter((n) => !open.has(n)));
};

export const splitFindings = (planText) => {
  const lines = planText.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const start = FINDING_START.exec(lines[i]);
    if (!start) {
      i++;
      continue;
    }
    let end = i + 1;
    while (end < lines.length && lines[end].trim() !== '' && !FINDING_START.test(lines[end])) end++;
    blocks.push({ number: Number(start[1]), from: i, to: end, lines: lines.slice(i, end) });
    i = end;
  }
  return blocks;
};

export const archiveFindings = (planText, statusText) => {
  const done = doneFindingNumbers(parseStatusRows(statusText));
  const lines = planText.split('\n');
  const moved = [];
  const drop = new Set();
  for (const block of splitFindings(planText)) {
    if (!done.has(block.number)) continue;
    const date = DATE.exec(block.lines.join('\n'));
    if (!date) continue;
    moved.push({ number: block.number, month: `${date[1]}-${date[2]}`, text: block.lines.join('\n') });
    let to = block.to;
    while (to < lines.length && lines[to].trim() === '' && block.from < to) to++;
    for (let n = block.from; n < to; n++) drop.add(n);
  }
  const plan = lines.filter((_, n) => !drop.has(n)).join('\n');
  return { plan, moved };
};

export const orphanFindings = (planText, statusText) => {
  const cited = new Set(parseStatusRows(statusText).flatMap((row) => [...row.findings]));
  return splitFindings(planText).flatMap((block) => {
    const date = DATE.exec(block.lines.join('\n'));
    if (!date || cited.has(block.number)) return [];
    const title = block.lines[0].replace(FINDING_START, '').slice(0, 100);
    return [{ number: block.number, title, date: date[0] }];
  });
};

export const writeArchive = (archiveDir, moved) => {
  mkdirSync(archiveDir, { recursive: true });
  const months = [...new Set(moved.map((m) => m.month))].sort();
  for (const month of months) {
    const file = join(archiveDir, `findings-${month}.md`);
    const body = moved
      .filter((m) => m.month === month)
      .map((m) => m.text)
      .join('\n\n');
    if (existsSync(file)) {
      appendFileSync(file, `\n${body}\n`);
    } else {
      writeFileSync(file, `# Findings ${month}\n\n${body}\n`);
    }
  }
};

export const run = (root) => {
  const studio = join(root, 'plans/ethlete-studio');
  const planFile = join(studio, 'design-to-code.md');
  const { plan, moved } = archiveFindings(
    readFileSync(planFile, 'utf8'),
    readFileSync(join(studio, 'STATUS.md'), 'utf8'),
  );
  writeArchive(join(studio, 'archive'), moved);
  writeFileSync(planFile, plan);
  return moved.length;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  if (process.argv.includes('--orphans')) {
    const studio = join(root, 'plans/ethlete-studio');
    const orphans = orphanFindings(
      readFileSync(join(studio, 'design-to-code.md'), 'utf8'),
      readFileSync(join(studio, 'STATUS.md'), 'utf8'),
    );
    for (const o of orphans) console.log(`${o.number}\t${o.date}\t${o.title}`);
    console.log(`${orphans.length} orphans`);
    process.exit(0);
  }
  console.log(`moved ${run(root)} findings`);
}
