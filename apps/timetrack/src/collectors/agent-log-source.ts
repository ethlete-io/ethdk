import { AgentLogPass, AgentSessionLogParser, AgentSessionLogReader } from '@ethlete/timetrack';
import { HostPorts } from '../host';

/**
 * One coding agent's logs: how to read them, how to parse them, and whose cursors to move.
 *
 * One agent is one log format and one set of cursors, so each gets a collector of its own rather than
 * a shared one that reads two formats. See ADR 0005.
 */
export type AgentLogSource = {
  parser: AgentSessionLogParser;
  /** The version of `parser`'s rules, where a log an older version read is to be read again. */
  parserVersion?: number;
  /** Which logs are read again together. See `agentSessionReparseBatch`. */
  logGroupOf?: (logId: string) => string;
  readerOf: (ports: HostPorts) => AgentSessionLogReader;
  pass: AgentLogPass;
};
