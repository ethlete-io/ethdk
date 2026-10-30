import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FAILURES_FILE_NAME, FAILURES_FILE_LINE_PREFIX, FailureRecord } from './failure-reporter';

const PLAYWRIGHT_CLI = require.resolve('@playwright/test/cli');
const PLAYWRIGHT_TEST = require.resolve('@playwright/test');
const REPORTER = join(__dirname, 'failure-reporter.ts');

const dirs: string[] = [];

afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const makeSuite = (reporterOptions: object = {}, extraTests = '') => {
  const dir = mkdtempSync(join(tmpdir(), 'failure-reporter-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'tests'));
  writeFileSync(
    join(dir, 'playwright.config.js'),
    `module.exports = {
  testDir: './tests',
  outputDir: './test-results',
  retries: 1,
  projects: [{ name: 'unit' }],
  reporter: [['line'], [${JSON.stringify(REPORTER)}, ${JSON.stringify(reporterOptions)}]],
};`,
  );
  writeFileSync(
    join(dir, 'tests', 'sample.spec.js'),
    `const { test, expect } = require(${JSON.stringify(PLAYWRIGHT_TEST)});
test.describe('sample', () => {
  test('passes', () => expect(1).toBe(1));
  test('fails', () => expect(1).toBe(2));
  test.fail('fails as expected', () => expect(1).toBe(2));
  test.skip('is skipped', () => {});
${extraTests}});`,
  );
  return dir;
};

const runSuite = (dir: string, env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', '-c', join(dir, 'playwright.config.js')], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, CI: '', FORCE_COLOR: '0', ...env },
  });

const readRecords = (file: string) =>
  readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FailureRecord);

describe('FailureReporter', () => {
  it('writes one line per failed attempt, next to the config by default', () => {
    const dir = makeSuite();

    const result = runSuite(dir);

    expect(result.stdout).toContain(`${FAILURES_FILE_LINE_PREFIX}${join(dir, DEFAULT_FAILURES_FILE_NAME)}\n`);
    const records = readRecords(join(dir, DEFAULT_FAILURES_FILE_NAME));
    expect(records.map((record) => [record.test, record.retry])).toEqual([
      ['sample > fails', 0],
      ['sample > fails', 1],
    ]);
    expect(records[0]).toMatchObject({
      location: 'tests/sample.spec.js:4',
      project: 'unit',
      status: 'failed',
    });
    expect(records[0]?.error).toContain('toBe');
    expect(records[0]?.detail).toBeNull();
    expect(records[0]?.error).not.toContain(String.fromCharCode(27));
  }, 60_000);

  it('keeps the first url past the error lines in detail', () => {
    const dir = makeSuite(
      {},
      `test.describe.configure({ retries: 0 });
  test('refused', () => {
    throw new Error(['Console errors', '', 'expect(received)', '', '- Expected  - 1', '+ Received  + 3', '', '+   "GET http://localhost:4310/entries -> net::ERR_CONNECTION_REFUSED",'].join('\\n'));
  });
`,
    );

    runSuite(dir);

    const record = readRecords(join(dir, DEFAULT_FAILURES_FILE_NAME)).find(
      (entry) => entry.test === 'sample > refused',
    );
    expect(record?.error).not.toContain('4310');
    expect(record?.detail).toContain('http://localhost:4310/entries');
  }, 60_000);

  it('takes the env path over the option, and empties the file at the start of a run', () => {
    const dir = makeSuite({ outputFile: 'from-option.jsonl' });
    const file = join(dir, 'from-env.jsonl');
    writeFileSync(file, '{"stale":true}\n');

    runSuite(dir, { E2E_FAILURES_FILE: file });

    expect(existsSync(join(dir, 'from-option.jsonl'))).toBe(false);
    expect(readRecords(file)).toHaveLength(2);
  }, 60_000);

  it('warns when the file is inside the outputDir', () => {
    const dir = makeSuite({ outputFile: 'test-results/failures.jsonl' });

    const result = runSuite(dir);

    expect(result.stderr + result.stdout).toContain('is inside the outputDir');
  }, 60_000);
});
