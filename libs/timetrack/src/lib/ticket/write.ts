import { Observable, catchError, defer, map, of, retry } from 'rxjs';
import { agentOutputDocument } from '../reason/envelope';
import { ReasoningOptions } from '../reason/model';
import { agentProcessSpec } from '../reason/spec';
import { UnnamedContext } from '../correlate/rules';
import { JiraIssue } from '../jira/issue';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { MAX_TICKET_SUMMARY_LENGTH } from './draft';

/** An issue the agent may choose from, offered so it picks rather than invents a key. */
export type TicketWritingIssue = {
  key: string;
  summary: string;
};

/** What the agent answers. Every field lands in the form, and every field stays the user's. */
export type TicketWording = {
  summary: string;
  description: string;
  /** The parent it chose from `parents`, or nothing for a ticket that rolls up to none. */
  parentKey?: string;
  /** An issue from `issues` that already is this work, so nothing new needs filing. */
  existingKey?: string;
  /** One sentence for why that issue is the same work. Empty unless `existingKey` is set. */
  existingReason?: string;
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
  /** The issues that may be the parent of a new ticket. */
  parents: TicketWritingIssue[];
  /** The project's open issues, so the work already tracked is found instead of filed twice. */
  issues: TicketWritingIssue[];
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
  '`parents` is the issues a new ticket could roll up to. `issues` is every open issue in the project.',
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
  '- `parentKey` is the issue from `parents` this work belongs under, or null. Choose only from',
  '  `parents`. Answer null unless the notes or the branch actually say it belongs there.',
  '- `existingKey` is an issue from `issues` that already tracks this very work, or null. Answer it',
  '  only when the same work is meant, not when the subject is merely related — a second ticket is',
  '  a nuisance, and time logged on the wrong existing issue is worse. Choose only from `issues`.',
  '- `existingReason` is one sentence naming the wording that decided `existingKey`. Empty otherwise.',
  '- Write `summary` and `description` in every answer, including one that names an `existingKey`.',
].join('\n');

/** Passed to `--json-schema`, so the CLI validates the shape before it answers. */
export const TICKET_WRITING_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    description: { type: 'string' },
    parentKey: { type: ['string', 'null'] },
    existingKey: { type: ['string', 'null'] },
    existingReason: { type: 'string' },
  },
  required: ['summary', 'description', 'parentKey', 'existingKey', 'existingReason'],
  additionalProperties: false,
} as const;

const repoNameOf = (path: string) => path.split('/').filter(Boolean).pop() ?? path;

const asIssues = (issues: readonly JiraIssue[]): TicketWritingIssue[] =>
  issues.map((issue) => ({ key: issue.key, summary: issue.summary }));

/** Builds the redacted payload the review shows before anything is sent. */
export const ticketWritingRequest = (options: {
  context: UnnamedContext;
  notes: readonly string[];
  parents?: readonly JiraIssue[];
  issues?: readonly JiraIssue[];
}): TicketWritingRequest => {
  const { repoPath, branch, appId } = options.context.context;

  return {
    repo: repoPath ? repoNameOf(repoPath) : undefined,
    branch,
    app: appId,
    minutes: Math.round(options.context.observedMs / 60_000),
    notes: [...options.notes],
    parents: asIssues(options.parents ?? []),
    issues: asIssues(options.issues ?? []),
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

type RawWording = {
  summary: string;
  description: string;
  parentKey?: string | null;
  existingKey?: string | null;
  existingReason?: string;
};

const isOptionalKey = (value: unknown) => value === undefined || value === null || typeof value === 'string';

const isWording = (value: unknown): value is RawWording => {
  if (!value || typeof value !== 'object') return false;

  const wording = value as Partial<RawWording>;

  return (
    typeof wording.summary === 'string' &&
    typeof wording.description === 'string' &&
    isOptionalKey(wording.parentKey) &&
    isOptionalKey(wording.existingKey)
  );
};

/** A key the request never offered is a key the agent made up, and it is dropped rather than shown. */
const offeredKey = (options: { answered: string | null | undefined; issues: readonly TicketWritingIssue[] }) => {
  const key = options.answered?.trim().toUpperCase();

  return key && options.issues.some((issue) => issue.key.toUpperCase() === key) ? key : undefined;
};

/**
 * Has the local agent CLI write the ticket, and answers `null` when it cannot.
 *
 * `null` rather than a throw or a half-written draft: the deterministic draft is already in the form
 * and is a worse but honest ticket, so a failed run costs the user the button and nothing else. An
 * empty summary is treated as a failed run — a ticket with no title is not a ticket.
 *
 * A parent or an existing issue the request never offered is dropped, exactly as the day's reasoning
 * drops an invented issue key: the rest of the answer still stands on the wording it was given.
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

      const existingKey = offeredKey({ answered: wording.existingKey, issues: options.request.issues });

      return {
        summary,
        description: wording.description.trim(),
        parentKey: offeredKey({ answered: wording.parentKey, issues: options.request.parents }),
        existingKey,
        existingReason: existingKey ? wording.existingReason?.trim() : undefined,
      };
    }),
    retry(1),
    catchError(() => of(null)),
  );
};
