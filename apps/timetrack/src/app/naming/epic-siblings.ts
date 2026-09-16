import { computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  ActivityBlock,
  AttributionRule,
  EpicOptions,
  EpicSibling,
  TimetrackSettings,
  WorklogProposal,
  branchSlugOf,
  fetchJiraIssueChildren$,
  fetchJiraIssues$,
  gitFlowConfigFor,
  issueKeyOf,
  readJiraCredentials$,
  streamKeyRepoPath,
} from '@ethlete/timetrack';
import { Observable, catchError, distinctUntilChanged, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { injectGitCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { readDay$ } from '../read-day';
import { injectTimetrackSettings } from '../settings/settings';

const NOTHING: EpicOptions = { siblings: [], claimed: [] };

/**
 * How far the read for the watched day got.
 *
 * A caller that acts on an unnamed checkout has to tell a day the rung answered nothing for from one
 * whose answer is still out. Both read as an empty bag, and only the second is worth waiting for.
 */
export type EpicSiblingsState = { state: 'idle' } | { state: 'loading' } | { state: 'ready'; options: EpicOptions };

/** One checkout's naming, before Jira has been asked what it hangs under. */
type EpicCandidate = { repoPath: string; branch: string; issueKey: string };

/** What the day asks Jira. Empty when the day left nothing unnamed, and then no call is made. */
type EpicQuestion = { candidates: EpicCandidate[]; claimed: string[] };

const NO_QUESTION: EpicQuestion = { candidates: [], claimed: [] };

/**
 * Two questions are the same question when the same checkouts book the same keys and the same keys
 * are spoken for. The day read emits on every collected event, and without this each one would spend
 * three Jira calls to learn what the last one already knew.
 */
const questionKey = (question: EpicQuestion) =>
  JSON.stringify([
    question.candidates.map((candidate) => [candidate.repoPath, candidate.branch, candidate.issueKey]).sort(),
    [...question.claimed].sort(),
  ]);

/** Every branch each checkout was seen on during the day, which is where a proposal's branch comes from. */
const branchesByRepo = (blocks: readonly ActivityBlock[]) => {
  const found = new Map<string, Set<string>>();

  for (const block of blocks) {
    const { repoPath, branch } = block.context;

    if (!repoPath || !branch) continue;

    const branches = found.get(repoPath) ?? new Set<string>();

    branches.add(branch);
    found.set(repoPath, branches);
  }

  return found;
};

const candidatesFromRules = (options: {
  rules: readonly AttributionRule[];
  slugs: ReadonlySet<string>;
  settings: TimetrackSettings;
}) => {
  const config = gitFlowConfigFor(options.settings);

  return options.rules.flatMap((rule): EpicCandidate[] => {
    const issueKey = issueKeyOf(rule);

    if (!rule.repoPath || !rule.branch || !issueKey) return [];

    const slug = branchSlugOf({ branch: rule.branch, config });

    return slug && options.slugs.has(slug) ? [{ repoPath: rule.repoPath, branch: rule.branch, issueKey }] : [];
  });
};

const candidatesFromDay = (options: {
  proposals: readonly WorklogProposal[];
  blocks: readonly ActivityBlock[];
  slugs: ReadonlySet<string>;
  settings: TimetrackSettings;
}) => {
  const config = gitFlowConfigFor(options.settings);
  const branches = branchesByRepo(options.blocks);

  return options.proposals.flatMap((proposal): EpicCandidate[] => {
    const repoPath = proposal.laneKey ? streamKeyRepoPath(proposal.laneKey) : undefined;

    if (!repoPath || !proposal.issueKey) return [];

    return [...(branches.get(repoPath) ?? [])].flatMap((branch) => {
      const slug = branchSlugOf({ branch, config });

      return slug && options.slugs.has(slug) ? [{ repoPath, branch, issueKey: proposal.issueKey }] : [];
    });
  });
};

/**
 * What the day's first pass leaves for the epic rung to answer, narrowed before anything is fetched.
 *
 * The slugs of the blocks nothing named come first, and a day with none of them asks nothing at all —
 * the rung can only ever speak about a checkout that is still unnamed, so a fully named day must not
 * cost a Jira call. See ADR 0029.
 */
const questionOf = (options: {
  blocks: readonly ActivityBlock[];
  unattributed: readonly { blocks: readonly ActivityBlock[] }[];
  proposals: readonly WorklogProposal[];
  settings: TimetrackSettings;
}): EpicQuestion => {
  const config = gitFlowConfigFor(options.settings);
  const slugs = new Set<string>();

  for (const group of options.unattributed) {
    for (const block of group.blocks) {
      const { repoPath, branch } = block.context;

      if (!repoPath || !branch) continue;

      const slug = branchSlugOf({ branch, config });

      if (slug) slugs.add(slug);
    }
  }

  if (!slugs.size) return NO_QUESTION;

  const rules = options.settings.attributionRules;
  const candidates = [
    ...candidatesFromRules({ rules, slugs, settings: options.settings }),
    ...candidatesFromDay({ proposals: options.proposals, blocks: options.blocks, slugs, settings: options.settings }),
  ];

  if (!candidates.length) return NO_QUESTION;

  const claimed = [
    ...new Set([
      ...options.proposals.map((proposal) => proposal.issueKey).filter(Boolean),
      ...rules.flatMap((rule) => issueKeyOf(rule) ?? []),
    ]),
  ];

  return { candidates, claimed };
};

/**
 * The three reads behind one question: what each named checkout hangs under, what type that parent is,
 * and which of its children are still open.
 *
 * The parents are read a second time rather than taken from the children search, because the rung puts
 * the parent's own issue type in the evidence and a child list never carries it.
 */
const resolve$ = (options: {
  question: EpicQuestion;
  settings: TimetrackSettings;
  ports: ReturnType<typeof injectHostPorts>;
}): Observable<EpicOptions> => {
  const { question, settings, ports } = options;

  if (!question.candidates.length) return of(NOTHING);

  return readJiraCredentials$({ secrets: ports.secrets, settings }).pipe(
    switchMap((credentials) => {
      if (!credentials) return of(NOTHING);

      const transport = ports.transport;
      const keys = [...new Set(question.candidates.map((candidate) => candidate.issueKey))];

      return fetchJiraIssues$({ transport, credentials, keys }).pipe(
        switchMap((issues) => {
          const parentOf = new Map(issues.flatMap((issue) => (issue.parentKey ? [[issue.key, issue.parentKey]] : [])));
          const parentKeys = [...new Set([...parentOf.values()])];

          if (!parentKeys.length) return of(NOTHING);

          return forkJoin({
            parents: fetchJiraIssues$({ transport, credentials, keys: parentKeys }),
            children: fetchJiraIssueChildren$({
              transport,
              credentials,
              parentKeys,
              limit: settings.epicChildLimit,
            }),
          }).pipe(
            map(({ parents, children }): EpicOptions => {
              const typeOf = new Map(parents.map((parent) => [parent.key, parent.issueType]));
              const childrenOf = new Map(children.map((entry) => [entry.parentKey, entry]));

              const siblings = question.candidates.flatMap((candidate): EpicSibling[] => {
                const parentKey = parentOf.get(candidate.issueKey.toUpperCase());
                const found = parentKey ? childrenOf.get(parentKey) : undefined;

                if (!parentKey || !found) return [];

                return [
                  {
                    repoPath: candidate.repoPath,
                    branch: candidate.branch,
                    issueKey: candidate.issueKey,
                    parentKey,
                    parentType: typeOf.get(parentKey) ?? '',
                    siblingKeys: found.childKeys,
                    truncated: found.truncated,
                  },
                ];
              });

              return { siblings, claimed: question.claimed };
            }),
          );
        }),
      );
    }),
    catchError(() => of(NOTHING)),
  );
};

/**
 * The epic rung's input: what a sibling checkout on the same branch name books, and which children of
 * its parent are already spoken for.
 *
 * It follows one day, the one a screen asks it to watch. The day is read here with an empty bag, which
 * is the rung's first pass — the answer it produces is what the reader's own second read names a block
 * from. The two passes are two reads, never a loop: this read can never see its own answer.
 *
 * Jira is an extra, not the day. No token, an unreadable instance or an offline machine leaves every
 * screen reading exactly as it did before this was here.
 */
const EPIC_SIBLINGS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const git = injectGitCollector();

  const watched = signal<string | undefined>(undefined);

  const probe = computed(() => ({
    day: watched(),
    settings: settings.settings(),
    repoRoots: git.discovery()?.repos ?? [],
  }));

  const read = toSignal(
    toObservable(probe).pipe(
      switchMap((current) =>
        current.day
          ? readDay$({
              ports,
              settings: current.settings,
              repoRoots: current.repoRoots,
              day: current.day,
            }).pipe(
              map((day) =>
                questionOf({
                  blocks: day.day.blocks,
                  unattributed: day.day.rows.unattributed,
                  proposals: day.day.rows.proposals,
                  settings: current.settings,
                }),
              ),
              distinctUntilChanged((a, b) => questionKey(a) === questionKey(b)),
              switchMap((question) => resolve$({ question, settings: current.settings, ports })),
              map((options): EpicSiblingsState => ({ state: 'ready', options })),
              catchError(() => of<EpicSiblingsState>({ state: 'ready', options: NOTHING })),
              startWith<EpicSiblingsState>({ state: 'loading' }),
            )
          : of<EpicSiblingsState>({ state: 'idle' }),
      ),
    ),
    { initialValue: { state: 'idle' } as EpicSiblingsState },
  );

  const options = computed(() => {
    const value = read();

    return value.state === 'ready' ? value.options : NOTHING;
  });

  return {
    /** The day the answer belongs to. A reader on another day must not use it. */
    day: watched,

    /** How far the read got, so a caller that opens a placeholder can wait rather than race it. */
    state: read,

    /**
     * Follows a day. A screen calls it with the day it shows; the read narrows to that day and stays on
     * it until the screen steps to another one.
     */
    watch: (day: string) => watched.set(day),

    /** The rung's input for `day`, or nothing when the answer on hand is for another day. */
    optionsFor: (day: string): EpicOptions => (watched() === day ? options() : NOTHING),

    /** Whether the answer on hand is the one `day` asked for, rather than a read still in flight. */
    settledFor: (day: string) => watched() === day && read().state === 'ready',
  };
});

export const injectEpicSiblings = /* @__PURE__ */ toInjectFn(EPIC_SIBLINGS_DEF);
