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
const namedIn = (text, number) => new RegExp(`(?<![\\w.])${number}(?![\\w])`).test(text);
const HEADING = /^#/;

const PARAGRAPH_LEAD = /^(\d{3,4}(?: \+ \d{3,4})*)(?![\w\\.])(.*)$/;
const DONE_FORM = /^ (?:built|closed|withdrawn|as built)\b/;
const SHA = /(?<!\w)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}(?!\w)/g;

const paragraphLead = (lines, n) => {
  if (n > 0 && lines[n - 1].trim() !== '') return null;
  const match = PARAGRAPH_LEAD.exec(lines[n]);
  return match ? { numbers: match[1].split(' + ').map(Number), rest: match[2] } : null;
};

/** Paragraphs that start with a finding number ("957 built (Linux, 01f0cd0c6): ..."), in file order. */
export const findingParagraphs = (planText) => {
  const lines = planText.split('\n');
  const paragraphs = [];
  for (let n = 0; n < lines.length; n++) {
    const lead = paragraphLead(lines, n);
    if (!lead) continue;
    let to = n + 1;
    while (to < lines.length && lines[to].trim() !== '' && !FINDING_START.test(lines[to]) && !HEADING.test(lines[to]))
      to++;
    const shas = (/\(([^)]*)\)/.exec(lines[n])?.[1] ?? '').match(SHA) ?? [];
    paragraphs.push({ ...lead, from: n, to, done: DONE_FORM.test(lead.rest), shas });
  }
  return paragraphs;
};

const PARKED_NUMBER = /^- .*?\((?:[^()]*, )?(\d{3,4})\)/;

/** Finding numbers parked-suspects.md lists, one per "- name (Machine, NNN): ..." line. */
export const parkedNumbers = (parkedText) =>
  new Set(
    parkedText.split('\n').flatMap((line) => {
      const match = PARKED_NUMBER.exec(line);
      return match ? [Number(match[1])] : [];
    }),
  );

const extentOf = (lines, from, number) => {
  let to = from + 1;
  while (to < lines.length && !FINDING_START.test(lines[to]) && !HEADING.test(lines[to])) {
    const lead = paragraphLead(lines, to);
    if (lead && !lead.numbers.includes(number)) break;
    to++;
  }
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
  unbuilt: 'no built, closed or withdrawn paragraph, no built line, not parked, no backlog row',
  unpushed: 'its built paragraph names a sha that is not on origin/next',
  reopened: 'a later paragraph follows its built, closed or withdrawn one',
  undated: 'no date in the finding',
};

const closedByParagraph = (number, paragraphs, parked, isPushed) => {
  const own = paragraphs.filter((p) => p.numbers.includes(number));
  const done = own.filter((p) => p.done);
  if (done.length === 0) return parked.has(number) ? { done: true } : { done: false };
  if (!done.some((p) => p.shas.every((sha) => isPushed(sha)))) return { done: false, reason: STAY_REASONS.unpushed };
  if (own.at(-1) !== done.at(-1)) return { done: false, reason: STAY_REASONS.reopened };
  return { done: true };
};

export const archiveFindings = (
  planText,
  statusText,
  { today, days = 5, isPushed = isPushedSha, parked = new Set() } = {},
) => {
  const rows = parseStatusRows(statusText);
  const done = doneFindingNumbers(rows);
  const cited = new Set(rows.flatMap((row) => [...row.findings]));
  const backlog = backlogNumbers(statusText);
  const lines = planText.split('\n');
  const paragraphs = findingParagraphs(planText);
  const blocks = splitFindings(planText);
  const decided = [];
  const stays = [];
  for (const block of blocks) {
    const date = DATE.exec(block.lines.join('\n'));
    const byParagraph = closedByParagraph(block.number, paragraphs, parked, isPushed);
    const listed = byParagraph.done || byParagraph.reason !== undefined;
    const old = Boolean(today) && Boolean(date) && (today - new Date(date[0])) / DAY_MS > days;
    const stay = (reason) => {
      if (old || listed) stays.push({ number: block.number, reason });
    };
    if (!date) {
      if (listed) stay(STAY_REASONS.undated);
      continue;
    }
    const month = `${date[1]}-${date[2]}`;
    const take = (to, index = false) => decided.push({ block, month, to, index });
    if (done.has(block.number)) {
      take(block.to);
    } else if (cited.has(block.number)) {
      stay(STAY_REASONS.open);
    } else if (old && backlog.has(block.number)) {
      take(extentOf(lines, block.from, block.number), true);
    } else if (namedIn(statusText, block.number)) {
      stay(STAY_REASONS.named);
    } else if (byParagraph.done) {
      take(block.to);
    } else if (byParagraph.reason) {
      stay(byParagraph.reason);
    } else {
      const to = extentOf(lines, block.from, block.number);
      const builtLines = lines.slice(block.from, to).filter((line) => isBuiltLine(line, isPushed));
      if (!builtLines.length) stay(STAY_REASONS.unbuilt);
      else if (old || builtLines.some((line) => namedIn(line, block.number))) take(to);
    }
  }

  const leaving = new Set(decided.map((d) => d.block.number));
  const blockNumbers = new Set(blocks.map((b) => b.number));
  const follows = (p) => p.numbers.every((n) => leaving.has(n) || !blockNumbers.has(n));
  const drop = new Set();
  const index = new Map();
  const dropRange = (from, to) => {
    let end = to;
    while (end < lines.length && lines[end].trim() === '') end++;
    for (let n = from; n < end; n++) drop.add(n);
  };
  const moved = decided.map(({ block, month, to, index: asIndex }) => {
    const extra = paragraphs.filter(
      (p) =>
        p.numbers.find((n) => leaving.has(n)) === block.number && follows(p) && (p.from < block.from || p.from >= to),
    );
    const parts = [lines.slice(block.from, to).join('\n'), ...extra.map((p) => lines.slice(p.from, p.to).join('\n'))];
    if (asIndex) {
      index.set(block.from, `${block.number} -> archive/findings-${month}.md, backlog ${BACKLOG_WHERE}`);
      for (let n = block.from + 1; n < to; n++) drop.add(n);
    } else {
      dropRange(block.from, to);
    }
    for (const p of extra) dropRange(p.from, p.to);
    return { number: block.number, month, text: parts.join('\n\n') };
  });
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
  a finding is done by a done STATUS row, a paragraph "NNN built|closed|withdrawn|as built ...", a line in
  parked-suspects.md, or a built line; it leaves with every paragraph that starts with its number
  --days=<n>  age in days an orphan finding (no STATUS row) must reach to move by a built line or a
              tool-backlog entry in STATUS.md, and a decision section to move (default 5)
  --dry-run   list what would move and why each old finding stays, write nothing
  --orphans   list old findings with no STATUS row, write nothing`;

const planMoves = (root, days) => {
  const studio = join(root, 'plans/ethlete-studio');
  const planFile = join(studio, 'design-to-code.md');
  const statusText = readFileSync(join(studio, 'STATUS.md'), 'utf8');
  const today = new Date();
  const parkedFile = join(studio, 'parked-suspects.md');
  const parked = existsSync(parkedFile) ? parkedNumbers(readFileSync(parkedFile, 'utf8')) : new Set();
  const first = archiveFindings(readFileSync(planFile, 'utf8'), statusText, { today, days, parked });
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
