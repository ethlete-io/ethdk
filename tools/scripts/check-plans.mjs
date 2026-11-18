#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_PLAN_CHARS = 30000;
const MAX_STATUS_CHARS = 5000;
const STALE_DAYS = 14;
const DAY_MS = 86_400_000;

const ARCHIVE = /^plans\/[^/]+\/archive\//;
const PRODUCT_STATUS = /^plans\/[^/]+\/STATUS\.md$/;
const DUE_FILES = /^plans\/(?:[^/]+\/STATUS\.md|studio\/queue\.md|studio\/rows\.md)$/;
const PARKED = /^parked since \d{4}-\d{2}-\d{2}/m;
const DUE = /fällig:?\s*(\d{4}-\d{2}-\d{2})/i;
const LINK = /\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const MENTION = /#(\d+)(?:\s*[-–]\s*#?(\d+))?/g;

const stripCode = (text) => text.replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, '').replace(/`[^`\n]*`/g, '');

const linksOf = (text) => [...stripCode(text).matchAll(LINK)].map((m) => m[1]);

const resolveLink = (from, target) => {
  const bare = target.split('#')[0];
  if (!bare) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(bare);
  } catch {
    decoded = bare;
  }
  return posix.normalize(posix.join(posix.dirname(from), decoded)).replace(/\/$/, '');
};

const isExternal = (target) => /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target);

const daysBetween = (from, to) => (Date.parse(to) - Date.parse(from)) / DAY_MS;

const productOf = (path) => path.split('/')[1];

const entriesOf = (text) =>
  text.split('\n').flatMap((line) => {
    const entry = /^(\d+)\. /.exec(line) ?? /^#{2,} (\d+)\./.exec(line);
    return entry && !line.includes('~~') ? [Number(entry[1])] : [];
  });

const mentionsIn = (line, n) =>
  [...line.matchAll(MENTION)].some((m) =>
    m[2] === undefined ? Number(m[1]) === n : Number(m[1]) <= n && n <= Number(m[2]),
  );

/**
 * Returns one problem line per rule violation in the plans tree. `files` maps every path under plans/ (archive
 * included) to its text, or null for a non-text file; `repoFiles` lists every other path in the repo.
 */
export const plansProblems = ({ files, lastChange, today, repoFiles = [] }) => {
  const problems = [];
  const report = (path, what, fix) => problems.push(`${path}: ${what}. Fix: ${fix}.`);

  const known = new Set([...files.keys(), ...repoFiles]);
  const dirs = new Set();
  for (const path of known)
    for (let d = posix.dirname(path); d !== '.' && !dirs.has(d); d = posix.dirname(d)) dirs.add(d);
  const exists = (path) => known.has(path) || dirs.has(path);

  const paths = [...files.keys()].filter((path) => !ARCHIVE.test(path)).sort();
  const textOf = (path) => files.get(path) ?? '';
  const statuses = paths.filter((path) => PRODUCT_STATUS.test(path));

  const linkedFrom = (path) =>
    statuses.filter((status) =>
      linksOf(textOf(status)).some((target) => {
        if (isExternal(target)) return false;
        const resolved = resolveLink(status, target);
        return resolved !== null && (resolved === path || path.startsWith(`${resolved}/`));
      }),
    );

  const queueText = (product) =>
    [`plans/${product}/STATUS.md`, 'plans/studio/STATUS.md', 'plans/studio/queue.md', 'plans/studio/rows.md']
      .map(textOf)
      .join('\n');

  for (const path of paths) {
    const text = files.get(path);
    const linked = linkedFrom(path);

    if (!PRODUCT_STATUS.test(path) && (posix.dirname(path) === 'plans' || linked.length === 0))
      report(path, 'no STATUS.md links this file', 'link it from plans/<product>/STATUS.md, or delete it');

    if (text !== null && path.endsWith('.md')) {
      const limit = PRODUCT_STATUS.test(path) ? MAX_STATUS_CHARS : MAX_PLAN_CHARS;
      const size = [...text].length;
      if (size > limit) report(path, `${size} characters, limit ${limit}`, 'split it or delete its done parts');
    }

    const changed = lastChange(path);
    const parked = PARKED.test(text ?? '') || linked.some((status) => PARKED.test(textOf(status)));
    if (changed && !parked && daysBetween(changed, today) > STALE_DAYS)
      report(
        path,
        `last changed ${changed}, more than ${STALE_DAYS} days ago and not parked`,
        'mark it parked (a line `parked since <date>`), or delete it',
      );

    if (text === null || !path.endsWith('.md')) continue;

    if (posix.basename(path).includes('findings')) {
      const product = productOf(path);
      const name = posix.basename(path);
      const status = textOf(`plans/${product}/STATUS.md`).split('\n');
      const lines = queueText(product).split('\n');
      for (const n of entriesOf(text)) {
        const covered =
          lines.some((line) => line.includes(name) && mentionsIn(line, n)) ||
          status.some((line) => mentionsIn(line, n));
        if (!covered) report(path, `finding ${n} has no queue row`, 'add a queue row for it, or strike it');
      }
    }

    for (const target of linksOf(text)) {
      if (isExternal(target)) continue;
      const resolved = resolveLink(path, target);
      if (resolved !== null && !exists(resolved))
        report(path, `links ${target}, which does not exist`, "point it at the file's new place, or drop the link");
    }

    if (DUE_FILES.test(path))
      for (const line of text.split('\n')) {
        const due = DUE.exec(line);
        if (due && !line.includes('~~') && due[1] < today)
          report(path, `due date ${due[1]} has passed`, 'do it, move the date with a reason, or strike it');
      }
  }
  return problems;
};

const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });

const readTree = (rev) => {
  const all = git(['ls-tree', '-r', '--name-only', rev]).split('\n').filter(Boolean);
  const files = new Map();
  const repoFiles = [];
  for (const path of all) {
    if (!path.startsWith('plans/')) repoFiles.push(path);
    else if (ARCHIVE.test(path) || !path.endsWith('.md')) files.set(path, null);
    else files.set(path, git(['show', `${rev}:${path}`]));
  }
  return { files, repoFiles };
};

const lastChangeAt = (rev) => (path) => git(['log', '-1', '--format=%cs', rev, '--', path]).trim() || null;

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const revAt = args.indexOf('--rev');
  const rev = revAt >= 0 ? args[revAt + 1] : 'HEAD';
  const { files, repoFiles } = readTree(rev);
  const today = new Date().toLocaleDateString('sv');
  const problems = plansProblems({ files, repoFiles, lastChange: lastChangeAt(rev), today });
  for (const problem of problems) console.log(problem);
  process.exit(problems.length ? 1 : 0);
}
