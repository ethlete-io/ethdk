import { Observable, catchError, defer, map, of, retry } from 'rxjs';
import { agentOutputDocument } from '../reason/envelope';
import { ReasoningOptions } from '../reason/model';
import { agentProcessSpec } from '../reason/spec';
import { UnnamedContext } from '../correlate/rules';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { MAX_TICKET_SUMMARY_LENGTH } from './draft';

/** The wording of one ticket. Both fields land in the form, and both stay editable. */
export type TicketWording = {
  summary: string;
  description: string;
};

/**
 * Exactly what leaves the machine to have a ticket written. The same redaction the day's reasoning
 * call uses: a repository's name rather than its path, a branch name, an application id, and wording
 * the day's own quotable evidence already carries.
 */
export type TicketWritingRequest = {
  repo?: string;
  branch?: string;
  app?: string;
  minutes: number;
  notes: string[];
};

/**
 * The whole instruction. It replaces the CLI's own system prompt for the same reason the day's
 * reasoning call does: the agent framing underneath describes a session with tools and a codebase,
 * which this call does not have.
 */
export const TICKET_WRITING_SYSTEM_PROMPT = [
  'You write one Jira ticket for a stretch of work a developer already did.',
  '',
  'The user message is JSON with the repository, the branch, the application, how many minutes the',
  'work lasted, and notes taken from commit subjects, merge request titles and agent session titles.',
  '',
  'Write for the person who reads the backlog and was not there: a delivery lead, a product manager.',
  '',
  'Rules:',
  '- `summary` is one line, under 255 characters, naming the outcome. No issue key, no branch name,',
  '  no ticket-type prefix such as "feat:" or "chore:".',
  '- `description` is two to five sentences of plain prose, then a short bullet list of the notes',
  '  that carry real information. Say what changed and what it is for.',
  '- Use only what the JSON says. Never invent a requirement, an acceptance criterion, a deadline or',
  '  a person. Where the notes are thin, write less rather than filling the gap.',
  '- Never write about yourself, the notes, the tracking, or how long the work took.',
].join('\n');

/** Passed to `--json-schema`, so the CLI validates the shape before it answers. */
export const TICKET_WRITING_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['summary', 'description'],
  additionalProperties: false,
} as const;

const repoNameOf = (path: string) => path.split('/').filter(Boolean).pop() ?? path;

/** Builds the redacted payload the review shows before anything is sent. */
export const ticketWritingRequest = (options: {
  context: UnnamedContext;
  notes: readonly string[];
}): TicketWritingRequest => {
  const { repoPath, branch, appId } = options.context.context;

  return {
    repo: repoPath ? repoNameOf(repoPath) : undefined,
    branch,
    app: appId,
    minutes: Math.round(options.context.observedMs / 60_000),
    notes: [...options.notes],
  };
};

export const ticketWritingSpec = (options: {
  request: TicketWritingRequest;
  options?: Partial<ReasoningOptions>;
}): ProcessSpec =>
  agentProcessSpec({
    systemPrompt: TICKET_WRITING_SYSTEM_PROMPT,
    schema: TICKET_WRITING_JSON_SCHEMA,
    stdin: JSON.stringify(options.request),
    options: options.options,
  });

const isWording = (value: unknown): value is TicketWording => {
  if (!value || typeof value !== 'object') return false;

  const wording = value as Partial<TicketWording>;

  return typeof wording.summary === 'string' && typeof wording.description === 'string';
};

/**
 * Has the local agent CLI write the ticket, and answers `null` when it cannot.
 *
 * `null` rather than a throw or a half-written draft: the deterministic draft is already in the form
 * and is a worse but honest ticket, so a failed run costs the user the button and nothing else. An
 * empty summary is treated as a failed run — a ticket with no title is not a ticket.
 */
export const writeTicketWithAgent$ = (options: {
  runner: TimetrackProcessRunner;
  request: TicketWritingRequest;
  options?: Partial<ReasoningOptions>;
}): Observable<TicketWording | null> => {
  const spec = ticketWritingSpec({ request: options.request, options: options.options });

  // `defer` is what makes the retry a second run. Without it the retry re-subscribes to the
  // observable the first spawn already returned, which replays the failure it is meant to escape.
  return defer(() => options.runner.run$(spec)).pipe(
    map((result): TicketWording => {
      if (result.code !== 0) throw new Error(result.stderr.trim() || `the agent exited ${result.code}`);

      const wording = agentOutputDocument({ stdout: result.stdout, isValid: isWording });
      const summary = wording.summary.trim().slice(0, MAX_TICKET_SUMMARY_LENGTH);

      if (!summary) throw new Error('the agent wrote no summary');

      return { summary, description: wording.description.trim() };
    }),
    retry(1),
    catchError(() => of(null)),
  );
};
