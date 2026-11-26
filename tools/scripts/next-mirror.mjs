#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const USAGE = `usage: next-mirror.mjs watch [--repo <dir>] [--branch next] [--every <s>]
       next-mirror.mjs run [--repo <dir>] <rev>
       next-mirror.mjs status`;

export const POLL_SECONDS = 15;
export const MIRROR_STEPS = 'lint,tools,coverage';

export const mirrorDir = (env = process.env) => env['ETHLETE_MIRROR_DIR'] || '/tmp/ethlete-mirror';

/** Returns `env` without any `GIT_*` variable, so git and specs started from a hook never reach the hook's repo. */
export const cleanGitEnv = (env = process.env) =>
  Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));

export const parseArgs = (argv) => {
  const [command, ...rest] = argv;
  const opts = { command, repo: resolve(HERE, '../..'), branch: 'next', every: POLL_SECONDS, rev: undefined };
  if (!['watch', 'run', 'status'].includes(command)) throw new Error(USAGE);
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i].replace(/^--/, '');
    if (rest[i].startsWith('--')) {
      if (!['repo', 'branch', 'every'].includes(key) || rest[i + 1] === undefined) throw new Error(USAGE);
      opts[key] = key === 'every' ? Number(rest[++i]) : rest[++i];
    } else opts.rev = rest[i];
  }
  if (command === 'run' && !opts.rev) throw new Error(USAGE);
  opts.repo = resolve(opts.repo);
  return opts;
};

export const mirrorSuite = (sha, parent) =>
  `node tools/scripts/push-suite.mjs --only ${MIRROR_STEPS} ${parent}..${sha}`;

/** Reads the push-suite outcome out of a remote-run log; infrastructure failures are `error`, never `red`. */
export const verdictOf = (code, output) => {
  const checks = output.match(/push-suite: blocked pre-push checks failed \(([^)]*)\)/);
  if (checks) return { status: 'red', step: `checks: ${checks[1]}` };
  const step = output.match(/push-suite: blocked (\w+) failed at [0-9a-f]+/);
  if (step) return { status: 'red', step: step[1] };
  if (code === 0 && /push-suite: ok [0-9a-f]+/.test(output)) return { status: 'green', step: undefined };
  const blocked = output.match(/push-suite: (blocked .*)/);
  const lastLine = output.trim().split('\n').at(-1) ?? '';
  return { status: 'error', step: (blocked?.[1] ?? lastLine).trim().slice(0, 200) || `exit ${code}` };
};

export const verdictLine = ({ at, sha, status, step, subject }) =>
  `${at} ${sha.slice(0, 12)} ${status.toUpperCase()}${step ? ` [${step}]` : ''} ${subject}`;

const gitIn = (repo) => (args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: cleanGitEnv() });

/** Commits on `head` not yet mirrored, oldest first; only `head` when `last` is not its ancestor (a rewrite). */
export const newCommits = (git, last, head) => {
  if (!last || last === head) return last ? [] : [head];
  if (git(['merge-base', '--is-ancestor', last, head]).status !== 0) return [head];
  return git(['rev-list', '--reverse', '--first-parent', `${last}..${head}`])
    .stdout.split('\n')
    .filter(Boolean);
};

const spawnRemoteRun = ({ repo, sha, suite, log }) =>
  new Promise((done) => {
    const child = spawn(
      process.execPath,
      [
        join(HERE, 'remote-run.mjs'),
        '--host',
        'rack',
        '--linux',
        '--ref',
        sha,
        '--slot',
        'mirror',
        '--log',
        log,
        '--',
        suite,
      ],
      { cwd: repo, env: cleanGitEnv(), stdio: ['ignore', 'ignore', 'ignore'] },
    );
    child.on('error', () => done(255));
    child.on('close', (code) => done(code ?? 255));
  });

/** Runs the push-suite steps for `sha` on the rack and writes `<dir>/<sha>.json` plus a line in `<dir>/verdicts.log`. */
export const mirrorCommit = async ({
  repo,
  sha,
  dir = mirrorDir(),
  remote = spawnRemoteRun,
  now = () => new Date(),
}) => {
  const git = gitIn(repo);
  const parent = git(['rev-parse', '--verify', `${sha}^`]).stdout.trim();
  const subject = git(['log', '-1', '--format=%s', sha]).stdout.trim();
  mkdirSync(join(dir, 'logs'), { recursive: true });
  const log = join(dir, 'logs', `${sha}.log`);
  rmSync(log, { force: true });
  const startedAt = now();
  writeFileSync(
    join(dir, 'running.json'),
    JSON.stringify({ sha, subject, startedAt: startedAt.toISOString(), log, pid: process.pid }),
  );
  const code = parent ? await remote({ repo, sha, suite: mirrorSuite(sha, parent), log }) : 2;
  const output = existsSync(log) ? readFileSync(log, 'utf8') : '';
  const { status, step } = parent ? verdictOf(code, output) : { status: 'error', step: 'no parent commit' };
  const finishedAt = now();
  const verdict = {
    sha,
    subject,
    status,
    step,
    exitCode: code,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    seconds: Math.round((finishedAt - startedAt) / 1000),
    log,
  };
  const line = verdictLine({ at: verdict.finishedAt, ...verdict });
  writeFileSync(join(dir, `${sha}.json`), `${JSON.stringify(verdict, null, 2)}\n`);
  appendFileSync(join(dir, 'verdicts.log'), `${line}\n`);
  writeFileSync(join(dir, 'latest.txt'), `${line}\n`);
  rmSync(join(dir, 'running.json'), { force: true });
  return verdict;
};

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** The recorded mirror run, `died` when its process no longer exists; undefined when none is recorded. */
export const runningState = (dir) => {
  const file = join(dir, 'running.json');
  if (!existsSync(file)) return undefined;
  const record = JSON.parse(readFileSync(file, 'utf8'));
  return { state: record.pid && alive(record.pid) ? 'running' : 'died', record };
};

/** Polls `branch` of `repo` and mirrors each new commit in order; one watcher per mirror dir. */
export const watch = async ({ repo, branch, every, dir = mirrorDir(), log = console.log }) => {
  mkdirSync(dir, { recursive: true });
  const pidFile = join(dir, 'watch.pid');
  const holder = existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8')) : 0;
  if (holder && holder !== process.pid && alive(holder)) throw new Error(`next-mirror: watcher ${holder} already runs`);
  writeFileSync(pidFile, String(process.pid));
  const stateFile = join(dir, 'state.json');
  const git = gitIn(repo);
  const headOf = () => git(['rev-parse', '--verify', `refs/heads/${branch}`]).stdout.trim();
  let last = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')).last : headOf();
  writeFileSync(stateFile, JSON.stringify({ last }));
  log(`next-mirror: watching ${branch} of ${repo} from ${last.slice(0, 12)}, verdicts in ${dir}`);
  for (;;) {
    const head = headOf();
    for (const sha of head ? newCommits(git, last, head) : []) {
      log(`next-mirror: mirroring ${sha.slice(0, 12)}`);
      const verdict = await mirrorCommit({ repo, sha, dir });
      log(`next-mirror: ${verdictLine({ at: verdict.finishedAt, ...verdict })}`);
      last = sha;
      writeFileSync(stateFile, JSON.stringify({ last }));
    }
    await new Promise((done) => setTimeout(done, every * 1000));
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
  const dir = mirrorDir();
  if (opts.command === 'status') {
    const latest = join(dir, 'latest.txt');
    const running = runningState(dir);
    if (running) console.log(`${running.state} ${JSON.stringify(running.record)}`);
    console.log(existsSync(latest) ? readFileSync(latest, 'utf8').trim() : 'no verdict yet');
  } else if (opts.command === 'run') {
    const sha = gitIn(opts.repo)(['rev-parse', '--verify', `${opts.rev}^{commit}`]).stdout.trim();
    if (!sha) {
      process.stderr.write(`next-mirror: cannot resolve ${opts.rev}\n`);
      process.exit(2);
    }
    const verdict = await mirrorCommit({ repo: opts.repo, sha, dir });
    console.log(verdictLine({ at: verdict.finishedAt, ...verdict }));
    process.exitCode = verdict.status === 'green' ? 0 : 1;
  } else await watch({ ...opts, dir });
}
