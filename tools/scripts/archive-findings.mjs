import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStatusRows } from './studio-status.mjs';
import { studioRowsText } from './studio-plan.mjs';

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
      if (old || builtLines.some((line) => namedIn(line, block.number))) take(to);
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

const ARCHIVED_LINE = /^Archived: /;

const keptFindingLines = (body) => {
  const kept = new Set();
  const numbers = new Set();
  for (const block of splitFindings(body.join('\n'))) {
    numbers.add(block.number);
    for (let n = block.from; n < extentOf(body, block.from, block.number); n++) kept.add(n);
  }
  for (const p of findingParagraphs(body.join('\n')))
    if (p.numbers.some((n) => numbers.has(n))) for (let n = p.from; n < p.to; n++) kept.add(n);
  return kept;
};

export const archiveSections = (planText, statusText, adrText, { today, days = 5 }) => {
  const openRows = parseStatusRows(statusText)
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
    const kept = keptFindingLines(body);
    const leaves = (line, n) => n > 0 && !kept.has(n) && !ARCHIVED_LINE.test(line) && line.trim() !== '';
    if (age <= days || openRows.includes(title) || adrText.includes(title) || !body.some(leaves)) {
      out.push(...body);
      i = end;
      continue;
    }
    const month = `${date[1]}-${date[2]}`;
    const pointer = `Archived: ${title} (${date[0]}), see [findings-${month}](archive/findings-${month}.md).`;
    if (kept.size === 0) {
      moved.push({ number: 0, month, text: body.join('\n').trimEnd() });
      out.push(pointer, '');
      i = end;
      continue;
    }
    const leaving = body.filter((line, n) => n === 0 || leaves(line, n) || (line.trim() === '' && !kept.has(n)));
    moved.push({ number: 0, month, text: squeezeBlankLines(leaving).join('\n').trimEnd() });
    const staying = body.filter((line, n) => n > 0 && !leaves(line, n));
    const hasPointer = staying.some((line) => line === pointer);
    out.push(heading, '', ...(hasPointer ? [] : [pointer, '']), ...squeezeBlankLines(staying));
    i = end;
  }
  return { plan: out.join('\n'), moved };
};

const squeezeBlankLines = (lines) => {
  const out = [];
  for (const line of lines) {
    if (line.trim() === '' && (out.length === 0 || out.at(-1).trim() === '')) continue;
    out.push(line);
  }
  return out;
};

export const readAdrText = (root) => {
  const dir = join(root, 'apps/ethlete-studio/docs/adr');
  if (!existsSync(dir)) return '';
  return readdirSync(dir)
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
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

const AS_BUILT_HEADING = /^## As built\b/;

/** Splits a plan into the text that stays and its "## As built ..." sections (with their subsections), in file order. */
export const splitAsBuilt = (planText) => {
  const lines = planText.split('\n');
  const kept = [];
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^## /.test(line)) current = AS_BUILT_HEADING.test(line) ? [] : null;
    if (current) {
      if (current.length === 0) sections.push(current);
      current.push(line);
    } else {
      kept.push(line);
    }
  }
  return { kept: squeezeBlankLines(kept).join('\n'), sections: sections.map((s) => s.join('\n').trimEnd()) };
};

const monthOf = (today) => today.toISOString().slice(0, 7);

/** Appends a whole plan file to the month's archive and deletes it. */
export const archiveWhole = (root, file, today = new Date()) => {
  const path = resolve(root, file);
  const text = readFileSync(path, 'utf8').trimEnd();
  writeArchive(join(root, 'plans/studio/archive'), [
    {
      number: 0,
      month: monthOf(today),
      text: `## Archived plan file ${basename(file)} (${today.toISOString().slice(0, 10)})\n\n${text}`,
    },
  ]);
  unlinkSync(path);
};

/** Moves the "## As built" sections of a plan file to the month's archive. Returns how many moved. */
export const archiveAsBuilt = (root, file, today = new Date()) => {
  const path = resolve(root, file);
  const { kept, sections } = splitAsBuilt(readFileSync(path, 'utf8'));
  if (sections.length === 0) return 0;
  const heading = `## Archived from ${basename(file)} (${today.toISOString().slice(0, 10)})`;
  writeArchive(join(root, 'plans/studio/archive'), [
    { number: 0, month: monthOf(today), text: [heading, ...sections].join('\n\n') },
  ]);
  writeFileSync(path, `${kept.trimEnd()}\n`);
  return sections.length;
};

const USAGE = `usage: node tools/scripts/archive-findings.mjs [--help]
       node tools/scripts/archive-findings.mjs --whole <plan file>
       node tools/scripts/archive-findings.mjs --as-built <plan file>
  --whole     appends the plan file to archive/findings-<month>.md and deletes it
  --as-built  moves the "## As built" sections of the plan file to archive/findings-<month>.md
  moves done findings and old decision sections of plans/studio/design-to-code.md into archive/
  a finding is done by a done STATUS row, a paragraph "NNN built|closed|withdrawn|as built ...", a line in
  parked-suspects.md, or a built line; it leaves with every paragraph that starts with its number`;

const planMoves = (root) => {
  const studio = join(root, 'plans/studio');
  const planFile = join(studio, 'design-to-code.md');
  const statusText = studioRowsText(root);
  const today = new Date();
  const parkedFile = join(studio, 'parked-suspects.md');
  const parked = existsSync(parkedFile) ? parkedNumbers(readFileSync(parkedFile, 'utf8')) : new Set();
  const first = archiveFindings(readFileSync(planFile, 'utf8'), statusText, { today, parked });
  const second = archiveSections(first.plan, statusText, readAdrText(root), { today });

  return {
    studio,
    planFile,
    plan: second.plan,
    moved: [...first.moved, ...second.moved],
    stays: first.stays,
  };
};

const logStays = (stays, log) => {
  for (const s of stays) log(`stays\t${s.number}\t${s.reason}`);
  const counts = Map.groupBy(stays, (s) => s.reason);
  for (const [reason, list] of counts) log(`${list.length} stay: ${reason}`);
};

export const run = (root, log = console.log) => {
  const { studio, planFile, plan, moved, stays } = planMoves(root);
  writeArchive(join(studio, 'archive'), moved);
  writeFileSync(planFile, plan);
  logStays(stays, log);
  return moved.length;
};

const KNOWN = new Set(['--help']);

export const main = (argv, { root, log = console.log }) => {
  const modeAt = argv.findIndex((arg) => arg === '--whole' || arg === '--as-built');
  if (modeAt >= 0) {
    const file = argv[modeAt + 1];
    if (!file || !existsSync(resolve(root, file))) {
      log(`no such plan file: ${file ?? ''}`);
      return 2;
    }
    if (argv[modeAt] === '--whole') {
      archiveWhole(root, file);
      log(`archived ${file}`);
    } else {
      log(`moved ${archiveAsBuilt(root, file)} as-built sections of ${file}`);
    }
    return 0;
  }
  if (!argv.includes('--help') && !existsSync(join(root, 'plans/studio/design-to-code.md'))) {
    log('plans/studio/design-to-code.md is archived; nothing to move');
    return 0;
  }
  const unknown = argv.filter((arg) => !KNOWN.has(arg));
  if (argv.includes('--help') || unknown.length > 0) {
    if (unknown.length > 0) log(`unknown argument: ${unknown.join(' ')}`);
    log(USAGE);
    return unknown.length > 0 ? 2 : 0;
  }
  log(`moved ${run(root, log)} findings and sections`);
  return 0;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  process.exitCode = main(process.argv.slice(2), { root });
}
