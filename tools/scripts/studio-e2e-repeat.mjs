#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const RUNNER = 'apps/ethlete-studio/e2e/canvas.e2e.mjs';
const SHARED = ['libs/cli/src/lib/design/serve.ts', 'libs/cli/src/lib/design/studio-api.ts'];

export const RUNS = 3;
export const HOLD_LISTINGS_MS = 14000;
export const DELAY_PICTURES_MS = 60000;
export const TRIGGERS = [RUNNER, ...SHARED];

export const changedLines = (diff) => {
  const lines = new Map();
  let file;

  for (const line of diff.split('\n')) {
    const target = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/.exec(line);
    if (target) {
      file = target[1];
      if (file && !lines.has(file)) lines.set(file, []);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let at = start; at < start + Math.max(count, 1); at++) lines.get(file).push(at);
    }
  }

  return lines;
};

export const caseSpans = (source) => {
  const rows = source.split('\n');
  const first = rows.indexOf('const CASES = [');
  const spans = [];
  if (first === -1) return spans;

  for (let at = first + 1, open; at < rows.length && rows[at] !== '];'; at++) {
    if (rows[at] === '  {') open = { start: at + 1 };
    const name =
      open &&
      !open.name &&
      (/^ {4}name: (['`])(.+)\1,$/.exec(rows[at]) ??
        (rows[at] === '    name:' ? /^ {6}(['`])(.+)\1,$/.exec(rows[at + 1] ?? '') : null));
    if (name) open.name = name[2];
    if (open && rows[at] === '  },') {
      spans.push({ ...open, end: at + 1 });
      open = undefined;
    }
  }

  return spans;
};

export const affectedCases = (changes, spans) => {
  const reasons = [];
  const cases = new Set();
  let all = false;

  for (const [file, lines] of changes) {
    if (SHARED.includes(file)) {
      all = true;
      reasons.push(`${file} serves every page`);
    }
    if (file !== RUNNER) continue;
    for (const line of lines) {
      const span = spans.find(({ start, end }) => line >= start && line <= end);
      if (span?.name) cases.add(span.name);
      else if (!all) {
        all = true;
        reasons.push(`${RUNNER} line ${line} is outside a case (fixtures, setup or helpers)`);
      }
    }
  }
  if (!all && cases.size) reasons.push(`${RUNNER} changes ${cases.size} case(s): ${[...cases].join('; ')}`);

  return { all, cases: all ? [] : [...cases], reasons };
};

const LIST_ROW = /^\s*[\d.]+s {2}(\S+)\s+(.+)$/;

export const parseList = (output) =>
  output
    .split('\n')
    .map((line) => LIST_ROW.exec(line))
    .filter(Boolean)
    .map(([, page, name]) => ({ page, name: name.trimEnd() }));

export const keyOf = ({ page, name }) => `${page}  ${name}`;

export const parseResults = (output, jobs) => {
  const results = new Map();

  for (const line of output.split('\n')) {
    const row = /^(?: {2}(✓|✘) +\d+ \[([^\]]+)\] › |(NOT RUN) {2}(\S+)\s+)(.*)$/.exec(line);
    if (!row) continue;
    const [, mark, resultPage, notRun, notRunPage, text] = row;
    const status = notRun ? 'NOT RUN' : mark === '✓' ? 'PASS' : 'FAIL';
    const page = resultPage ?? notRunPage;
    const rest = text.replace(/ \([\d.]+m?s\)$/, '');
    const job = jobs
      .filter((it) => it.page === page && (rest === it.name || rest.startsWith(`${it.name} `)))
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (job) results.set(keyOf(job), status === 'PASS' ? 'pass' : status === 'FAIL' ? 'fail' : 'not run');
  }

  return results;
};

export const repeatVerdict = (jobs, runs) => {
  const changed = [];
  const holdFailed = [];

  for (const job of jobs) {
    const results = runs.map((run) => run.results.get(keyOf(job)) ?? 'not run');
    if (new Set(results).size > 1) changed.push({ ...job, results });
    if (runs.some((run, at) => run.hold && results[at] !== 'pass')) holdFailed.push({ ...job, results });
  }

  return { changed, holdFailed, blocks: changed.length > 0 || holdFailed.length > 0 };
};

const listRunner = (runner, args, cwd) =>
  spawnSync(process.execPath, [runner, ...args], { cwd, encoding: 'utf8', env: process.env }).stdout;

export const runOnce = (runner, args, cwd, liveLog) =>
  new Promise((done) => {
    if (liveLog) {
      mkdirSync(dirname(liveLog), { recursive: true });
      writeFileSync(liveLog, '');
    }
    const child = spawn(process.execPath, [runner, ...args], { cwd, env: process.env });
    let output = '';
    const take = (chunk) => {
      output += chunk;
      if (liveLog) appendFileSync(liveLog, chunk);
      for (const line of String(chunk).split('\n')) if (/^( {2}[✓✘] |NOT RUN )/.test(line)) console.log(`  ${line}`);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', () => done(output));
  });

export const runArgs = (at, pageArgs, built) => [
  ...pageArgs,
  '--built',
  built,
  ...(at === RUNS - 1
    ? ['--hold-listings', String(HOLD_LISTINGS_MS), '--delay-pictures', String(DELAY_PICTURES_MS)]
    : []),
];

const minutes = (ms) => `${(ms / 60000).toFixed(1)} min`;

export const runRepeatGate = async (
  diff,
  { log = console.log, cwd = root, runner = join(cwd, RUNNER), liveLog } = {},
) => {
  const changes = new Map([...changedLines(diff)].filter(([file]) => TRIGGERS.includes(file)));
  if (!changes.size) return 0;

  const spans = caseSpans(readFileSync(runner, 'utf8'));
  const { all, cases, reasons } = affectedCases(changes, spans);
  if (!all && !cases.length) return 0;

  const groups = all
    ? undefined
    : [...new Set(parseList(listRunner(runner, ['--list', '--case', cases.join('|')], cwd)).map((job) => job.page))];
  const pageArgs = groups ? ['--page', groups.join('|')] : [];
  const listed = listRunner(runner, ['--list', ...pageArgs], cwd);
  const jobs = parseList(listed);
  const knownSeconds = Number(/cases, ([\d.]+)s by/.exec(listed)?.[1] ?? 0);

  log(`[studio-e2e-repeat] ${reasons.join('; ')}`);
  log(
    `[studio-e2e-repeat] runs ${jobs.length} case(s) of ${groups ? groups.join(', ') : 'every page group'} ${RUNS} times, the last with --hold-listings ${HOLD_LISTINGS_MS} --delay-pictures ${DELAY_PICTURES_MS}; it blocks when a case result changes between runs or fails in the hold run (${knownSeconds.toFixed(0)} s of cases per run by the last local timings)`,
  );

  const startedAt = performance.now();
  const built = mkdtempSync(join(tmpdir(), 'studio-e2e-repeat-'));
  const env = { ...process.env, NX_NO_CLOUD: 'true' };

  try {
    if (all) execFileSync('npx', ['nx', 'build', 'cli'], { cwd, stdio: 'ignore', env });
    execFileSync(
      'npx',
      ['nx', 'build', 'ethlete-studio', `--outputPath=${built}`, '--excludeTaskDependencies', '--skip-nx-cache'],
      { cwd, stdio: 'ignore', env },
    );

    const runs = [];
    for (let at = 0; at < RUNS; at++) {
      const hold = at === RUNS - 1;
      log(
        `[studio-e2e-repeat] run ${at + 1}/${RUNS}${hold ? ` (--hold-listings ${HOLD_LISTINGS_MS} --delay-pictures ${DELAY_PICTURES_MS})` : ''}`,
      );
      const output = await runOnce(runner, runArgs(at, pageArgs, built), cwd, liveLog);
      runs.push({ hold, results: parseResults(output, jobs) });
    }

    const verdict = repeatVerdict(jobs, runs);
    for (const job of verdict.changed) log(`CHANGED  ${job.page.padEnd(9)} ${job.name}: ${job.results.join(', ')}`);
    for (const job of verdict.holdFailed)
      log(`HOLD FAIL  ${job.page.padEnd(9)} ${job.name}: ${job.results.join(', ')}`);
    log(`[studio-e2e-repeat] ${verdict.blocks ? 'blocks' : 'stable'} after ${minutes(performance.now() - startedAt)}`);

    return verdict.blocks ? 1 : 0;
  } finally {
    rmSync(built, { recursive: true, force: true });
  }
};

export const repeatDiff = (cwd, paths) =>
  spawnSync('git', ['diff', '-U0', ...(paths.length ? ['HEAD', '--', ...paths] : ['--cached'])], {
    cwd,
    encoding: 'utf8',
  }).stdout;

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await runRepeatGate(repeatDiff(root, process.argv.slice(2))));
}
