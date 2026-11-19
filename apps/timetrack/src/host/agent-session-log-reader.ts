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
 * The roots are the `projects` dir of each `~/.claude…` config dir and of `$CLAUDE_CONFIG_DIR`, or
 * `~/.codex/sessions`, by provider, and the host resolves them itself. Naming one here would name the
 * confinement the host then checks a read against.
 */
export const createTauriAgentSessionLogReader = (options?: { provider?: AgentLogProvider }): AgentSessionLogReader => ({
  logs$: ({ modifiedAfter }) =>
    invokeHost$<HostLogRef[]>('agent_logs', {
      modifiedAfterMs: modifiedAfter ? modifiedAfter.getTime() : null,
      provider: options?.provider,
    }).pipe(map((refs) => refs.map(reviveRef))),
  readLines$: ({ ref, fromLine }) =>
    invokeHost$<AgentSessionLogLines>('agent_log_lines', {
      request: { path: ref.path, fromLine, provider: options?.provider },
    }),
});
