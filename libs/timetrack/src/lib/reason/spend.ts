import { EMPTY, Observable, catchError, concatMap, defaultIfEmpty, map, of, take } from 'rxjs';
import { asJsonObject, countAt, objectAt, stringAt } from '../agent-session/record';
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

/**
 * What one agent-CLI run spent, read out of its own JSON envelope, or `null` where it reports none.
 *
 * A run that answered an error still spent its tokens, so the envelope is read whatever it says. A
 * `usage` of all zeros is kept for the same reason a turn of one token is: the call was made.
 */
export const agentRunSpend = (options: { stdout: string; ask: ModelAsk; at: Date }): AgentUsageEvent | null => {
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
        const spend = spec.ask ? agentRunSpend({ stdout: result.stdout, ask: spec.ask, at }) : null;

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
