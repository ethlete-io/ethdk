#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const prefix = process.env.HEAVY_LOCK_PREFIX ?? '/tmp/fifagg-heavy';
const slotCount = Number(process.env.HEAVY_SLOTS ?? 3);
const pollMs = Number(process.env.HEAVY_POLL_MS ?? 500);
const busyExit = 200;
const forwarded = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const signalNumber = { SIGHUP: 1, SIGINT: 2, SIGKILL: 9, SIGTERM: 15 };

// Slot 1 is the old lock file, so a bare `flock /tmp/fifagg-heavy.lock` caller counts as one holder.
const slotFile = (n) => (n === 1 ? `${prefix}.lock` : `${prefix}.slot-${n}.lock`);

const describeHolder = (n) => {
  try {
    const info = JSON.parse(readFileSync(`${slotFile(n)}.info`, 'utf8'));
    if (existsSync(`/proc/${info.pid}`)) {
      const age = Math.round((Date.now() - info.startedAt) / 1000);
      return `slot ${n}: pid ${info.pid}, cwd ${info.cwd}, age ${age}s, ${info.command}`;
    }
  } catch {
    // no info file: the holder is a bare flock caller
  }
  return `slot ${n}: held by a bare flock caller (no info)`;
};

const tryRun = (command, n) =>
  new Promise((resolve) => {
    const info = JSON.stringify({ cwd: process.cwd(), command: command.join(' '), startedAt: Date.now() });
    const script = 'printf \'{"pid":%s,%s\' "$$" "${HEAVY_INFO#\\{}" > "$1"; shift; exec "$@"';
    const child = spawn(
      'flock',
      ['-n', '-E', String(busyExit), slotFile(n), 'sh', '-c', script, 'sh', `${slotFile(n)}.info`, ...command],
      { stdio: 'inherit', env: { ...process.env, HEAVY_INFO: info } },
    );
    const forward = (signal) => child.kill(signal);
    for (const s of forwarded) process.on(s, forward);
    child.on('close', (code, signal) => {
      for (const s of forwarded) process.off(s, forward);
      resolve(signal ? 128 + (signalNumber[signal] ?? 0) : code);
    });
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async (command) => {
  let reported = false;
  for (;;) {
    for (let n = 1; n <= slotCount; n++) {
      const code = await tryRun(command, n);
      if (code !== busyExit) return code;
    }
    if (!reported) {
      reported = true;
      console.error(`heavy: all ${slotCount} slots are taken:`);
      for (let n = 1; n <= slotCount; n++) console.error(`  ${describeHolder(n)}`);
    }
    await sleep(pollMs);
  }
};

const [verb, ...rest] = process.argv.slice(2);
const sep = rest.indexOf('--');
const command = sep === -1 ? rest : rest.slice(sep + 1);
if (verb !== 'run' || command.length === 0) {
  console.error('usage: heavy.mjs run -- <command>');
  process.exit(2);
}
process.exit(await run(command));
