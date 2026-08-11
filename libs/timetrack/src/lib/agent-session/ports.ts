import { Observable } from 'rxjs';

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
