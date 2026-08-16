/* eslint-disable @typescript-eslint/naming-convention -- the agent CLI's JSON envelope is snake_case. */
import { InferredAttribution } from '../correlate/rules';
import { ReasoningPlan, ReasoningRequest } from './model';

type Answer = { id: string; issueKey: string | null; reason: string };

const isAnswer = (value: unknown): value is Answer => {
  if (!value || typeof value !== 'object') return false;

  const entry = value as Partial<Answer>;

  return (
    typeof entry.id === 'string' &&
    typeof entry.reason === 'string' &&
    (entry.issueKey === null || typeof entry.issueKey === 'string')
  );
};

const answersIn = (value: unknown): Answer[] | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  const { answers } = value as { answers?: unknown };

  return Array.isArray(answers) && answers.every(isAnswer) ? answers : undefined;
};

/**
 * Reads the CLI's own JSON envelope. `structured_output` is the parsed answer when the run used
 * `--json-schema`; `result` is the same document as a string, and is the fallback for a CLI that
 * does not support the flag.
 */
const answersInEnvelope = (stdout: string): Answer[] => {
  const envelope: unknown = JSON.parse(stdout);

  if (envelope && typeof envelope === 'object' && (envelope as { is_error?: unknown }).is_error === true)
    throw new Error('the reasoning provider reported an error');

  const structured = answersIn((envelope as { structured_output?: unknown })?.structured_output);

  if (structured) return structured;

  const result = (envelope as { result?: unknown })?.result;

  if (typeof result !== 'string') throw new Error('the reasoning provider returned no result');

  const answers = answersIn(JSON.parse(result.replace(/^\s*```(?:json)?|```\s*$/g, '')));

  if (!answers) throw new Error('the reasoning provider returned an answer of the wrong shape');

  return answers;
};

const knownKey = (request: ReasoningRequest, issueKey: string) =>
  request.candidates.some((candidate) => candidate.issueKey === issueKey);

/**
 * Turns one CLI run into attributions, dropping every answer the request cannot vouch for: a token
 * that was never sent, an issue key that was not offered as a candidate, an empty reason. A model
 * that answers something else is not a model to trust with the rest of the answer either, but the
 * day loses only that context — the remaining answers still stand on their own evidence.
 *
 * Throws when the output is not readable at all, which is what the single retry is for.
 */
export const parseReasoningOutput = (options: { stdout: string; plan: ReasoningPlan }): InferredAttribution[] => {
  const { plan } = options;
  const inferred: InferredAttribution[] = [];
  const answered = new Set<string>();

  for (const answer of answersInEnvelope(options.stdout)) {
    const contextId = plan.contextIds[answer.id];
    const issueKey = answer.issueKey?.trim().toUpperCase();
    const reason = answer.reason.trim();

    if (!contextId || answered.has(contextId) || !issueKey || !reason) continue;
    if (!knownKey(plan.request, issueKey)) continue;

    answered.add(contextId);
    inferred.push({ contextId, issueKey, reason });
  }

  return inferred;
};
