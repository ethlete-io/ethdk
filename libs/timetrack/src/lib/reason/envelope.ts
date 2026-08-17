/* eslint-disable @typescript-eslint/naming-convention -- the agent CLI's JSON envelope is snake_case. */

/**
 * Reads the document out of an agent CLI's own JSON envelope.
 *
 * `structured_output` is the parsed answer when the run used `--json-schema`; `result` is the same
 * document as a string, and is the fallback for a CLI that does not support the flag. A
 * `structured_output` of the wrong shape falls through to `result` rather than failing, because a CLI
 * that ignores the schema still answers in the string.
 *
 * Throws when nothing readable is there, which is what a caller's single retry is for.
 */
export const agentOutputDocument = <T>(options: { stdout: string; isValid: (value: unknown) => value is T }): T => {
  const envelope: unknown = JSON.parse(options.stdout);

  if (envelope && typeof envelope === 'object' && (envelope as { is_error?: unknown }).is_error === true)
    throw new Error('the agent reported an error');

  const structured = (envelope as { structured_output?: unknown })?.structured_output;

  if (options.isValid(structured)) return structured;

  const result = (envelope as { result?: unknown })?.result;

  if (typeof result !== 'string') throw new Error('the agent returned no result');

  const parsed: unknown = JSON.parse(result.replace(/^\s*```(?:json)?|```\s*$/g, ''));

  if (!options.isValid(parsed)) throw new Error('the agent returned an answer of the wrong shape');

  return parsed;
};
