import fs from 'fs';
import { syncBuiltinESMExports } from 'module';

const target = process.argv[2] ?? '';
const killAt = Number(process.argv[3] ?? '0');
const fsCalls = fs as unknown as Record<string, (...args: unknown[]) => unknown>;
let count = 0;

for (const name of ['writeFileSync', 'rmSync', 'renameSync', 'cpSync', 'unlinkSync', 'copyFileSync']) {
  const original = fsCalls[name] as (...args: unknown[]) => unknown;

  fsCalls[name] = (...args: unknown[]) => {
    if (String(args[0]).startsWith(target)) {
      count += 1;
      if (count === killAt) process.kill(process.pid, 'SIGKILL');
    }

    return original(...args);
  };
}

syncBuiltinESMExports();

process.on('exit', () => console.log(`writes ${count}`));
