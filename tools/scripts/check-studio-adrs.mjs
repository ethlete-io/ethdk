import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStatusRows } from './studio-status.mjs';

const STATUS_VALUE = /^(accepted|superseded by \d{4})$/;
const BUILT_VALUE = /^[0-9a-f]{7,40}$/;
const OPEN_VALUE = /^(B\d+|none)$/;

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
    warnings.push(`${name}: open: none (decided, no STATUS row yet)`);
  } else {
    const row = rows.find((r) => r.id === meta.open);
    if (!row) errors.push(`${name}: open row ${meta.open} is not in STATUS.md`);
    else if (row.done) errors.push(`${name}: open row ${meta.open} is done in STATUS.md; set "built: <sha>"`);
  }
  return { errors, warnings };
};

export const checkAdrs = (root) => {
  const dir = join(root, 'apps/ethlete-studio/docs/adr');
  if (!existsSync(dir)) return { errors: [], warnings: [] };
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  if (!files.length) return { errors: [], warnings: [] };
  const statusFile = join(root, 'plans/ethlete-studio/STATUS.md');
  const rows = existsSync(statusFile) ? parseStatusRows(readFileSync(statusFile, 'utf8')) : [];
  const results = files.map((f) => checkAdr(f, readFileSync(join(dir, f), 'utf8'), rows));
  return { errors: results.flatMap((r) => r.errors), warnings: results.flatMap((r) => r.warnings) };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, warnings } = checkAdrs(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(e);
  if (errors.length) process.exit(1);
  console.log('studio ADRs ok');
}
