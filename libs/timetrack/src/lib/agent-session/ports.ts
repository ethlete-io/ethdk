import { Observable } from 'rxjs';

/**
 * Which pass over which agent's logs a cursor belongs to.
 *
 * Three passes read the same files from an offset of their own: the session pass collects activity
 * samples as the agent writes them, and the spend and prompt passes each read every log once from the
 * top for the keyed events the session pass went past. See ADR 0003 and ADR 0006.
 *
 * One pass per provider, so two collectors that run at the same time move disjoint sets of cursors —
 * both write back every cursor they read, and a shared set would let one undo the other's offset.
 * `agent-session` and `spend` are Claude Code's: they were the only pair when the store first held
 * them, and renaming a stored cursor would re-read its whole log. A prompt pass of its own is what
 * gives the prompts a cursor at line 0 without rewinding the spend pass, which has converged.
 */
export type AgentLogPass = 'agent-session' | 'spend' | 'prompt' | 'codex-session' | 'codex-spend' | 'codex-prompt';

/** One session log the host found. `id` identifies the log — for Claude Code it is the file's basename. */
export type AgentSessionLogRef = {
  id: string;
  path: string;
  modifiedAt: Date;
};

export type AgentSessionLogLines = {
  lines: string[];
  /** The line to resume from on the next read. */
  nextLine: number;
};

/**
 * The host's read side of an agent's session logs. The core never touches the filesystem itself.
 *
 * `readLines$` must not yield a line that has no terminating newline yet: the agent appends to the file
 * while this runs, and a half-written JSON line consumed as complete is a line lost for good.
 */
export type AgentSessionLogReader = {
  logs$(options: { modifiedAfter?: Date }): Observable<AgentSessionLogRef[]>;
  readLines$(options: { ref: AgentSessionLogRef; fromLine: number }): Observable<AgentSessionLogLines>;
};
