import { inject, InjectionToken, Signal, WritableSignal } from '@angular/core';
import {
  AnyBearerAuthProvider,
  AnyPagedQueryStack,
  AnyQueryStack,
  QueryDevtoolsEntry,
  QueryDevtoolsFeature,
  QueryDevtoolsFormHandle,
  QueryDevtoolsRun,
  QuerySequence,
  WebSocketDevtoolsHandle,
} from '@ethlete/query';
import {
  AnyQuery,
  DetailTab,
  DevtoolsTab,
  PaneAxis,
  PaneTarget,
  QueryActivity,
  QueryLink,
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
  responseDiff(entry: QueryDevtoolsEntry): { before: QueryDevtoolsRun; after: QueryDevtoolsRun; diff: unknown } | null;
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
