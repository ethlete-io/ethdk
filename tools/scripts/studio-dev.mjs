import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS, isDirty, lastCommitOf } from './studio-code.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const marker = join(root, 'tmp/studio-rebuild');

// Ctrl+C reaches the whole group: ending first would return the shell before the host stops.
process.on('SIGINT', () => undefined);

for (;;) {
  rmSync(marker, { force: true });

  if (isDirty(root, AREAS.host)) {
    console.warn(`${AREAS.host} has uncommitted changes; the host is built with them.`);
  }

  const run = spawnSync('node', ['../../tools/scripts/studio-tauri.mjs', 'dev', '--no-watch'], {
    cwd: join(root, 'apps/ethlete-studio'),
    stdio: 'inherit',
    env: {
      ...process.env,
      ETHLETE_STUDIO_HOST_SHA: lastCommitOf(root, AREAS.host) ?? '',
      // nx's pty runner puts the terminal in raw mode, so Ctrl+C would arrive as a byte, not as SIGINT.
      NX_NATIVE_COMMAND_RUNNER: 'false',
    },
  });

  if (!existsSync(marker)) process.exit(run.status ?? 1);
}
