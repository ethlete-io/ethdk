#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { changedLines, runRepeatGate, TRIGGERS } from './studio-e2e-repeat.mjs';

const root = resolve(import.meta.dirname, '../..');
const RUNNER = 'apps/ethlete-studio/e2e/canvas.e2e.mjs';

export const STEPS = ['cli', 'studio', 'e2e', 'repeat'];
export const TESTED_PATHS = ['apps/ethlete-studio/', 'libs/'];
export const EXEMPT_PATHS = [/^plans\//, /^\.changeset\//, /\.md$/];

export const parseArgs = (argv) => {
  const at = argv.indexOf('--only');
  const only = at === -1 ? undefined : argv[at + 1];
  const range = argv.find((arg, index) => !arg.startsWith('--') && index !== at + 1);

  return { only, range: range ?? '@{upstream}..HEAD' };
};

export const blockingDirt = (files) =>
  files.filter((file) => TESTED_PATHS.some((path) => file.startsWith(path)) && !file.endsWith('.md'));

export const missingVerdict = (commits, hasOk) => {
  for (const { sha, files } of commits) {
    if (hasOk(sha)) return undefined;
    if (files.some((file) => !EXEMPT_PATHS.some((path) => path.test(file)))) return sha;
  }
  return undefined;
};

export const parseLog = (output) =>
  output
    .split('\0')
    .filter((entry) => entry.trim())
    .map((entry) => {
      const [sha, ...files] = entry.split('\n').filter(Boolean);
      return { sha, files };
    });

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

export const verdictFileOf = (sha) =>
  join(resolve(root, git('rev-parse', '--git-path', 'push-suite').stdout.trim()), sha);

const seconds = (ms) => `${(ms / 1000).toFixed(0)} s`;

const runStep = (command, args) =>
  new Promise((done) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, NX_NO_CLOUD: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (status) => done({ status: status ?? 1, output }));
  });

export const pushSuite = async ({ only, range }, log = console.log) => {
  const sha = git('rev-parse', 'HEAD').stdout.trim();
  const dirty = blockingDirt(git('diff', '--name-only', 'HEAD').stdout.split('\n').filter(Boolean));
  const finish = (verdict) => {
    log(`push-suite: ${verdict}`);
    if (only) log(`push-suite: --only ${only} writes no verdict file`);
    else {
      const file = verdictFileOf(sha);
      mkdirSync(resolve(file, '..'), { recursive: true });
      writeFileSync(file, `${verdict}\n`);
    }
    return verdict.startsWith('ok') ? 0 : 1;
  };

  if (only && !STEPS.includes(only)) return finish(`blocked unknown step ${only}, expected one of ${STEPS.join(', ')}`);
  if (dirty.length) return finish(`blocked uncommitted tracked changes the suite would test: ${dirty.join(', ')}`);

  const copy = join(root, 'apps/ethlete-studio/e2e', `.push-suite-${sha.slice(0, 12)}.e2e.mjs`);
  const removeCopy = () => rmSync(copy, { force: true });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
    process.once(signal, () => {
      removeCopy();
      process.exit(1);
    });
  writeFileSync(copy, git('show', `HEAD:${RUNNER}`).stdout);

  const steps = {
    cli: () => runStep('npx', ['nx', 'test', 'cli']),
    studio: () => runStep('npx', ['nx', 'test', 'ethlete-studio']),
    e2e: () => runStep(process.execPath, [copy]),
    repeat: async () => {
      const diff = git('diff', '-U0', range, '--', ...TRIGGERS);
      if (diff.status !== 0) return { status: 1, output: diff.stderr };
      const lines = [];
      const status = await runRepeatGate(diff.stdout, { log: (line) => lines.push(line), runner: copy });
      const touched = [...changedLines(diff.stdout).keys()].length;
      return { status, output: lines.join('\n'), note: touched ? undefined : `no trigger change in ${range}` };
    },
  };

  try {
    for (const name of only ? [only] : STEPS) {
      const startedAt = performance.now();
      const { status, output, note } = await steps[name]();
      log(
        `push-suite: ${name} ${status === 0 ? 'ok' : 'failed'} in ${seconds(performance.now() - startedAt)}${note ? ` (${note})` : ''}`,
      );
      if (status !== 0) {
        log(output.split('\n').slice(-40).join('\n'));
        return finish(`blocked ${name} failed at ${sha}`);
      }
      if (name === 'repeat' && output) log(output);
    }
    const drift = blockingDirt(git('diff', '--name-only', 'HEAD').stdout.split('\n').filter(Boolean));
    if (drift.length)
      log(`push-suite: tracked files changed during the run and may have been tested: ${drift.join(', ')}`);
    return finish(`ok ${sha}`);
  } finally {
    removeCopy();
  }
};

export const checkPush = (base, sha, log = console.error) => {
  if (process.env['PUSH_SUITE_SKIP'] === '1') return 0;
  const commits = parseLog(git('log', '--format=%x00%H', '--name-only', `${base}..${sha}`).stdout);
  const hasOk = (commit) => {
    const file = verdictFileOf(commit);
    return existsSync(file) && readFileSync(file, 'utf8').startsWith('ok ');
  };
  const missing = missingVerdict(commits, hasOk);
  if (!missing) return 0;
  log(
    `pre-push: ${missing.slice(0, 10)} changes more than plans/, .changeset/ or Markdown, and no later commit in this push has an ok verdict. Run \`yarn push:suite\` on this HEAD and push after \`push-suite: ok\`; PUSH_SUITE_SKIP=1 skips the check for a push the suite does not cover.`,
  );
  return 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  process.exit(argv[0] === '--check' ? checkPush(argv[1], argv[2]) : await pushSuite(parseArgs(argv)));
}
