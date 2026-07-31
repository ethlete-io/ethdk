import { defaultIfEmpty, defer, EMPTY, expand, from, isObservable, map, Observable, take, toArray } from 'rxjs';
import { TableCsvRowsProvider } from './table-csv-export';

/** Options for {@link tableCsvRowsFromPages}. */
export type TableCsvRowsFromPagesOptions<T> = {
  /**
   * Fetch one page and hand back its rows. Called with `1`, then `2`, and so on until `hasMore` says
   * to stop. An observable is read to its first emission — one page is one list, not a stream.
   */
  fetchPage: (page: number) => Promise<readonly T[]> | Observable<readonly T[]>;

  /**
   * Whether to ask for another page after this one. The default stops at the first page that comes
   * back empty, which is right whenever the last page is followed by an empty one — pass your own when
   * the response says so directly (`(rows, page) => page < response.totalPages`).
   */
  hasMore?: (rows: readonly T[], page: number) => boolean;

  /** The first page's number, for a 0-based API. @default 1 */
  initialPage?: number;

  /**
   * Stop after this many pages, whatever `hasMore` says. A backstop, not a limit: a `hasMore` that
   * never goes false would otherwise walk a backend forever, and the export is running behind a button
   * the user is waiting on.
   * @default 1000
   */
  maxPages?: number;
};

// One page is one list, so the first emission is the answer and the subscription ends there. A source
// that completes without emitting is the end of the pages, not a failure — hence the default.
const firstPage = <T>(source: Promise<readonly T[]> | Observable<readonly T[]>): Observable<readonly T[]> =>
  (isObservable(source) ? source : from(source)).pipe(take(1), defaultIfEmpty<readonly T[], readonly T[]>([]));

/**
 * Walks a paginated endpoint and concatenates every page, as a `rows` provider for a
 * [CSV export](/components/table#exporting-more-than-the-loaded-page).
 *
 * This is the fallback for a backend with no "export everything" endpoint of its own. Prefer one when
 * it exists — see the export's `file` option — because this makes N round trips for a file the server
 * could stream in one, and holds the whole dataset in memory to do it.
 *
 * The pages are fetched **in order, one at a time**: page N+1 is only asked for once page N has come
 * back, so a large export doesn't open fifty connections at once.
 *
 * @example
 * <button et-button [disabled]="csv.exporting()" (click)="csv.export({ rows: allPeople })">
 *   Export everything
 * </button>
 *
 * @example
 * protected allPeople = tableCsvRowsFromPages<Person>({
 *   fetchPage: (page) => this.http.get<Person[]>('/people', { params: { page, size: 200 } }),
 * });
 */
export const tableCsvRowsFromPages =
  <T>(options: TableCsvRowsFromPagesOptions<T>): TableCsvRowsProvider<T> =>
  () => {
    const { fetchPage, hasMore, initialPage = 1, maxPages = 1000 } = options;
    const more = (rows: readonly T[], page: number) => (hasMore ? hasMore(rows, page) : rows.length > 0);

    // `defer` so nothing is requested until the export subscribes, and `expand` for the recursion:
    // each page decides whether there is another, which is what keeps them strictly one at a time
    // rather than all at once. `index` counts emissions, so it is also the page's offset.
    return defer(() =>
      firstPage(fetchPage(initialPage)).pipe(
        expand((rows, index) =>
          more(rows, initialPage + index) && index + 1 < maxPages
            ? firstPage(fetchPage(initialPage + index + 1))
            : EMPTY,
        ),
        toArray(),
        map((pages) => pages.flat()),
      ),
    );
  };
