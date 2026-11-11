import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orphanFindings, splitFindings } from './archive-findings.mjs';
import { findingOrderErrors } from './check-plan-findings.mjs';
import { parseStatusRows } from './studio-status.mjs';

const STATUS_VALUE = /^(accepted|superseded by \d{4})$/;
const BUILT_VALUE = /^[0-9a-f]{7,40}$/;
const OPEN_VALUE = /^(B\d+|none)$/;
const LIST_ITEM = /^(\d+)\. /;
const FINDING_LIKE_LIST_NUMBER = 100;
const OPEN_NONE_GRANDFATHERED_UP_TO = 204;

export const frontmatterOf = (text) => {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) return null;
  return Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => /^([A-Za-z-]+):\s*(.*)$/.exec(line))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );
};

export const checkAdr = (name, text, rows) => {
  const errors = [];
  const warnings = [];
  const meta = frontmatterOf(text);
  if (!meta) return { errors: [`${name}: no frontmatter`], warnings };
  if (!STATUS_VALUE.test(meta.status ?? '')) {
    errors.push(`${name}: status must be "accepted" or "superseded by NNNN", got "${meta.status ?? ''}"`);
  }
  const hasBuilt = 'built' in meta;
  const hasOpen = 'open' in meta;
  if (hasBuilt === hasOpen) {
    errors.push(`${name}: needs exactly one of "built: <sha>" or "open: B<row>"`);
  } else if (hasBuilt) {
    if (!BUILT_VALUE.test(meta.built)) errors.push(`${name}: built must be a commit sha, got "${meta.built}"`);
  } else if (!OPEN_VALUE.test(meta.open)) {
    errors.push(`${name}: open must be B<row> or none, got "${meta.open}"`);
  } else if (meta.open === 'none') {
    if (Number(/^(\d+)-/.exec(name)?.[1] ?? 0) > OPEN_NONE_GRANDFATHERED_UP_TO) {
      errors.push(`${name}: open: none needs a "built: <sha>" or an "open: B<row>"; a decided ADR must be tracked`);
    }
    warnings.push(`${name}: open: none (decided, no STATUS row yet)`);
  } else {
    const row = rows.find((r) => r.id === meta.open);
    if (!row) errors.push(`${name}: open row ${meta.open} is not in STATUS.md`);
    else if (row.done) errors.push(`${name}: open row ${meta.open} is done in STATUS.md; set "built: <sha>"`);
  }
  return { errors, warnings };
};

const ORPHAN_AFTER = '2026-11-04';

export const orphanWarnings = (planText, statusText) =>
  orphanFindings(planText, statusText)
    .filter((o) => o.date > ORPHAN_AFTER)
    .map((o) => `finding ${o.number} (${o.date}) is cited by no STATUS row: ${o.title}`);

const listItemErrors = (name, text) =>
  text.split('\n').flatMap((line, i) => {
    const match = LIST_ITEM.exec(line);
    if (!match || Number(match[1]) < FINDING_LIKE_LIST_NUMBER) return [];
    return [
      `${name}:${i + 1}: "${match[1]}. " is a list item that prettier renumbers; write the finding as "${match[1]}\\. "`,
    ];
  });

export const findingErrors = (planText, archives, statusText) => {
  const errors = [...listItemErrors('design-to-code.md', planText)];
  const known = new Set();
  for (const { name, text } of archives) {
    errors.push(...listItemErrors(name, text));
    for (const { number } of splitFindings(text)) {
      if (known.has(number)) errors.push(`finding ${number} exists twice (${name})`);
      known.add(number);
    }
  }
  for (const { number } of splitFindings(planText)) {
    if (known.has(number)) errors.push(`finding ${number} exists twice (design-to-code.md)`);
    known.add(number);
  }
  errors.push(...findingOrderErrors(planText));
  for (const row of parseStatusRows(statusText)) {
    for (const number of row.findings) {
      if (!known.has(number)) errors.push(`${row.id} cites Bef. ${number}, but no finding ${number} exists`);
    }
  }
  return errors;
};

export const lostFindingErrors = (archives, committedTextOf) =>
  archives.flatMap(({ name, text }) => {
    const committed = committedTextOf(name);
    if (committed === null) return [];
    const kept = new Set(splitFindings(text).map(({ number }) => number));
    const lost = splitFindings(committed)
      .map(({ number }) => number)
      .filter((number) => !kept.has(number));
    return lost.length
      ? [`${name} lost findings ${lost.join(', ')} of its committed version; append with archive-findings.mjs`]
      : [];
  });

const committedArchiveOf = (root) => (name) => {
  try {
    return execFileSync('git', ['show', `HEAD:./plans/ethlete-studio/archive/${name}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
};

const readArchives = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => /^findings-.*\.md$/.test(f))
        .sort()
        .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }))
    : [];

export const checkAdrs = (root) => {
  const statusFile = join(root, 'plans/ethlete-studio/STATUS.md');
  const planFile = join(root, 'plans/ethlete-studio/design-to-code.md');
  const statusText = existsSync(statusFile) ? readFileSync(statusFile, 'utf8') : '';
  const planText = existsSync(planFile) ? readFileSync(planFile, 'utf8') : null;
  const warnings = planText === null ? [] : orphanWarnings(planText, statusText);
  const archives = readArchives(join(root, 'plans/ethlete-studio/archive'));
  const findings =
    planText === null
      ? []
      : [...findingErrors(planText, archives, statusText), ...lostFindingErrors(archives, committedArchiveOf(root))];
  const dir = join(root, 'apps/ethlete-studio/docs/adr');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
  const rows = parseStatusRows(statusText);
  const results = files.map((f) => checkAdr(f, readFileSync(join(dir, f), 'utf8'), rows));
  return {
    errors: [...findings, ...results.flatMap((r) => r.errors)],
    warnings: [...warnings, ...results.flatMap((r) => r.warnings)],
  };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, warnings } = checkAdrs(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(e);
  if (errors.length) process.exit(1);
  console.log('studio ADRs ok');
}
