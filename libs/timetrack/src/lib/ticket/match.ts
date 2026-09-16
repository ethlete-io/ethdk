import { Observable, catchError, defer, map, of, retry } from 'rxjs';
import { agentOutputDocument } from '../reason/envelope';
import { ReasoningOptions } from '../reason/model';
import { pseudonymMap, unmaskNames } from '../reason/pseudonym';
import { agentProcessSpec } from '../reason/spec';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { TicketWritingRequest, offeredIssueKey } from './write';

/** What the agent answers when it is asked only what already tracks the work. */
export type TicketMatch = {
  /** The issue from `parents` the work belongs under, or nothing when none does. */
  parentKey?: string;
  /** An issue from `issues` that already is this work, so nothing new needs filing. */
  existingKey?: string;
  /** One sentence for why that issue is the same work. Empty unless `existingKey` is set. */
  existingReason?: string;
};

/**
 * The whole instruction. It replaces the CLI's own system prompt for the same reason the ticket
 * writing call does: the agent framing underneath describes a session with tools and a codebase,
 * which this call does not have.
 */
export const TICKET_MATCH_SYSTEM_PROMPT = [
  'You read a stretch of work a developer already did, and you answer two questions about it: is it',
  'already tracked by an open issue, and which wider issue does it belong under.',
  '',
  'You write nothing. No summary, no description, no new ticket. The user already wrote the words for',
  'this work and is keeping them.',
  '',
  'The user message is JSON. `standIn` is the name the user gave the work themselves, their own draft',
  'description, and how many days it has run across. `notes` is taken from commit subjects, merge',
  'request titles and agent session titles. `parents` is the issues the work could roll up to.',
  '`issues` is every open issue in the project.',
  '',
  '`spec` is present when the work sits in a repository that holds a written specification: its',
  'title, what kind of work it is, its tags, the parent issue it already names, and the section it',
  'opens with. It is the closest thing to a brief that exists, so it outranks the notes on what the',
  'work is for. Only the opening section is sent, never the body of the specification.',
  '',
  'Rules:',
  '- `existingKey` is an issue from `issues` that already tracks this very work, or null. Answer it',
  '  only when the same work is meant, not when the subject is merely related. Time logged on the',
  '  wrong issue is worse than a second ticket. Choose only from `issues`.',
  '- `existingReason` is one sentence naming the wording that decided `existingKey`. Empty otherwise.',
  '- `parentKey` is the issue from `parents` this work belongs under, or null. Choose only from',
  '  `parents`. Answer null unless the notes, the branch or the specification say it belongs there.',
  '- Answer null rather than a guess. An empty answer costs the user nothing, and a wrong key costs',
  '  them a correction they may not notice.',
  '- Write `existingReason` in the language the evidence is in. A German `standIn` name and German',
  '  notes get a German sentence, whatever language this instruction is in.',
  '- Use only what the JSON says. Never name an issue key that is not in `issues` or `parents`.',
].join('\n');

/** Passed to `--json-schema`, so the CLI validates the shape before it answers. */
export const TICKET_MATCH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    parentKey: { type: ['string', 'null'] },
    existingKey: { type: ['string', 'null'] },
    existingReason: { type: 'string' },
  },
  required: ['parentKey', 'existingKey', 'existingReason'],
  additionalProperties: false,
} as const;

/** The run a match press spawns, from the same payload a writing press would have sent. */
export const ticketMatchSpec = (options: {
  request: TicketWritingRequest;
  options?: Partial<ReasoningOptions>;
}): ProcessSpec =>
  agentProcessSpec({
    systemPrompt: TICKET_MATCH_SYSTEM_PROMPT,
    schema: TICKET_MATCH_JSON_SCHEMA,
    stdin: JSON.stringify(options.request),
    ask: 'a match',
    options: options.options,
  });

type RawMatch = {
  parentKey?: string | null;
  existingKey?: string | null;
  existingReason?: string;
};

const isKey = (value: unknown) => value === undefined || value === null || typeof value === 'string';

const isMatch = (value: unknown): value is RawMatch => {
  if (!value || typeof value !== 'object') return false;

  const match = value as Partial<RawMatch>;

  return isKey(match.parentKey) && isKey(match.existingKey);
};

/**
 * Has the local agent CLI say what already tracks this work, and answers `null` when it cannot.
 *
 * An answer that names neither key is not a failure: it is the agent saying nothing tracks the work,
 * which is the common case and is worth showing. Only a run that fails answers `null`, so a failed
 * run costs the user the button and nothing else.
 *
 * A parent or an existing issue the request never offered is dropped, exactly as the writing call
 * drops an invented issue key.
 *
 * The answer is checked in the pseudonyms it was asked in and read back into real names after. Pass
 * the same name list the request was built with, or the reason comes back in pseudonyms.
 */
export const matchTicketWithAgent$ = (options: {
  runner: TimetrackProcessRunner;
  request: TicketWritingRequest;
  options?: Partial<ReasoningOptions>;
  /** The list the request was masked with. The list is the map; nothing derived is stored. */
  maskedNames?: readonly string[];
}): Observable<TicketMatch | null> => {
  const spec = ticketMatchSpec({ request: options.request, options: options.options });
  const names = pseudonymMap(options.maskedNames ?? []);
  const real = (text: string | undefined) => (text ? unmaskNames({ text, map: names }) : text);

  // `defer` is what makes the retry a second run rather than a replay of the first spawn's failure.
  return defer(() => options.runner.run$(spec)).pipe(
    map((result): TicketMatch => {
      if (result.code !== 0) throw new Error(result.stderr.trim() || `the agent exited ${result.code}`);

      const answer = agentOutputDocument({ stdout: result.stdout, isValid: isMatch });
      const existingKey = offeredIssueKey({ answered: answer.existingKey, issues: options.request.issues });
      const parentKey = offeredIssueKey({ answered: answer.parentKey, issues: options.request.parents });

      return {
        parentKey: real(parentKey),
        existingKey: real(existingKey),
        existingReason: existingKey ? real(answer.existingReason?.trim()) : undefined,
      };
    }),
    retry(1),
    catchError(() => of(null)),
  );
};
