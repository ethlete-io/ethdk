#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { killWithParent } from './kill-with-parent.mjs';

/** The directory every run that agents wait on is registered in, one `<id>.json` per run. */
export const registryDir = (env = process.env) => env['RUN_REGISTRY_DIR'] ?? '/tmp/ethlete-runs';

export const ENDED_KEEP_MS = 60 * 60_000;

/** The machine name of this host as the registry shows it (`tank`, `rack`, `mac`). */
export const localMachine = (env = process.env) => env['RUN_MACHINE'] ?? hostname().split('.')[0] ?? 'local';

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

const writeEntry = (dir, entry) => {
  const file = join(dir, `${entry.id}.json`);
  writeFileSync(`${file}.tmp`, JSON.stringify(entry));
  renameSync(`${file}.tmp`, file);
};

/** Reads every entry, deleting those whose process died without ending them and those ended over an hour ago. */
export const listRuns = ({ env = process.env, now = Date.now(), alive = isAlive } = {}) => {
  const dir = registryDir(env);
  let names;
  try {
    names = readdirSync(dir).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  const kept = [];
  for (const name of names) {
    let entry;
    try {
      entry = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    } catch {
      continue;
    }
    const isStale = entry.endedAt ? now - entry.endedAt > ENDED_KEEP_MS : !alive(entry.pid);
    if (!isStale) {
      kept.push(entry);
      continue;
    }
    rmSync(join(dir, name), { force: true });
    if (entry.log?.startsWith(`${dir}/`)) rmSync(entry.log, { force: true });
  }
  return kept;
};

/**
 * Registers a run in the registry and returns its entry with `finish(exitCode)` to mark it ended.
 * Without `log`, the run gets a log file in the registry directory; the caller writes the run's output to it.
 */
export const registerRun = ({
  machine = localMachine(),
  label,
  command,
  cwd = process.cwd(),
  log,
  env = process.env,
}) => {
  const dir = registryDir(env);
  mkdirSync(dir, { recursive: true });
  listRuns({ env });
  const startedAt = Date.now();
  const id = `${machine}-${process.pid}-${startedAt}`;
  const sessionId = env['CLAUDE_CODE_SESSION_ID'];
  const entry = {
    id,
    machine,
    label,
    command,
    cwd,
    log: log ?? join(dir, `${id}.log`),
    pid: process.pid,
    startedAt,
    ...(sessionId ? { sessionId } : {}),
  };
  writeEntry(dir, entry);
  return {
    ...entry,
    update: (fields) => {
      Object.assign(entry, fields);
      writeEntry(dir, entry);
    },
    finish: (exitCode) => {
      try {
        writeEntry(dir, { ...entry, endedAt: Date.now(), exitCode });
      } catch {
        // the registry was removed while the run ran
      }
    },
  };
};

/**
 * Spawns `command`, tees its output to `run.log` and resolves with its exit code; `wrap` builds the spawned argv.
 * With `onFd3`, the child gets a pipe on fd 3 and `onFd3` receives what it writes there.
 */
export const teeRun = (run, argv, { wrap = (a) => a, env = process.env, cwd, onSpawn = () => undefined, onFd3 } = {}) =>
  new Promise((resolve) => {
    const file = createWriteStream(run.log, { flags: 'a' });
    const [bin, ...args] = wrap(argv);
    const stdio = ['inherit', 'pipe', 'pipe', ...(onFd3 ? ['pipe'] : [])];
    const watch = killWithParent();
    const child = spawn(bin, args, { stdio, env, cwd });
    watch(child);
    onSpawn(child);
    if (onFd3) child.stdio[3].on('data', (chunk) => onFd3(String(chunk)));
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      file.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      file.write(chunk);
    });
    child.on('close', (code, signal) => file.end(() => resolve({ code, signal })));
  });

const signalNumber = { SIGHUP: 1, SIGINT: 2, SIGKILL: 9, SIGTERM: 15 };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [verb, ...rest] = process.argv.slice(2);
  const sep = rest.indexOf('--');
  const command = sep === -1 ? rest : rest.slice(sep + 1);
  if (verb === 'list') {
    for (const entry of listRuns()) console.log(JSON.stringify(entry));
    process.exit(0);
  }
  if (verb !== 'track' || command.length === 0) {
    console.error('usage: run-registry.mjs track -- <command> | run-registry.mjs list');
    process.exit(2);
  }
  const run = registerRun({ label: command.join(' '), command: command.join(' ') });
  let current;
  const forward = (signal) => current?.kill(signal);
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, forward);
  const { code, signal } = await teeRun(run, command, { onSpawn: (child) => (current = child) });
  const exitCode = signal ? 128 + (signalNumber[signal] ?? 0) : (code ?? 1);
  run.finish(exitCode);
  process.exit(exitCode);
}
