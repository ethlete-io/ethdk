import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LINUX_PATH = /(?:^|[\s"'=(`$])\/(?:etc|proc|sys|var\/lib|usr\/lib)\//;
const STEP_START = /^\s*- [A-Za-z-]+:/;
const LINUX_GUARD = /runner\.os\s*==\s*['"]Linux['"]|RUNNER_OS"?\s*(?:=|==)\s*"?Linux/;
const LINUX_LABEL = /\bLinux\b/;

export const linuxPathFindings = (text) => {
  const lines = text.split('\n');
  const findings = [];
  let stepStart = 0;

  lines.forEach((line, i) => {
    if (STEP_START.test(line)) stepStart = i;
    if (!LINUX_PATH.test(line) || line.trimStart().startsWith('#')) return;
    if (LINUX_LABEL.test(line)) return;

    const guards = lines.slice(stepStart, i + 1).filter((l) => /^\s*(?:- )?if:/.test(l));
    if (guards.some((l) => LINUX_GUARD.test(l))) return;

    findings.push({ line: i + 1, text: line.trim() });
  });

  return findings;
};

const yamlFilesUnder = (dir) =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return yamlFilesUnder(path);
        return /\.ya?ml$/.test(name) ? [path] : [];
      });

export const runnerOsProblems = (root) =>
  [join(root, '.github', 'actions'), join(root, '.github', 'workflows')]
    .flatMap(yamlFilesUnder)
    .flatMap((file) =>
      linuxPathFindings(readFileSync(file, 'utf8')).map(
        (f) =>
          `${relative(root, file)}:${f.line}: Linux-only path outside a Linux branch (use a RUNNER_OS case or a runner.os == 'Linux' guard): ${f.text}`,
      ),
    );

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = runnerOsProblems(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}
