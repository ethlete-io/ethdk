import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS, isDirty, lastCommitOf } from './studio-code.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const marker = join(root, 'tmp/studio-rebuild');

for (;;) {
  rmSync(marker, { force: true });

  if (isDirty(root, AREAS.host)) {
    console.warn(`${AREAS.host} has uncommitted changes; the host is built with them.`);
  }

  const run = spawnSync('npx', ['nx', 'tauri:dev', 'ethlete-studio'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ETHLETE_STUDIO_HOST_SHA: lastCommitOf(root, AREAS.host) ?? '' },
  });

  if (!existsSync(marker)) process.exit(run.status ?? 1);
}
