import { InferredAttribution } from '../correlate/rules';
import { agentOutputDocument } from './envelope';
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

const isAnswerDocument = (value: unknown): value is { answers: Answer[] } => {
  if (!value || typeof value !== 'object') return false;

  const { answers } = value as { answers?: unknown };

  return Array.isArray(answers) && answers.every(isAnswer);
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

  const { answers } = agentOutputDocument({ stdout: options.stdout, isValid: isAnswerDocument });

  for (const answer of answers) {
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
