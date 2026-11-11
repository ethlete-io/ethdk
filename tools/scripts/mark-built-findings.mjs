import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFindings } from './archive-findings.mjs';

const DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
const MARKER = /(?:^|[.;:!?] |\n)Built in [0-9a-f]{7,40}\./;
const PHRASES = [
  /\b[Ff]ixed in `?([0-9a-f]{7,40})\b/g,
  /\b[Bb]uilt in `?([0-9a-f]{7,40})\b/g,
  /\b[Aa]s built \(`?([0-9a-f]{7,40})\b/g,
  /\bBuilt: `?([0-9a-f]{7,40})\b/g,
];
const FIX_SUBJECT = /^(fix|feat)(\(|:|!)/;

export const commitInfo = (sha, root = process.cwd()) => {
  const out = spawnSync('git', ['log', '-1', '--format=%ad%x09%s', '--date=short', sha], {
    cwd: root,
    encoding: 'utf8',
  });
  if (out.status !== 0) return null;
  const [date, ...subject] = out.stdout.trim().split('\t');
  return { date, subject: subject.join('\t') };
};

const namesFinding = (subject, number) => new RegExp(`(?<![\\d.])${number}(?!\\d)`).test(subject);

export const provenSha = (block, lookup) => {
  const text = block.lines.join('\n');
  if (MARKER.test(text)) return null;
  const found = DATE.exec(text);
  if (!found) return null;
  const shas = PHRASES.flatMap((re) => [...text.matchAll(re)].map((m) => m[1]));
  for (const sha of shas) {
    const info = lookup(sha);
    if (!info || info.date < found[1]) continue;
    if (FIX_SUBJECT.test(info.subject) || namesFinding(info.subject, block.number)) return sha;
  }
  return null;
};

export const markBuilt = (planText, lookup) => {
  const lines = planText.split('\n');
  const marked = [];
  for (const block of splitFindings(planText)) {
    const sha = provenSha(block, lookup);
    if (!sha) continue;
    const last = block.to - 1;
    lines[last] = `${lines[last].trimEnd()} Built in ${sha}.`;
    marked.push({ number: block.number, sha });
  }
  return { plan: lines.join('\n'), marked };
};

export const main = (argv, { root, log = console.log }) => {
  const file = join(root, 'plans/ethlete-studio/design-to-code.md');
  const { plan, marked } = markBuilt(readFileSync(file, 'utf8'), (sha) => commitInfo(sha, root));
  for (const m of marked) log(`${m.number}\t${m.sha}`);
  log(`${marked.length} findings`);
  if (argv.includes('--write')) writeFileSync(file, plan);
  return 0;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  process.exitCode = main(process.argv.slice(2), { root });
}
