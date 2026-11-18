import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NO_VERIFY = /--no-verify/;
const NEGATED = /\b(?:never|no|not|don't|dont|forbid|forbidden|refuse|refuses|without)\b/i;
const BLOCK_START = /^\s*(?:[-*+]\s|\d+[.)]\s|#|>|\||```|$)/;

const logicalLines = (text) =>
  text.split('\n').reduce((acc, line, i) => {
    const last = acc[acc.length - 1];
    if (last && last.text.trim() && !BLOCK_START.test(line)) {
      last.text += ` ${line.trim()}`;
      last.lines.push(i + 1);
    } else {
      acc.push({ text: line, lines: [i + 1] });
    }
    return acc;
  }, []);

export const noVerifyFindings = (text) => {
  const raw = text.split('\n');
  return logicalLines(text).flatMap((logical) =>
    NO_VERIFY.test(logical.text) && !NEGATED.test(logical.text.replace(/--no-verify/g, ''))
      ? logical.lines.filter((n) => NO_VERIFY.test(raw[n - 1])).map((n) => ({ line: n, text: raw[n - 1].trim() }))
      : [],
  );
};

export const isBriefPath = (path) =>
  path.endsWith('.md') &&
  (path.startsWith('.claude/handoffs/') ||
    (path.startsWith('.agents/skills/') && path.endsWith('/SKILL.md')) ||
    path.startsWith('libs/agent-rules/content/'));

const trackedFiles = (root) =>
  execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean);

export const noVerifyProblems = (root, files = trackedFiles(root)) =>
  files
    .filter(isBriefPath)
    .flatMap((file) =>
      noVerifyFindings(readFileSync(join(root, file), 'utf8')).map(
        (f) => `${file}:${f.line}: an agent brief must not tell agents to skip hooks with --no-verify: ${f.text}`,
      ),
    );

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = noVerifyProblems(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}
