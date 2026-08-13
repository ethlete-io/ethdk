import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, untracked, ViewEncapsulation } from '@angular/core';
import { clearQueryDevtoolsTombstones, QueryDevtoolsEntry } from '@ethlete/query';
import { QueryDevtoolsDetailComponent } from './query-devtools-detail.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { buildQueryPathTree, flattenQueryPathTree, queryRoutePathSegments } from './query-devtools-query-tree';
import { QueryDevtoolsRouteComponent } from './query-devtools-route.component';
import { AnyQuery, QueryListFacet, QueryStatus } from './query-devtools-types';

/** One query as the Queries list renders it: the registry entry plus the handle it was registered with. */
type QueryRow = { entry: QueryDevtoolsEntry; query: AnyQuery };

/**
 * Rows the list folds into one line. `head` is the row the collapsed line renders from - every row in
 * `items` looks the same, which is what put them in one group.
 */
type QueryRowGroup = { key: string; head: QueryRow; items: QueryRow[] };

/** The Queries tab: every registered query, filterable by client/search/status, with an inline detail. */
@Component({
  selector: 'et-query-devtools-queries-tab',
  templateUrl: './query-devtools-queries-tab.component.html',
  styleUrl: './query-devtools-queries-tab.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, QueryDevtoolsDetailComponent, QueryDevtoolsRouteComponent],
})
export class QueryDevtoolsQueriesTabComponent {
  protected host = injectQueryDevtoolsHost();

  /** The status chips above the list, in the order a problem is usually looked for. */
  private readonly facets = [
    { id: 'error', label: 'Failing' },
    { id: 'loading', label: 'Loading' },
    { id: 'stale', label: 'Stale' },
    { id: 'idle', label: 'Idle' },
    { id: 'gone', label: 'Gone' },
  ] satisfies { id: QueryListFacet; label: string }[];

  private searchedQueries = computed(() => {
    const items = this.host.scopedQueries().map((entry) => ({ entry, query: entry.handle as AnyQuery }));
    const terms = this.host.queryFilter().trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (!terms.length) return items;

    return items.filter((item) => {
      const haystack = this.queryHaystack(item.entry, item.query);

      return terms.every((term) => haystack.includes(term));
    });
  });

  /**
   * How many queries each status chip would leave. Counted before the active chips are applied, so a
   * chip always states what picking it yields rather than what the current selection happens to show.
   */
  private facetCounts = computed(() => {
    // Staleness is a `Date.now()` comparison and deliberately not reactive, so the clock is what makes
    // the counts age with it - without it a chip would keep the number it happened to be built with.
    this.host.clock();

    const counts: Record<QueryListFacet, number> = { error: 0, loading: 0, stale: 0, idle: 0, gone: 0 };

    for (const { entry, query } of this.searchedQueries()) {
      // A tombstone's frozen state is not live state: counting it as failing or idle would put a query
      // that no longer exists into the numbers the panel is read for.
      if (entry.destroyedAt) {
        counts.gone++;
        continue;
      }

      const status = this.host.queryStatus(query);

      if (status === 'error') counts.error++;
      if (status === 'loading') counts.loading++;
      if (status === 'idle') counts.idle++;
      if (this.host.isStale(query)) counts.stale++;
    }

    return counts;
  });

  /**
   * The status chips worth rendering: the ones that would narrow the list, plus whichever are on. An
   * active chip stays even at zero - it is the only thing that says why the list is empty.
   */
  protected visibleFacets = computed(() => {
    const counts = this.facetCounts();
    const active = this.host.queryFacets();

    return this.facets
      .map((facet) => ({ ...facet, count: counts[facet.id], active: active.has(facet.id) }))
      .filter((facet) => facet.count > 0 || facet.active);
  });

  protected filteredQueries = computed(() => {
    const facets = this.host.queryFacets();

    // Same reason as in `facetCounts`: a list narrowed to stale queries has to re-evaluate as they age.
    if (facets.has('stale')) this.host.clock();

    const items = this.searchedQueries().filter((item) =>
      item.entry.destroyedAt
        ? this.listsTombstone(item.entry, facets)
        : !facets.size || this.matchesFacets(item, facets),
    );

    return this.pinnedFirst(this.byLastExecuted(items));
  });

  /**
   * The list as it is rendered: rows that would be indistinguishable from each other - same method, same
   * resolved route, same live-or-gone - folded into one group. One query used by several consumers is one
   * entry per consumer by design (the ids have to stay per-instance for the detail, pins and tombstones),
   * and this is where that stops being N identical lines.
   *
   * Grouping on what the row *shows* rather than on the registry's descriptor is deliberate: the
   * descriptor is the route template, so `/post/1` and `/post/2` share it while being different data.
   * Folding only what looks the same can never hide a distinction the list was making.
   */
  protected queryGroups = computed(() => {
    const groups = new Map<string, QueryRowGroup>();

    for (const item of this.filteredQueries()) {
      const key = this.groupKey(item);
      const group = groups.get(key);

      if (group) {
        group.items.push(item);
        continue;
      }

      groups.set(key, { key, head: item, items: [item] });
    }

    return [...groups.values()];
  });

  /**
   * The same groups, arranged by route path. Built from what a row *shows* (the resolved route), the way
   * {@link groupKey} is - so `/post/1` and `/post/2` are two leaves under `post` rather than one, which
   * is what makes the tree answer "which ids did this screen fetch".
   */
  protected queryTree = computed(() =>
    flattenQueryPathTree(
      buildQueryPathTree(
        this.queryGroups().map((group) => ({ path: queryRoutePathSegments(this.groupPathRoute(group)), item: group })),
      ),
      {
        isCollapsed: (key) => this.host.collapsedQueryPaths().has(key),
        keyOf: (group) => group.key,
      },
    ),
  );

  /**
   * The fold the selected query sits in, or `null` while it is not in the list. Keyed the way
   * {@link groupKey} keys the fold, so it moves with the query when regrouping moves it.
   */
  private selectedGroupKey = computed(() => {
    const id = this.host.selectedQueryId();

    if (!id) return null;

    const item = this.filteredQueries().find((item) => item.entry.id === id);

    return item ? this.groupKey(item) : null;
  });

  /**
   * Whether the selected query is the very row a collapsed fold renders. A boolean rather than the group
   * itself on purpose: the effect below reads it, and a fresh object every time the list re-evaluates
   * would re-run it - which is exactly what it must not do.
   */
  private selectedIsFoldHead = computed(() => {
    const key = this.selectedGroupKey();

    if (!key) return false;

    return this.queryGroups().find((group) => group.key === key)?.head.entry.id === this.host.selectedQueryId();
  });

  /** How many queries the list would hold with the search box empty, which is what the count compares to. */
  protected scopedQueryCount = computed(() => {
    const facets = this.host.queryFacets();

    return this.host.scopedQueries().filter((entry) => !entry.destroyedAt || this.listsTombstone(entry, facets)).length;
  });

  protected goneQueryCount = computed(() => this.host.scopedQueries().filter((entry) => !!entry.destroyedAt).length);

  /** The tombstones Forget would drop: the ones the list is showing, never the whole registry. */
  protected listedGoneQueries = computed(() =>
    this.host.queryFacets().has('gone') ? this.filteredQueries().filter((item) => item.entry.destroyedAt) : [],
  );

  /** Whether the search box or a status chip is narrowing the list beyond its scope. */
  protected isQueryListNarrowed = computed(() => !!this.host.queryFilter().trim() || this.host.queryFacets().size > 0);

  constructor() {
    // Opens the fold when the selection lands on a member it does not render, so the detail pane always
    // has a row to match - a selection arriving from the Events tab has to say *which* consumer it is.
    // Selecting the fold's own head leaves it shut: the collapsed row already stands for that query.
    //
    // Only *opens*, never closes, and `untracked` is what keeps that true: `expandQueryGroup` reads the
    // expanded set to decide whether it has anything to do, and a tracked read of it would make
    // collapsing the fold re-run this and open it straight back up.
    effect(() => {
      const key = this.selectedGroupKey();

      if (key && !this.selectedIsFoldHead()) untracked(() => this.host.expandQueryGroup(key));
    });
  }

  /** Whether the selected query is one of this fold's - the row stands in for it while it is collapsed. */
  protected holdsSelection(group: QueryRowGroup) {
    return this.selectedGroupKey() === group.key;
  }

  /**
   * Opens the detail on the fold without expanding it. Every row in it is the same request, so the head
   * answers for all of them - and a fold already showing one of its own keeps that one selected.
   */
  protected selectGroup(group: QueryRowGroup) {
    if (this.holdsSelection(group)) return;

    this.host.selectedQueryId.set(group.head.entry.id);
  }

  /**
   * What tells one consumer of a folded query from another. They share a method, a route and a response -
   * what differs is where each was created, so the element it was created in is the only thing on a nested
   * row worth reading. The ordinal carries the ones created outside a component, and the ones several
   * instances of the same component created.
   */
  protected consumerLabel(item: QueryRow) {
    return this.host.locatableElement(item.entry)?.localName ?? null;
  }

  /**
   * The batch that created a fold's queries, or `null` for a fold of ordinary ones. Every query in a
   * batch fold has the same one, so the head answers for all of them.
   */
  protected batchEntryOf(group: QueryRowGroup) {
    return this.host.batchOf(group.head.entry);
  }

  /** The worst state in a folded group, so a collapsed row cannot hide the one instance that is failing. */
  protected groupStatus(group: QueryRowGroup): QueryStatus {
    const statuses = group.items.map((item) => this.host.queryStatus(item.query));

    if (statuses.includes('error')) return 'error';
    if (statuses.includes('loading')) return 'loading';
    if (statuses.includes('success')) return 'success';

    return 'idle';
  }

  protected isGroupStale(group: QueryRowGroup) {
    return group.items.some((item) => this.host.isStale(item.query));
  }

  protected isGroupTampered(group: QueryRowGroup) {
    return group.items.some((item) => this.host.isTampered(item.entry));
  }

  protected isGroupExpanded(group: QueryRowGroup) {
    return this.host.expandedQueryGroups().has(group.key);
  }

  protected forgetGoneQueries() {
    clearQueryDevtoolsTombstones(this.listedGoneQueries().map((item) => item.entry.id));
    // Left lit, the chip would narrow the list to the tombstones that were just dropped - an empty list.
    this.host.toggleFacet('gone');
  }

  protected downloadInsomniaCollection() {
    this.host.downloadInsomniaCollection(this.filteredQueries(), this.host.selectedClientName());
  }

  /**
   * When a query last ran, or `null` for one that never has. A tombstone's is frozen at whatever it held
   * when it died, so `destroyedAt` is the tiebreak that keeps gone entries ordered among themselves.
   */
  protected lastExecutedAt(item: QueryRow) {
    return item.query.lastTimeExecutedAt() ?? item.entry.destroyedAt ?? null;
  }

  /**
   * A tombstone is the last state a query held, not a state it is in, so the list leaves one out unless the
   * Gone chip asks for it - or the detail is showing it, so a query dying under the detail keeps its row.
   */
  private listsTombstone(entry: QueryDevtoolsEntry, facets: ReadonlySet<QueryListFacet>) {
    // A batch's settled items are the exception: the batch destroys each query the moment its item lands,
    // so every row of a finished run is a tombstone and the fold would vanish the moment it completed.
    // What the row stands for is the batch - which is still registered - not a query that is gone.
    if (this.host.batchOf(entry)) return true;

    return facets.has('gone') || (!facets.size && entry.id === this.host.selectedQueryId());
  }

  /**
   * Newest or oldest run first. A query that has **never** executed has no place on a time axis, so it
   * sinks to the bottom in *both* directions rather than piling up at whichever end `null` sorts to -
   * flipping the arrow must not turn the list into the queries that have not run yet.
   */
  private byLastExecuted(items: QueryRow[]) {
    const recentFirst = this.host.queryRecentFirst();

    // Copied first: `items` came out of a computed and `sort` is in place.
    return items.slice().sort((a, b) => {
      const left = this.lastExecutedAt(a);
      const right = this.lastExecutedAt(b);

      if (left === null || right === null) return Number(left === null) - Number(right === null);

      return recentFirst ? right - left : left - right;
    });
  }

  /**
   * Pinned queries first, everything else in {@link byLastExecuted} order. A chip could not do this job:
   * {@link matchesFacets} widens, so a Pinned chip would mean "pinned or failing" and never both.
   */
  private pinnedFirst(items: QueryRow[]) {
    if (!this.host.pinnedQueryIds().size) return items;

    // Copied first: `items` is a computed's cached array, and `sort` is in place.
    return items
      .slice()
      .sort((a, b) => Number(this.host.isQueryPinned(b.entry)) - Number(this.host.isQueryPinned(a.entry)));
  }

  /** A live query matches the chips if it is in any of the picked states - chips widen, they don't intersect. */
  private matchesFacets(item: QueryRow, facets: ReadonlySet<QueryListFacet>) {
    const status = this.host.queryStatus(item.query);

    return (
      (facets.has('error') && status === 'error') ||
      (facets.has('loading') && status === 'loading') ||
      (facets.has('idle') && status === 'idle') ||
      (facets.has('stale') && this.host.isStale(item.query))
    );
  }

  /** The route a row renders, as one string - what both the fold key and the path tree are built from. */
  private groupRoute(item: QueryRow) {
    return this.host
      .routeSegments(item.entry, item.query)
      .map((segment) => segment.text)
      .join('');
  }

  /**
   * The route a whole fold sits under in the path tree. A batch's is its route *template*, not the
   * resolved route of whichever item happens to be the head - the items differ in every path param, so
   * the head's route would put the run under a different leaf on every re-render.
   */
  private groupPathRoute(group: QueryRowGroup) {
    const batch = this.batchEntryOf(group);

    return batch ? (batch.meta.route ?? '') : this.groupRoute(group.head);
  }

  /** What makes two rows indistinguishable on screen. A tombstone never folds into a live query. */
  private groupKey(item: QueryRow) {
    const batch = this.host.batchOf(item.entry);

    // A batch's items fold by the run that created them rather than by what the row shows: they differ
    // in every path param, so nothing else would fold them, and a run only ever has `concurrency` of
    // them alive at a time - so an unfolded list is a handful of rows churning through the same slot.
    if (batch) return `batch|${batch.id}`;

    return `${item.entry.destroyedAt ? 'gone' : 'live'}|${item.entry.meta.method ?? ''}|${this.groupRoute(item)}`;
  }

  /**
   * What the search box matches against: what the row shows, plus the path of the request that ran for a
   * query whose template differs from it.
   *
   * Deliberately not the origin or the client name - both repeat across most entries, so a short term
   * ("p") would match nearly everything through the host name. Scoping to a client is the picker's job.
   */
  private queryHaystack(entry: QueryDevtoolsEntry, query: AnyQuery) {
    const url = this.host.requestUrl(query);
    const route = this.host
      .routeSegments(entry, query)
      .map((segment) => segment.text)
      .join('');
    const parts = [entry.meta.method, route, url ? this.host.requestPath(url) : null];

    return parts.join(' ').toLowerCase();
  }
}
