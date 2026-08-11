import { AgentSessionEvent } from '../model/event';
import { AgentSessionLogParseOptions, AgentSessionLogParser, DEFAULT_AGENT_SESSION_SAMPLE_INTERVAL_MS } from './source';

type ActivityRecord = { at: Date; sessionId: string; cwd: string; gitBranch?: string };

type TitleCandidates = { generated?: string; firstPrompt?: string };

const asJsonObject = (line: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(line);

    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const stringAt = (record: Record<string, unknown>, key: string) => {
  const value = record[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

/**
 * Anything carrying a timestamp, a working directory and a session id counts as a sample of the
 * session running, whatever its record type — so a record type the agent adds later still lands.
 */
const activityOf = (record: Record<string, unknown>): ActivityRecord | null => {
  const timestamp = stringAt(record, 'timestamp');
  const sessionId = stringAt(record, 'sessionId');
  const cwd = stringAt(record, 'cwd');

  if (!timestamp || !sessionId || !cwd) return null;

  const at = new Date(timestamp);

  return Number.isNaN(at.getTime()) ? null : { at, sessionId, cwd, gitBranch: stringAt(record, 'gitBranch') };
};

const readTitle = (record: Record<string, unknown>, into: TitleCandidates) => {
  const type = stringAt(record, 'type');

  if (type === 'ai-title') {
    into.generated = stringAt(record, 'aiTitle') ?? into.generated;

    return;
  }

  // A fresh `last-prompt` record is appended for every prompt, so the first one in file order is the
  // prompt that opened the session. The last one describes only what the session ended on.
  if (type === 'last-prompt' && into.firstPrompt === undefined) {
    into.firstPrompt = stringAt(record, 'lastPrompt');
  }
};

const fromPrompt = (prompt: string | undefined, fallback: AgentSessionLogParseOptions['promptFallback']) => {
  if (!prompt || !fallback || fallback.maxLength < 1) return undefined;

  const oneLine = prompt.replace(/\s+/g, ' ').trim();

  if (!oneLine) return undefined;

  return oneLine.length > fallback.maxLength ? `${oneLine.slice(0, fallback.maxLength).trimEnd()}…` : oneLine;
};

const contextOf = (record: ActivityRecord) => `${record.cwd}\u0000${record.gitBranch ?? ''}`;

/**
 * Reads a Claude Code session log — the JSONL file under `~/.claude/projects/<cwd-slug>/` — into
 * activity samples. The working directory and the branch are taken per record rather than per session,
 * so switching branch mid-session splits the block the way a checkout would.
 *
 * Records are thinned to one sample per `sampleIntervalMs`, except that a change of directory or branch
 * always emits, and so does each session's final record, so a block ends where the session did.
 *
 * Only metadata is read. Message bodies never become events, and the session's first prompt is used as
 * a title only when `promptFallback` asks for it.
 */
export const parseClaudeCodeSessionLog: AgentSessionLogParser = (options) => {
  const interval = options.sampleIntervalMs ?? DEFAULT_AGENT_SESSION_SAMPLE_INTERVAL_MS;
  const after = options.resume?.after;
  const titles: TitleCandidates = {};
  const records: ActivityRecord[] = [];
  let unparsedLines = 0;

  for (const line of options.lines) {
    if (!line.trim()) continue;

    const parsed = asJsonObject(line);

    if (!parsed) {
      unparsedLines++;
      continue;
    }

    readTitle(parsed, titles);

    const record = activityOf(parsed);

    if (!record || (after && record.at.getTime() <= after.getTime())) continue;

    records.push(record);
  }

  records.sort((a, b) => a.at.getTime() - b.at.getTime());

  const title = titles.generated ?? options.resume?.title ?? fromPrompt(titles.firstPrompt, options.promptFallback);
  const finalIndexOf = new Map<string, number>();

  records.forEach((record, index) => finalIndexOf.set(record.sessionId, index));

  const emitted = new Map<string, { at: number; context: string }>();
  const events: AgentSessionEvent[] = [];

  const emit = (record: ActivityRecord) => {
    emitted.set(record.sessionId, { at: record.at.getTime(), context: contextOf(record) });
    events.push({
      at: record.at,
      source: 'agent-session',
      kind: 'agent-session',
      sessionId: record.sessionId,
      cwd: record.cwd,
      gitBranch: record.gitBranch,
      title,
    });
  };

  records.forEach((record, index) => {
    const previous = emitted.get(record.sessionId);

    if (!previous) {
      emit(record);

      return;
    }

    const elapsed = record.at.getTime() - previous.at;
    const isFinal = finalIndexOf.get(record.sessionId) === index;

    if (previous.context !== contextOf(record) || elapsed >= interval || (isFinal && elapsed > 0)) emit(record);
  });

  return { events, title, unparsedLines };
};
