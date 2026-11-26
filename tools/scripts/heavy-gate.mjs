import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HEAVY_LOCK_MAX_WAIT_MS, HEAVY_LOCK_POLL_MS, holderLine, waitForNoHeavyRun } from './heavy-run-lock.mjs';

export const parseGateArgs = (argv) => {
  const split = argv.indexOf('--');
  if (split < 1 || split === argv.length - 1) return undefined;
  const command = argv.slice(split + 1);
  const wait = !argv.slice(0, split).includes('--no-wait') && !command.includes('--no-wait');
  return { name: argv[0], wait, command: command.filter((arg) => arg !== '--no-wait') };
};

const main = async () => {
  const parsed = parseGateArgs(process.argv.slice(2));
  if (!parsed) {
    console.error('usage: heavy-gate.mjs <name> [--no-wait] -- <command> [args...]');
    process.exit(2);
  }
  const { name, wait, command } = parsed;
  const free = await waitForNoHeavyRun(name, {
    wait: wait && !process.env['ETHLETE_HEAVY_NO_WAIT'],
    maxWaitMs: Number(process.env['ETHLETE_HEAVY_MAX_WAIT_MS']) || HEAVY_LOCK_MAX_WAIT_MS,
    pollMs: Number(process.env['ETHLETE_HEAVY_POLL_MS']) || HEAVY_LOCK_POLL_MS,
  });
  if (!free.ok) {
    console.error(`${name}: ${holderLine(free.holder)}; run again after it ends`);
    process.exit(2);
  }
  const child = spawn(command[0], command.slice(1), { stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
  child.on('error', (error) => {
    console.error(`${name}: ${error.message}`);
    process.exit(1);
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
