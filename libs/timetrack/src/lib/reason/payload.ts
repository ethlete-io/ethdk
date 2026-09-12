import { WorkGroup } from '../rows/merge';
import { UnnamedContext } from '../model/attribution';
import { contextKey } from '../model/block';
import { QUOTABLE_EVIDENCE_KINDS } from '../model/evidence';
import { WorklogProposal } from '../model/proposal';
import { LoggedIssue } from '../model/recurrence';
import {
  DEFAULT_MAX_NOTES_PER_CONTEXT,
  DEFAULT_MIN_REASONING_MS,
  ReasoningCandidate,
  ReasoningContext,
  ReasoningPlan,
} from './model';

/** The repository's name. The absolute path the collectors report never leaves the machine. */
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

/** FNV-1a. Identifies a payload; nothing here needs it to resist anything. */
const hashOf = (text: string) => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
};

/** How many issues the provider chooses from. Past this the prompt costs more than the answer gains. */
export const DEFAULT_REASONING_CANDIDATE_LIMIT = 20;

/**
 * The issues the provider may choose from: the ones the day itself already reached, then the ones the
 * user's recent Tempo history names.
 *
 * The day's own issues come first and are never cut, because the work that has a name on this day is
 * the likeliest name for the work beside it. The history fills what is left of the cap, most recently
 * logged first — it is what lets a day whose every context is unnamed still be answered at all.
 */
export const reasoningCandidates = (options: {
  proposals: readonly WorklogProposal[];
  /** From `fetchTempoHistory$`. Absent on a machine with no Tempo token, which changes nothing else. */
  logged?: readonly LoggedIssue[];
  limit?: number;
}): ReasoningCandidate[] => {
  const found = new Map<string, ReasoningCandidate>();

  for (const proposal of options.proposals) {
    if (!found.has(proposal.issueKey)) found.set(proposal.issueKey, { issueKey: proposal.issueKey, summary: '' });

    const candidate = found.get(proposal.issueKey);

    if (candidate && !candidate.summary) candidate.summary = proposal.description;
  }

  const limit = options.limit ?? DEFAULT_REASONING_CANDIDATE_LIMIT;

  for (const issue of options.logged ?? []) {
    if (found.size >= limit) break;
    if (!found.has(issue.issueKey)) found.set(issue.issueKey, { ...issue });
  }

  return [...found.values()];
};

/**
 * Builds the redacted payload for one day, and the map that reads its answer back.
 *
 * Contexts are addressed by token rather than by `contextKey`, because a `contextKey` for a
 * repository *is* its absolute path — sending one would put `/Users/<name>/dev/…` in a prompt.
 */
export const reasoningPlan = (options: {
  contexts: readonly UnnamedContext[];
  unattributed: readonly WorkGroup[];
  candidates?: readonly ReasoningCandidate[];
  minObservedMs?: number;
  maxNotesPerContext?: number;
}): ReasoningPlan => {
  const minObservedMs = options.minObservedMs ?? DEFAULT_MIN_REASONING_MS;
  const max = options.maxNotesPerContext ?? DEFAULT_MAX_NOTES_PER_CONTEXT;
  const contextIds: Record<string, string> = {};
  const contexts: ReasoningContext[] = [];

  for (const unnamed of options.contexts) {
    if (unnamed.observedMs < minObservedMs) continue;

    const token = `c${contexts.length + 1}`;

    contextIds[token] = unnamed.id;
    contexts.push({
      id: token,
      repo: unnamed.context.repoPath ? repoNameOf(unnamed.context.repoPath) : undefined,
      branch: unnamed.context.branch,
      app: unnamed.context.appId,
      minutes: Math.round(unnamed.observedMs / 60_000),
      notes: notesFor({ groups: options.unattributed, contextId: unnamed.id, max }),
    });
  }

  const request = { candidates: [...(options.candidates ?? [])], contexts };

  return { request, contextIds, hash: hashOf(JSON.stringify(request)) };
};
