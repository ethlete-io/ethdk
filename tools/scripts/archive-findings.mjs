import { spawnSync } from 'node:child_process';
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
const AS_BUILT = /(?:^|[.;:] )As built\b/;
const BUILT_SHA = /(?:^|[.;:!?] )Built in ([0-9a-f]{7,40})\./g;

export const isPushedSha = (sha, root = process.cwd()) =>
  spawnSync('git', ['merge-base', '--is-ancestor', sha, 'origin/next'], { cwd: root }).status === 0;

const isBuiltLine = (line, isPushed) =>
  BUILT_LINE.test(line) || AS_BUILT.test(line) || [...line.matchAll(BUILT_SHA)].some((match) => isPushed(match[1]));
const namedIn = (text, number) => new RegExp(`(?<![\\d.])${number}(?![\\d])`).test(text);
const HEADING = /^#/;

const extentOf = (lines, from) => {
  let to = from + 1;
  while (to < lines.length && !FINDING_START.test(lines[to]) && !HEADING.test(lines[to])) to++;
  while (to > from + 1 && lines[to - 1].trim() === '') to--;
  return to;
};

const BACKLOG_HEAD = '**Werkzeug-Rückstand**';
export const BACKLOG_WHERE = 'STATUS.md Werkzeug-Rückstand';
const BACKLOG_NUMBER = /(?<![\w.])(?<!ADR )(\d+)(?:-(\d+))?(?![\w])/g;

/** Finding numbers the tool backlog paragraph of STATUS.md names, ranges like `628-633` expanded. */
export const backlogNumbers = (statusText) => {
  const lines = statusText.split('\n');
  const from = lines.findIndex((line) => line.startsWith(BACKLOG_HEAD));
  if (from < 0) return new Set();
  let to = from + 1;
  while (to < lines.length && !lines[to].startsWith('**') && !HEADING.test(lines[to])) to++;
  const text = lines
    .slice(from, to)
    .join('\n')
    .replace(/`[^`]*`/g, '');
  const numbers = new Set();
  for (const [, first, last] of text.matchAll(BACKLOG_NUMBER)) {
    const end = last !== undefined && Number(last) - Number(first) < 50 ? Number(last) : Number(first);
    for (let n = Number(first); n <= end; n++) numbers.add(n);
  }
  return numbers;
};

export const STAY_REASONS = {
  open: 'open in STATUS',
  named: 'named in STATUS outside a row and the backlog',
  unbuilt: 'no built line, no backlog row',
};

export const archiveFindings = (planText, statusText, { today, days = 5, isPushed = isPushedSha } = {}) => {
  const rows = parseStatusRows(statusText);
  const done = doneFindingNumbers(rows);
  const cited = new Set(rows.flatMap((row) => [...row.findings]));
  const backlog = backlogNumbers(statusText);
  const lines = planText.split('\n');
  const moved = [];
  const stays = [];
  const drop = new Set();
  const index = new Map();
  for (const block of splitFindings(planText)) {
    const date = DATE.exec(block.lines.join('\n'));
    if (!date) continue;
    const old = Boolean(today) && (today - new Date(date[0])) / DAY_MS > days;
    const month = `${date[1]}-${date[2]}`;
    const stay = (reason) => {
      if (old) stays.push({ number: block.number, reason });
    };
    let text;
    let to;
    if (done.has(block.number)) {
      text = block.lines.join('\n');
      to = block.to;
    } else if (cited.has(block.number)) {
      stay(STAY_REASONS.open);
      continue;
    } else if (old && backlog.has(block.number)) {
      to = extentOf(lines, block.from);
      moved.push({ number: block.number, month, text: lines.slice(block.from, to).join('\n') });
      index.set(block.from, `${block.number} -> archive/findings-${month}.md, backlog ${BACKLOG_WHERE}`);
      for (let n = block.from + 1; n < to; n++) drop.add(n);
      continue;
    } else if (!namedIn(statusText, block.number)) {
      to = extentOf(lines, block.from);
      const extent = lines.slice(block.from, to);
      const builtLines = extent.filter((line) => isBuiltLine(line, isPushed));
      if (!builtLines.length) {
        stay(STAY_REASONS.unbuilt);
        continue;
      }
      if (!old && !builtLines.some((line) => namedIn(line, block.number))) continue;
      text = extent.join('\n');
    } else {
      stay(STAY_REASONS.named);
      continue;
    }
    moved.push({ number: block.number, month, text });
    while (to < lines.length && lines[to].trim() === '' && block.from < to) to++;
    for (let n = block.from; n < to; n++) drop.add(n);
  }
  const plan = lines.flatMap((line, n) => (index.has(n) ? [index.get(n)] : drop.has(n) ? [] : [line])).join('\n');
  return { plan, moved, stays };
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

const USAGE = `usage: node tools/scripts/archive-findings.mjs [--days=<n>] [--dry-run] [--orphans] [--help]
  moves done findings and old decision sections of plans/ethlete-studio/design-to-code.md into archive/
  --days=<n>  age in days an orphan finding (no STATUS row) must reach to move by a built line or a
              tool-backlog entry in STATUS.md, and a decision section to move (default 5)
  --dry-run   list what would move and why each old finding stays, write nothing
  --orphans   list old findings with no STATUS row, write nothing`;

const planMoves = (root, days) => {
  const studio = join(root, 'plans/ethlete-studio');
  const planFile = join(studio, 'design-to-code.md');
  const statusText = readFileSync(join(studio, 'STATUS.md'), 'utf8');
  const today = new Date();
  const first = archiveFindings(readFileSync(planFile, 'utf8'), statusText, { today, days });
  const second = archiveSections(first.plan, statusText, readAdrText(root), { today, days });

  const before = readFileSync(planFile, 'utf8').length;
  return {
    studio,
    planFile,
    plan: second.plan,
    moved: [...first.moved, ...second.moved],
    stays: first.stays,
    freed: before - second.plan.length,
  };
};

const logStays = (stays, log) => {
  for (const s of stays) log(`stays\t${s.number}\t${s.reason}`);
  const counts = Map.groupBy(stays, (s) => s.reason);
  for (const [reason, list] of counts) log(`${list.length} stay: ${reason}`);
};

export const run = (root, days = 5, log = console.log) => {
  const { studio, planFile, plan, moved, stays } = planMoves(root, days);
  writeArchive(join(studio, 'archive'), moved);
  writeFileSync(planFile, plan);
  logStays(stays, log);
  return moved.length;
};

const DAYS_ARG = /^--days=(\d+)$/;
const KNOWN = new Set(['--help', '--dry-run', '--orphans']);

export const main = (argv, { root, log = console.log }) => {
  const unknown = argv.filter((arg) => !KNOWN.has(arg) && !DAYS_ARG.test(arg));
  if (argv.includes('--help') || unknown.length > 0) {
    if (unknown.length > 0) log(`unknown argument: ${unknown.join(' ')}`);
    log(USAGE);
    return unknown.length > 0 ? 2 : 0;
  }
  if (argv.includes('--orphans')) {
    const studio = join(root, 'plans/ethlete-studio');
    const orphans = orphanFindings(
      readFileSync(join(studio, 'design-to-code.md'), 'utf8'),
      readFileSync(join(studio, 'STATUS.md'), 'utf8'),
    );
    for (const o of orphans) log(`${o.number}\t${o.date}\t${o.title}`);
    log(`${orphans.length} orphans`);
    return 0;
  }
  const daysArg = argv.find((arg) => DAYS_ARG.test(arg));
  const days = daysArg ? Number(daysArg.slice(7)) : 5;
  if (argv.includes('--dry-run')) {
    const { moved, stays, freed } = planMoves(root, days);
    for (const m of moved) log(`${m.month}\t${m.text.split('\n')[0].slice(0, 100)}`);
    logStays(stays, log);
    log(`would move ${moved.length} findings and sections, freeing ${freed} chars`);
    return 0;
  }
  log(`moved ${run(root, days, log)} findings and sections`);
  return 0;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  process.exitCode = main(process.argv.slice(2), { root });
}
