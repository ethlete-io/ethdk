import { appendFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, relative, resolve, sep } from 'path';
import { FullConfig, Reporter, TestCase, TestResult } from 'playwright/types/testReporter';

export const FAILURES_FILE_ENV = 'E2E_FAILURES_FILE';
export const DEFAULT_FAILURES_FILE_NAME = 'e2e-failures.jsonl';

const ERROR_LINES = 6;
const ERROR_CHARS = 700;
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

export type FailureReporterOptions = {
  /** The JSONL file to write. `E2E_FAILURES_FILE` wins over it. The default is `e2e-failures.jsonl` next to the config file. */
  outputFile?: string;
};

/** One line of the failures file. */
export type FailureRecord = {
  test: string;
  location: string;
  project: string | null;
  status: TestResult['status'];
  retry: number;
  seconds: number;
  error: string;
  context: string | null;
};

const isInside = (file: string, dir: string) => file.startsWith(dir.endsWith(sep) ? dir : `${dir}${sep}`);

export const toFailureRecord = (test: TestCase, result: TestResult): FailureRecord => {
  const message = (result.error?.message ?? '').replace(ANSI, '');

  return {
    test: test.titlePath().slice(3).join(' > '),
    location: `${relative(process.cwd(), test.location.file)}:${test.location.line}`,
    project: test.parent.project()?.name || null,
    status: result.status,
    retry: result.retry,
    seconds: Math.round(result.duration / 1000),
    error: message.split('\n').slice(0, ERROR_LINES).join('\n').slice(0, ERROR_CHARS),
    context: result.attachments.find((attachment) => attachment.name === 'error-context')?.path ?? null,
  };
};

/**
 * A Playwright reporter that appends one JSON line per failed test to a file, at the moment the test
 * fails. Add it next to the reporter you read: `reporter: [['list'], ['@ethlete/cli/playwright/failure-reporter']]`.
 */
export default class FailureReporter implements Reporter {
  private file = '';

  constructor(private readonly options: FailureReporterOptions = {}) {}

  onBegin(config: FullConfig) {
    const configDir = config.configFile ? dirname(config.configFile) : process.cwd();
    this.file = resolve(
      configDir,
      process.env[FAILURES_FILE_ENV] || this.options.outputFile || DEFAULT_FAILURES_FILE_NAME,
    );

    const outputDir = config.projects.map((project) => project.outputDir).find((dir) => isInside(this.file, dir));
    if (outputDir) {
      console.warn(
        `[failure-reporter] ${this.file} is inside the outputDir ${outputDir}. Playwright deletes that folder at the start of a run, so pick a path outside it.`,
      );
    }

    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, '');
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === test.expectedStatus) return;

    appendFileSync(this.file, `${JSON.stringify(toFailureRecord(test, result))}\n`);
  }

  printsToStdio() {
    return false;
  }
}
