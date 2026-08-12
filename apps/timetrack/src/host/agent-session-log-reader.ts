import { AgentSessionLogLines, AgentSessionLogReader, AgentSessionLogRef } from '@ethlete/timetrack';
import { map } from 'rxjs';
import { invokeHost$ } from './invoke';

type HostLogRef = {
  id: string;
  path: string;
  modifiedAtMs: number;
};

const reviveRef = (ref: HostLogRef): AgentSessionLogRef => ({
  id: ref.id,
  path: ref.path,
  modifiedAt: new Date(ref.modifiedAtMs),
});

/**
 * Reads Claude Code's session logs through the host.
 *
 * `root` defaults to `~/.claude/projects` and is what the host confines every read to, so pointing it
 * somewhere else is the only way to read logs from another location — including in a test.
 */
export const createTauriAgentSessionLogReader = (options?: { root?: string }): AgentSessionLogReader => ({
  logs$: ({ modifiedAfter }) =>
    invokeHost$<HostLogRef[]>('agent_logs', {
      root: options?.root,
      modifiedAfterMs: modifiedAfter ? modifiedAfter.getTime() : null,
    }).pipe(map((refs) => refs.map(reviveRef))),
  readLines$: ({ ref, fromLine }) =>
    invokeHost$<AgentSessionLogLines>('agent_log_lines', {
      request: { path: ref.path, fromLine, root: options?.root },
    }),
});
