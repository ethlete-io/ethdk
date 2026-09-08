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
  readerOf: (ports: HostPorts) => AgentSessionLogReader;
  pass: AgentLogPass;
};
