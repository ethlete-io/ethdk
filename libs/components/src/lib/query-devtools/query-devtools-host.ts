import { inject, InjectionToken, Signal, WritableSignal } from '@angular/core';
import {
  AnyBearerAuthProvider,
  AnyPagedQueryStack,
  AnyQuerySnapshot,
  AnyQueryStack,
  QueryClient,
  QueryDevtoolsEntry,
  QueryDevtoolsFault,
  QueryDevtoolsFeature,
  QueryDevtoolsFormHandle,
  QueryDevtoolsRun,
  QueryDevtoolsRunError,
  QueryRefreshCause,
  QueryRepository,
  QueryRepositoryCacheEntry,
  QuerySequence,
  QuerySequenceStatus,
  WebSocketDevtoolsHandle,
  WebSocketDevtoolsMessage,
} from '@ethlete/query';
import { QueryDevtoolsDiff } from './query-devtools-diff';
import {
  AnyQuery,
  CacheView,
  DetailTab,
  DevtoolsTab,
  EventLogItem,
  PaneAxis,
  PaneTarget,
  QueryActivity,
  QueryDevtoolsLeadership,
  QueryDevtoolsSelection,
  QueryLink,
  QueryListFacet,
  RepositoryInfo,
  RequestProgress,
  RouteSegment,
  TabBadge,
} from './query-devtools-types';

/**
 * Everything a tab or the shared detail drawer reads from - or writes back into - the always-mounted
 * `<et-query-devtools>` panel: cross-tab registries, the JIT editor, copy/export actions, the value
 * explorer and pane sizing. A tab component only ever exists while it is the active one, so anything a
 * tab needs to survive being switched away from (a drawer's own selection, the persisted panel chrome)
 * has to live here instead of on the tab itself. Every member below is named and shaped exactly like the
 * panel's own field/method it stands in for.
 *
 * @see injectQueryDevtoolsHost
 */
export type QueryDevtoolsHost = {
  selectTab(tab: DevtoolsTab): void;

  /** Jumps to the Queries tab with this query selected - the Events tab is a way in, not a dead end. */
  selectQuery(id: string): void;

  /** Jumps to the Forms tab with this form selected. */
  selectForm(id: string): void;

  queryEntries: Signal<QueryDevtoolsEntry[]>;
  stackEntries: Signal<QueryDevtoolsEntry[]>;
  sequenceEntries: Signal<QueryDevtoolsEntry[]>;
  formEntries: Signal<QueryDevtoolsEntry[]>;
  authEntries: Signal<QueryDevtoolsEntry[]>;
  wsEntries: Signal<QueryDevtoolsEntry[]>;
  repositories: Signal<RepositoryInfo[]>;

  /**
   * The cache per client, with every entry's size measured. Reading each response inside the computed is
   * what keeps the totals current: a cache mutation bumps `cacheVersion`, but a response landing in an
   * entry that is already there does not.
   */
  cacheView: Signal<CacheView[]>;
  refetchCacheEntry(entry: QueryRepositoryCacheEntry): void;
  evictCacheEntry(repository: QueryRepository, key: string): void;
  /** Drops every entry of one client, consumers included - the cold-start check that does not need a reload. */
  evictAllCacheEntries(repository: QueryRepository): void;
  toggleCacheValue(clientName: string, key: string): void;
  isCacheValueExpanded(clientName: string, key: string): boolean;
  cacheFreshness(entry: QueryRepositoryCacheEntry): string;
  cacheSync(entry: QueryRepositoryCacheEntry, pollStates: Record<string, unknown>): string;
  cachePersistence(entry: QueryRepositoryCacheEntry): string;
  /** How many responses this client has on disk, which is usually more than it has in memory. */
  persistedCount(client: QueryClient): number;
  clearPersistedQueries(client: QueryClient): void;
  /** The features of the client behind a cache tab card, or `null` for a client without any. */
  clientFeatures(client: QueryClient | null | undefined): QueryDevtoolsFeature[] | null;

  /** Unique client names present across queries and auth providers, for the Queries/Timeline pickers. */
  clientNames: Signal<string[]>;

  /** What each tab holds - also drives the tab bar's own badges, so it lives here rather than per-tab. */
  tabBadges: Signal<Record<DevtoolsTab, TabBadge>>;

  /**
   * Every client the Faults tab can arm, with the fault it currently carries. Also feeds the
   * cross-tab "Faults armed" banner and the session export, so it lives here rather than on the tab.
   */
  faultClients: Signal<{ name: string; baseUrl: string; fault: QueryDevtoolsFault; armed: boolean }[]>;

  /**
   * The queries in scope before the Queries tab's own search box and status chips narrow them further:
   * either the picked client's, or exactly the inspected element's. Also what the Timeline tab scopes
   * its runs to, which is why this lives here rather than on the Queries tab alone.
   */
  scopedQueries: Signal<QueryDevtoolsEntry[]>;

  /** 1-second tick driving every countdown/freshness readout across tabs. */
  clock: Signal<number>;

  findQuery(id: string | null): QueryDevtoolsSelection | null;
  queryLinkFor(entry: QueryDevtoolsEntry | undefined, query?: AnyQuery): QueryLink;

  asStack(entry: QueryDevtoolsEntry): AnyQueryStack;
  asPagedStack(entry: QueryDevtoolsEntry): AnyPagedQueryStack;
  asSequence(entry: QueryDevtoolsEntry): QuerySequence<unknown[]>;
  asAuth(entry: QueryDevtoolsEntry): AnyBearerAuthProvider;
  asWs(entry: QueryDevtoolsEntry): WebSocketDevtoolsHandle;
  asForm(entry: QueryDevtoolsEntry): QueryDevtoolsFormHandle;

  authTokenPayload(auth: AnyBearerAuthProvider): Record<string, unknown> | null;
  authQueryKeys(auth: AnyBearerAuthProvider): string[];
  /** Countdown to the access-token's `exp` (the point a refresh becomes due), or `null` if unknown. */
  authTokenExpiry(auth: AnyBearerAuthProvider): string | null;
  /** The multi-tab leadership chip, or `null` for a provider without `withBearerAuthMultiTabSync`. */
  authLeadership(auth: AnyBearerAuthProvider): QueryDevtoolsLeadership | null;

  queryStatus(query: AnyQuery): 'idle' | 'loading' | 'success' | 'error';
  isStale(query: AnyQuery): boolean;
  /** Whether an entry is showing an armed response override or a devtools-faulted outcome. */
  isTampered(entry: QueryDevtoolsEntry): boolean;
  /** Whether armed response overrides are kept in `sessionStorage` and replayed on the next load. */
  overridesPersist(): boolean;
  toggleOverridesPersist(): void;
  requestProgress(query: AnyQuery): RequestProgress | null;
  retryCause(status: number): string;
  requestUrl(query: AnyQuery): string | null;
  requestPath(url: string): string;
  queryArgs(query: AnyQuery): unknown;
  routeSegments(entry: QueryDevtoolsEntry | undefined, query: AnyQuery): RouteSegment[];
  queryActivity(entry: QueryDevtoolsEntry): QueryActivity;
  linkActivity(link: QueryLink): QueryActivity;
  stackActivity(stack: AnyQueryStack | AnyPagedQueryStack): QueryActivity;
  sequenceActivity(sequence: QuerySequence<unknown[]>): QueryActivity;
  queriesForStack(stack: AnyQueryStack | AnyPagedQueryStack): QueryLink[];
  queriesForSequence(sequence: QuerySequence<unknown[]>): QueryLink[];
  /**
   * The queries a form feeds, discovered from the reads its `value()` recorded while their args were
   * built - so a form that nothing consumes yet reads as exactly that.
   */
  queriesDrivenByForm(entry: QueryDevtoolsEntry): QueryLink[];
  sequenceStepStatus(sequence: QuerySequence<unknown[]>, index: number): QuerySequenceStatus;
  stepSnapshot(sequence: QuerySequence<unknown[]>, index: number): AnyQuerySnapshot | null;
  /** Whether a sequence step's in/out detail (`<entryId>:<stepIndex>`) is expanded - persisted. */
  isStepExpanded(entryId: string, index: number): boolean;
  toggleStep(entryId: string, index: number): void;
  /** Keys of the Queries-list groups of identical rows the user opened - persisted. */
  expandedQueryGroups: Signal<ReadonlySet<string>>;
  toggleQueryGroup(key: string): void;
  /** Which way the Queries list sorts by last-executed time - persisted. */
  queryRecentFirst: WritableSignal<boolean>;
  /** Whether the Queries list is arranged as a tree of route paths instead of a flat list - persisted. */
  queryTreeView: WritableSignal<boolean>;
  /** The path folders the user closed. Collapsed, not expanded - a tree opens open. */
  collapsedQueryPaths: Signal<ReadonlySet<string>>;
  toggleQueryPath(key: string): void;
  /** The element a query was created in, or `null` for one created outside a component/directive. */
  locatableElement(entry: QueryDevtoolsEntry): HTMLElement | null;
  locateQuery(entry: QueryDevtoolsEntry): void;
  locateState: Signal<'idle' | 'located' | 'offscreen'>;
  resetStats(entry: QueryDevtoolsEntry): void;
  executeQuery(selection: QueryDevtoolsSelection, allowCache: boolean): void;
  resetQuery(query: AnyQuery): void;

  formatDuration(ms: number | null): string;
  formatBytes(bytes: number): string;
  formatTransferred(bytes: number, isEstimated: boolean): string;
  formatSpeed(bytesPerSecond: number): string;
  formatPercent(percentage: number): string;
  formatCountdown(ms: number | null): string;
  formatTime(timestamp: number | null): string;
  gqlDocument(doc: string): string;
  inlineValue(value: unknown): string;
  featureLabel(type: string): string;
  featureSummary(feature: QueryDevtoolsFeature): string;

  // --- Shared detail drawer state (one instance across every tab's drawer - see the type doc) ---

  detailTab: WritableSignal<DetailTab>;

  editorMode: WritableSignal<'none' | 'response' | 'args'>;
  responseDraft: WritableSignal<string>;
  argsDraft: WritableSignal<string>;
  /** The text the currently open editor was seeded with - not a signal, see the field's own doc. */
  editorSeed: string;
  editError: Signal<string | null>;
  openResponseEditor(query: AnyQuery): void;
  openArgsEditor(selection: QueryDevtoolsSelection): void;
  applyResponse(query: AnyQuery): void;
  applyArgs(query: AnyQuery): void;
  cancelEditor(): void;

  forceLoading(query: AnyQuery): void;
  forceError(query: AnyQuery): void;
  forceEmpty(query: AnyQuery): void;
  clearForced(query: AnyQuery): void;

  diffRunIndex: WritableSignal<number | null>;

  /** The run the diff compares against, or `null` to derive it - see the panel's own field. */
  diffBaseRunIndex: WritableSignal<number | null>;

  toggleRunDiff(entry: QueryDevtoolsEntry, run: QueryDevtoolsRun): void;
  /** Which end of the open diff a run is, or `null` if it is not one of the two. */
  diffRunRole(entry: QueryDevtoolsEntry, run: QueryDevtoolsRun): 'base' | 'compare' | null;
  responseDiff(
    entry: QueryDevtoolsEntry,
  ): { before: QueryDevtoolsRun; after: QueryDevtoolsRun; diff: QueryDevtoolsDiff } | null;
  canDiffRun(entry: QueryDevtoolsEntry, run: QueryDevtoolsRun): boolean;
  queryRuns(entry: QueryDevtoolsEntry): QueryDevtoolsRun[];
  runStatus(run: QueryDevtoolsRun): string;

  /** How many bodies a query retains, which is what bounds how far back a diff can reach. */
  retainedResponseCount: number;

  /** Moves the whole response diff one run older or newer, from the diff header. */
  canStepRunDiff(entry: QueryDevtoolsEntry, older: boolean): boolean;
  stepRunDiff(entry: QueryDevtoolsEntry, older: boolean): void;

  errorRunIndex: WritableSignal<number | null>;
  toggleRunError(run: QueryDevtoolsRun): void;
  pickedRunError(entry: QueryDevtoolsEntry): { run: QueryDevtoolsRun; error: QueryDevtoolsRunError } | null;

  copiedReport: Signal<boolean>;
  copiedInsomnia: Signal<boolean>;
  copiedCurl: Signal<boolean>;
  copiedGql: Signal<boolean>;
  copiedRoute: Signal<boolean>;
  copyReport(entry: QueryDevtoolsEntry, query: AnyQuery): void;
  copyInsomniaRequest(entry: QueryDevtoolsEntry, query: AnyQuery): void;
  copyCurlRequest(entry: QueryDevtoolsEntry, query: AnyQuery): void;
  copyGqlDocument(doc: string): void;
  /** The absolute URL of the last request, or the rendered route for a query that has not run. */
  copyableRoute(entry: QueryDevtoolsEntry, query: AnyQuery): string;
  copyableRouteTitle(entry: QueryDevtoolsEntry, query: AnyQuery): string;
  copyRoute(entry: QueryDevtoolsEntry, query: AnyQuery): void;

  refreshesFor(entryId: string): { id: number; timestamp: number; label: string }[];
  /** What asked for a refresh, on one line - shared by the drawer's "Refetched by" and the Events tab. */
  causeLabel(cause: QueryRefreshCause): string;
  formsDrivingQuery(entry: QueryDevtoolsEntry): QueryDevtoolsEntry[];

  /** Shared value-explorer search term, read (and set) from every drawer's Data sub-tab. */
  jsonSearch: WritableSignal<string>;
  jsonSearchTerm: Signal<string>;
  jsonExpandedPaths: Signal<ReadonlySet<string>>;
  jsonCollapsedPaths: Signal<ReadonlySet<string>>;
  toggleJsonPath(path: string, expand: boolean): void;

  // --- Queries tab state (persisted, so it has to survive the tab being switched away from) ---

  selectedClientName: WritableSignal<string | null>;
  selectedQueryId: WritableSignal<string | null>;
  selectedQuery: Signal<{ entry: QueryDevtoolsEntry; query: AnyQuery } | null>;
  queryFilter: WritableSignal<string>;
  queryFacets: WritableSignal<ReadonlySet<QueryListFacet>>;

  /** The entry ids sorted to the top of the Queries list. Persisted apart from the rest - see the panel. */
  pinnedQueryIds: Signal<ReadonlySet<string>>;
  isQueryPinned(entry: QueryDevtoolsEntry): boolean;
  toggleQueryPin(entry: QueryDevtoolsEntry): void;

  /** When set (via inspect), the Queries list is filtered to exactly these entry ids. */
  inspectFilterIds: WritableSignal<string[] | null>;

  selectClient(name: string | null): void;
  clearInspectFilter(): void;
  toggleFacet(facet: QueryListFacet): void;
  /** Drops the search term and the status chips, keeping the client / inspection scope. */
  clearQueryFilters(): void;

  /**
   * Downloads the given queries (already scoped/filtered by the caller) as one Insomnia collection,
   * filed into a folder per query client.
   */
  downloadInsomniaCollection(items: { entry: QueryDevtoolsEntry; query: AnyQuery }[], clientLabel: string | null): void;

  // --- Per-tab drawer selections (deliberately not shared with each other, but each has to survive its
  // own tab being switched away from, so - like the Queries tab's selection above - they live here) ---

  stackSelectedQueryId: WritableSignal<string | null>;
  stackSelectedQuery: Signal<{ entry: QueryDevtoolsEntry; query: AnyQuery } | null>;
  sequenceSelectedQueryId: WritableSignal<string | null>;
  sequenceSelectedQuery: Signal<{ entry: QueryDevtoolsEntry; query: AnyQuery } | null>;
  formSelectedQueryId: WritableSignal<string | null>;
  formSelectedQuery: Signal<{ entry: QueryDevtoolsEntry; query: AnyQuery } | null>;

  /** The form whose detail the Forms tab has expanded - persisted. */
  selectedFormId: WritableSignal<string | null>;

  /** The rolling event log - persisted only in the sense that it survives a tab switch, not a reload. */
  eventLog: WritableSignal<EventLogItem[]>;
  /** The client (by base URL) the event log is scoped to, or `null` for all of them - persisted. */
  eventClient: WritableSignal<string | null>;
  /** Whether the event log is narrowed to failures - persisted. */
  eventErrorsOnly: WritableSignal<boolean>;

  /** Free-text narrowing of every socket's message log - persisted. */
  socketFilter: WritableSignal<string>;
  socketMessages(ws: WebSocketDevtoolsHandle): WebSocketDevtoolsMessage[];
  socketDirectionLabel(message: WebSocketDevtoolsMessage): string;
  emitSocketMessage(options: { entry: QueryDevtoolsEntry; event: string; data: string }): void;
  /** The message an emit box last failed with, if this is the socket it failed on. */
  socketEmitErrorFor(entryId: string): string | null;
  timelineSelectedQueryId: WritableSignal<string | null>;
  timelineSelectedQuery: Signal<{ entry: QueryDevtoolsEntry; query: AnyQuery } | null>;

  // --- Two-pane tab sizing (the divider between a tab's list and its drawer) ---

  paneAxis: Signal<PaneAxis>;
  listWidth: Signal<number | null>;
  drawerWidth: Signal<number | null>;
  listHeight: Signal<number | null>;
  drawerHeight: Signal<number | null>;
  startPaneResize(event: PointerEvent, target: { pane: PaneTarget; container: HTMLElement }): void;
  resetPaneSize(pane: PaneTarget): void;
};

export const QUERY_DEVTOOLS_HOST = new InjectionToken<QueryDevtoolsHost>('QUERY_DEVTOOLS_HOST');

/** Injects the panel a tab or the detail drawer is rendered inside of. @see QueryDevtoolsHost */
export const injectQueryDevtoolsHost = (): QueryDevtoolsHost => inject(QUERY_DEVTOOLS_HOST);
