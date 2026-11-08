import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const specTypecheckProblem = (projectDir, projectJson) => {
  const command = JSON.stringify(projectJson?.targets?.typecheck ?? null);
  if (command.includes(`${projectDir}/tsconfig.spec.json`)) return null;
  return `${projectDir}/project.json: the typecheck target does not check ${projectDir}/tsconfig.spec.json, so a type error in a spec passes every gate`;
};

export const specTypecheckProblems = (root) =>
  execFileSync('git', ['ls-files', '*/tsconfig.spec.json'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((file) => dirname(file))
    .filter((dir) => existsSync(join(root, dir, 'project.json')))
    .map((dir) => specTypecheckProblem(dir, JSON.parse(readFileSync(join(root, dir, 'project.json'), 'utf8'))))
    .filter(Boolean);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = specTypecheckProblems(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}
