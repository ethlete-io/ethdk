import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  Evidence,
  JiraCreatableType,
  JiraCredentials,
  JiraIssue,
  JiraIssueType,
  ParentCandidate,
  SpecHeader,
  StandIn,
  TicketWording,
  TicketWritingRequest,
  UnnamedContext,
  checkoutOf,
  contextKey,
  createJiraIssue$,
  creatableTypeNames,
  childTypeNameFor,
  describeJiraHierarchy$,
  draftParentDescription,
  mayCreateType,
  draftTicket,
  favoriteProjectKeys,
  fetchJiraCreatableTypes$,
  fetchJiraIssues$,
  fetchJiraOpenIssues$,
  fetchJiraParentCandidates$,
  fileTicketOnce$,
  gitFlowConfigFor,
  inferTicketProjectKey,
  matchExistingIssues,
  matchTicketWithAgent$,
  rankParentCandidates,
  reasoningOptionsOf,
  readJiraCredentials$,
  shasFromEvidence,
  specForCommits$,
  standInWritingRequest,
  suggestParentKey,
  ticketSubjectOf,
  ticketWritingRequest,
  TicketMatch,
  ParentWritingRequest,
  parentWritingRequest,
  writeParentWithAgent$,
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

/** What the new-parent form holds. Its type is one of the instance's own parent types. */
export type ParentForm = {
  summary: string;
  description: string;
  issueTypeName: string;
};

/** The project's open issues: the ones a ticket may roll up to, and every one it could already be. */
type ProjectIssues = {
  parents: JiraIssue[];
  open: JiraIssue[];
  /** What this account may create here. Empty until the read lands, which offers no type at all. */
  creatable: JiraCreatableType[];
  /** The types a parent may be: the ones settings name that something can be filed under. */
  parentTypes: string[];
  /** The instance's own levels, which decide what type the ticket under a picked parent must be. */
  issueTypes: JiraIssueType[];
};

type CandidateStatus =
  typeof IDLE | { kind: 'loading' } | ({ kind: 'ready' } & ProjectIssues) | { kind: 'failed'; message: string };

type CreateStatus =
  | typeof IDLE
  | { kind: 'creating' }
  | { kind: 'created'; issueKey: string }
  /** The project already held an issue with this summary, so nothing new was filed. */
  | { kind: 'duplicate'; issueKey: string }
  | { kind: 'failed'; message: string };

type WriteStatus = typeof IDLE | { kind: 'writing' } | { kind: 'matching' } | { kind: 'failed'; message: string };

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
  /**
   * The placeholder being turned into a ticket, when the form was opened from one rather than from a
   * context the day could not name. The two are exclusive: a stand-in already names the work, so the
   * created key resolves it instead of writing a second rule beside the one it already has.
   */
  const standIn = signal<StandIn | null>(null);
  const form = signal<TicketForm | null>(null);
  const notes = signal<readonly string[]>([]);
  /** The specification the work sits under, when its own commits named one. Null until the read lands. */
  const spec = signal<SpecHeader | null>(null);
  /** The epic the spec names, read on its own so the parent list can offer it under its own summary. */
  const specParent = signal<JiraIssue | null>(null);
  const searches$ = new Subject<string>();
  const specs$ = new Subject<{ repoPath: string; evidence: readonly Evidence[] }>();
  const writes$ = new Subject<TicketWritingRequest>();
  const matches$ = new Subject<TicketWritingRequest>();
  const parentWrites$ = new Subject<ParentWritingRequest>();
  const creations$ = new Subject<TicketForm>();
  const parentForm = signal<ParentForm | null>(null);
  const parentCreations$ = new Subject<ParentForm>();
  /** Parents filed from this form, which the project's own read does not hold yet. */
  const createdParents = signal<JiraIssue[]>([]);

  /**
   * Looks for the specification the work was written against, from the commits its own evidence
   * names. It answers null wherever the guess does not land, which is the ticket every ticket was
   * before this.
   */
  const askSpec = (options: { repoPath: string | undefined; evidence: readonly Evidence[] }) => {
    spec.set(null);
    specParent.set(null);

    if (options.repoPath) specs$.next({ repoPath: options.repoPath, evidence: options.evidence });
  };

  const update = (change: Partial<TicketForm>) => {
    const current = form();

    if (current) form.set({ ...current, ...change });
  };

  /**
   * The types an issue may be offered as a parent under: the ones settings name, minus any the
   * account can file nothing beneath. Jira's parent field points one level down, so a parent with no
   * creatable type below it is a choice that fails after the user wrote a summary.
   *
   * Nothing is dropped where `parenting` is `issue-link`. That link expresses a same-level relation,
   * which is the whole purpose of the setting.
   */
  const parentTypesFor = (options: { types: readonly JiraIssueType[]; creatable: readonly JiraCreatableType[] }) => {
    const ticket = settings.settings().ticket;

    if (ticket.parenting === 'issue-link') return [...ticket.parentIssueTypeNames];

    return ticket.parentIssueTypeNames.filter(
      (parentTypeName) =>
        childTypeNameFor({
          parentTypeName,
          preferredTypeNames: [ticket.issueTypeName],
          types: options.types,
          creatable: options.creatable,
        }) !== null,
    );
  };

  /** The levels a parent may be filed at: what settings name, narrowed to what Jira permits here. */
  const parentTypeNames = () => {
    const status = candidateStatus();

    if (status.kind !== 'ready') return [];

    return creatableTypeNames({ typeNames: settings.settings().ticket.parentIssueTypeNames, types: status.creatable });
  };

  // The hierarchy has to land before the parent read: it decides which types that read asks for.
  // Two reads rather than one filtered afterwards: the parent list is the most recent 30 of the
  // parent types, and narrowing a window of open issues to those types would offer fewer parents the
  // busier the project is.
  const candidates$ = (projectKey: string): Observable<CandidateStatus> => {
    const ticket = settings.settings().ticket;
    const subjectField = ticket.subjectField || undefined;

    return readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) =>
        credentials
          ? describeJiraHierarchy$({ transport: ports.transport, credentials }).pipe(
              switchMap((hierarchy) => {
                return fetchJiraCreatableTypes$({ transport: ports.transport, credentials, projectKey }).pipe(
                  switchMap((creatable) => {
                    const parentTypes = parentTypesFor({ types: hierarchy.issueTypes, creatable });

                    return forkJoin({
                      // An empty `issueTypeNames` reads as "any type", so a project with no usable
                      // parent level must skip the read rather than make it.
                      parents: parentTypes.length
                        ? fetchJiraParentCandidates$({
                            transport: ports.transport,
                            credentials,
                            projectKey,
                            issueTypeNames: parentTypes,
                            subjectField,
                          })
                        : of<JiraIssue[]>([]),
                      open: fetchJiraOpenIssues$({ transport: ports.transport, credentials, projectKey, subjectField }),
                    }).pipe(map((issues) => ({ ...issues, creatable, parentTypes, issueTypes: hierarchy.issueTypes })));
                  }),
                );
              }),
            )
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

  const pickedParent = computed(() => {
    const status = candidateStatus();
    const parentKey = form()?.parentKey;

    if (!parentKey) return null;

    const named = specParent();
    const read = status.kind === 'ready' ? status.parents : [];

    return [...createdParents(), ...(named ? [named] : []), ...read].find((issue) => issue.key === parentKey) ?? null;
  });

  /**
   * The type the ticket is filed as. Jira's parent field points one level down, so the parent the
   * user picked decides it: a Story takes a sub-task, an Epic takes the type settings name. Settings
   * answer it whenever no parent is picked or the reads have not landed.
   */
  const issueTypeName = computed(() => {
    const configured = settings.settings().ticket.issueTypeName;
    const status = candidateStatus();
    const parent = pickedParent();

    if (status.kind !== 'ready' || !parent) return configured;

    return (
      childTypeNameFor({
        parentTypeName: parent.issueType,
        preferredTypeNames: [configured],
        types: status.issueTypes,
        creatable: status.creatable,
      }) ?? configured
    );
  });

  const createStatus = signal<CreateStatus>(IDLE);
  const writeStatus = signal<WriteStatus>(IDLE);
  const matchStatus = signal<WriteStatus>(IDLE);
  const parentWriteStatus = signal<WriteStatus>(IDLE);
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

  /**
   * Fills only what already exists. The summary and the description must stay untouched: the user
   * wrote those words on the stand-in, and keeping them is the whole point of this press.
   */
  const applyMatch = (match: TicketMatch) => {
    if (match.parentKey) update({ parentKey: match.parentKey });

    agentMatch.set(match.existingKey ? { ...matchFor(match.existingKey), reason: match.existingReason ?? '' } : null);
  };

  // `exhaustMap`, not `switchMap`: spawning a second CLI while the first still runs costs the user
  // twice and answers into the same fields.
  writes$
    .pipe(
      exhaustMap((request) =>
        writeTicketWithAgent$({
          runner: ports.processes,
          request,
          options: reasoningOptionsOf(settings.settings()),
          maskedNames: settings.settings().reasoning.maskedNames,
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

  matches$
    .pipe(
      exhaustMap((request) =>
        matchTicketWithAgent$({
          runner: ports.processes,
          request,
          options: reasoningOptionsOf(settings.settings()),
          maskedNames: settings.settings().reasoning.maskedNames,
        }).pipe(
          tap((match) => {
            if (match) applyMatch(match);
          }),
          map((match): WriteStatus => (match ? IDLE : { kind: 'failed', message: AGENT_FAILED })),
          startWith<WriteStatus>({ kind: 'matching' }),
        ),
      ),
      tap((status) => matchStatus.set(status)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  parentWrites$
    .pipe(
      exhaustMap((request) =>
        writeParentWithAgent$({
          runner: ports.processes,
          request,
          options: reasoningOptionsOf(settings.settings()),
          maskedNames: settings.settings().reasoning.maskedNames,
        }).pipe(
          tap((wording) => {
            if (wording) {
              parentForm.update((draft) =>
                draft ? { ...draft, summary: wording.summary, description: wording.description } : draft,
              );
            }
          }),
          map((wording): WriteStatus => (wording ? IDLE : { kind: 'failed', message: AGENT_FAILED })),
          startWith<WriteStatus>({ kind: 'writing' }),
        ),
      ),
      tap((status) => parentWriteStatus.set(status)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  const epic$ = (issueKey: string): Observable<JiraIssue | null> =>
    readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) =>
        credentials
          ? fetchJiraIssues$({
              transport: ports.transport,
              credentials,
              keys: [issueKey],
              subjectField: settings.settings().ticket.subjectField || undefined,
            })
          : of<JiraIssue[]>([]),
      ),
      map((issues) => issues[0] ?? null),
      catchError(() => of(null)),
    );

  specs$
    .pipe(
      switchMap((ask) =>
        specForCommits$({
          repoPath: ask.repoPath,
          shas: shasFromEvidence(ask.evidence),
          processes: ports.processes,
          specs: ports.specs,
        }).pipe(
          switchMap((found) =>
            found?.epicKey ? epic$(found.epicKey).pipe(map((issue) => ({ found, issue }))) : of({ found, issue: null }),
          ),
        ),
      ),
      tap(({ found, issue }) => {
        spec.set(found);
        specParent.set(issue);

        // Only while nothing answers the field yet, exactly as the ranking fills it: a key the spec
        // names is a statement about the work, and a key the user picked is a decision about it.
        if (found?.epicKey && !form()?.parentKey) update({ parentKey: found.epicKey });
      }),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  /**
   * Why nothing can be filed in this project, or `null` while it can.
   *
   * It reads off `createmeta` and so states what Jira permits this account, never what the team
   * agreed. It stays silent while the read is in flight: a reason shown and then withdrawn reads as a
   * problem the user has to do something about.
   */
  const createGate = computed(() => {
    const status = candidateStatus();
    const typeName = issueTypeName();

    if (status.kind !== 'ready' || !typeName) return null;
    if (!status.creatable.length) return `Jira lets this account create nothing in ${form()?.projectKey ?? 'it'}.`;
    if (!mayCreateType({ typeName, types: status.creatable })) {
      return `Jira does not let this account create a ${typeName} in ${form()?.projectKey ?? 'it'}.`;
    }

    return null;
  });

  const parentStatus = signal<CreateStatus>(IDLE);

  // The same `exhaustMap` guard, for the same reason: Jira has no idempotency key, so a second press
  // while the first call is in flight would file a second epic.
  parentCreations$
    .pipe(
      exhaustMap((draft) => {
        const ticket = settings.settings().ticket;
        const projectKey = form()?.projectKey ?? '';

        return readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
          switchMap((credentials) =>
            credentials
              ? createJiraIssue$({
                  transport: ports.transport,
                  credentials,
                  input: {
                    projectKey,
                    issueTypeName: draft.issueTypeName,
                    summary: draft.summary,
                    description: draft.description,
                    parenting: ticket.parenting,
                    parentLinkType: ticket.parentLinkType,
                    subjectField: ticket.subjectField || undefined,
                    subject: ticketSubjectOf(draft.summary),
                  },
                })
              : throwError(() => new Error(NO_JIRA)),
          ),
          map((created): CreateStatus => {
            // Offered by the select straight away: the project's own read does not hold it yet, and
            // re-reading the project to find the issue this very form just filed is a round trip for
            // something already known.
            createdParents.update((held) => [
              { key: created.key, id: created.id, summary: draft.summary, issueType: draft.issueTypeName },
              ...held,
            ]);
            update({ parentKey: created.key });
            parentForm.set(null);

            return { kind: 'created', issueKey: created.key };
          }),
          catchError((error: unknown) => of<CreateStatus>({ kind: 'failed', message: messageOf(error) })),
          startWith<CreateStatus>({ kind: 'creating' }),
        );
      }),
      tap((status) => parentStatus.set(status)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  const fileTicket$ = (options: { credentials: JiraCredentials; draft: TicketForm }) => {
    const ticket = settings.settings().ticket;
    const { credentials, draft } = options;

    return fileTicketOnce$({
      transport: ports.transport,
      credentials,
      input: {
        projectKey: draft.projectKey,
        issueTypeName: issueTypeName(),
        summary: draft.summary,
        description: draft.description,
        parentKey: draft.parentKey ?? undefined,
        parenting: ticket.parenting,
        parentLinkType: ticket.parentLinkType,
        subjectField: ticket.subjectField || undefined,
        subject: ticketSubjectOf(draft.summary),
      },
    });
  };

  // `exhaustMap`, not `switchMap`: a second press while the first call is in flight must not start a
  // second issue. Jira has no idempotency key, so two calls are two tickets.
  creations$
    .pipe(
      exhaustMap((draft) => {
        const named = context();
        const waiting = standIn();

        return readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
          switchMap((credentials) =>
            credentials ? fileTicket$({ credentials, draft }) : throwError(() => new Error(NO_JIRA)),
          ),
          map((created): CreateStatus => {
            if (named) dayReview.nameContext(named, { kind: 'issue', issueKey: created.issueKey });
            else if (waiting) settings.resolveStandIn({ id: waiting.id, issueKey: created.issueKey });

            return created.duplicate
              ? { kind: 'duplicate', issueKey: created.issueKey }
              : { kind: 'created', issueKey: created.issueKey };
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
    standIn.set(null);
    form.set(null);
    notes.set([]);
    spec.set(null);
    specParent.set(null);
    createStatus.set(IDLE);
    writeStatus.set(IDLE);
    matchStatus.set(IDLE);
    agentMatch.set(null);
    parentForm.set(null);
    createdParents.set([]);
  };

  const parentWritingRequestNow = (): ParentWritingRequest | null => {
    const draft = parentForm();
    const request = writingRequestNow();

    if (!draft || !request) return null;

    return parentWritingRequest({
      level: draft.issueTypeName,
      child: { summary: form()?.summary ?? '', description: form()?.description ?? '' },
      request,
      maskedNames: settings.settings().reasoning.maskedNames,
    });
  };

  const writingRequestNow = (): TicketWritingRequest | null => {
    const unnamed = context();
    const waiting = standIn();
    const status = candidateStatus();
    const issues = status.kind === 'ready' ? status : { parents: [], open: [] };
    const offered = { parents: issues.parents, issues: issues.open };
    const maskedNames = settings.settings().reasoning.maskedNames;

    const found = spec();
    const framed = found ? { spec: found } : {};

    if (unnamed) return ticketWritingRequest({ context: unnamed, notes: notes(), ...offered, ...framed, maskedNames });

    return waiting ? standInWritingRequest({ standIn: waiting, ...offered, ...framed, maskedNames }) : null;
  };

  return {
    /** The context being filed, or nothing when the form is closed. */
    context: context.asReadonly(),
    /** The placeholder being filed, or nothing when the form was opened from a context instead. */
    standIn: standIn.asReadonly(),
    /** The specification the work sits under, for the form to say what framed the ticket. */
    spec: spec.asReadonly(),
    form: form.asReadonly(),
    /** Re-ranked as the summary is typed, so editing the draft re-orders the parents under it. */
    candidates: computed((): ParentCandidate[] => {
      const status = candidateStatus();
      const read = status.kind === 'ready' ? status.parents : [];
      const named = specParent();
      const fromSpec = named && !read.some((issue) => issue.key === named.key) ? [named] : [];

      return rankParentCandidates({
        summary: form()?.summary ?? '',
        issues: [...createdParents(), ...fromSpec, ...read],
      });
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
    /** Only a stand-in offers the press: a context has no wording of the user's own to protect. */
    canMatch: computed(() => settings.settings().reasoning.enabled && !!standIn()),
    isMatching: computed(() => matchStatus().kind === 'matching'),
    matchFailure: computed(() => {
      const status = matchStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    isSearching: computed(() => candidateStatus().kind === 'loading'),
    searchFailure: computed(() => {
      const status = candidateStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    /** Exactly what a writing run would send, shown so it can be read before it leaves the machine. */
    writingRequest: computed(writingRequestNow),
    canWrite: computed(() => settings.settings().reasoning.enabled && (!!context() || !!standIn())),
    isWriting: computed(() => writeStatus().kind === 'writing'),
    writeFailure: computed(() => {
      const status = writeStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    /** Exactly what a parent-writing run would send, shown so it can be read before it leaves. */
    parentWritingRequest: computed(parentWritingRequestNow),
    isWritingParent: computed(() => parentWriteStatus().kind === 'writing'),
    parentWriteFailure: computed(() => {
      const status = parentWriteStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    isCreating: computed(() => createStatus().kind === 'creating'),
    createdKey: computed(() => {
      const status = createStatus();

      return status.kind === 'created' ? status.issueKey : null;
    }),

    /**
     * The key the press landed on rather than filing a new one. The rule is written either way, so
     * the day is named — what differs is that Jira already held the issue.
     */
    duplicateKey: computed(() => {
      const status = createStatus();

      return status.kind === 'duplicate' ? status.issueKey : null;
    }),
    createFailure: computed(() => {
      const status = createStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    canCreate: computed(() => {
      const draft = form();

      return !!draft?.projectKey && !!draft.summary && !!issueTypeName() && !createGate();
    }),

    /**
     * Why this project holds no create, or nothing when it does.
     *
     * A disabled button with no reason beside it is the worst of the three states, and the reason is
     * one Jira alone knows: the account's own permissions in this project.
     */
    createGate,

    /** The open new-parent form, or nothing while it is closed. */
    parentForm: parentForm.asReadonly(),
    /** The parent this form filed, newest first, so the result can name what it created as well as why. */
    createdParent: computed(() => createdParents()[0] ?? null),
    /** The levels a parent may be filed at: what settings name, narrowed to what Jira permits here. */
    parentTypeNames: computed(() => parentTypeNames()),
    /** The type the create will file, which the picked parent decides. */
    issueTypeName,
    /** What the picked parent changed the ticket's own type to, or nothing when it changed nothing. */
    parentRule: computed(() => {
      const parent = pickedParent();
      const typeName = issueTypeName();

      return parent && typeName !== settings.settings().ticket.issueTypeName
        ? `Filed as a ${typeName}, the level below ${parent.key} (${parent.issueType}).`
        : null;
    }),
    isCreatingParent: computed(() => parentStatus().kind === 'creating'),
    createParentFailure: computed(() => {
      const status = parentStatus();

      return status.kind === 'failed' ? status.message : null;
    }),
    canCreateParent: computed(() => {
      const draft = parentForm();

      return !!form()?.projectKey && !!draft?.summary.trim() && !!draft.issueTypeName;
    }),

    /**
     * Opens the form on a placeholder, so the ticket it files is the one the work has been waiting for.
     *
     * The summary and the description start as the placeholder's own, which the app drafted from the
     * day's evidence when it opened — the user has been looking at them since, and re-drafting them
     * here would throw away every correction they made.
     */
    openForStandIn: (waiting: StandIn) => {
      const projectKey = waiting.projectKey ?? '';

      context.set(null);
      standIn.set(waiting);
      form.set({ projectKey, summary: waiting.name, description: waiting.description ?? '', parentKey: null });
      notes.set([]);
      createStatus.set(IDLE);
      writeStatus.set(IDLE);
      matchStatus.set(IDLE);
      agentMatch.set(null);
      parentForm.set(null);
      createdParents.set([]);
      searches$.next(projectKey);
      askSpec({
        repoPath: checkoutOf({ settings: settings.settings(), standIn: waiting }),
        evidence: dayReview.rows().flatMap((row) => (row.standInId === waiting.id ? row.evidence : [])),
      });
    },

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
      standIn.set(null);
      form.set({ projectKey, summary: drafted.summary, description: drafted.description, parentKey: null });
      notes.set(drafted.notes);
      createStatus.set(IDLE);
      writeStatus.set(IDLE);
      matchStatus.set(IDLE);
      agentMatch.set(null);
      searches$.next(projectKey);
      askSpec({
        repoPath: unnamed.context.repoPath,
        evidence: (dayReview.deterministic()?.unattributed ?? [])
          .flatMap((group) => group.blocks)
          .flatMap((block) => (contextKey(block.context) === unnamed.id ? block.evidence : [])),
      });
    },

    close,

    /**
     * Takes an issue that already tracks this work instead of filing a second one for it. It writes
     * the same standing rule a creation would, so every later day with this context lands on that key.
     */
    useExisting: (issueKey: string) => {
      const named = context();
      const waiting = standIn();

      if (named) dayReview.nameContext(named, { kind: 'issue', issueKey });
      else if (waiting) settings.resolveStandIn({ id: waiting.id, issueKey });
      else return;

      close();
    },

    /** Picking a project also re-reads the parents, so the list under it is never for another one. */
    setProjectKey: (projectKey: string) => {
      const key = projectKey.trim().toUpperCase();

      update({ projectKey: key, parentKey: null });
      parentForm.set(null);
      createdParents.set([]);
      specParent.set(null);
      searches$.next(key);
    },
    setSummary: (summary: string) => update({ summary }),
    setDescription: (description: string) => update({ description }),
    setParentKey: (parentKey: string | null) => update({ parentKey }),

    /**
     * Opens the form that files the parent itself, for work whose epic does not exist yet. It starts
     * from the ticket's own summary and the first of the instance's parent levels, because a parent
     * filed here is nearly always the wider name for the very work below it.
     */
    openParentForm: () => {
      const named = context();

      parentStatus.set(IDLE);
      parentWriteStatus.set(IDLE);
      parentForm.set({
        summary: form()?.summary ?? '',
        description: named ? draftParentDescription(named) : (standIn()?.description ?? ''),
        issueTypeName: parentTypeNames()[0] ?? '',
      });
    },
    closeParentForm: () => parentForm.set(null),
    setParentSummary: (summary: string) => parentForm.update((draft) => (draft ? { ...draft, summary } : draft)),
    setParentDescription: (description: string) =>
      parentForm.update((draft) => (draft ? { ...draft, description } : draft)),
    setParentIssueTypeName: (issueTypeName: string) =>
      parentForm.update((draft) => (draft ? { ...draft, issueTypeName } : draft)),
    createParent: () => {
      const draft = parentForm();

      if (draft) parentCreations$.next(draft);
    },

    /**
     * Hands the open parent form to the local agent CLI, which writes the wider goal the ticket
     * below it serves. It fills the form and files nothing.
     */
    writeParentWithAgent: () => {
      const request = parentWritingRequestNow();

      if (request) parentWrites$.next(request);
    },

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

    /**
     * Hands the same payload to the local agent CLI and asks it one thing: what already tracks this
     * work. It fills the parent and names the issue that may already be it, and it never touches the
     * summary or the description the user wrote. Nothing is resolved until the user presses.
     */
    matchWithAgent: () => {
      const request = writingRequestNow();

      if (request) matches$.next(request);
    },

    create: () => {
      const draft = form();

      if (draft) creations$.next(draft);
    },
  };
});

export const injectTicketDraft = /* @__PURE__ */ toInjectFn(TICKET_DRAFT_DEF);
