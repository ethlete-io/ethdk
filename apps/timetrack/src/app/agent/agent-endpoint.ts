import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AGENT_API_VERSION,
  AgentApiInstance,
  AgentApiIssue,
  AgentApiRequest,
  AgentApiStatus,
  JiraCredentials,
  JiraIssue,
  createJiraIssue$,
  describeJiraHierarchy$,
  favoriteProjectKeys,
  fetchJiraFields$,
  fetchJiraIssuePicks$,
  fetchJiraIssues$,
  jiraSubjectFieldCandidates,
  localDayKey,
  matchProjectLink,
  parseAgentRequest,
  readJiraCredentials$,
  suggestProjectForRepo,
} from '@ethlete/timetrack';
import { Observable, catchError, forkJoin, map, mergeMap, of, switchMap, throwError } from 'rxjs';
import { AGENT_REQUEST_EVENT, hostEventWith$, injectHostPorts, invokeHost$ } from '../../host';
import { injectDayReview } from '../day-review/day-review';
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
  const destroyRef = inject(DestroyRef);

  /** Runs a read with the configured credentials, or fails with the one message that names the cause. */
  const withCredentials$ = <T>(read$: (credentials: JiraCredentials) => Observable<T>) =>
    readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      switchMap((credentials) => (credentials ? read$(credentials) : throwError(() => new Error(NO_JIRA)))),
    );

  const status$ = (): Observable<AgentApiStatus> =>
    readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }).pipe(
      map((credentials) => ({
        version: AGENT_API_VERSION,
        jiraReady: !!credentials,
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
    const day = localDayKey(from);

    return review
      .addRowOnDay$({
        day,
        row: {
          issueKey: request.issueKey,
          description: request.description,
          from,
          to,
          durationMs: request.durationMs,
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
