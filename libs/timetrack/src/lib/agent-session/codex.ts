import { AgentPromptEvent, AgentSessionEvent, AgentUsageEvent, TokenUsage } from '../model/event';
import { asJsonObject, countAt, objectAt, stringAt } from './record';
import { AgentLogSessionState, AgentSessionLogParser, DEFAULT_AGENT_SESSION_SAMPLE_INTERVAL_MS } from './source';

/** The name this parser's events carry, and the first half of the key the store deduplicates them on. */
export const CODEX_PROVIDER = 'codex';

type CodexSessionState = AgentLogSessionState & { cwd?: string };

type CodexRecord = {
  at: Date;
  ordinal?: number;
  type?: string;
  payload: Record<string, unknown> | null;
};

type ActivityRecord = { at: Date; sessionId: string; cwd: string };

const recordOf = (line: string): CodexRecord | null => {
  const parsed = asJsonObject(line);

  if (!parsed) return null;

  const timestamp = stringAt(parsed, 'timestamp');

  if (!timestamp) return null;

  const at = new Date(timestamp);
  const ordinal = parsed['ordinal'];

  if (Number.isNaN(at.getTime())) return null;

  return {
    at,
    ordinal: typeof ordinal === 'number' && Number.isFinite(ordinal) ? ordinal : undefined,
    type: stringAt(parsed, 'type'),
    payload: objectAt(parsed, 'payload'),
  };
};

/**
 * What the record adds to what the log has already said about itself.
 *
 * `session_meta` opens a log and `turn_context` opens a turn; every other record states none of this,
 * which is why the state is carried between reads rather than read per record. A `cwd` a later turn
 * changes wins, the way a Claude Code record's own `cwd` does.
 */
const learn = (record: CodexRecord, state: CodexSessionState): CodexSessionState => {
  const { payload } = record;

  if (!payload) return state;

  if (record.type === 'session_meta') {
    return {
      sessionId: stringAt(payload, 'session_id') ?? state.sessionId,
      cwd: stringAt(payload, 'cwd') ?? state.cwd,
      model: state.model,
    };
  }

  if (record.type === 'turn_context') {
    return {
      sessionId: state.sessionId,
      cwd: stringAt(payload, 'cwd') ?? state.cwd,
      model: stringAt(payload, 'model') ?? state.model,
    };
  }

  return state;
};

/**
 * The turn's own counts, mapped into the shape every provider reports.
 *
 * `total_token_usage` on the same record is the session's running total, so summing that instead
 * would multiply a session by its number of turns. `cached_input_tokens` is part of `input_tokens`
 * here — unlike Claude Code, where a cache read is counted beside the input — so `input` is what is
 * left after the cache read, and `input` plus `cacheRead` is what the provider billed as input.
 */
const tokenUsageOf = (usage: Record<string, unknown>): TokenUsage => {
  const input = countAt(usage, 'input_tokens');
  const cacheRead = countAt(usage, 'cached_input_tokens');

  return {
    input: Math.max(input - cacheRead, 0),
    output: countAt(usage, 'output_tokens'),
    cacheWrite: countAt(usage, 'cache_write_input_tokens'),
    cacheRead,
    thinking: countAt(usage, 'reasoning_output_tokens'),
  };
};

const isSpent = (usage: TokenUsage) =>
  usage.input > 0 || usage.output > 0 || usage.cacheWrite > 0 || usage.cacheRead > 0;

/**
 * The spend of one turn, or `null` where the record reports none.
 *
 * Codex writes a `token_count` at the start of a turn too, with every class at zero and
 * `total_tokens` set to the size of the prompt it is about to send. That is the context window, not
 * spend, so a record with nothing in any class is skipped — otherwise a day would count it as a turn.
 *
 * The turn id is the session and the record's `ordinal`, because a `token_count` names no turn of its
 * own and `turn_context.turn_id` covers a whole turn's worth of them. An ordinal is stable across a
 * re-read, which is what the store's dedupe key needs.
 */
const usageOf = (record: CodexRecord, state: CodexSessionState): AgentUsageEvent | null => {
  const { payload } = record;

  if (!payload || payload['type'] !== 'token_count') return null;

  const counts = objectAt(objectAt(payload, 'info'), 'last_token_usage');
  const { sessionId, cwd, model } = state;

  if (!counts || !sessionId || !cwd || !model || record.ordinal === undefined) return null;

  const usage = tokenUsageOf(counts);

  if (!isSpent(usage)) return null;

  return {
    at: record.at,
    source: 'agent-usage',
    kind: 'agent-usage',
    provider: CODEX_PROVIDER,
    sessionId,
    turnId: `${sessionId}#${record.ordinal}`,
    cwd,
    model,
    usage,
  };
};

/** What the CLI opens a session with, in the user's own role. Neither is anybody at a keyboard. */
const INJECTED_PREFIXES = ['<environment_context>', '<user_instructions>'];

/**
 * The text of a message record, joined across its content blocks.
 *
 * It is read to tell a typed prompt from one the CLI wrote for itself, and then dropped. Nothing in it
 * reaches an event.
 */
const textOf = (payload: Record<string, unknown>) => {
  const content = payload['content'];

  if (!Array.isArray(content)) return '';

  return content
    .map((block) =>
      typeof block === 'object' && block !== null ? stringAt(block as Record<string, unknown>, 'text') : undefined,
    )
    .filter((text): text is string => text !== undefined)
    .join(' ')
    .trimStart();
};

/**
 * The prompt the user typed, or `null` for every other record.
 *
 * Codex writes what the person sent as a `response_item` message in the `user` role, and opens every
 * session with two of its own in the same role — the environment and the instructions files. Those are
 * rejected by their opening tag, because a session would otherwise report a keystroke at the instant
 * the CLI started.
 */
const promptOf = (record: CodexRecord, state: CodexSessionState): AgentPromptEvent | null => {
  const { payload } = record;

  if (!payload || record.type !== 'response_item') return null;
  if (payload['type'] !== 'message' || payload['role'] !== 'user') return null;

  const promptId = stringAt(payload, 'id');
  const { sessionId, cwd } = state;

  if (!promptId || !sessionId || !cwd) return null;

  const text = textOf(payload);

  if (INJECTED_PREFIXES.some((prefix) => text.startsWith(prefix))) return null;

  return {
    at: record.at,
    source: 'agent-prompt',
    kind: 'agent-prompt',
    provider: CODEX_PROVIDER,
    sessionId,
    promptId,
    cwd,
  };
};

/**
 * Reads a Codex CLI rollout log — the JSONL file under `~/.codex/sessions/<yyyy>/<mm>/<dd>/` — into
 * activity samples and one event per turn's token spend.
 *
 * Every record carrying a timestamp counts as a sample of the session running, so a record type Codex
 * adds later still lands. Records are thinned to one sample per `sampleIntervalMs`, except that a
 * change of directory always emits, and so does the log's final record, so a block ends where the
 * session did.
 *
 * The log names its session and its model once rather than per record, so both are carried in and out
 * through `resume.session`. A read that resumes mid-turn has no `turn_context` in view, and a turn
 * with no model cannot be priced.
 *
 * Codex records no branch and no title. Only metadata is read: message bodies never become events, and
 * a prompt's text is read to reject the CLI's own opening messages and then dropped.
 */
export const parseCodexSessionLog: AgentSessionLogParser = (options) => {
  const interval = options.sampleIntervalMs ?? DEFAULT_AGENT_SESSION_SAMPLE_INTERVAL_MS;
  const after = options.resume?.after;
  const records: ActivityRecord[] = [];
  const usageByTurnId = new Map<string, AgentUsageEvent>();
  const promptById = new Map<string, AgentPromptEvent>();
  let state: CodexSessionState = { ...options.resume?.session, cwd: options.resume?.cwd };
  let unparsedLines = 0;

  for (const line of options.lines) {
    if (!line.trim()) continue;

    const record = recordOf(line);

    if (!record) {
      unparsedLines++;
      continue;
    }

    state = learn(record, state);

    const spend = usageOf(record, state);

    // No `after` guard: `after` follows the thinned samples, and a turn behind it is spend, not a
    // repeat. The store's dedupe key — the provider and the turn id — is what makes a re-read safe.
    if (spend && !usageByTurnId.has(spend.turnId)) usageByTurnId.set(spend.turnId, spend);

    // Kept behind `after` for the same reason spend is: the record's own id is what the store
    // deduplicates a prompt on, so a re-read appends nothing.
    const prompt = promptOf(record, state);

    if (prompt && !promptById.has(prompt.promptId)) promptById.set(prompt.promptId, prompt);

    const { sessionId, cwd } = state;

    if (!sessionId || !cwd) continue;
    if (after && record.at.getTime() <= after.getTime()) continue;

    records.push({ at: record.at, sessionId, cwd });
  }

  records.sort((a, b) => a.at.getTime() - b.at.getTime());

  const events: AgentSessionEvent[] = [];
  let emitted: { at: number; cwd: string } | undefined;

  records.forEach((record, index) => {
    const isFinal = index === records.length - 1;
    const elapsed = emitted ? record.at.getTime() - emitted.at : 0;

    if (emitted && emitted.cwd === record.cwd && elapsed < interval && !(isFinal && elapsed > 0)) return;

    emitted = { at: record.at.getTime(), cwd: record.cwd };
    events.push({
      at: record.at,
      source: 'agent-session',
      kind: 'agent-session',
      sessionId: record.sessionId,
      cwd: record.cwd,
    });
  });

  const usage = [...usageByTurnId.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
  const prompts = [...promptById.values()].sort((a, b) => a.at.getTime() - b.at.getTime());

  return { events, usage, prompts, session: { sessionId: state.sessionId, model: state.model }, unparsedLines };
};
