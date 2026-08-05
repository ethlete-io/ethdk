import { inject, InjectionToken, Signal, WritableSignal } from '@angular/core';
import {
  AnyBearerAuthProvider,
  AnyPagedQueryStack,
  AnyQuerySnapshot,
  AnyQueryStack,
  QueryDevtoolsEntry,
  QueryDevtoolsFeature,
  QueryDevtoolsFormHandle,
  QueryDevtoolsRun,
  QuerySequence,
  QuerySequenceStatus,
  WebSocketDevtoolsHandle,
} from '@ethlete/query';
import { QueryDevtoolsDiff } from './query-devtools-diff';
import {
  AnyQuery,
  DetailTab,
  DevtoolsTab,
  PaneAxis,
  PaneTarget,
  QueryActivity,
  QueryLink,
  QueryListFacet,
  RepositoryInfo,
  RequestProgress,
  RouteSegment,
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

  /** Unique client names present across queries and auth providers, for the Queries/Timeline pickers. */
  clientNames: Signal<string[]>;

  /**
   * The queries in scope before the Queries tab's own search box and status chips narrow them further:
   * either the picked client's, or exactly the inspected element's. Also what the Timeline tab scopes
   * its runs to, which is why this lives here rather than on the Queries tab alone.
   */
  scopedQueries: Signal<QueryDevtoolsEntry[]>;

  /** 1-second tick driving every countdown/freshness readout across tabs. */
  clock: Signal<number>;

  findQuery(id: string | null): { entry: QueryDevtoolsEntry; query: AnyQuery } | null;
  queryLinkFor(entry: QueryDevtoolsEntry | undefined, query?: AnyQuery): QueryLink;

  asStack(entry: QueryDevtoolsEntry): AnyQueryStack;
  asPagedStack(entry: QueryDevtoolsEntry): AnyPagedQueryStack;
  asSequence(entry: QueryDevtoolsEntry): QuerySequence<unknown[]>;
  asAuth(entry: QueryDevtoolsEntry): AnyBearerAuthProvider;
  asWs(entry: QueryDevtoolsEntry): WebSocketDevtoolsHandle;
  asForm(entry: QueryDevtoolsEntry): QueryDevtoolsFormHandle;

  queryStatus(query: AnyQuery): 'idle' | 'loading' | 'success' | 'error';
  isStale(query: AnyQuery): boolean;
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
  resetStats(entry: QueryDevtoolsEntry): void;
  executeQuery(query: AnyQuery, allowCache: boolean): void;
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
  openArgsEditor(query: AnyQuery): void;
  applyResponse(query: AnyQuery): void;
  applyArgs(query: AnyQuery): void;
  cancelEditor(): void;

  forceLoading(query: AnyQuery): void;
  forceError(query: AnyQuery): void;
  forceEmpty(query: AnyQuery): void;
  clearForced(query: AnyQuery): void;

  diffRunIndex: Signal<number | null>;
  toggleRunDiff(run: QueryDevtoolsRun): void;
  responseDiff(
    entry: QueryDevtoolsEntry,
  ): { before: QueryDevtoolsRun; after: QueryDevtoolsRun; diff: QueryDevtoolsDiff } | null;
  canDiffRun(entry: QueryDevtoolsEntry, run: QueryDevtoolsRun): boolean;
  queryRuns(entry: QueryDevtoolsEntry): QueryDevtoolsRun[];
  runStatus(run: QueryDevtoolsRun): string;

  copiedReport: Signal<boolean>;
  copiedInsomnia: Signal<boolean>;
  copiedCurl: Signal<boolean>;
  copiedGql: Signal<boolean>;
  copyReport(entry: QueryDevtoolsEntry, query: AnyQuery): void;
  copyInsomniaRequest(entry: QueryDevtoolsEntry, query: AnyQuery): void;
  copyCurlRequest(entry: QueryDevtoolsEntry, query: AnyQuery): void;
  copyGqlDocument(doc: string): void;

  refreshesFor(entryId: string): { id: number; timestamp: number; label: string }[];
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
