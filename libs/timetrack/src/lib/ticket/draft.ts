import { GitFlowConfig, parseBranch, slugifySubject } from '@ethlete/agent-rules/git-flow';
import { WorkGroup } from '../correlate/merge';
import { UnnamedContext } from '../correlate/rules';
import { contextKey } from '../model/block';
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
const humanized = (subject: string) => {
  const words = subject.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

  return words ? `${words[0]?.toUpperCase()}${words.slice(1)}` : '';
};

const repoNameOf = (path: string) => path.split('/').filter(Boolean).pop() ?? path;

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

const whereFor = (context: UnnamedContext) => {
  const { repoPath, branch, appId } = context.context;

  if (!repoPath) return appId ?? 'this machine';

  return branch ? `${repoNameOf(repoPath)} @ ${branch}` : repoNameOf(repoPath);
};

/**
 * Drafts the ticket that a stretch of work nothing could name would be filed as.
 *
 * It quotes only what may leave the machine (`QUOTABLE_EVIDENCE_KINDS`), so a description carries
 * commit subjects and agent-session titles and never a window title or a file path. The branch is the
 * strongest source there is for a summary: it is what the user called the work while doing it.
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
  const opening = `Reconstructed from ${formatDurationMs(context.observedMs)} of work in ${whereFor(context)}.`;

  return {
    summary,
    description: [opening, ...(notes.length ? ['', ...notes.map((note) => `- ${note}`)] : [])].join('\n'),
    subject: ticketSubjectOf(summary),
    notes,
  };
};
