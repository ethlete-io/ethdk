import { GitFlowConfig, parseBranch, slugifySubject } from '@ethlete/agent-rules/git-flow';
import { WorkGroup } from '../rows/merge';
import { UnnamedContext } from '../model/attribution';
import { ActivityContext, contextKey } from '../model/block';
import { formatDurationMs } from '../model/duration';
import { QUOTABLE_EVIDENCE_KINDS } from '../model/evidence';

/** Jira refuses a longer summary, and a summary that long is a description anyway. */
export const MAX_TICKET_SUMMARY_LENGTH = 255;

/** How many observations a description quotes. Enough to recognise the work, short enough to read. */
export const DEFAULT_MAX_TICKET_NOTES = 10;

/** What the create form opens with. Every field is editable — this is a first draft, not a decision. */
export type TicketDraft = {
  summary: string;
  description: string;
  /** The branch subject the grammar would use, such as `user-management`, for the subject field. */
  subject: string;
  /** The observations the description quotes, so the form can show what it drew on. */
  notes: string[];
};

/** The branch subject a summary would produce, for the instance's subject field. */
export const ticketSubjectOf = (summary: string) => slugifySubject(summary);

/** `user-management` reads as a branch; `User management` reads as a ticket. */
export const humanized = (subject: string) => {
  const words = subject.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

  return words ? `${words[0]?.toUpperCase()}${words.slice(1)}` : '';
};

const repoNameOf = (path: string) => path.split('/').filter(Boolean).pop() ?? path;

const notesForAll = (options: { groups: readonly WorkGroup[]; contextIds: readonly string[]; max: number }) => {
  const wanted = new Set(options.contextIds);
  const notes: string[] = [];
  const seen = new Set<string>();

  for (const group of options.groups) {
    for (const block of group.blocks) {
      if (!wanted.has(contextKey(block.context))) continue;

      for (const entry of block.evidence) {
        if (!QUOTABLE_EVIDENCE_KINDS.includes(entry.kind)) continue;

        const note = entry.summary ?? entry.detail;

        if (!note || seen.has(note)) continue;

        seen.add(note);
        notes.push(note);

        if (notes.length >= options.max) return notes;
      }
    }
  }

  return notes;
};

const notesFor = (options: { groups: readonly WorkGroup[]; contextId: string; max: number }) => {
  const notes: string[] = [];
  const seen = new Set<string>();

  for (const group of options.groups) {
    for (const block of group.blocks) {
      if (contextKey(block.context) !== options.contextId) continue;

      for (const entry of block.evidence) {
        if (!QUOTABLE_EVIDENCE_KINDS.includes(entry.kind)) continue;

        const note = entry.summary ?? entry.detail;

        if (!note || seen.has(note)) continue;

        seen.add(note);
        notes.push(note);

        if (notes.length >= options.max) return notes;
      }
    }
  }

  return notes;
};

/**
 * The subject a branch already carries, even when the branch names no issue key — which is the only
 * case that reaches here. `parseBranch` reports the subject of a non-conforming name too, so
 * `feat/user-management` still yields `user-management`.
 */
const branchSubjectOf = (options: { branch: string | undefined; config: GitFlowConfig }) =>
  options.branch ? parseBranch({ branch: options.branch, config: options.config }).subject : undefined;

const summaryFor = (options: { context: UnnamedContext; notes: string[]; config: GitFlowConfig }) => {
  const { repoPath, branch, appId } = options.context.context;
  const fromBranch = humanized(branchSubjectOf({ branch, config: options.config }) ?? '');

  return (fromBranch || options.notes[0] || (repoPath ? repoNameOf(repoPath) : (appId ?? ''))).slice(
    0,
    MAX_TICKET_SUMMARY_LENGTH,
  );
};

/**
 * The name a stand-in opens with.
 *
 * It is drafted by the rules a ticket summary is drafted by, because that is what it becomes: the
 * plan says the epic's summary is the stand-in name. The branch subject is the strongest source there
 * is — it is what the user called the work while doing it — and a checkout with no subject falls back
 * to the checkout's own name.
 */
export const standInNameFor = (options: { context: ActivityContext; config: GitFlowConfig }) => {
  const { repoPath, branch, appId } = options.context;
  const fromBranch = humanized(branchSubjectOf({ branch, config: options.config }) ?? '');

  return (fromBranch || (repoPath ? repoNameOf(repoPath) : (appId ?? ''))).slice(0, MAX_TICKET_SUMMARY_LENGTH);
};

const whereFor = (context: UnnamedContext) => {
  const { repoPath, branch, appId } = context.context;

  if (!repoPath) return appId ?? 'this machine';

  return branch ? `${repoNameOf(repoPath)}, on branch ${branch}` : repoNameOf(repoPath);
};

/**
 * Drafts the description of the parent a ticket rolls up to.
 *
 * It says what the parent gathers and where its time came from, and it deliberately does not repeat
 * the child's quoted notes: an epic that restates its first task tells a reader nothing the task does
 * not already, and the notes belong to the stretch of work that produced them.
 *
 * An epic filed with no description at all is the thing this exists to stop. It is what somebody
 * outside the work reads first, and the field is the user's to rewrite before anything is sent.
 */
export const draftParentDescription = (context: UnnamedContext) =>
  [
    `Gathers the work in ${whereFor(context)} that no issue covered.`,
    '',
    `Recorded from ${formatDurationMs(context.observedMs)} of it, on the day it was reviewed. Each child says what its own stretch of work was.`,
  ].join('\n');

/**
 * Drafts the ticket that a stretch of work nothing could name would be filed as.
 *
 * It quotes only what may leave the machine (`QUOTABLE_EVIDENCE_KINDS`), so a description carries
 * commit subjects and agent-session titles and never a window title or a file path. The branch is the
 * strongest source there is for a summary: it is what the user called the work while doing it.
 *
 * The description leads with what the work says about itself and ends with where the time came from,
 * because the reader of the ticket is somebody who was not there. Where the time came from is the
 * least interesting line for them, so it goes last rather than first.
 */
export const draftTicket = (options: {
  context: UnnamedContext;
  unattributed: readonly WorkGroup[];
  config: GitFlowConfig;
  maxNotes?: number;
}): TicketDraft => {
  const { context, config } = options;
  const notes = notesFor({
    groups: options.unattributed,
    contextId: context.id,
    max: options.maxNotes ?? DEFAULT_MAX_TICKET_NOTES,
  });
  const summary = summaryFor({ context, notes, config });
  const provenance = `Recorded from ${formatDurationMs(context.observedMs)} of work in ${whereFor(context)}.`;
  const body = notes.length
    ? ['What the work says it was:', '', ...notes.map((note) => `- ${note}`), '']
    : ['Nothing in the day names this work beyond where it happened.', ''];

  return {
    summary,
    description: [...body, provenance].join('\n'),
    subject: ticketSubjectOf(summary),
    notes,
  };
};

/**
 * Drafts the ticket for one unnamed stretch of a checkout, on the day's own evidence alone.
 *
 * It is what an auto-opened stand-in carries until the user rewrites it, so best effort is the bar,
 * not correctness. The summary comes from the branch that held the most time, and the description
 * names every branch the contexts cover, so a title that names only the biggest piece never hides
 * the rest.
 */
export const draftRepoTicket = (options: {
  repoPath: string;
  contexts: readonly UnnamedContext[];
  unattributed: readonly WorkGroup[];
  config: GitFlowConfig;
  maxNotes?: number;
}): TicketDraft => {
  const { repoPath, config } = options;
  const byTime = [...options.contexts].sort((left, right) => right.observedMs - left.observedMs);
  const observedMs = byTime.reduce((total, context) => total + context.observedMs, 0);
  const notes = notesForAll({
    groups: options.unattributed,
    contextIds: byTime.map((context) => context.id),
    max: options.maxNotes ?? DEFAULT_MAX_TICKET_NOTES,
  });

  const branches = [
    ...new Set(byTime.map((context) => context.context.branch).filter((branch): branch is string => !!branch)),
  ];
  const leading = byTime[0];
  const fromBranch = humanized(branchSubjectOf({ branch: leading?.context.branch, config }) ?? '');
  const summary = (fromBranch || notes[0] || repoNameOf(repoPath)).slice(0, MAX_TICKET_SUMMARY_LENGTH);

  const body = notes.length
    ? ['What the work says it was:', '', ...notes.map((note) => `- ${note}`), '']
    : ['Nothing in the day names this work beyond where it happened.', ''];
  const covers = branches.length ? [`Covers ${branches.join(', ')}.`, ''] : [];

  return {
    summary,
    description: [
      ...body,
      ...covers,
      `Recorded from ${formatDurationMs(observedMs)} of work in ${repoNameOf(repoPath)} that no issue covered.`,
    ].join('\n'),
    subject: ticketSubjectOf(summary),
    notes,
  };
};
