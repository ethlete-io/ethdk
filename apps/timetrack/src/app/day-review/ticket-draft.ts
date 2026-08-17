import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  JiraIssue,
  ParentCandidate,
  TicketWording,
  TicketWritingRequest,
  UnnamedContext,
  createJiraIssue$,
  draftTicket,
  favoriteProjectKeys,
  fetchJiraOpenIssues$,
  fetchJiraParentCandidates$,
  gitFlowConfigFor,
  inferTicketProjectKey,
  matchExistingIssues,
  rankParentCandidates,
  readJiraCredentials$,
  suggestParentKey,
  ticketSubjectOf,
  ticketWritingRequest,
  writeTicketWithAgent$,
} from '@ethlete/timetrack';
import {
  Observable,
  Subject,
  catchError,
  exhaustMap,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { injectDayReview } from './day-review';

const IDLE = { kind: 'idle' } as const;

/** What the create form holds. Every field starts drafted and every field is editable. */
export type TicketForm = {
  projectKey: string;
  summary: string;
  description: string;
  /** The issue the new one rolls up to, or nothing for a ticket with no parent. */
  parentKey: string | null;
};

/** The project's open issues: the ones a ticket may roll up to, and every one it could already be. */
type ProjectIssues = {
  parents: JiraIssue[];
  open: JiraIssue[];
};

type CandidateStatus =
  typeof IDLE | { kind: 'loading' } | ({ kind: 'ready' } & ProjectIssues) | { kind: 'failed'; message: string };

type CreateStatus =
  typeof IDLE | { kind: 'creating' } | { kind: 'created'; issueKey: string } | { kind: 'failed'; message: string };

type WriteStatus = typeof IDLE | { kind: 'writing' } | { kind: 'failed'; message: string };

/** An issue the agent says already tracks this work, so nothing new has to be filed for it. */
export type AgentMatch = {
  issueKey: string;
  summary: string;
  reason: string;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const NO_JIRA = 'Jira needs a host, an account email and a token in Settings.';

const AGENT_FAILED = 'The agent wrote nothing back. The draft below is still what the day observed.';

/**
 * Files a ticket for work the day found that no issue covers.
 *
 * The draft is built from the same evidence the review already shows, and every field of it is the
 * user's to change before anything is sent — this writes to Jira, where a wrong ticket is a thing
 * somebody has to explain rather than a row that can be edited away. On success the new key becomes a
 * standing rule for the context, exactly as naming it by hand would, so tomorrow does not ask again.
 */
const TICKET_DRAFT_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const destroyRef = inject(DestroyRef);
  const settings = injectTimetrackSettings();
  const dayReview = injectDayReview();

  const context = signal<UnnamedContext | null>(null);
  const form = signal<TicketForm | null>(null);
  const notes = signal<readonly string[]>([]);
  const searches$ = new Subject<string>();
  const writes$ = new Subject<TicketWritingRequest>();
  const creations$ = new Subject<TicketForm>();

  const update = (change: Partial<TicketForm>) => {
    const current = form();

    if (current) form.set({ ...current, ...change });
  };

  // Two reads rather than one filtered afterwards: the parent list is the most recent 30 of the
  // parent types, and narrowing a window of open issues to those types would offer fewer parents the
  // busier the project is.
  const candidates$ = (projectKey: string): Observable<CandidateStatus> => {
    const ticket = settings.settings().ticket;
    const subjectField = ticket.subjectField || undefined;

    return readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) =>
        credentials
          ? forkJoin({
              parents: fetchJiraParentCandidates$({
                transport: ports.transport,
                credentials,
                projectKey,
                issueTypeNames: ticket.parentIssueTypeNames,
                subjectField,
              }),
              open: fetchJiraOpenIssues$({ transport: ports.transport, credentials, projectKey, subjectField }),
            })
          : throwError(() => new Error(NO_JIRA)),
      ),
      map((issues): CandidateStatus => ({ kind: 'ready', ...issues })),
      catchError((error: unknown) => of<CandidateStatus>({ kind: 'failed', message: messageOf(error) })),
    );
  };

  // The parent is filled in as soon as the list arrives, so the field is answered rather than asked.
  // Only when nothing is chosen yet: a user who picked one while the read was in flight keeps it.
  const suggestParent = (status: CandidateStatus) => {
    const draft = form();

    if (status.kind !== 'ready' || !draft || draft.parentKey) return;

    const parentKey = suggestParentKey(rankParentCandidates({ summary: draft.summary, issues: status.parents }));

    if (parentKey) update({ parentKey });
  };

  const candidateStatus = toSignal(
    searches$.pipe(
      switchMap((projectKey) =>
        projectKey
          ? candidates$(projectKey).pipe(startWith<CandidateStatus>({ kind: 'loading' }))
          : of<CandidateStatus>(IDLE),
      ),
      tap((status) => suggestParent(status)),
    ),
    { initialValue: IDLE as CandidateStatus },
  );

  const createStatus = signal<CreateStatus>(IDLE);
  const writeStatus = signal<WriteStatus>(IDLE);
  const agentMatch = signal<AgentMatch | null>(null);

  const matchFor = (issueKey: string): AgentMatch => {
    const status = candidateStatus();
    const found = status.kind === 'ready' ? status.open.find((issue) => issue.key === issueKey) : undefined;

    return { issueKey, summary: found?.summary ?? '', reason: '' };
  };

  const applyWording = (wording: TicketWording) => {
    update({
      summary: wording.summary,
      description: wording.description,
      ...(wording.parentKey ? { parentKey: wording.parentKey } : {}),
    });
    agentMatch.set(
      wording.existingKey ? { ...matchFor(wording.existingKey), reason: wording.existingReason ?? '' } : null,
    );
  };

  // `exhaustMap`, not `switchMap`: spawning a second CLI while the first still runs costs the user
  // twice and answers into the same fields.
  writes$
    .pipe(
      exhaustMap((request) =>
        writeTicketWithAgent$({
          runner: ports.processes,
          request,
          options: { command: settings.settings().reasoning.command, model: settings.settings().reasoning.model },
        }).pipe(
          tap((wording) => {
            if (wording) applyWording(wording);
          }),
          map((wording): WriteStatus => (wording ? IDLE : { kind: 'failed', message: AGENT_FAILED })),
          startWith<WriteStatus>({ kind: 'writing' }),
        ),
      ),
      tap((status) => writeStatus.set(status)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  // `exhaustMap`, not `switchMap`: a second press while the first call is in flight must not start a
  // second issue. Jira has no idempotency key, so two calls are two tickets.
  creations$
    .pipe(
      exhaustMap((draft) => {
        const ticket = settings.settings().ticket;
        const named = context();

        return readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
          switchMap((credentials) =>
            credentials
              ? createJiraIssue$({
                  transport: ports.transport,
                  credentials,
                  input: {
                    projectKey: draft.projectKey,
                    issueTypeName: ticket.issueTypeName,
                    summary: draft.summary,
                    description: draft.description,
                    parentKey: draft.parentKey ?? undefined,
                    parenting: ticket.parenting,
                    parentLinkType: ticket.parentLinkType,
                    subjectField: ticket.subjectField || undefined,
                    subject: ticketSubjectOf(draft.summary),
                  },
                })
              : throwError(() => new Error(NO_JIRA)),
          ),
          map((created): CreateStatus => {
            if (named) dayReview.nameContext(named, { kind: 'issue', issueKey: created.key });

            return { kind: 'created', issueKey: created.key };
          }),
          catchError((error: unknown) => of<CreateStatus>({ kind: 'failed', message: messageOf(error) })),
          startWith<CreateStatus>({ kind: 'creating' }),
        );
      }),
      tap((status) => createStatus.set(status)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  const close = () => {
    context.set(null);
    form.set(null);
    notes.set([]);
    createStatus.set(IDLE);
    writeStatus.set(IDLE);
    agentMatch.set(null);
  };

  const writingRequestNow = (): TicketWritingRequest | null => {
    const unnamed = context();
    const status = candidateStatus();
    const issues = status.kind === 'ready' ? status : { parents: [], open: [] };

    return unnamed
      ? ticketWritingRequest({ context: unnamed, notes: notes(), parents: issues.parents, issues: issues.open })
      : null;
  };

  return {
    /** The context being filed, or nothing when the form is closed. */
    context: context.asReadonly(),
    form: form.asReadonly(),
    /** Re-ranked as the summary is typed, so editing the draft re-orders the parents under it. */
    candidates: computed((): ParentCandidate[] => {
      const status = candidateStatus();

      return status.kind === 'ready'
        ? rankParentCandidates({ summary: form()?.summary ?? '', issues: status.parents })
        : [];
    }),
    /**
     * Open issues whose wording says this work may already be tracked, best first. Ranked here as the
     * summary is typed, so it answers before any agent is asked — and it is a question, not a verdict.
     */
    existing: computed((): ParentCandidate[] => {
      const status = candidateStatus();

      return status.kind === 'ready'
        ? matchExistingIssues({ summary: form()?.summary ?? '', issues: status.open })
        : [];
    }),
    /** The one the agent says is the same work, which is a stronger claim than shared wording. */
    agentMatch: agentMatch.asReadonly(),
    isSearching: computed(() => candidateStatus().kind === 'loading'),
    searchFailure: computed(() => {
      const status = candidateStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    /** Exactly what a writing run would send, shown so it can be read before it leaves the machine. */
    writingRequest: computed(writingRequestNow),
    canWrite: computed(() => settings.settings().reasoning.enabled && !!context()),
    isWriting: computed(() => writeStatus().kind === 'writing'),
    writeFailure: computed(() => {
      const status = writeStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    isCreating: computed(() => createStatus().kind === 'creating'),
    createdKey: computed(() => {
      const status = createStatus();

      return status.kind === 'created' ? status.issueKey : null;
    }),
    createFailure: computed(() => {
      const status = createStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    canCreate: computed(() => {
      const draft = form();

      return !!draft?.projectKey && !!draft.summary && !!settings.settings().ticket.issueTypeName;
    }),

    open: (unnamed: UnnamedContext) => {
      const drafted = draftTicket({
        context: unnamed,
        unattributed: dayReview.deterministic()?.unattributed ?? [],
        config: gitFlowConfigFor(settings.settings()),
      });
      const projectKey =
        inferTicketProjectKey({
          context: unnamed.context,
          rules: settings.settings().attributionRules,
          proposals: dayReview.deterministic()?.proposals ?? [],
          projectKeys: favoriteProjectKeys(settings.settings()),
          links: settings.settings().projectLinks,
        }) ?? '';

      context.set(unnamed);
      form.set({ projectKey, summary: drafted.summary, description: drafted.description, parentKey: null });
      notes.set(drafted.notes);
      createStatus.set(IDLE);
      writeStatus.set(IDLE);
      agentMatch.set(null);
      searches$.next(projectKey);
    },

    close,

    /**
     * Takes an issue that already tracks this work instead of filing a second one for it. It writes
     * the same standing rule a creation would, so every later day with this context lands on that key.
     */
    useExisting: (issueKey: string) => {
      const named = context();

      if (!named) return;

      dayReview.nameContext(named, { kind: 'issue', issueKey });
      close();
    },

    /** Picking a project also re-reads the parents, so the list under it is never for another one. */
    setProjectKey: (projectKey: string) => {
      const key = projectKey.trim().toUpperCase();

      update({ projectKey: key, parentKey: null });
      searches$.next(key);
    },
    setSummary: (summary: string) => update({ summary }),
    setDescription: (description: string) => update({ description }),
    setParentKey: (parentKey: string | null) => update({ parentKey }),

    /** Re-reads the parents for whatever project the form now names. */
    findParents: () => searches$.next(form()?.projectKey ?? ''),

    /**
     * Hands the draft to the local agent CLI, which writes the summary and the description a reader
     * outside the work would want, picks the parent, and says whether an open issue already tracks
     * this. It only ever runs on this press, and it fills the form rather than filing anything — the
     * ticket is still the user's to change and still theirs to send.
     */
    writeWithAgent: () => {
      const request = writingRequestNow();

      if (request) writes$.next(request);
    },

    create: () => {
      const draft = form();

      if (draft) creations$.next(draft);
    },
  };
});

export const injectTicketDraft = /* @__PURE__ */ toInjectFn(TICKET_DRAFT_DEF);
