import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AGENT_API_VERSION,
  AgentApiInstance,
  AgentApiIssue,
  AgentApiDayRows,
  AgentApiEditedDay,
  AgentApiNaming,
  AgentApiRequest,
  AgentApiReviewedRow,
  AgentApiRules,
  AgentApiStandIn,
  AgentApiStandInSplit,
  AgentApiStatus,
  JiraCredentials,
  JiraIssue,
  createJiraIssue$,
  describeJiraHierarchy$,
  favoriteProjectKeys,
  fetchJiraFields$,
  fetchJiraIssuePicks$,
  fetchJiraIssues$,
  issueKeyOf,
  standInIdOf,
  jiraSubjectFieldCandidates,
  dayBoundaryOf,
  localDayKey,
  localDayRange,
  matchProjectLink,
  parseAgentRequest,
  readJiraCredentials$,
  readTempoCredentials$,
  ReviewedRow,
  suggestProjectForRepo,
  workPathDays,
  workPathPieces,
} from '@ethlete/timetrack';
import { Observable, catchError, forkJoin, map, mergeMap, of, switchMap, throwError } from 'rxjs';
import { AGENT_REQUEST_EVENT, hostEventWith$, injectHostPorts, invokeHost$ } from '../../host';
import { injectDayReview } from '../day-review/day-review';
import { injectRecurringPatterns } from '../naming/recurring-patterns';
import { injectTimetrackSettings } from '../settings/settings';

/** One request as the host hands it over. What is in `body` is the caller's, uninterpreted. */
type AgentRequestEvent = { id: number; body: unknown };

type AgentAnswer = { ok: true; value: unknown } | { ok: false; message: string };

const NO_JIRA = 'Timetrack has no Jira host, account email and token yet. Set them in its Settings.';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The wire shape of an issue. The app's own type carries more than a caller in another repo needs. */
const toApiIssue = (issue: JiraIssue): AgentApiIssue => ({
  key: issue.key,
  id: issue.id,
  summary: issue.summary,
  issueType: issue.issueType,
  parentKey: issue.parentKey,
  subject: issue.subject,
});

/**
 * Carries out what a coding agent's CLI asks of this machine, over the host's loopback endpoint.
 *
 * It is here rather than in the host because everything an operation needs is here: the Jira client,
 * the settings that say which projects and which subject field, and the day a row is written to. The
 * host holds the socket and interprets nothing, so there is one set of rules about what may be written
 * and one place a Jira token is read.
 *
 * Only the main window runs this. The host addresses that window by name, because a second window
 * would carry out the same operation a second time.
 */
const AGENT_ENDPOINT_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const review = injectDayReview();
  const recurring = injectRecurringPatterns();
  const destroyRef = inject(DestroyRef);

  /** Runs a read with the configured credentials, or fails with the one message that names the cause. */
  const withCredentials$ = <T>(read$: (credentials: JiraCredentials) => Observable<T>) =>
    readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) => (credentials ? read$(credentials) : throwError(() => new Error(NO_JIRA)))),
    );

  const status$ = (): Observable<AgentApiStatus> =>
    forkJoin({
      jira: readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }),
      tempo: readTempoCredentials$({ secrets: ports.secrets }),
    }).pipe(
      map(({ jira, tempo }) => ({
        version: AGENT_API_VERSION,
        jiraReady: !!jira,
        tempoReady: !!tempo,
        projects: settings.settings().favoriteProjects.map((project) => ({ key: project.key, name: project.name })),
        subjectField: settings.settings().ticket.subjectField,
      })),
    );

  /**
   * Reads the instance's own shape, so a setup step reports what Jira says rather than what the
   * convention assumes. Nothing here reads settings: the point is to fill them in.
   */
  const instance$ = (): Observable<AgentApiInstance> =>
    withCredentials$((credentials) =>
      forkJoin({
        hierarchy: describeJiraHierarchy$({ transport: ports.transport, credentials }),
        fields: fetchJiraFields$({ transport: ports.transport, credentials }),
      }),
    ).pipe(
      map(({ hierarchy, fields }) => ({
        levels: hierarchy.levels,
        suggestedParenting: hierarchy.suggestedParenting,
        subjectFieldCandidates: jiraSubjectFieldCandidates(fields).map((field) => ({
          id: field.id,
          name: field.name,
        })),
      })),
    );

  const issue$ = (key: string) =>
    withCredentials$((credentials) =>
      fetchJiraIssues$({
        transport: ports.transport,
        credentials,
        keys: [key],
        subjectField: settings.settings().ticket.subjectField || undefined,
      }),
    ).pipe(
      map((issues) => {
        const found = issues[0];

        // `fetchJiraIssues$` drops a key Jira does not know, because a day of proposals must survive one
        // bad key. A caller that asked for exactly this one has to be told instead.
        if (!found) throw new Error(`Jira has no issue ${key}, or the token cannot see it.`);

        return { issue: toApiIssue(found) };
      }),
    );

  const search$ = (request: Extract<AgentApiRequest, { op: 'jira.search' }>) =>
    withCredentials$((credentials) =>
      fetchJiraIssuePicks$({
        transport: ports.transport,
        credentials,
        subjectField: settings.settings().ticket.subjectField || undefined,
        filter: {
          projectKeys: request.projectKey ? [request.projectKey] : favoriteProjectKeys(settings.settings()),
          text: request.text,
          assignedToMe: request.assignedToMe,
          limit: request.limit,
        },
      }),
    ).pipe(map((issues) => ({ issues: issues.map(toApiIssue) })));

  const repoProject$ = (repoPath: string) => {
    const current = settings.settings();
    const link = matchProjectLink({ context: { repoPath }, links: current.projectLinks });
    const target = link?.target;

    return of({
      repoPath,
      projectKey: target?.kind === 'project' ? target.projectKey : undefined,
      private: target?.kind === 'private',
      inherited: !!link && link.path.trim().replace(/\/+$/, '') !== repoPath.trim().replace(/\/+$/, ''),
      suggestedProjectKey: link
        ? undefined
        : suggestProjectForRepo({ repoPath, projects: current.favoriteProjects })?.key,
    });
  };

  /**
   * Files an issue with the instance's own ticket settings, which is what keeps a ticket an agent
   * opened indistinguishable from one the review opened.
   */
  const create$ = (request: Extract<AgentApiRequest, { op: 'jira.create' }>) => {
    const current = settings.settings();
    const favorites = current.favoriteProjects;
    const projectKey = request.projectKey ?? (favorites.length === 1 ? favorites[0]?.key : undefined);

    if (!projectKey) {
      return throwError(
        () =>
          new Error(
            favorites.length === 0
              ? 'jira.create needs a projectKey, and Timetrack has no picked projects to fall back on.'
              : `jira.create needs a projectKey. Timetrack has ${favorites.map((project) => project.key).join(', ')}.`,
          ),
      );
    }

    return withCredentials$((credentials) =>
      createJiraIssue$({
        transport: ports.transport,
        credentials,
        input: {
          projectKey,
          issueTypeName: request.issueTypeName ?? current.ticket.issueTypeName,
          summary: request.summary,
          description: request.description,
          parentKey: request.parentKey,
          parenting: current.ticket.parenting,
          parentLinkType: current.ticket.parentLinkType,
          subjectField: current.ticket.subjectField,
          subject: request.subject,
        },
      }),
    ).pipe(map((created) => ({ issue: { key: created.key, id: created.id } })));
  };

  /**
   * Writes a row nothing watched onto the day it belongs to — the same row the timeline's drag-to-create
   * writes, and it goes through the same review before it reaches Tempo.
   *
   * It is deliberately not a Tempo call. The day is where a worklog is decided, and a row posted behind
   * the review would double-book against whatever the evidence already proposed for that hour.
   */
  const addWorklog$ = (request: Extract<AgentApiRequest, { op: 'worklog.add' }>) => {
    const from = new Date(request.fromMs);
    const to = new Date(request.fromMs + request.durationMs);
    const day = localDayKey(from, dayBoundaryOf(settings.settings()));

    return review
      .addRowOnDay$({
        day,
        row: {
          issueKey: request.issueKey,
          description: request.description,
          from,
          to,
        },
      })
      .pipe(
        map(() => ({
          worklog: {
            day,
            issueKey: request.issueKey,
            description: request.description,
            fromMs: from.getTime(),
            toMs: to.getTime(),
            durationMs: request.durationMs,
          },
        })),
      );
  };

  /**
   * The evidence one day holds, straight out of the store.
   *
   * The store is encrypted, so no shell reads a day. Without this an agent asked to explain what the
   * day screen drew has nothing to read but a screenshot of it.
   */
  /** The wire shape of a row. A caller in another repository names this `id` in every edit it sends. */
  const toApiRow = (row: ReviewedRow): AgentApiReviewedRow => ({
    id: row.id,
    issueKey: row.issueKey,
    standInId: row.standInId,
    description: row.description,
    fromMs: row.from.getTime(),
    toMs: row.to.getTime(),
    durationMs: row.durationMs,
    observedMs: row.observedMs,
    laneKey: row.laneKey,
    state: row.state,
    confidence: row.confidence,
    withheldIssueKey: row.withheldIssueKey,
    disputedIssueKey: row.disputedIssueKey,
    disputedStandInId: row.disputedStandInId,
    edited: row.edited,
    hidden: row.hidden,
  });

  /**
   * The day as its own review draws it, which is the only place a row's id exists.
   *
   * `day.events` answers what the collectors saw; this answers what the screen made of it. An agent
   * asked to check a day needs the second, because a band that is drawn wrong is drawn wrong after
   * every rule the app applied, not in the events underneath them.
   */
  const dayRows$ = (day: string): Observable<AgentApiDayRows> =>
    review.reviewOfDay$(day).pipe(
      map((current) => ({
        day,
        rows: current.rows.map(toApiRow),
        hidden: current.hidden.map(toApiRow),
        proposedMs: current.check.proposedMs,
        loggedMs: current.check.loggedMs,
        targetMs: current.check.targetMs ?? 0,
        unattributedMs: current.check.unattributedMs,
        warnings: current.check.warnings,
      })),
    );

  /**
   * Makes the edits a caller stated, then answers the day as it reads afterwards.
   *
   * The answer is the whole day rather than a verdict per edit. A reviewer's edit is cut against every
   * other row of the day, so what an edit did is only legible in the day it left behind.
   */
  const editDay$ = (request: Extract<AgentApiRequest, { op: 'day.edits' }>): Observable<AgentApiEditedDay> =>
    review
      .editRowsOnDay$({ day: request.day, edits: request.edits })
      .pipe(mergeMap((applied) => dayRows$(request.day).pipe(map((day) => ({ ...day, applied })))));

  const dayEvents$ = (request: Extract<AgentApiRequest, { op: 'day.events' }>) => {
    const { from, to } = localDayRange(request.day, dayBoundaryOf(settings.settings()));

    return ports.events
      .eventsBetween$(from, to)
      .pipe(map((events) => ({ day: request.day, fromMs: from.getTime(), toMs: to.getTime(), events })));
  };

  /**
   * Why the checkout-wide naming offer says what it says, for the checkouts one day saw.
   *
   * The card is either there or it is not, and every step that can stop it — the project link, the
   * Tempo token, the history and the three thresholds — is invisible from the day screen. Without
   * this, answering "why was this checkout never offered a name" means reading the user's worklogs,
   * and none of them need leave the app to answer it.
   */
  const naming$ = (request: Extract<AgentApiRequest, { op: 'naming.offers' }>): Observable<AgentApiNaming> =>
    forkJoin({
      tempo: readTempoCredentials$({ secrets: ports.secrets }),
      history: recurring.settled$,
      decisions: review.namingDecisionsOnDay$(request.day),
    }).pipe(
      map(({ tempo, history, decisions }) => ({
        day: request.day,
        tempoReady: !!tempo,
        history: history.state,
        historyWorklogs: recurring.worklogs().length,
        historyMessage: history.state === 'failed' ? history.message : undefined,
        offers: decisions.offers.map((offer) => ({
          repoPath: offer.repoPath,
          projectKey: offer.projectKey,
          issueKey: offer.issueKey,
          summary: offer.summary,
          days: offer.days,
          loggedMs: offer.loggedMs,
          share: offer.share,
        })),
        declines: decisions.declines.map((decline) => ({ ...decline })),
      })),
    );

  /**
   * The settings that decide what a day's work is named.
   *
   * The store is encrypted, so nothing else can read why a band went unnamed. Every field is listed by
   * hand: the caller may hand what it reads to a hosted model, and a spread of the settings document
   * would put the Jira host, the account email and a token on that wire the next time one is added.
   */
  const rules$ = (): Observable<AgentApiRules> => {
    const current = settings.settings();

    return of({
      dayTargetMs: current.dayTargetMs,
      gapFillMs: current.gapFillMs,
      dayStartHour: current.dayStartHour,
      attributionRules: current.attributionRules.map((rule) => ({
        id: rule.id,
        repoPath: rule.repoPath,
        branch: rule.branch,
        appId: rule.appId,
        issueKey: issueKeyOf(rule),
        standInId: standInIdOf(rule),
        donates: rule.target.kind === 'donate',
        createdAtMs: rule.createdAt.getTime(),
      })),
      projectLinks: current.projectLinks.map((link) => ({
        id: link.id,
        path: link.path,
        projectKey: link.target.kind === 'project' ? link.target.projectKey : undefined,
        private: link.target.kind === 'private',
        createdAtMs: link.createdAt.getTime(),
      })),
      backgroundProjects: [...current.backgroundProjects],
      noWorkContextApps: [...current.noWorkContextApps],
      holdsWorkApps: [...current.holdsWorkApps],
      callRules: {
        countsAsWork: [...current.callRules.countsAsWork],
        neverCountsAsWork: [...current.callRules.neverCountsAsWork],
      },
      meetingNamings: current.meetingNamings.map((naming) => ({
        seriesKey: naming.seriesKey,
        issueKey: naming.issueKey,
        title: naming.title,
        createdAtMs: naming.createdAt.getTime(),
      })),
      callNamings: current.callNamings.map((naming) => ({
        appId: naming.appId,
        weekday: naming.weekday,
        durationBand: naming.durationBand,
        after: naming.after,
        startMinute: naming.startMinute,
        issueKey: naming.target.kind === 'issue' ? naming.target.issueKey : undefined,
        standInId: naming.target.kind === 'stand-in' ? naming.target.standInId : undefined,
        label: naming.label,
        createdAtMs: naming.createdAt.getTime(),
      })),
    });
  };

  /**
   * The names the user gave work Jira does not hold yet.
   *
   * An agent may say that a stand-in has waited five days, and it may delete one; it may not open
   * one, because the name is the user's own word for their work. `resolvedRuleIds` is left out: it is
   * what the undo of a resolve reads, and no caller outside the app has any use for it.
   */
  const standIns$ = (): Observable<{ standIns: AgentApiStandIn[] }> =>
    of({
      standIns: settings.settings().standIns.map((standIn) => ({
        id: standIn.id,
        name: standIn.name,
        projectKey: standIn.projectKey,
        state: standIn.state,
        issueKey: standIn.issueKey,
        days: [...standIn.days],
        author: standIn.author,
        createdAtMs: standIn.createdAt.getTime(),
        openedFor: standIn.openedFor,
        openedForBranch: standIn.openedForBranch,
        openedForWorkPath: standIn.openedForWorkPath,
      })),
    });

  /**
   * Deletes one placeholder, and answers with the list as it reads afterwards.
   *
   * `removeStandIn` takes the rule pointing at it with it, so a delete cannot leave a rule naming a
   * record that is gone. A delete of an app-opened record that names a branch refuses that branch, so
   * the next pass opens no second one; a record naming none refuses nothing, and the pass may redo it
   * at whatever grain the day now reads.
   */
  const removeStandIn$ = (id: string): Observable<{ standIns: AgentApiStandIn[] }> => {
    if (!settings.settings().standIns.some((standIn) => standIn.id === id))
      return throwError(() => new Error(`Timetrack holds no stand-in ${id}.`));

    settings.removeStandIn(id);

    return standIns$();
  };

  /**
   * Cuts one placeholder into one per directory it turned out to cover.
   *
   * Without `apply` it answers the plan and writes nothing, so a caller can show the split before it
   * happens. `candidates` is every directory the commits name; `pieces` is what would be written —
   * the ones `paths` chose, or the automatic reading where the caller chose none. A checkout whose
   * commits name more directories than a grain can hold has no automatic reading, and the user picks.
   *
   * The commits come from the caller rather than the store: one collected before Timetrack recorded
   * file paths carries none, which is every commit a wrongly grained placeholder covers.
   */
  const splitStandIn$ = (
    request: Extract<AgentApiRequest, { op: 'standIn.split' }>,
  ): Observable<AgentApiStandInSplit> => {
    const { commits, projectRoots } = request;
    const candidates = workPathDays({ commits, projectRoots });
    const chosen = new Set(request.paths);
    const pieces = chosen.size
      ? candidates.filter((piece) => chosen.has(piece.workPath))
      : workPathPieces({ commits, projectRoots });
    const covered = new Set(pieces.flatMap((piece) => piece.days));
    const plan = (answer: { standIns: AgentApiStandIn[] }) => {
      const held = answer.standIns.find((entry) => entry.id === request.id)?.days ?? [];

      return { candidates, pieces, remainder: held.filter((day) => !covered.has(day)), ...answer };
    };

    if (!request.apply) return standIns$().pipe(map(plan));

    const result = settings.splitStandIn({
      id: request.id,
      branch: request.branch,
      repoPath: request.repoPath,
      pieces,
      claim: request.claim,
      now: new Date(),
    });

    if (result.refused) return throwError(() => new Error(result.refused));

    return standIns$().pipe(map(plan));
  };

  const carryOut$ = (request: AgentApiRequest): Observable<unknown> => {
    switch (request.op) {
      case 'status':
        return status$();
      case 'jira.instance':
        return instance$();
      case 'jira.issue':
        return issue$(request.key);
      case 'jira.search':
        return search$(request);
      case 'repo.project':
        return repoProject$(request.repoPath);
      case 'jira.create':
        return create$(request);
      case 'worklog.add':
        return addWorklog$(request);
      case 'day.events':
        return dayEvents$(request);
      case 'day.rows':
        return dayRows$(request.day);
      case 'day.edits':
        return editDay$(request);
      case 'settings.rules':
        return rules$();
      case 'standIn.list':
        return standIns$();
      case 'standIn.remove':
        return removeStandIn$(request.id);
      case 'standIn.split':
        return splitStandIn$(request);
      case 'naming.offers':
        return naming$(request);
    }
  };

  const answer$ = (body: unknown): Observable<AgentAnswer> => {
    const parsed = parseAgentRequest(body);

    if (!parsed.ok) return of({ ok: false, message: parsed.message });

    return carryOut$(parsed.request).pipe(
      map((value): AgentAnswer => ({ ok: true, value })),
      catchError((error: unknown) => of<AgentAnswer>({ ok: false, message: messageOf(error) })),
    );
  };

  // `mergeMap`: two repositories asking at once are two questions, and neither has to wait for the
  // other's Jira call. The host pairs every answer back to its own request by id.
  hostEventWith$<AgentRequestEvent>(AGENT_REQUEST_EVENT)
    .pipe(
      mergeMap((received) =>
        answer$(received.body).pipe(
          switchMap((answer) => invokeHost$<void>('agent_reply', { id: received.id, answer })),
          catchError(() => of(undefined)),
        ),
      ),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();
});

export const injectAgentEndpoint = /* @__PURE__ */ toInjectFn(AGENT_ENDPOINT_DEF);
