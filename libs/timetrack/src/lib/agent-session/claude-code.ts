import { AgentSessionEvent, AgentUsageEvent, TokenUsage } from '../model/event';
import { asJsonObject, countAt, objectAt, stringAt } from './record';
import { AgentSessionLogParseOptions, AgentSessionLogParser, DEFAULT_AGENT_SESSION_SAMPLE_INTERVAL_MS } from './source';

/** The name this parser's events carry, and the first half of the key the store deduplicates them on. */
export const CLAUDE_CODE_PROVIDER = 'claude-code';

/** The model Claude Code names on a record it wrote itself. Every count on it is zero. */
const SYNTHETIC_MODEL = '<synthetic>';

type ActivityRecord = { at: Date; sessionId: string; cwd: string; gitBranch?: string };

type TitleCandidates = { custom?: string; generated?: string; firstPrompt?: string };

/**
 * The branch the record names, or `undefined` for a detached checkout.
 *
 * `git rev-parse --abbrev-ref HEAD` answers `HEAD` when no branch is checked out, and the agent writes
 * that answer through. Git refuses `HEAD` as a branch name, so it never names one — and keeping it
 * would label a block with a word that says nothing and that the branch grammar can never resolve.
 */
const branchOf = (record: Record<string, unknown>) => {
  const branch = stringAt(record, 'gitBranch');

  return branch === 'HEAD' ? undefined : branch;
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

  return Number.isNaN(at.getTime()) ? null : { at, sessionId, cwd, gitBranch: branchOf(record) };
};

/**
 * The turn's own counts, from the top level of `usage` only. `usage.iterations` restates them per API
 * call, so reading it as well would count a turn twice.
 */
const tokenUsageOf = (usage: Record<string, unknown>): TokenUsage => ({
  input: countAt(usage, 'input_tokens'),
  output: countAt(usage, 'output_tokens'),
  cacheWrite: countAt(usage, 'cache_creation_input_tokens'),
  cacheRead: countAt(usage, 'cache_read_input_tokens'),
  thinking: countAt(objectAt(usage, 'output_tokens_details'), 'thinking_tokens'),
});

/**
 * The spend of one turn, or `null` where the record reports none.
 *
 * A subagent's records name the parent session in `sessionId` and the subagent in `agentId`, so a
 * subagent's spend already lands in the stream that asked for it.
 */
const usageOf = (record: Record<string, unknown>): AgentUsageEvent | null => {
  const activity = activityOf(record);
  const message = objectAt(record, 'message');
  const usage = message ? objectAt(message, 'usage') : null;
  const turnId = message ? stringAt(message, 'id') : undefined;
  const model = message ? stringAt(message, 'model') : undefined;

  if (!activity || !usage || !turnId || !model || model === SYNTHETIC_MODEL) return null;

  return {
    at: activity.at,
    source: 'agent-usage',
    kind: 'agent-usage',
    provider: CLAUDE_CODE_PROVIDER,
    sessionId: activity.sessionId,
    turnId,
    cwd: activity.cwd,
    gitBranch: activity.gitBranch,
    model,
    usage: tokenUsageOf(usage),
    agentId: stringAt(record, 'agentId'),
  };
};

const readTitle = (record: Record<string, unknown>, into: TitleCandidates) => {
  const type = stringAt(record, 'type');

  if (type === 'custom-title') {
    into.custom = stringAt(record, 'customTitle') ?? into.custom;

    return;
  }

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
 * Every turn that reports `message.usage` also becomes an `AgentUsageEvent`, whatever the sample
 * interval: a token count is not a sample of time.
 *
 * Only metadata is read. Message bodies never become events, and the session's first prompt is used as
 * a title only when `promptFallback` asks for it.
 */
export const parseClaudeCodeSessionLog: AgentSessionLogParser = (options) => {
  const interval = options.sampleIntervalMs ?? DEFAULT_AGENT_SESSION_SAMPLE_INTERVAL_MS;
  const after = options.resume?.after;
  const titles: TitleCandidates = {};
  const records: ActivityRecord[] = [];
  // One assistant message is written as several records — one per content block — and each of them
  // restates the same `message.usage`. Measured over this machine's logs: 46 % of usage records repeat
  // an id, and a repeated id never carried different counts. So the first one wins.
  const usageByTurnId = new Map<string, AgentUsageEvent>();
  let unparsedLines = 0;

  for (const line of options.lines) {
    if (!line.trim()) continue;

    const parsed = asJsonObject(line);

    if (!parsed) {
      unparsedLines++;
      continue;
    }

    readTitle(parsed, titles);

    const spend = usageOf(parsed);

    // No `after` guard: `after` follows the thinned samples, and a turn behind it is spend, not a
    // repeat. The store's dedupe key — the provider and the turn id — is what makes a re-read safe.
    if (spend && !usageByTurnId.has(spend.turnId)) usageByTurnId.set(spend.turnId, spend);

    const record = activityOf(parsed);

    if (!record || (after && record.at.getTime() <= after.getTime())) continue;

    records.push(record);
  }

  records.sort((a, b) => a.at.getTime() - b.at.getTime());

  const title =
    titles.custom ??
    titles.generated ??
    options.resume?.title ??
    fromPrompt(titles.firstPrompt, options.promptFallback);
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

  const usage = [...usageByTurnId.values()].sort((a, b) => a.at.getTime() - b.at.getTime());

  return { events, usage, title, unparsedLines };
};
