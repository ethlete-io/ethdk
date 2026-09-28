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
export const agentOutputDocument = <T>(options: {
  stdout: string;
  isValid: (value: unknown) => value is T;
  /** The CLI that wrote `stdout`, as the spec named it. Anything but `codex` reads Claude's envelope. */
  command?: string;
}): T => {
  if (options.command === 'codex') return codexOutputDocument(options);

  const envelope: unknown = JSON.parse(options.stdout);

  if (envelope && typeof envelope === 'object' && (envelope as { is_error?: unknown }).is_error === true)
    throw new Error('the agent reported an error');

  const structured = (envelope as { structured_output?: unknown })?.structured_output;

  if (options.isValid(structured)) return structured;

  const result = (envelope as { result?: unknown })?.result;

  if (typeof result !== 'string') throw new Error('the agent returned no result');

  return answerDocument(result, options.isValid);
};

const answerDocument = <T>(text: string, isValid: (value: unknown) => value is T): T => {
  const parsed: unknown = JSON.parse(text.replace(/^\s*```(?:json)?|```\s*$/g, ''));

  if (!isValid(parsed)) throw new Error('the agent returned an answer of the wrong shape');

  return parsed;
};

type CodexEvent = {
  type?: unknown;
  message?: unknown;
  error?: { message?: unknown };
  item?: { type?: unknown; text?: unknown };
};

const codexEvents = (stdout: string): CodexEvent[] =>
  stdout.split('\n').flatMap((line) => {
    if (!line.trim().startsWith('{')) return [];

    try {
      const event: unknown = JSON.parse(line);

      return event && typeof event === 'object' ? [event as CodexEvent] : [];
    } catch {
      return [];
    }
  });

/**
 * Reads the answer out of `codex exec --json`, one event per line. The last `agent_message` is the
 * answer; an earlier one is the agent narrating. An `error` item is a warning the run survived, while a
 * top-level `error` or a `turn.failed` is the run failing.
 */
const codexOutputDocument = <T>(options: { stdout: string; isValid: (value: unknown) => value is T }): T => {
  const events = codexEvents(options.stdout);
  const failure = events.find((event) => event.type === 'turn.failed' || event.type === 'error');

  if (failure) {
    const message = failure.error?.message ?? failure.message;

    throw new Error(typeof message === 'string' ? message : 'the agent reported an error');
  }

  const answer = events
    .filter((event) => event.type === 'item.completed' && event.item?.type === 'agent_message')
    .map((event) => event.item?.text)
    .at(-1);

  if (typeof answer !== 'string') throw new Error('the agent returned no result');

  return answerDocument(answer, options.isValid);
};
