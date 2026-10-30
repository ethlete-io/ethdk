import { spawnSync } from 'child_process';
import { join } from 'path';
import { resolveContentRoot } from './load-content';

export const MAILBOX_SCRIPT = join('skills', 'agent-mailbox', 'agent-mailbox.mjs');

export const mailboxCommand = (options: { argv: string[] }) => {
  const result = spawnSync(process.execPath, [join(resolveContentRoot(), MAILBOX_SCRIPT), ...options.argv], {
    stdio: 'inherit',
  });

  return result.status ?? 1;
};
