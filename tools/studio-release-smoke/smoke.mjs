#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { consoleProblems } from './cdp-log.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const valueOf = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);

if (args.includes('--help')) {
  console.log(`Usage: yarn studio:release-smoke [--app <Ethlete Studio.app>] [options]

Starts a Studio release bundle once, opens a sketch and fails on a CSP refusal or any console error.
Without --app it builds a bundle first (macOS, CEF, a few minutes when warm).

  --app <path>        a bundle this script built before (dist/studio-release-smoke/<label>/Ethlete Studio.app)
  --csp-from <rev>    build with the app.security block of tauri.conf.json at <rev> (the bite)
  --build-only        build, print the bundle path, do not run it
  --checkout <dir>    design checkout Studio opens (default: this repo)
  --product <name>    design product (default: sdk)
  --sketch <target>   sketch to open (default: components/button)
  --timeout <s>       how long the sketch may take to paint (default: 120)
  --record <file>     write the raw CDP console events as JSON`);
  process.exit(0);
}

const CDP_PORT = 9339;
const CEF_CLI = '@tauri-apps/cli-cef@3.0.0-alpha.27';
const RUNTIME_ANCHOR = 'builder.runtime(tauri_runtime_cef::Cef::default())';
const RUNTIME_WITH_PORT = `builder.runtime(tauri_runtime_cef::Cef::default().remote_debugging(tauri_runtime_cef::RemoteDebugging::Port { port: ${CDP_PORT}, allowed_origins: Vec::new() }).command_line_args([("--disable-backgrounding-occluded-windows", None::<&str>), ("--disable-renderer-backgrounding", None)]))`;
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

    const libRs = join(worktree, 'apps/ethlete-studio/src-tauri/src/lib.rs');
    const source = readFileSync(libRs, 'utf8');

    if (!source.includes(RUNTIME_ANCHOR)) throw new Error(`lib.rs no longer contains ${RUNTIME_ANCHOR}`);

    writeFileSync(libRs, source.replace(RUNTIME_ANCHOR, RUNTIME_WITH_PORT));

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

const cdpReachable = async () => {
  try {
    return (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok;
  } catch {
    return false;
  }
};

const waitFor = async (probe, ms, what) => {
  const until = Date.now() + ms;

  while (Date.now() < until) {
    const value = await probe();

    if (value) return value;

    await sleep(500);
  }

  throw new Error(`timed out after ${ms / 1000} s waiting for ${what}`);
};

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

const connect = async (url) => {
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = [];
  let nextId = 1;

  await new Promise((opened, failed) => {
    socket.addEventListener('open', opened, { once: true });
    socket.addEventListener('error', failed, { once: true });
  });

  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);

    if (message.id && pending.has(message.id)) {
      const { resolve: answer, reject } = pending.get(message.id);

      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else answer(message.result);
    } else if (message.method) {
      for (const listener of listeners) listener(message);
    }
  });

  return {
    send: (method, params = {}, sessionId) =>
      new Promise((answer, reject) => {
        const id = nextId++;

        pending.set(id, { resolve: answer, reject });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
        setTimeout(() => {
          if (pending.delete(id)) reject(new Error(`${method} got no answer in 15 s`));
        }, 15000);
      }),
    on: (listener) => listeners.push(listener),
    close: () => socket.close(),
  };
};

const screenLocked = () =>
  process.platform === 'darwin' &&
  /<key>CGSSessionScreenIsLocked<\/key>\s*<true\/>/.test(
    execFileSync('ioreg', ['-n', 'Root', '-d1', '-a'], { encoding: 'utf8' }),
  );

const smoke = async (app) => {
  if (screenLocked()) throw new Error('the screen is locked; a CEF window renders nothing then, so unlock it first');

  const binary = join(app, 'Contents/MacOS/ethlete-studio');

  if (!existsSync(binary)) throw new Error(`no Studio binary at ${binary}`);
  if (await cdpReachable()) throw new Error(`port ${CDP_PORT} already answers; stop the other Studio first`);

  const home = mkdtempSync(join(tmpdir(), 'studio-release-smoke-home-'));
  const config = join(home, 'Library/Application Support', IDENTIFIER);

  mkdirSync(config, { recursive: true });
  writeFileSync(join(config, 'design-roots.json'), JSON.stringify({ search: '', roots: [checkout] }));

  const studio = spawn(binary, [], { env: { ...process.env, HOME: home }, stdio: 'ignore' });
  const events = [];

  try {
    await waitFor(cdpReachable, 60000, `the DevTools port ${CDP_PORT} (a bundle not built by this script has none)`);

    const page = await waitFor(
      async () =>
        (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find((target) => target.type === 'page'),
      30000,
      'the Studio page',
    );
    const cdp = await connect(page.webSocketDebuggerUrl);
    const enable = async (sessionId) => {
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Log.enable', {}, sessionId);
      await cdp.send(
        'Target.setAutoAttach',
        { autoAttach: true, waitForDebuggerOnStart: true, flatten: true },
        sessionId,
      );
      await cdp.send('Runtime.runIfWaitingForDebugger', {}, sessionId);
    };

    cdp.on((message) => {
      if (message.method === 'Target.attachedToTarget') {
        enable(message.params.sessionId).catch(() => undefined);
      } else if (/^(Log\.entryAdded|Runtime\.consoleAPICalled|Runtime\.exceptionThrown)$/.test(message.method)) {
        events.push({ method: message.method, params: message.params });
      }
    });

    await enable();

    const evaluate = async (expression) =>
      (await cdp.send('Runtime.evaluate', { expression, returnByValue: true })).result.value;

    await evaluate(
      `localStorage.clear(); localStorage.setItem('ethlete-studio.call-view', ${JSON.stringify(
        JSON.stringify({ checkout, systemProduct: product, systemEntry: `sketch:${sketch}` }),
      )}); location.reload(); true`,
    );
    await sleep(1000);

    const count = () =>
      evaluate(`({
        live: document.querySelectorAll('ethlete-sketch-view iframe[data-state]').length,
        painted: document.querySelectorAll('ethlete-sketch-view iframe[data-state]:not(.opacity-0)').length,
        text: document.body.innerText.slice(0, 200),
      })`).catch(() => undefined);

    let frames;

    try {
      frames = await waitFor(
        async () => {
          const seen = await count();

          return seen?.painted ? seen : undefined;
        },
        timeoutMs,
        `a painted frame of ${product} ${sketch}`,
      );
      await sleep(SETTLE_MS);
      frames = (await count()) ?? frames;
    } catch (error) {
      frames = { ...(await count()), error: error.message };
    }

    cdp.close();

    return { frames, events };
  } finally {
    await stop(studio.pid);
    rmSync(home, { recursive: true, force: true });
  }
};

const app = valueOf('--app') ? resolve(valueOf('--app')) : build();

if (args.includes('--build-only')) {
  console.log(app);
  process.exit(0);
}

const { frames, events } = await smoke(app);

if (record) writeFileSync(record, `${JSON.stringify(events, null, 2)}\n`);

const { refusals, errors } = consoleProblems(events);
const show = (kind, problems) => {
  for (const { line, url, count } of problems) console.log(`${kind} (x${count})${url ? ` ${url}` : ''}: ${line}`);
};

show('CSP refusal', refusals);
show('console error', errors);

const ok = !frames.error && refusals.length === 0 && errors.length === 0;

console.log(
  `${ok ? 'PASS' : 'FAIL'}  ${product} ${sketch}: ${frames.painted ?? 0} of ${frames.live ?? 0} live frames painted, ` +
    `${refusals.length} CSP refusals, ${errors.length} console errors${frames.error ? `; ${frames.error}` : ''}`,
);

if (frames.error) console.log(`page text: ${JSON.stringify(frames.text ?? '')}`);

process.exit(ok ? 0 : 1);
