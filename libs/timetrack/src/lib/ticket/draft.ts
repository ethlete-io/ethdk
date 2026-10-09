import { GitFlowConfig, parseBranch, slugifySubject } from '@ethlete/agent-rules/git-flow';
import { WorkGroup } from '../rows/merge';
import { UnnamedContext } from '../model/attribution';
import { ActivityContext, contextKey } from '../model/block';
import { formatDurationMs } from '../model/duration';
import { isQuotableNote } from '../model/acknowledgement';
import { Evidence, QUOTABLE_EVIDENCE_KINDS } from '../model/evidence';
import { StandIn } from '../model/stand-in';

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

/**
 * A leading date, as a branch or a directory of dated work writes one. Both shapes are matched after
 * the separators became spaces, so `20260911_x` and `2026-09-11-x` reach here alike.
 */
const DATED_PREFIX = /^(?:\d{4} \d{2} \d{2}|\d{8}) /;

/**
 * `20260911_user-management` reads as a branch; `User management` reads as a ticket.
 *
 * The date goes: it says when the work was filed, which the days of the record already say, so it is
 * noise in a name a person reads. A subject that is nothing but a date keeps it, because a name of
 * nothing is worse than a date.
 */
export const humanized = (subject: string) => {
  const plain = subject.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const named = plain.replace(DATED_PREFIX, '') || plain;

  return named ? `${named[0]?.toUpperCase()}${named.slice(1)}` : '';
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

        const note = entry.summary;

        if (!note || !isQuotableNote(note) || seen.has(note)) continue;

        seen.add(note);
        notes.push(note);

        if (notes.length >= options.max) return notes;
      }
    }
  }

  return notes;
};

const NOTES_HEADING = 'What the work says it was:';
const NO_NOTES_LINE = 'Nothing in the day names this work beyond where it happened.';

/** A band of the day, as far as {@link standInNotes} reads one. */
export type StandInBand = {
  standInId?: string;
  issueKey?: string;
  observedMs?: number;
  evidence?: readonly Evidence[];
};

/**
 * What a stand-in's bands on the day say the work was, the wording that held the most time first.
 *
 * A note is weighed by the observed time of every band that carries it, so an agent session that ran
 * through the whole afternoon outranks a commit that took four minutes. Only a band the stand-in still
 * names counts: one that reached a real issue is no longer its work.
 */
export const standInNotes = (options: { bands: readonly StandInBand[]; standInId: string; max?: number }) => {
  const weight = new Map<string, number>();

  for (const band of options.bands) {
    if (band.standInId !== options.standInId || band.issueKey) continue;

    for (const note of new Set(
      (band.evidence ?? [])
        .filter(
          (entry) => QUOTABLE_EVIDENCE_KINDS.includes(entry.kind) && !!entry.summary && isQuotableNote(entry.summary),
        )
        .map((entry) => entry.summary as string),
    )) {
      weight.set(note, (weight.get(note) ?? 0) + (band.observedMs ?? 0));
    }
  }

  return [...weight]
    .sort((left, right) => right[1] - left[1])
    .slice(0, options.max ?? DEFAULT_MAX_TICKET_NOTES)
    .map(([note]) => note);
};

/** The observed time of a stand-in's bands on the day. */
export const standInObservedMs = (options: { bands: readonly StandInBand[]; standInId: string }) =>
  options.bands
    .filter((band) => band.standInId === options.standInId && !band.issueKey)
    .reduce((total, band) => total + (band.observedMs ?? 0), 0);

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

/** Whether a context says anything a ticket could be written from: a branch subject or a quotable note. */
export const contextHasTicketText = (options: {
  context: UnnamedContext;
  unattributed: readonly WorkGroup[];
  config: GitFlowConfig;
}) =>
  !!branchSubjectOf({ branch: options.context.context.branch, config: options.config })?.trim() ||
  notesForAll({ groups: options.unattributed, contextIds: [options.context.id], max: 1 }).length > 0;

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

/**
 * Whether a stand-in says anything a ticket could be written from: the user's own name for it, a branch
 * subject, a quotable note on the day's bands, or a name the app drafted from a note rather than from
 * where the work happened.
 */
export const standInHasTicketText = (options: {
  standIn: Pick<StandIn, 'id' | 'name'> & Partial<Pick<StandIn, 'author' | 'openedFor' | 'openedForBranch'>>;
  bands: readonly StandInBand[];
  config: GitFlowConfig;
}) => {
  const { standIn, config } = options;

  if (standIn.author !== 'app') return true;
  if (branchSubjectOf({ branch: standIn.openedForBranch, config })?.trim()) return true;
  if (standInNotes({ bands: options.bands, standInId: standIn.id, max: 1 }).length) return true;

  const where = standInNameFor({ context: { repoPath: standIn.openedFor, branch: standIn.openedForBranch }, config });

  return isQuotableNote(standIn.name) && standIn.name !== where;
};

/**
 * The name and description an app-drafted stand-in carries once a note that does not read as words is
 * taken out of them, or `null` when its name was not drafted from such a note.
 */
export const readableStandInDraft = (options: {
  standIn: Pick<StandIn, 'name' | 'description' | 'author' | 'openedFor' | 'openedForBranch'>;
  config: GitFlowConfig;
}): Pick<StandIn, 'name' | 'description'> | null => {
  const { standIn, config } = options;
  const lines = (standIn.description ?? '').split('\n');

  if (standIn.author !== 'app' || isQuotableNote(standIn.name) || !lines.includes(`- ${standIn.name}`)) return null;

  const kept = lines.filter((line) => !line.startsWith('- ') || isQuotableNote(line.slice(2)));
  const firstNote = kept.find((line) => line.startsWith('- '))?.slice(2);
  const description = (firstNote ? kept : kept.map((line) => (line === NOTES_HEADING ? NO_NOTES_LINE : line)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  const where = standInNameFor({ context: { repoPath: standIn.openedFor, branch: standIn.openedForBranch }, config });

  return { name: (firstNote ?? where).slice(0, MAX_TICKET_SUMMARY_LENGTH), description };
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
  const notes = notesForAll({
    groups: options.unattributed,
    contextIds: [context.id],
    max: options.maxNotes ?? DEFAULT_MAX_TICKET_NOTES,
  });
  const summary = summaryFor({ context, notes, config });
  const provenance = `Recorded from ${formatDurationMs(context.observedMs)} of work in ${whereFor(context)}.`;
  const body = notes.length ? [NOTES_HEADING, '', ...notes.map((note) => `- ${note}`), ''] : [NO_NOTES_LINE, ''];

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

  const body = notes.length ? [NOTES_HEADING, '', ...notes.map((note) => `- ${note}`), ''] : [NO_NOTES_LINE, ''];
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
