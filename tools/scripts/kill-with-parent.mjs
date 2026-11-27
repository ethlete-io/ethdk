#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const GRACE_MS = Number(process.env['KILL_WITH_PARENT_GRACE_MS'] ?? 3000);

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

/** Returns `root` and every live descendant of it, parents before children. */
export const processTree = (root) => {
  const listed = spawnSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).stdout ?? '';
  const children = new Map();
  for (const line of listed.split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (!pid) continue;
    children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  }
  const tree = [];
  const queue = [root];
  while (queue.length) {
    const pid = queue.shift();
    if (tree.includes(pid) || !isAlive(pid)) continue;
    tree.push(pid);
    queue.push(...(children.get(pid) ?? []));
  }
  return tree;
};

const signalAll = (pids, signal) => {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
};

const killTree = async (root) => {
  const first = processTree(root);
  signalAll(first, 'SIGTERM');
  const deadline = Date.now() + GRACE_MS;
  while (Date.now() < deadline && first.some(isAlive)) await new Promise((r) => setTimeout(r, 100));
  const rest = [...new Set(first.filter(isAlive).flatMap(processTree))];
  signalAll(rest, 'SIGKILL');
};

/**
 * Starts a detached watchdog and returns `watch(child)`, which hands it `child`: when this process dies without
 * `child` having exited first, even by SIGKILL, the watchdog kills `child` and its whole process tree. Call it before
 * spawning `child`, and `watch` right after the spawn, so the job never runs unwatched.
 */
export const killWithParent = () => {
  const watchdog = spawn(process.execPath, [SELF], { detached: true, stdio: ['pipe', 'ignore', 'ignore'] });
  watchdog.unref();
  watchdog.stdin.unref();
  watchdog.stdin.on('error', () => undefined);
  return (child) => {
    if (!child.pid) return void watchdog.kill('SIGKILL');
    watchdog.stdin.write(`${child.pid}\n`);
    child.once('exit', () => watchdog.kill('SIGKILL'));
  };
};

if (process.argv[1] === SELF) {
  let root;
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
    root ??= Number(input.match(/^(\d+)\n/)?.[1]) || undefined;
  });
  const onEnd = () => (root ? killTree(root).then(() => process.exit(0)) : process.exit(0));
  process.stdin.once('end', onEnd);
  process.stdin.once('error', onEnd);
  setInterval(() => root && !isAlive(root) && process.exit(0), 1000);
}
