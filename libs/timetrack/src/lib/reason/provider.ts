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
 * Runs the day's one reasoning call and returns what it proposes.
 *
 * One call per day-review, never one per context: spawning the CLI costs seconds, and the answers
 * are better for seeing the whole day at once. A run that fails, times out, or answers something
 * unreadable twice degrades to proposing nothing — a day short of an answer is the outcome this
 * feature already handles everywhere, and a guess is not.
 */
export const runReasoning$ = (options: {
  runner: TimetrackProcessRunner;
  plan: ReasoningPlan;
  options?: Partial<ReasoningOptions>;
}): Observable<InferredAttribution[]> => {
  if (!options.plan.request.contexts.length || !options.plan.request.candidates.length) return of([]);

  const spec = reasoningSpec({ plan: options.plan, options: options.options });

  // `defer` is what makes the retry a second run. Without it the retry re-subscribes to the
  // observable the first spawn already returned, which replays the failure it is meant to escape.
  return defer(() => options.runner.run$(spec)).pipe(
    map((result) => {
      if (result.code !== 0) throw new Error(result.stderr.trim() || `the reasoning provider exited ${result.code}`);

      return parseReasoningOutput({ stdout: result.stdout, plan: options.plan });
    }),
    retry(1),
    catchError(() => of<InferredAttribution[]>([])),
  );
};
