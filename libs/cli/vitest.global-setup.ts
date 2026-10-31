import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const rootPrefix = 'cli-spec-run-';
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const removeRoot = (root: string) => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

const removeOrphanedRoots = (parent: string) => {
  for (const name of readdirSync(parent)) {
    const pid = Number(name.slice(rootPrefix.length).split('-')[0]);

    if (!name.startsWith(rootPrefix) || !Number.isInteger(pid) || isAlive(pid)) continue;

    removeRoot(join(parent, name));
  }
};

export default function setup() {
  const parent = tmpdir();

  removeOrphanedRoots(parent);

  const root = mkdtempSync(join(parent, `${rootPrefix}${process.pid}-`));
  const originalTmpdir = process.env['TMPDIR'];

  // Must be set before vitest spawns its workers: they and every child process they start inherit it.
  process.env['TMPDIR'] = root;

  const teardown = () => {
    if (originalTmpdir === undefined) delete process.env['TMPDIR'];
    else process.env['TMPDIR'] = originalTmpdir;

    removeRoot(root);
  };

  const onSignal = (signal: NodeJS.Signals) => {
    teardown();

    if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
  };

  process.once('exit', teardown);

  for (const signal of signals) process.once(signal, onSignal);

  return () => {
    for (const signal of signals) process.off(signal, onSignal);
    process.off('exit', teardown);
    teardown();
  };
}
