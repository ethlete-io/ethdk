import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KNOWN_NAME_HASHES = new Set(
  JSON.parse(
    readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../libs/cli/src/lib/person-name-hashes.json'),
      'utf8',
    ),
  ),
);
const ROOTS = ['libs', 'apps', '.ethlete/design'];
const TEXT = /\.(?:ts|tsx|js|mjs|cjs|json|md|css|html|vue|yml|yaml|txt)$/;

const hash = (word) => createHash('sha256').update(word).digest('hex').slice(0, 16);

const knownWordCache = new Map();
const isKnownName = (word) => {
  let known = knownWordCache.get(word);
  if (known === undefined) {
    known = KNOWN_NAME_HASHES.has(hash(word));
    knownWordCache.set(word, known);
  }
  return known;
};

const words = (line) =>
  line
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .map((w) => w.toLowerCase());

const hasKnownName = (text) => {
  const tokens = new Set(text.match(/\p{L}+/gu));
  for (const token of tokens) if (words(token).some(isKnownName)) return true;
  return false;
};

export const personNameFindings = (text, gitUserName = '') => {
  const full = gitUserName.trim().toLowerCase();
  const nameInFull = full.length > 2 && text.toLowerCase().includes(full);
  if (!nameInFull && !hasKnownName(text)) return [];
  return text.split('\n').flatMap((line, i) => {
    const hit = words(line).some(isKnownName) || (full.length > 2 && line.toLowerCase().includes(full));
    return hit ? [{ line: i + 1, text: line.trim().slice(0, 160) }] : [];
  });
};

const gitUserName = () => {
  try {
    return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const countsIn = (root, file, userName) => {
  let text;
  try {
    text = readFileSync(resolve(root, file), 'utf8');
  } catch {
    return [];
  }
  return personNameFindings(text, userName);
};

export const personNameCounts = (root, files, userName = gitUserName()) =>
  Object.fromEntries(
    files
      .filter((file) => TEXT.test(file) && ROOTS.some((r) => file.startsWith(`${r}/`)))
      .filter((file) => !/(?:^|\/)CHANGELOG\.md$|\/node_modules\//.test(file))
      .map((file) => [file, countsIn(root, file, userName)])
      .filter(([, hits]) => hits.length),
  );

export const personNameProblems = (counts, baseline) =>
  Object.entries(counts).flatMap(([file, hits]) => {
    const allowed = baseline[file] ?? 0;
    return hits.length > allowed
      ? [
          `${file}: ${hits.length} person-name lines, ${allowed} allowed. Use the role "human". First: ${hits[0].line}: ${hits[0].text}`,
        ]
      : [];
  });

const BASELINE_FILE = 'tools/scripts/person-names-baseline.json';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const files = execFileSync('git', ['ls-files', '--', ...ROOTS], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\n')
    .filter(Boolean);
  const counts = personNameCounts(root, files);
  if (process.argv.includes('--write-baseline')) {
    const next = Object.fromEntries(Object.entries(counts).map(([f, h]) => [f, h.length]));
    writeFileSync(resolve(root, BASELINE_FILE), `${JSON.stringify(next, null, 2)}\n`);
    console.log(`baseline: ${Object.keys(next).length} files, ${Object.values(next).reduce((a, b) => a + b, 0)} lines`);
  } else {
    const baseline = existsSync(resolve(root, BASELINE_FILE))
      ? JSON.parse(readFileSync(resolve(root, BASELINE_FILE), 'utf8'))
      : {};
    const problems = personNameProblems(counts, baseline);
    if (problems.length) {
      console.error(problems.join('\n'));
      process.exit(1);
    }
  }
}
