#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { changedLines, runRepeatGate, TRIGGERS } from './studio-e2e-repeat.mjs';

const root = resolve(import.meta.dirname, '../..');
const RUNNER = 'apps/ethlete-studio/e2e/canvas.e2e.mjs';
const WORKSPACE_PARENTS = ['apps', 'libs', 'tools'];
const DRAWING_BUILDS = ['cli', 'components', 'core'];

export const STEPS = ['cli', 'studio', 'e2e', 'repeat'];
export const EXEMPT_PATHS = [/^plans\//, /^\.changeset\//, /\.md$/];

export const parseArgs = (argv) => {
  const at = argv.indexOf('--only');
  const only = at === -1 ? undefined : argv[at + 1];
  const range = argv.find((arg, index) => !arg.startsWith('--') && index !== at + 1);

  return { only, range: range ?? '@{upstream}..HEAD' };
};

export const linkTargetOf = (repo, entry, link) => {
  if (link === undefined || isAbsolute(link)) return entry;
  const target = relative(repo, resolve(dirname(entry), link)).split(sep);
  const intoWorkspace = target[0] !== '..' && !target.includes('node_modules');
  return intoWorkspace ? link : entry;
};

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

const linkDependencies = (from, to) => {
  mkdirSync(to);
  for (const name of readdirSync(from)) {
    const entry = join(from, name);
    const link = lstatSync(entry).isSymbolicLink() ? readlinkSync(entry) : undefined;
    if (link === undefined && name.startsWith('@')) linkDependencies(entry, join(to, name));
    else symlinkSync(linkTargetOf(root, entry, link), join(to, name));
  }
};

const exportCommit = (sha) => {
  const dir = mkdtempSync(join(tmpdir(), `push-suite-${sha.slice(0, 12)}-`));
  const extract = spawnSync('bash', ['-c', 'set -o pipefail; git archive "$1" | tar -x -C "$2"', 'export', sha, dir], {
    cwd: root,
    encoding: 'utf8',
  });
  if (extract.status !== 0) return { dir, error: extract.stderr.trim() || `git archive exited ${extract.status}` };
  linkDependencies(join(root, 'node_modules'), join(dir, 'node_modules'));
  for (const parent of WORKSPACE_PARENTS)
    for (const name of readdirSync(join(dir, parent))) {
      const dependencies = join(root, parent, name, 'node_modules');
      if (existsSync(dependencies)) linkDependencies(dependencies, join(dir, parent, name, 'node_modules'));
    }
  return { dir };
};

const runStep = (command, args, cwd) =>
  new Promise((done) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (status) => done({ status: status ?? 1, output }));
  });

export const pushSuite = async ({ only, range }, log = console.log) => {
  const sha = git('rev-parse', 'HEAD').stdout.trim();
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

  Object.assign(process.env, { NX_NO_CLOUD: 'true', NX_DAEMON: 'false' });
  delete process.env['STUDIO_CLI_ENTRY'];
  const exportedAt = performance.now();
  const { dir, error } = exportCommit(sha);
  const removeExport = () => rmSync(dir, { recursive: true, force: true });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
    process.once(signal, () => {
      removeExport();
      process.exit(1);
    });

  let built;
  const buildDrawingLibs = () =>
    (built ??= runStep('npx', ['nx', 'run-many', '-t', 'build', '-p', ...DRAWING_BUILDS], dir));
  const afterBuild = async (run) => {
    const build = await buildDrawingLibs();
    return build.status === 0 ? run() : build;
  };

  const steps = {
    cli: () => runStep('npx', ['nx', 'test', 'cli'], dir),
    studio: () => runStep('npx', ['nx', 'test', 'ethlete-studio'], dir),
    e2e: () => afterBuild(() => runStep(process.execPath, [join(dir, RUNNER)], dir)),
    repeat: () =>
      afterBuild(async () => {
        const diff = git('diff', '-U0', range, '--', ...TRIGGERS);
        if (diff.status !== 0) return { status: 1, output: diff.stderr };
        const lines = [];
        const status = await runRepeatGate(diff.stdout, { log: (line) => lines.push(line), cwd: dir });
        const touched = [...changedLines(diff.stdout).keys()].length;
        return { status, output: lines.join('\n'), note: touched ? undefined : `no trigger change in ${range}` };
      }),
  };

  try {
    if (error) return finish(`blocked export of ${sha} failed: ${error}`);
    log(`push-suite: exported ${sha.slice(0, 12)} to ${dir} in ${seconds(performance.now() - exportedAt)}`);
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
    return finish(`ok ${sha}`);
  } finally {
    removeExport();
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
