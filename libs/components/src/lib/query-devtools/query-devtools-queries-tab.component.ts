import { Component, computed, ViewEncapsulation } from '@angular/core';
import { QueryDevtoolsEntry } from '@ethlete/query';
import { QueryDevtoolsDetailComponent } from './query-devtools-detail.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsRouteComponent } from './query-devtools-route.component';
import { AnyQuery, QueryListFacet } from './query-devtools-types';

/** The Queries tab: every registered query, filterable by client/search/status, with an inline detail. */
@Component({
  selector: 'et-query-devtools-queries-tab',
  templateUrl: './query-devtools-queries-tab.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsDetailComponent, QueryDevtoolsRouteComponent],
})
export class QueryDevtoolsQueriesTabComponent {
  protected host = injectQueryDevtoolsHost();

  /** The status chips above the list, in the order a problem is usually looked for. */
  protected readonly facets = [
    { id: 'error', label: 'Failing' },
    { id: 'loading', label: 'Loading' },
    { id: 'stale', label: 'Stale' },
    { id: 'idle', label: 'Idle' },
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
  protected facetCounts = computed(() => {
    // Staleness is a `Date.now()` comparison and deliberately not reactive, so the clock is what makes
    // the counts age with it - without it a chip would keep the number it happened to be built with.
    this.host.clock();

    const counts: Record<QueryListFacet, number> = { error: 0, loading: 0, stale: 0, idle: 0 };

    for (const { query } of this.searchedQueries()) {
      const status = this.host.queryStatus(query);

      if (status === 'error') counts.error++;
      if (status === 'loading') counts.loading++;
      if (status === 'idle') counts.idle++;
      if (this.host.isStale(query)) counts.stale++;
    }

    return counts;
  });

  protected filteredQueries = computed(() => {
    const facets = this.host.queryFacets();
    const items = this.searchedQueries();

    if (!facets.size) return items;

    // Same reason as in `facetCounts`: a list narrowed to stale queries has to re-evaluate as they age.
    if (facets.has('stale')) this.host.clock();

    return items.filter(({ query }) => this.matchesFacets(query, facets));
  });

  /** How many queries are in scope, which is what the list would show unfiltered. */
  protected scopedQueryCount = computed(() => this.host.scopedQueries().length);

  /** Whether the search box or a status chip is narrowing the list beyond its scope. */
  protected isQueryListNarrowed = computed(() => !!this.host.queryFilter().trim() || this.host.queryFacets().size > 0);

  protected downloadInsomniaCollection() {
    this.host.downloadInsomniaCollection(this.filteredQueries(), this.host.selectedClientName());
  }

  /** A query matches the chips if it is in any of the picked states - chips widen, they don't intersect. */
  private matchesFacets(query: AnyQuery, facets: ReadonlySet<QueryListFacet>) {
    const status = this.host.queryStatus(query);

    return (
      (facets.has('error') && status === 'error') ||
      (facets.has('loading') && status === 'loading') ||
      (facets.has('idle') && status === 'idle') ||
      (facets.has('stale') && this.host.isStale(query))
    );
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
