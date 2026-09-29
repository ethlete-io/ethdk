import { EMPTY, Observable, catchError, concatMap, defaultIfEmpty, map, of, take } from 'rxjs';
import { asJsonObject, countAt, objectAt, stringAt } from '../agent-session/record';
import { codexEvents } from './envelope';
import { AgentUsageEvent, TIMETRACK_PROVIDER, TokenUsage } from '../model/event';
import { ModelAsk, ProcessResult, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';

const tokenUsageOf = (usage: Record<string, unknown>): TokenUsage => ({
  input: countAt(usage, 'input_tokens'),
  output: countAt(usage, 'output_tokens'),
  cacheWrite: countAt(usage, 'cache_creation_input_tokens'),
  cacheRead: countAt(usage, 'cache_read_input_tokens'),
  thinking: countAt(objectAt(usage, 'output_tokens_details'), 'thinking_tokens'),
});

/** The model the run actually ran on. `modelUsage` names it; the CLI's top level does not. */
const modelOf = (envelope: Record<string, unknown>) =>
  Object.keys(objectAt(envelope, 'modelUsage') ?? {})[0] ?? stringAt(envelope, 'model') ?? 'unknown';

const codexRunSpend = (options: {
  stdout: string;
  args: string[];
  ask: ModelAsk;
  at: Date;
}): AgentUsageEvent | null => {
  const events = codexEvents(options.stdout);
  const completed = events.filter((event) => event.type === 'turn.completed');
  const counts = completed.flatMap((event) => {
    const usage = objectAt({ usage: event.usage }, 'usage');

    return usage ? [usage] : [];
  });

  if (!counts.length) return null;

  const threadId = events.find((event) => event.type === 'thread.started')?.thread_id;
  const modelIndex = options.args.lastIndexOf('--model');
  const usage = counts.map((count) => {
    const cacheRead = countAt(count, 'cached_input_tokens');

    return {
      input: Math.max(countAt(count, 'input_tokens') - cacheRead, 0),
      output: countAt(count, 'output_tokens'),
      cacheWrite: countAt(count, 'cache_write_input_tokens'),
      cacheRead,
      thinking: countAt(count, 'reasoning_output_tokens'),
    };
  });

  return {
    at: options.at,
    source: 'agent-usage',
    kind: 'agent-usage',
    provider: TIMETRACK_PROVIDER,
    sessionId: options.ask,
    turnId: typeof threadId === 'string' ? threadId : options.at.toISOString(),
    cwd: '',
    model: (modelIndex >= 0 ? options.args[modelIndex + 1] : undefined) ?? 'unknown',
    usage: {
      input: usage.reduce((sum, u) => sum + u.input, 0),
      output: usage.reduce((sum, u) => sum + u.output, 0),
      cacheWrite: usage.reduce((sum, u) => sum + u.cacheWrite, 0),
      cacheRead: usage.reduce((sum, u) => sum + u.cacheRead, 0),
      thinking: usage.reduce((sum, u) => sum + u.thinking, 0),
    },
  };
};

/**
 * What one agent-CLI run spent, read out of its own JSON envelope (or, for `codex`, its event stream), or `null` where it reports none.
 *
 * A run that answered an error still spent its tokens, so the envelope is read whatever it says. A
 * `usage` of all zeros is kept for the same reason a turn of one token is: the call was made.
 */
export const agentRunSpend = (options: {
  stdout: string;
  ask: ModelAsk;
  at: Date;
  command?: string;
  args?: string[];
}): AgentUsageEvent | null => {
  if (options.command === 'codex')
    return codexRunSpend({ stdout: options.stdout, args: options.args ?? [], ask: options.ask, at: options.at });

  const envelope = asJsonObject(options.stdout);
  const usage = objectAt(envelope, 'usage');

  if (!envelope || !usage) return null;

  return {
    at: options.at,
    source: 'agent-usage',
    kind: 'agent-usage',
    provider: TIMETRACK_PROVIDER,
    sessionId: options.ask,
    // The CLI's own id for the run. Without one the instant is the id: the app writes each run once,
    // and a retry is a second run that spent a second time.
    turnId: stringAt(envelope, 'session_id') ?? options.at.toISOString(),
    cwd: '',
    model: modelOf(envelope),
    usage: tokenUsageOf(usage),
  };
};

/**
 * Wraps the process runner so every model call the app makes is recorded as spend of its own.
 *
 * Only a spec that names an `ask` is read for spend, so the git, forge and editor runs that share this
 * runner cost nothing and can never be mistaken for a model call. A recording that fails is dropped:
 * the answer the user pressed for must not be lost to the meter that watches it.
 */
export const meteredRunner = (options: {
  runner: TimetrackProcessRunner;
  record$: (event: AgentUsageEvent) => Observable<unknown>;
  now?: () => Date;
}): TimetrackProcessRunner => ({
  run$: (spec: ProcessSpec) =>
    options.runner.run$(spec).pipe(
      concatMap((result: ProcessResult) => {
        const at = (options.now ?? (() => new Date()))();
        const spend = spec.ask
          ? agentRunSpend({ stdout: result.stdout, ask: spec.ask, at, command: spec.command, args: spec.args })
          : null;

        if (!spend) return of(result);

        return options.record$(spend).pipe(
          catchError(() => EMPTY),
          take(1),
          defaultIfEmpty(null),
          map(() => result),
        );
      }),
    ),
});
