import { Observable, catchError, defer, map, of, retry } from 'rxjs';
import { InferredAttribution } from '../correlate/rules';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { DEFAULT_REASONING_OPTIONS, ReasoningOptions, ReasoningPlan } from './model';
import { parseReasoningOutput } from './parse';
import { REASONING_JSON_SCHEMA, REASONING_SYSTEM_PROMPT } from './prompt';

/**
 * The flags that make the call a one-shot question rather than a coding session.
 *
 * `--safe-mode` is what `--bare` was meant to be here: it drops hooks, skills, plugins, MCP servers,
 * custom agents and `CLAUDE.md` discovery, but leaves authentication alone. `--bare` cannot be used —
 * it reads `ANTHROPIC_API_KEY` only, and the whole point of spawning a CLI is to use the subscription
 * the user already has. `--tools ""` disables every built-in tool, so the run has no filesystem and no
 * network of its own; the prompt on stdin is all it can see.
 */
const ISOLATION_ARGS = ['--print', '--safe-mode', '--no-session-persistence', '--strict-mcp-config', '--tools', ''];

export const reasoningSpec = (options: { plan: ReasoningPlan; options?: Partial<ReasoningOptions> }): ProcessSpec => {
  const settings = { ...DEFAULT_REASONING_OPTIONS, ...options.options };

  return {
    command: settings.command,
    args: [
      ...ISOLATION_ARGS,
      '--system-prompt',
      REASONING_SYSTEM_PROMPT,
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(REASONING_JSON_SCHEMA),
      ...(settings.model ? ['--model', settings.model] : []),
    ],
    stdin: JSON.stringify(options.plan.request),
    timeoutMs: settings.timeoutMs,
  };
};

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
