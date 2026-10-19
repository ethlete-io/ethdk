import { spawn } from 'child_process';
import { constants } from 'os';
import { markApiStateDirty } from './api-state';
import { API_LOCK_ENV, LockSystem, acquireApiLock, describeApiLock, releaseApiLock } from './lock';

export const LOCK_TIMEOUT_EXIT_CODE = 75;

const FORWARDED_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

const runChild = (options: { command: string[]; cwd: string; env: NodeJS.ProcessEnv }) =>
  new Promise<number>((resolve) => {
    const { command, cwd, env } = options;
    const [binary, ...args] = command as [string, ...string[]];
    const child = spawn(binary, args, { cwd, env, stdio: 'inherit' });
    const forward = (signal: NodeJS.Signals) => void child.kill(signal);
    const done = (code: number) => {
      for (const signal of FORWARDED_SIGNALS) process.off(signal, forward);
      resolve(code);
    };

    for (const signal of FORWARDED_SIGNALS) process.on(signal, forward);

    child.once('error', (error) => {
      console.error(`Could not run ${binary}: ${error.message}`);
      done(127);
    });
    child.once('exit', (code, signal) => done(signal ? 128 + (constants.signals[signal] ?? 0) : (code ?? 1)));
  });

/**
 * Runs `command` under the API lock in `directory` and returns its exit code, or 75 when the lock
 * stayed taken for `wait` seconds. The state becomes dirty once the command ends.
 */
export const runLocked = async (options: {
  directory: string;
  command: string[];
  cwd: string;
  wait?: number;
  env?: NodeJS.ProcessEnv;
  system?: LockSystem;
}): Promise<number> => {
  const { directory, command, cwd, wait, env = process.env, system } = options;
  const acquired = await acquireApiLock({
    directory,
    command: command.join(' '),
    cwd,
    wait,
    system,
    onHeld: (holder) => console.error(`Waiting for the API lock, held by ${describeApiLock(holder, directory)}.`),
  });

  if (!acquired.ok) {
    console.error(`Gave up after ${wait} s. The API lock is held by ${describeApiLock(acquired.holder, directory)}.`);

    return LOCK_TIMEOUT_EXIT_CODE;
  }

  const { token } = acquired.lock;
  const release = () => {
    process.off('exit', release);
    markApiStateDirty(directory);
    releaseApiLock(directory, token);
  };

  process.once('exit', release);

  try {
    return await runChild({ command, cwd, env: { ...env, [API_LOCK_ENV]: token } });
  } finally {
    release();
  }
};
