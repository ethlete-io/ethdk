import { Observable, catchError, defer, map, of, retry } from 'rxjs';
import { InferredAttribution } from '../correlate/rules';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { ReasoningOptions, ReasoningPlan } from './model';
import { parseReasoningOutput } from './parse';
import { REASONING_JSON_SCHEMA, REASONING_SYSTEM_PROMPT } from './prompt';
import { agentProcessSpec } from './spec';

export const reasoningSpec = (options: { plan: ReasoningPlan; options?: Partial<ReasoningOptions> }): ProcessSpec =>
  agentProcessSpec({
    systemPrompt: REASONING_SYSTEM_PROMPT,
    schema: REASONING_JSON_SCHEMA,
    stdin: JSON.stringify(options.plan.request),
    options: options.options,
  });

/**
 * One reasoning run's result: what it proposes, and why it proposed nothing when it did.
 *
 * A run that failed and a run that had nothing to say both propose no attribution, and a reviewer has
 * to be able to tell them apart — a failure kept as an answer leaves the day looking answered, and the
 * card that would say so reads as a button that did nothing.
 */
export type ReasoningOutcome = {
  answers: InferredAttribution[];
  /** Why the run proposed nothing, or `null` for a run that answered. */
  failure: string | null;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Runs the day's one reasoning call and returns what it proposes.
 *
 * One call per day-review, never one per context: spawning the CLI costs seconds, and the answers
 * are better for seeing the whole day at once. A run that fails, times out, or answers something
 * unreadable twice proposes nothing and says why — a day short of an answer is the outcome this
 * feature already handles everywhere, and a guess is not.
 */
export const runReasoning$ = (options: {
  runner: TimetrackProcessRunner;
  plan: ReasoningPlan;
  options?: Partial<ReasoningOptions>;
}): Observable<ReasoningOutcome> => {
  if (!options.plan.request.contexts.length || !options.plan.request.candidates.length) {
    return of({ answers: [], failure: null });
  }

  const spec = reasoningSpec({ plan: options.plan, options: options.options });

  // `defer` is what makes the retry a second run. Without it the retry re-subscribes to the
  // observable the first spawn already returned, which replays the failure it is meant to escape.
  return defer(() => options.runner.run$(spec)).pipe(
    map((result): ReasoningOutcome => {
      if (result.code !== 0) throw new Error(result.stderr.trim() || `the reasoning provider exited ${result.code}`);

      return { answers: parseReasoningOutput({ stdout: result.stdout, plan: options.plan }), failure: null };
    }),
    retry(1),
    catchError((error: unknown) => of<ReasoningOutcome>({ answers: [], failure: messageOf(error) })),
  );
};
