#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PERIOD_MS = 100;

export const dutySlices = (percent, period = PERIOD_MS) => {
  if (!(percent > 0 && percent <= 100)) throw new Error(`a CPU share must be in (0, 100], got ${percent}`);
  const runMs = Math.max(1, Math.round((period * percent) / 100));
  return { runMs, stopMs: period - runMs };
};

const signalGroup = (pid, signal) => {
  try {
    process.kill(-pid, signal);
  } catch {
    // The group is gone.
  }
};

/** Runs a command in its own process group and lets the group run only `percent` of each 100 ms, by SIGSTOP and SIGCONT. */
export const throttle = (percent, command, args, { period = PERIOD_MS } = {}) =>
  new Promise((resolve) => {
    const { runMs, stopMs } = dutySlices(percent, period);
    const child = spawn(command, args, { detached: true, stdio: 'inherit' });
    let timer;
    let done = false;
    const cycle = () => {
      if (done) return;
      signalGroup(child.pid, 'SIGCONT');
      timer = setTimeout(() => {
        if (done || stopMs === 0) return cycle();
        signalGroup(child.pid, 'SIGSTOP');
        timer = setTimeout(cycle, stopMs);
      }, runMs);
    };
    const forward = (signal) => {
      signalGroup(child.pid, 'SIGCONT');
      signalGroup(child.pid, signal);
    };
    process.on('SIGINT', forward).on('SIGTERM', forward);
    child.on('exit', (code, signal) => {
      done = true;
      clearTimeout(timer);
      signalGroup(child.pid, 'SIGCONT');
      process.off('SIGINT', forward).off('SIGTERM', forward);
      resolve(code ?? (signal ? 1 : 0));
    });
    cycle();
  });

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [percent, separator, command, ...args] = process.argv.slice(2);
  if (separator !== '--' || !command) {
    console.error('Usage: node tools/scripts/cpu-throttle.mjs <percent> -- <command> [args...]');
    process.exit(2);
  }
  process.exit(await throttle(Number(percent), command, args));
}
