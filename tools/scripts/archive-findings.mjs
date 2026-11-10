import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStatusRows } from './studio-status.mjs';

const FINDING_START = /^(\d+)\\\. /;
const DATE = /\b(\d{4})-(\d{2})-\d{2}\b/;
const DAY_MS = 86_400_000;

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

const BUILT_LINE = /^(As built|Built)\b/;
const HEADING = /^#/;

const extentOf = (lines, from) => {
  let to = from + 1;
  while (to < lines.length && !FINDING_START.test(lines[to]) && !HEADING.test(lines[to])) to++;
  while (to > from + 1 && lines[to - 1].trim() === '') to--;
  return to;
};

export const archiveFindings = (planText, statusText, { today, days = 5 } = {}) => {
  const rows = parseStatusRows(statusText);
  const done = doneFindingNumbers(rows);
  const cited = new Set(rows.flatMap((row) => [...row.findings]));
  const lines = planText.split('\n');
  const moved = [];
  const drop = new Set();
  for (const block of splitFindings(planText)) {
    const date = DATE.exec(block.lines.join('\n'));
    if (!date) continue;
    let text;
    let to;
    if (done.has(block.number)) {
      text = block.lines.join('\n');
      to = block.to;
    } else if (today && !cited.has(block.number) && (today - new Date(date[0])) / DAY_MS > days) {
      to = extentOf(lines, block.from);
      const extent = lines.slice(block.from, to);
      if (!extent.some((line) => BUILT_LINE.test(line))) continue;
      text = extent.join('\n');
    } else {
      continue;
    }
    moved.push({ number: block.number, month: `${date[1]}-${date[2]}`, text });
    while (to < lines.length && lines[to].trim() === '' && block.from < to) to++;
    for (let n = block.from; n < to; n++) drop.add(n);
  }
  const plan = lines.filter((_, n) => !drop.has(n)).join('\n');
  return { plan, moved };
};

const SECTION_START = /^#{2,3} /;

const sectionTitle = (heading) =>
  heading
    .replace(/^#+ /, '')
    .replace(/\s*\([^()]*\)\s*$/, '')
    .trim();

export const archiveSections = (planText, statusText, adrText, { today, days = 5 }) => {
  const rows = parseStatusRows(statusText);
  const done = doneFindingNumbers(rows);
  const openRows = rows
    .filter((row) => !row.done)
    .map((row) => row.text)
    .join('\n');
  const lines = planText.split('\n');
  const moved = [];
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const heading = lines[i];
    const date = heading.startsWith('### ') ? DATE.exec(heading) : null;
    if (!date) {
      out.push(lines[i++]);
      continue;
    }
    let end = i + 1;
    while (end < lines.length && !SECTION_START.test(lines[end])) end++;
    const body = lines.slice(i, end);
    const title = sectionTitle(heading);
    const age = (today - new Date(date[0])) / DAY_MS;
    const holdsOpenFinding = splitFindings(body.join('\n')).some((block) => !done.has(block.number));
    if (age <= days || holdsOpenFinding || openRows.includes(title) || adrText.includes(title)) {
      out.push(...body);
      i = end;
      continue;
    }
    const month = `${date[1]}-${date[2]}`;
    const text = body.join('\n').trimEnd();
    moved.push({ number: 0, month, text });
    out.push(`Archived: ${title} (${date[0]}), see [findings-${month}](archive/findings-${month}.md).`, '');
    i = end;
  }
  return { plan: out.join('\n'), moved };
};

export const readAdrText = (root) => {
  const dir = join(root, 'apps/ethlete-studio/docs/adr');
  if (!existsSync(dir)) return '';
  return readdirSync(dir)
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
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

export const run = (root, days = 5) => {
  const studio = join(root, 'plans/ethlete-studio');
  const planFile = join(studio, 'design-to-code.md');
  const statusText = readFileSync(join(studio, 'STATUS.md'), 'utf8');
  const today = new Date();
  const first = archiveFindings(readFileSync(planFile, 'utf8'), statusText, { today, days });
  const second = archiveSections(first.plan, statusText, readAdrText(root), { today, days });
  const moved = [...first.moved, ...second.moved];
  writeArchive(join(studio, 'archive'), moved);
  writeFileSync(planFile, second.plan);
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
  const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
  console.log(`moved ${run(root, daysArg ? Number(daysArg.slice(7)) : 5)} findings and sections`);
}
