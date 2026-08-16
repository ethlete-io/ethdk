/**
 * The whole instruction. It replaces the CLI's own system prompt rather than appending to it: the
 * agent framing underneath — tools, a working directory, a codebase to explore — describes a session
 * this call does not have, and a model told it can read files asks to.
 */
export const REASONING_SYSTEM_PROMPT = [
  "You map stretches of a developer's day to the issue key the time should be logged against.",
  '',
  'The user message is JSON with two fields. `contexts` is a list of stretches nothing could name,',
  'each with the repository, the branch, the application, how many minutes it lasted, and notes taken',
  'from commit subjects, merge request titles, agent session titles and calendar events. `candidates`',
  'is the issues the rest of the same day was already logged against.',
  '',
  'For each context, answer with the candidate issue key the work belongs to, or null.',
  '',
  'Rules:',
  '- Choose only from `candidates`. Never invent an issue key.',
  '- Answer null unless the notes or the branch name actually say what the work was. A context you',
  '  cannot justify is worth more as an open question than as a wrong worklog.',
  '- `reason` is one sentence the developer will read beside the row. Quote the branch or the note',
  '  that decided it. Never write about your own confidence or process.',
  '- Answer every context exactly once, using the `id` it was given.',
].join('\n');

/**
 * Passed to `--json-schema`, so the CLI validates the shape before it answers rather than leaving a
 * malformed reply to be discovered here.
 */
export const REASONING_JSON_SCHEMA = {
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          issueKey: { type: ['string', 'null'] },
          reason: { type: 'string' },
        },
        required: ['id', 'issueKey', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['answers'],
  additionalProperties: false,
} as const;
