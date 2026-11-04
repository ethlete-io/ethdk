import { spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative, resolve, sep } from 'path';
import { Problem } from '../problem';

export const APP_SPEC_RULE = 'APP-SPEC';

/** A spec file vitest ran and the names of its failed tests, or why the file failed as a whole. */
export type SpecFailure = { file: string; failed: string[] };

/** Runs the specs related to `files` with the vitest config `config`, or answers why they did not run. */
export type RunRelatedSpecs = (options: {
  root: string;
  config: string;
  files: string[];
}) => Promise<SpecFailure[] | string>;

type VitestJson = {
  testResults?: {
    name: string;
    status: string;
    message?: string;
    assertionResults?: { fullName: string; status: string }[];
  }[];
};

const toRepoPath = (root: string, file: string) => relative(root, resolve(root, file)).split(sep).join('/');

/** The failed spec files of a vitest `--reporter=json` report, with repo paths. */
export const specFailuresOf = (options: { root: string; report: string }): SpecFailure[] => {
  const parsed = JSON.parse(options.report) as VitestJson;

  return (parsed.testResults ?? [])
    .filter((result) => result.status === 'failed')
    .map((result) => {
      const failed = (result.assertionResults ?? [])
        .filter((assertion) => assertion.status === 'failed')
        .map((assertion) => assertion.fullName);

      return {
        file: toRepoPath(options.root, result.name),
        failed: failed.length > 0 ? failed : [result.message?.split('\n')[0] || 'the file failed to run'],
      };
    });
};

const vitestOf = (root: string) => {
  const local = join(root, 'node_modules', '.bin', 'vitest');

  return existsSync(local) ? { command: local, args: [] } : { command: 'npx', args: ['vitest'] };
};

export const runRelatedSpecs: RunRelatedSpecs = ({ root, config, files }) => {
  const dir = mkdtempSync(join(tmpdir(), 'et-design-app-spec-'));
  const report = join(dir, 'report.json');
  const { command, args } = vitestOf(root);

  return new Promise((done) => {
    const child = spawn(
      command,
      [
        ...args,
        'related',
        '--run',
        '--passWithNoTests',
        '--config',
        config,
        '--reporter=json',
        `--outputFile=${report}`,
        ...files.map((file) => resolve(root, file)),
      ],
      { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let errors = '';

    child.stderr.on('data', (chunk: Buffer) => (errors = `${errors}${chunk.toString()}`.slice(-2000)));
    child.on('error', (error) => done(`vitest did not start: ${error.message}`));
    child.on('close', (code) => {
      try {
        done(
          existsSync(report)
            ? specFailuresOf({ root, report: readFileSync(report, 'utf8') })
            : `vitest exited with ${code} and wrote no report: ${errors.trim().split('\n').slice(-3).join(' ')}`,
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
};

const subjectsOf = (spec: string) => {
  const stem = spec.replace(/\.spec\.[cm]?tsx?$/u, '');

  return ['.ts', '.html', '.css'].map((extension) => `${stem}${extension}`);
};

/**
 * One `APP-SPEC` problem per failed spec, on the innermost checked part whose app files hold the file the spec tests
 * (the part reaching the fewest files), else on `(product)`.
 */
export const appSpecProblemsOf = (options: {
  parts: { part: string; files: string[] }[];
  failures: SpecFailure[];
}): Map<string, Problem[]> => {
  const problems = new Map<string, Problem[]>();

  for (const failure of options.failures) {
    const subjects = subjectsOf(failure.file);
    const owner =
      options.parts
        .filter(({ files }) => files.includes(failure.file) || subjects.some((subject) => files.includes(subject)))
        .sort((a, b) => a.files.length - b.files.length)[0]?.part ?? '(product)';
    const list = problems.get(owner) ?? [];

    list.push({ rule: APP_SPEC_RULE, file: failure.file, message: `fails: ${failure.failed.join('; ')}` });
    problems.set(owner, list);
  }

  return problems;
};
