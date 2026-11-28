#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { constants } from 'node:os';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const binary = resolve(
  args.includes('--binary')
    ? args[args.indexOf('--binary') + 1]
    : join(root, 'apps/ethlete-studio/src-tauri/target/debug/ethlete-studio'),
);
const only = args.includes('--case') ? args[args.indexOf('--case') + 1] : undefined;

const READY_TIMEOUT_MS = 60000;
const READY_HELPERS = 3;
const EXIT_LIMIT_MS = 20000;
const POLL_MS = 100;
const STABLE_POLL_MS = 20;
const STABLE_POLLS = 5;
const STDERR_TAIL = 2000;
const LOG_TAIL = 4000;
const WINDOW_ATTEMPTS = 3;
const STOP_TIMEOUT_MS = 5000;

// A thread name marks a moment inside cef::initialize: Chrome_IOThread starts while Chromium has
// reset the signals to their default, CrShutdownDetector shortly before Chromium installs its own
// handlers, so those cases also wait until the signal is caught again. The host is frozen at that
// moment and signalled while frozen; a host that had already reached setup missed the window.
const CASES = [
  { name: 'sigint', signal: 'SIGINT' },
  { name: 'sigint-inherited-ignore', signal: 'SIGINT', ignoreInterrupt: true },
  { name: 'sigterm', signal: 'SIGTERM' },
  { name: 'sighup', signal: 'SIGHUP' },
  { name: 'sigint-during-cef-init', signal: 'SIGINT', atThread: 'Chrome_IOThread' },
  { name: 'sigint-at-chromium-handlers', signal: 'SIGINT', atThread: 'CrShutdownDetec', caughtAgain: true },
  { name: 'sigterm-at-chromium-handlers', signal: 'SIGTERM', atThread: 'CrShutdownDetec', caughtAgain: true },
  { name: 'sighup-at-chromium-handlers', signal: 'SIGHUP', atThread: 'CrShutdownDetec', caughtAgain: true },
];

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const groupOf = (pid) => {
  try {
    return execFileSync('pgrep', ['-g', String(pid)], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
};

const catches = (pid, signal) => {
  try {
    const caught = readFileSync(`/proc/${pid}/status`, 'utf8').match(/^SigCgt:\s*([0-9a-f]+)$/m)?.[1];

    return caught !== undefined && (BigInt(`0x${caught}`) & (1n << BigInt(constants.signals[signal] - 1))) !== 0n;
  } catch {
    return false;
  }
};

const hasThread = (pid, name) => {
  try {
    return readdirSync(`/proc/${pid}/task`).some((task) => {
      try {
        return readFileSync(`/proc/${pid}/task/${task}/comm`, 'utf8').trim() === name;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
};

const killGroup = (pid) => {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // The group is already gone.
  }
};

const launch = (ignoreInterrupt) => {
  const home = mkdtempSync(join(tmpdir(), 'studio-host-signal-'));
  const env = {
    ...process.env,
    XDG_CACHE_HOME: join(home, 'cache'),
    XDG_CONFIG_HOME: join(home, 'config'),
    XDG_DATA_HOME: join(home, 'data'),
    XDG_STATE_HOME: join(home, 'state'),
    ETHLETE_STUDIO_CONSOLE_LOG: join(home, 'setup', 'console.log'),
  };
  const [command, commandArgs] = ignoreInterrupt ? ['sh', ['-c', 'trap "" INT; exec "$0"', binary]] : [binary, []];
  const stderrFile = join(home, 'stderr.log');
  const stderrFd = openSync(stderrFile, 'w');
  const child = spawn(command, commandArgs, { cwd: root, env, detached: true, stdio: ['ignore', 'ignore', stderrFd] });
  closeSync(stderrFd);
  const exit = new Promise((done) => child.once('exit', (code, signal) => done({ code, signal, at: Date.now() })));
  const stderrTail = () => readFileSync(stderrFile, 'utf8').slice(-STDERR_TAIL).trim();

  const setUp = () => existsSync(join(home, 'setup'));

  const diagnostics = () => {
    const setupDir = join(home, 'setup');
    const logs = existsSync(setupDir)
      ? readdirSync(setupDir).map(
          (file) => `${file}:\n${readFileSync(join(setupDir, file), 'utf8').slice(-LOG_TAIL).trim()}`,
        )
      : ['setup dir missing'];

    return [`stderr:\n${stderrTail() || 'empty'}`, ...logs.map((log) => `console log ${log}`)].join('\n');
  };

  return { child, exit, home, setUp, stderrTail, diagnostics };
};

const allStopped = (pid) => {
  try {
    return readdirSync(`/proc/${pid}/task`).every((task) => {
      try {
        return /^\d+ \(.*\) [tT] /s.test(readFileSync(`/proc/${pid}/task/${task}/stat`, 'utf8'));
      } catch {
        return true;
      }
    });
  } catch {
    return false;
  }
};

const freezeAt = (pid, { atThread, signal, caughtAgain, setUp }) => {
  const by = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < by && existsSync(`/proc/${pid}`)) {
    if (!hasThread(pid, atThread) || (caughtAgain && !catches(pid, signal))) continue;

    process.kill(pid, 'SIGSTOP');
    const stopBy = Date.now() + STOP_TIMEOUT_MS;

    while (!allStopped(pid)) {
      if (Date.now() > stopBy) return { error: `the host did not stop within ${STOP_TIMEOUT_MS} ms` };
    }

    return { missed: setUp(), caught: catches(pid, signal) };
  }

  return { error: `the host never started thread ${atThread}${caughtAgain ? ` and caught ${signal}` : ''}` };
};

const waitUntilReady = async ({ pid, child, signal, setUp, stderrTail, diagnostics }) => {
  const readyBy = Date.now() + READY_TIMEOUT_MS;

  let stableCatches = 0;

  while (groupOf(pid).length < READY_HELPERS || stableCatches < STABLE_POLLS || !setUp()) {
    stableCatches = catches(pid, signal) ? stableCatches + 1 : 0;

    if (Date.now() > readyBy)
      return `the host did not start its helpers or catch ${signal} (helpers ${groupOf(pid).length}/${READY_HELPERS}, signal caught ${catches(pid, signal)} for ${stableCatches}/${STABLE_POLLS} polls, setup ${setUp()})\n${diagnostics()}`;
    if (child.exitCode !== null) return `the host ended on its own (${child.exitCode}): ${stderrTail() || 'no stderr'}`;

    await sleep(STABLE_POLL_MS);
  }

  return undefined;
};

const runAttempt = async ({ name, signal, ignoreInterrupt, atThread, caughtAgain }) => {
  const { child, exit, home, setUp, stderrTail, diagnostics } = launch(ignoreInterrupt);
  const pid = child.pid;

  try {
    const faults = [];

    if (atThread) {
      const frozen = freezeAt(pid, { atThread, signal, caughtAgain, setUp });

      if (frozen.error) return { name, ok: false, detail: `${frozen.error}\n${diagnostics()}` };
      if (frozen.missed) return { name, missed: true };
      if (!frozen.caught) faults.push(`${signal} was not caught at ${atThread} before setup`);
    } else {
      const notReady = await waitUntilReady({ pid, child, signal, setUp, stderrTail, diagnostics });

      if (notReady) return { name, ok: false, detail: notReady };
    }

    const sentAt = Date.now();
    process.kill(pid, signal);
    if (atThread) process.kill(pid, 'SIGCONT');

    const ended = await Promise.race([exit, sleep(EXIT_LIMIT_MS).then(() => null)]);

    let left = groupOf(pid);

    while (left.length > 0 && Date.now() - sentAt < EXIT_LIMIT_MS) {
      await sleep(POLL_MS);
      left = groupOf(pid);
    }

    const expected = 128 + constants.signals[signal];
    faults.push(
      !ended && `still running ${EXIT_LIMIT_MS} ms after ${signal}`,
      ended?.signal && `killed by ${ended.signal} without its own exit path`,
      ended && !ended.signal && ended.code !== expected && `exit code ${ended.code}, expected ${expected}`,
      left.length > 0 && `${left.length} processes of its group left after ${EXIT_LIMIT_MS} ms`,
    );
    const found = faults.filter(Boolean);
    const moment = atThread ? `, signalled at ${atThread} before setup` : '';

    return {
      name,
      ok: found.length === 0,
      detail: found.length ? found.join('; ') : `exit ${ended.code} after ${ended.at - sentAt} ms${moment}`,
    };
  } finally {
    killGroup(pid);
    rmSync(home, { recursive: true, force: true });
  }
};

const runCase = async (testCase) => {
  for (let attempt = 1; attempt <= WINDOW_ATTEMPTS; attempt++) {
    const result = await runAttempt(testCase);

    if (!result.missed) return result;

    console.log(`RETRY ${testCase.name}: the host reached setup before the signal (attempt ${attempt})`);
  }

  return {
    name: testCase.name,
    ok: false,
    detail: `missed the window: the host reached setup before the signal in all ${WINDOW_ATTEMPTS} attempts`,
  };
};

if (process.platform === 'win32') {
  console.log('host-signal: no POSIX signals on Windows, skipped');
  process.exit(0);
}

if (!process.env['WAYLAND_DISPLAY'] && !process.env['DISPLAY']) {
  console.error('host-signal: the host needs a display (WAYLAND_DISPLAY or DISPLAY)');
  process.exit(1);
}

if (!existsSync(binary)) {
  console.error(`host-signal: no host binary at ${binary}; build it with cargo build in apps/ethlete-studio/src-tauri`);
  process.exit(1);
}

let failed = 0;

for (const testCase of CASES.filter((candidate) => !only || candidate.name === only)) {
  const result = await runCase(testCase);

  if (!result.ok) failed++;

  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}: ${result.detail}`);
}

process.exit(failed ? 1 : 0);
