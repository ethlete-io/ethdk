import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRERELEASE_SUFFIX = ' (next)';

export const workflowCommitMessages = (text) =>
  text.split('\n').flatMap((line, index) => {
    const match = line.match(/^\s*commit_message:\s*(?:'([^']*)'|"([^"]*)"|(\S.*?))\s*$/);
    const message = match?.[1] ?? match?.[2] ?? match?.[3];
    return message === undefined ? [] : [{ line: index + 1, message }];
  });

const lintMessage = (root, message) => {
  const result = spawnSync('yarn', ['commitlint'], { cwd: root, input: message, encoding: 'utf8' });
  return result.status === 0 ? null : `${result.stdout}${result.stderr}`.trim();
};

export const commitMessageProblems = (root, lint = lintMessage) => {
  const dir = join(root, '.github', 'workflows');

  return readdirSync(dir)
    .filter((name) => /\.ya?ml$/.test(name))
    .flatMap((name) =>
      workflowCommitMessages(readFileSync(join(dir, name), 'utf8')).flatMap(({ line, message }) => {
        const failure = lint(root, `${message}${PRERELEASE_SUFFIX}`);
        return failure
          ? [
              `${relative(root, join(dir, name))}:${line}: "${message}${PRERELEASE_SUFFIX}" fails commitlint:\n${failure}`,
            ]
          : [];
      }),
    );
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = commitMessageProblems(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}
