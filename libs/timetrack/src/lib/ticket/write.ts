import { Observable, catchError, defer, map, of, retry } from 'rxjs';
import { agentOutputDocument } from '../reason/envelope';
import { ReasoningOptions } from '../reason/model';
import { PseudonymMap, maskIssueKey, maskNames, pseudonymMap, unmaskNames } from '../reason/pseudonym';
import { agentProcessSpec } from '../reason/spec';
import { UnnamedContext } from '../model/attribution';
import { StandIn } from '../model/stand-in';
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

/** The name the user gave work before Jira held a ticket for it, offered as the ticket's subject. */
export type TicketWritingStandIn = {
  name: string;
  description?: string;
  /** How many days the work has run across, which is the only length a stand-in measures. */
  days: number;
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
  /** Absent for a stand-in, whose length no band measured. */
  minutes?: number;
  notes: string[];
  /** Present when the ticket is filed for a stand-in the user named. */
  standIn?: TicketWritingStandIn;
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
  '`minutes` is absent when nothing measured how long the work took.',
  '',
  '`standIn` is present when the user already named this work themselves, before Jira held a ticket:',
  'their own name for it, their own draft description, and how many days it has run across. Take it as',
  'the subject of the ticket. Sharpen the wording. Never write about different work than it names.',
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

const asIssues = (options: { issues: readonly JiraIssue[]; map: PseudonymMap }): TicketWritingIssue[] =>
  options.issues.map((issue) => ({
    key: maskIssueKey({ issueKey: issue.key, map: options.map }),
    summary: maskNames({ text: issue.summary, map: options.map }),
  }));

const masked = (options: { text: string | undefined; map: PseudonymMap }) =>
  options.text ? maskNames({ text: options.text, map: options.map }) : options.text;

/**
 * Builds the redacted payload the review shows before anything is sent.
 *
 * Every free-text field goes out in pseudonyms and the issue keys with them, exactly as the day's
 * reasoning call does — a project key is a project name. `writeTicketWithAgent$` reads the answer back
 * through the same name list.
 */
export const ticketWritingRequest = (options: {
  context: UnnamedContext;
  notes: readonly string[];
  parents?: readonly JiraIssue[];
  issues?: readonly JiraIssue[];
  /** The user's own name list, from `settings.reasoning.maskedNames`. Empty masks nothing. */
  maskedNames?: readonly string[];
}): TicketWritingRequest => {
  const { repoPath, branch, appId } = options.context.context;
  const map = pseudonymMap(options.maskedNames ?? []);

  return {
    repo: masked({ text: repoPath ? repoNameOf(repoPath) : undefined, map }),
    branch: masked({ text: branch, map }),
    app: masked({ text: appId, map }),
    minutes: Math.round(options.context.observedMs / 60_000),
    notes: options.notes.map((note) => maskNames({ text: note, map })),
    parents: asIssues({ issues: options.parents ?? [], map }),
    issues: asIssues({ issues: options.issues ?? [], map }),
  };
};

/**
 * Builds the redacted payload for a stand-in: work the user named in their own words before Jira
 * held a ticket for it.
 *
 * The name and the description are free text the user typed, so both go out in pseudonyms through the
 * same name list the day's reasoning call uses. `minutes` is left out rather than guessed — a stand-in
 * holds days, and no band on it measures how long the work took.
 */
export const standInWritingRequest = (options: {
  standIn: Pick<StandIn, 'name' | 'description' | 'days'>;
  parents?: readonly JiraIssue[];
  issues?: readonly JiraIssue[];
  /** The user's own name list, from `settings.reasoning.maskedNames`. Empty masks nothing. */
  maskedNames?: readonly string[];
}): TicketWritingRequest => {
  const map = pseudonymMap(options.maskedNames ?? []);
  const description = masked({ text: options.standIn.description, map });

  return {
    standIn: {
      name: maskNames({ text: options.standIn.name, map }),
      ...(description ? { description } : {}),
      days: options.standIn.days.length,
    },
    notes: [],
    parents: asIssues({ issues: options.parents ?? [], map }),
    issues: asIssues({ issues: options.issues ?? [], map }),
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
 *
 * The answer is checked in the pseudonyms it was asked in and read back into real names after, so a
 * key the agent echoed is matched against what was actually sent. Pass the same name list the request
 * was built with, or the wording comes back in pseudonyms.
 */
export const writeTicketWithAgent$ = (options: {
  runner: TimetrackProcessRunner;
  request: TicketWritingRequest;
  options?: Partial<ReasoningOptions>;
  /** The list `ticketWritingRequest` masked with. The list is the map; nothing derived is stored. */
  maskedNames?: readonly string[];
}): Observable<TicketWording | null> => {
  const spec = ticketWritingSpec({ request: options.request, options: options.options });
  const names = pseudonymMap(options.maskedNames ?? []);
  const real = (text: string | undefined) => (text ? unmaskNames({ text, map: names }) : text);

  // `defer` is what makes the retry a second run. Without it the retry re-subscribes to the
  // observable the first spawn already returned, which replays the failure it is meant to escape.
  return defer(() => options.runner.run$(spec)).pipe(
    map((result): TicketWording => {
      if (result.code !== 0) throw new Error(result.stderr.trim() || `the agent exited ${result.code}`);

      const wording = agentOutputDocument({ stdout: result.stdout, isValid: isWording });
      const summary = wording.summary.trim().slice(0, MAX_TICKET_SUMMARY_LENGTH);

      if (!summary) throw new Error('the agent wrote no summary');

      const existingKey = offeredKey({ answered: wording.existingKey, issues: options.request.issues });

      const parentKey = offeredKey({ answered: wording.parentKey, issues: options.request.parents });

      return {
        summary: unmaskNames({ text: summary, map: names }),
        description: unmaskNames({ text: wording.description.trim(), map: names }),
        parentKey: real(parentKey),
        existingKey: real(existingKey),
        existingReason: existingKey ? real(wording.existingReason?.trim()) : undefined,
      };
    }),
    retry(1),
    catchError(() => of(null)),
  );
};
