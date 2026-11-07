import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NO_VERIFY = /--no-verify/;
const NEGATED = /\b(?:never|not|don't|dont|forbid|forbidden|refuse|refuses|without)\b/i;

export const noVerifyFindings = (text) =>
  text
    .split('\n')
    .flatMap((line, i) => (NO_VERIFY.test(line) && !NEGATED.test(line) ? [{ line: i + 1, text: line.trim() }] : []));

const markdownUnder = (dir, only) =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (name === 'node_modules') return [];
        if (statSync(path).isDirectory()) return markdownUnder(path, only);
        return name.endsWith('.md') && (!only || only.test(name)) ? [path] : [];
      });

export const noVerifyProblems = (root) =>
  [
    ...markdownUnder(join(root, '.claude', 'handoffs')),
    ...markdownUnder(join(root, '.agents', 'skills'), /^SKILL\.md$/),
    ...markdownUnder(join(root, 'libs', 'agent-rules', 'content')),
  ].flatMap((file) =>
    noVerifyFindings(readFileSync(file, 'utf8')).map(
      (f) =>
        `${relative(root, file)}:${f.line}: an agent brief must not tell agents to skip hooks with --no-verify: ${f.text}`,
    ),
  );

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = noVerifyProblems(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}
