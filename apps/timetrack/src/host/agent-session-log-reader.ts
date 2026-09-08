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

/** Whose logs to read. The host derives both the default root and the shape of the tree from it. */
export type AgentLogProvider = 'claude-code' | 'codex';

/**
 * Reads one coding agent's session logs through the host.
 *
 * `root` defaults to `~/.claude/projects` or `~/.codex/sessions` by provider, and is what the host
 * confines every read to, so pointing it somewhere else is the only way to read logs from another
 * location — including in a test.
 */
export const createTauriAgentSessionLogReader = (options?: {
  root?: string;
  provider?: AgentLogProvider;
}): AgentSessionLogReader => ({
  logs$: ({ modifiedAfter }) =>
    invokeHost$<HostLogRef[]>('agent_logs', {
      root: options?.root,
      modifiedAfterMs: modifiedAfter ? modifiedAfter.getTime() : null,
      provider: options?.provider,
    }).pipe(map((refs) => refs.map(reviveRef))),
  readLines$: ({ ref, fromLine }) =>
    invokeHost$<AgentSessionLogLines>('agent_log_lines', {
      request: { path: ref.path, fromLine, root: options?.root, provider: options?.provider },
    }),
});
