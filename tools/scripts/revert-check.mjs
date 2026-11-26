import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const IGNORED_TOKENS = new Set(['class', 'id', 'type', 'role', 'style', 'href', 'src', 'for', 'name', 'value']);

const TOKEN_PATTERNS = [
  /\b(?:aria|data)-[a-z0-9-]+/g,
  /\battr\.([a-z][a-z0-9-]*)/g,
  /\[([a-z][a-z0-9-]*)(?:=|\])/g,
  /\s([a-z][a-z0-9-]*)="/g,
];

const withoutProse = (diff) =>
  diff
    .split(/^(?=diff --git )/m)
    .filter((section) => !/^diff --git a\/\S+\.(md|mdx)\b/.test(section))
    .join('');

const changedLines = (diff) =>
  withoutProse(diff)
    .split('\n')
    .filter((line) => /^[+-](?![+-]{2} )/.test(line))
    .map((line) => line.slice(1));

export const markupTokens = (diff) => {
  const tokens = new Set();

  for (const line of changedLines(diff)) {
    for (const pattern of TOKEN_PATTERNS) {
      for (const match of line.matchAll(pattern)) tokens.add(match[1] ?? match[0].trim());
    }
  }

  return [...tokens].filter((token) => !IGNORED_TOKENS.has(token)).sort();
};

const splitCommits = (log) =>
  log
    .split('\u0001')
    .filter(Boolean)
    .map((chunk) => {
      const [header, ...diff] = chunk.split('\n');
      const [sha, ...subject] = header.split(' ');
      return { sha, subject: subject.join(' '), diff: diff.join('\n') };
    });

export const findLaterCommits = ({ sha, subject, tokens, laterLog }) => {
  const shortSha = sha.slice(0, 8);

  return splitCommits(laterLog).flatMap((commit) => {
    const reasons = [];
    if (commit.subject.includes(shortSha) || (subject && commit.subject.includes(subject)))
      reasons.push('names the change');

    const lines = changedLines(commit.diff);
    const touched = tokens.filter((token) => lines.some((line) => line.includes(token)));
    if (touched.length) reasons.push(`changes lines with: ${touched.join(', ')}`);

    return reasons.length ? [{ sha: commit.sha, subject: commit.subject, reasons }] : [];
  });
};

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

export const checkRevert = (target, head = 'HEAD') => {
  const sha = git('rev-parse', target).trim();
  const subject = git('log', '-1', '--format=%s', sha).trim();
  const tokens = markupTokens(git('show', '--format=', sha));
  const laterLog = git('log', '--reverse', '--format=%x01%H %s', '-p', `${sha}..${head}`);

  return { sha, subject, tokens, later: findLaterCommits({ sha, subject, tokens, laterLog }) };
};

const main = () => {
  const [target, head] = process.argv.slice(2);

  if (!target) {
    console.error('usage: yarn revert:check <sha-to-revert> [head]');
    process.exit(2);
  }

  const { sha, subject, tokens, later } = checkRevert(target, head);
  console.log(`Reverting ${sha.slice(0, 9)} ${subject}`);
  console.log(`Markup tokens it touches: ${tokens.join(', ') || 'none'}`);

  if (!later.length) return console.log('No later commit names the change or touches those tokens.');

  console.log('Later commits to revert or check before the revert (grep e2e specs for the tokens too):');
  for (const { sha: laterSha, subject: laterSubject, reasons } of later) {
    console.log(`  ${laterSha.slice(0, 9)} ${laterSubject}\n    ${reasons.join('; ')}`);
  }
  process.exitCode = 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
