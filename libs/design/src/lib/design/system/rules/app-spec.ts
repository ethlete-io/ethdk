import { spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative, resolve, sep } from 'path';
import { matchesPattern } from '../harness-config';
import { Problem } from '../problem';

export const APP_SPEC_RULE = 'APP-SPEC';

/** A spec file vitest ran and its failed tests, each with the first line of its error, or why the file failed as a whole. */
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
    assertionResults?: { fullName: string; status: string; failureMessages?: string[] }[];
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
        .map((assertion) => {
          const reason = assertion.failureMessages?.[0]?.split('\n')[0]?.trim();

          return reason ? `${assertion.fullName} (${reason})` : assertion.fullName;
        });

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

export const relatedSpecArgsOf = (options: { root: string; config: string; report: string; files: string[] }) => [
  'related',
  '--run',
  '--passWithNoTests',
  '--pool=forks',
  '--config',
  options.config,
  '--reporter=json',
  `--outputFile=${options.report}`,
  ...options.files.map((file) => resolve(options.root, file)),
];

export const runRelatedSpecs: RunRelatedSpecs = ({ root, config, files }) => {
  const dir = mkdtempSync(join(tmpdir(), 'et-design-app-spec-'));
  const report = join(dir, 'report.json');
  const { command, args } = vitestOf(root);

  return new Promise((done) => {
    const child = spawn(command, [...args, ...relatedSpecArgsOf({ root, config, report, files })], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
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

/**
 * The files to run related specs for: the app files of the parts, where a shared file (`harness.shared`) stands for its
 * own spec only, since every spec importing a shared file would otherwise count as related to every part.
 */
export const specSeedsOf = (options: { root: string; files: string[]; shared: string[] }): string[] => {
  const seeds = new Set<string>();

  for (const file of options.files) {
    if (!options.shared.some((pattern) => matchesPattern(file, pattern))) {
      seeds.add(file);
      continue;
    }

    const own = file.replace(/\.[cm]?tsx?$/u, '.spec.ts');

    if (own !== file && existsSync(resolve(options.root, own))) seeds.add(own);
  }

  return [...seeds];
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
