import { spawnSync } from 'child_process';
import { join } from 'path';
import { resolveContentRoot } from './load-content';

export const SESSIONS_SCRIPT = join('skills', 'agent-sessions', 'agent-sessions.mjs');

export const sessionsCommand = (options: { argv: string[] }) => {
  const result = spawnSync(process.execPath, [join(resolveContentRoot(), SESSIONS_SCRIPT), ...options.argv], {
    stdio: 'inherit',
  });

  return result.status ?? 1;
};
