#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const valueOf = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);

if (args.includes('--help')) {
  console.log(`Usage: yarn studio:release-smoke [--app <Ethlete Studio.app>] [options]

Starts a Studio release bundle once, opens a sketch and fails on a CSP refusal or any console error the
bundle writes to its console log (ETHLETE_STUDIO_CONSOLE_LOG). Without --app it builds a bundle first
(macOS, CEF, a few minutes when warm).

  --app <path>        a Studio bundle, e.g. dist/studio-release-smoke/<label>/Ethlete Studio.app
  --csp-from <rev>    build with the app.security block of tauri.conf.json at <rev> (the bite)
  --build-only        build, print the bundle path, do not run it
  --checkout <dir>    design checkout Studio opens (default: this repo)
  --product <name>    design product (default: sdk)
  --sketch <target>   sketch to open (default: components/button)
  --timeout <s>       how long the sketch may take to paint (default: 120)
  --record <file>     copy the console log the bundle wrote`);
  process.exit(0);
}

const CEF_CLI = '@tauri-apps/cli-cef@3.0.0-alpha.27';
const LOG_ENV = 'ETHLETE_STUDIO_CONSOLE_LOG';
const VIEW_ENV = 'ETHLETE_STUDIO_SMOKE_VIEW';
const MARKER = '[studio-release-smoke]';
const CSP = 'Content Security Policy';
const IDENTIFIER = 'io.ethlete.studio';
const SETTLE_MS = 8000;

const checkout = resolve(valueOf('--checkout', root));
const product = valueOf('--product', 'sdk');
const sketch = valueOf('--sketch', 'components/button');
const timeoutMs = Number(valueOf('--timeout', '120')) * 1000;
const cspFrom = valueOf('--csp-from');
const record = valueOf('--record');

const run = (command, commandArgs, options = {}) =>
  execFileSync(command, commandArgs, { stdio: 'inherit', ...options });

const securityPatch = (rev) => {
  const current = JSON.parse(readFileSync(join(root, 'apps/ethlete-studio/src-tauri/tauri.conf.json'), 'utf8'));
  const old = JSON.parse(
    execFileSync('git', ['-C', root, 'show', `${rev}:apps/ethlete-studio/src-tauri/tauri.conf.json`], {
      encoding: 'utf8',
    }),
  );
  const security = { ...old.app.security };

  for (const key of Object.keys(current.app.security)) if (!(key in security)) security[key] = null;

  return { app: { security } };
};

const build = () => {
  if (process.platform !== 'darwin') throw new Error('the build step knows the macOS CEF bundle only');

  const label = cspFrom ? `csp-${cspFrom.replace(/[^\w.-]/g, '_')}` : 'head';
  const out = join(root, 'dist/studio-release-smoke', label);
  const worktree = mkdtempSync(join(tmpdir(), 'studio-release-smoke-'));

  run('git', ['-C', root, 'worktree', 'add', '--quiet', '--detach', worktree, 'HEAD']);

  try {
    symlinkSync(join(root, 'node_modules'), join(worktree, 'node_modules'));

    const buildArgs = ['--yes', `--package=${CEF_CLI}`, 'tauri', 'build', '--bundles', 'app', '--no-sign'];

    if (cspFrom) {
      const configFile = join(worktree, 'smoke-config.json');

      writeFileSync(configFile, JSON.stringify(securityPatch(cspFrom)));
      buildArgs.push('--config', configFile);
    }

    run('npx', buildArgs, {
      cwd: join(worktree, 'apps/ethlete-studio'),
      env: {
        ...process.env,
        CARGO_TARGET_DIR: join(root, 'dist/studio-release-smoke/target'),
        NX_DAEMON: 'false',
        NX_NO_CLOUD: 'true',
      },
    });

    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    cpSync(
      join(root, 'dist/studio-release-smoke/target/release/bundle/macos/Ethlete Studio.app'),
      join(out, 'Ethlete Studio.app'),
      {
        recursive: true,
        verbatimSymlinks: true,
      },
    );
  } finally {
    run('git', ['-C', root, 'worktree', 'remove', '--force', worktree]);
  }

  return join(out, 'Ethlete Studio.app');
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const descendants = (pid) => {
  const rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((row) => row.trim().split(/\s+/).map(Number));
  const found = [pid];

  for (let i = 0; i < found.length; i++) {
    for (const [child, parent] of rows) if (parent === found[i]) found.push(child);
  }

  return found;
};

const stop = async (pid) => {
  const all = descendants(pid);

  for (const signal of ['SIGTERM', 'SIGKILL']) {
    for (const each of all) {
      try {
        process.kill(each, signal);
      } catch {
        // Already gone.
      }
    }

    await sleep(3000);
  }
};

const screenLocked = () =>
  process.platform === 'darwin' &&
  /<key>CGSSessionScreenIsLocked<\/key>\s*<true\/>/.test(
    execFileSync('ioreg', ['-n', 'Root', '-d1', '-a'], { encoding: 'utf8' }),
  );

const readLog = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');

const smoke = async (app) => {
  const binary = join(app, 'Contents/MacOS/ethlete-studio');

  if (!existsSync(binary)) throw new Error(`no Studio binary at ${binary}`);

  const home = mkdtempSync(join(tmpdir(), 'studio-release-smoke-home-'));
  const config = join(home, 'Library/Application Support', IDENTIFIER);
  const log = join(home, 'console.log');

  mkdirSync(config, { recursive: true });
  writeFileSync(join(config, 'design-roots.json'), JSON.stringify({ search: '', roots: [checkout] }));

  const studio = spawn(binary, [], {
    env: {
      ...process.env,
      HOME: home,
      [LOG_ENV]: log,
      [VIEW_ENV]: JSON.stringify({ checkout, systemProduct: product, systemEntry: `sketch:${sketch}` }),
    },
    stdio: 'ignore',
  });
  let painted;

  try {
    const until = Date.now() + timeoutMs;

    while (!painted && Date.now() < until) {
      await sleep(500);
      painted = readLog(log)
        .split('\n')
        .find((line) => line.includes(MARKER));
    }

    if (painted) await sleep(SETTLE_MS);

    return { painted: painted?.slice(painted.indexOf(MARKER) + MARKER.length).trim(), text: readLog(log) };
  } finally {
    await stop(studio.pid);
    rmSync(home, { recursive: true, force: true });
  }
};

const problems = (text) => {
  const counts = new Map();

  for (const raw of text.split('\n')) {
    const line = raw.replace(/^\d+ ERROR /, '').trim();

    if (!line || line.includes(MARKER)) continue;

    const seen = counts.get(line) ?? { line, count: 0, refusal: line.includes(CSP) };

    seen.count += 1;
    counts.set(line, seen);
  }

  const all = [...counts.values()];

  return { refusals: all.filter((p) => p.refusal), errors: all.filter((p) => !p.refusal) };
};

const app = valueOf('--app') ? resolve(valueOf('--app')) : build();

if (args.includes('--build-only')) {
  console.log(app);
  process.exit(0);
}

const locked = screenLocked();
const { painted, text } = await smoke(app);

if (record) writeFileSync(record, text);

const { refusals, errors } = problems(text);
const show = (kind, found) => {
  for (const { line, count } of found) console.log(`${kind} (x${count}): ${line}`);
};

show('CSP refusal', refusals);
show('console error', errors);

const ok = Boolean(painted) && refusals.length === 0 && errors.length === 0;
const notPainted = `no frame painted in ${timeoutMs / 1000} s${locked ? ' (the screen is locked)' : ''}`;

console.log(
  `${ok ? 'PASS' : 'FAIL'}  ${product} ${sketch}: ${painted ?? notPainted}, ` +
    `${refusals.length} CSP refusals, ${errors.length} console errors`,
);

process.exit(ok ? 0 : 1);
