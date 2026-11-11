import { spawnSync } from 'node:child_process';

export const STUDIO_CEF_CLI = '@tauri-apps/cli-cef@3.0.0-alpha.27';

export const studioTauriArgs = (args, platform = process.platform) =>
  platform === 'win32' ? ['tauri', ...args] : ['--yes', `--package=${STUDIO_CEF_CLI}`, 'tauri', ...args];

if (import.meta.main) {
  const run = spawnSync('npx', studioTauriArgs(process.argv.slice(2)), {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  process.exit(run.status ?? 1);
}
