import { AgentSessionEvent } from '../model/event';

/**
 * Far enough apart to keep a long session from filling the store, and far below
 * `SessionizeOptions.maxUnobservedMs` so a session that ran continuously still arrives as one block.
 */
export const DEFAULT_AGENT_SESSION_SAMPLE_INTERVAL_MS = 60_000;

export type AgentSessionLogParseOptions = {
  /** The log's lines, in file order. */
  lines: string[];
  /**
   * Continues an earlier read of the same log: only records after `after` are used, and `title` carries
   * over what the previous batch resolved, because the record holding it may already be behind the
   * cursor.
   */
  resume?: { after: Date; title?: string };
  /** Defaults to `DEFAULT_AGENT_SESSION_SAMPLE_INTERVAL_MS`. */
  sampleIntervalMs?: number;
  /**
   * Falls back to the session's first prompt, collapsed to one line and truncated to `maxLength`, when
   * the agent generated no title of its own. Off unless set: a prompt is message content, and a session
   * log is read for its metadata.
   */
  promptFallback?: { maxLength: number };
};

export type AgentSessionLogParseResult = {
  events: AgentSessionEvent[];
  /** The title the events carry, to hand back as `resume.title` when reading the rest of the log. */
  title?: string;
  /**
   * Lines that were not a JSON object. A log read while the agent is writing to it ends in a partial
   * line, so one is normal; a growing count is a corrupt log.
   */
  unparsedLines: number;
};

/**
 * Turns one coding agent's session log into activity samples. Every agent writes a different file, so
 * the format lives in the implementation — Codex's logs plug in here beside Claude Code's.
 *
 * A parser never reads a file: the host tails the log and hands over the lines.
 */
export type AgentSessionLogParser = (options: AgentSessionLogParseOptions) => AgentSessionLogParseResult;
