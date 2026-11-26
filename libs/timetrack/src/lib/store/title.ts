import { EMPTY, Observable, concatMap, expand, last, map, of } from 'rxjs';
import { CollectedEvent } from '../model/event';
import { StoredTitle, TimetrackTitleRepairStore } from './ports';

/**
 * A URL inside a title, and the query string or fragment that follows it. The host must end in a
 * label of letters, so a version number is not mistaken for one.
 */
const URL_WITH_QUERY = /(https?:\/\/[^\s?#]+|[a-z0-9][\w-]*(?:\.[\w-]+)*\.[a-z]{2,}(?:\/[^\s?#]*)?)[?#]\S+/gi;

/**
 * The title with the query string and the fragment of every URL in it removed. The origin and the path
 * are kept, so the row still says which page the time was spent on.
 */
export const redactTitleUrls = (title: string) => title.replace(URL_WITH_QUERY, '$1');

/**
 * Every event's title with `redactTitleUrls` applied. Run it after the exclusion rules and before the
 * store: a rule is written against the title the user saw, and a browser puts the whole URL in the
 * title while a page has none of its own, so a sign-in redirect carries an OAuth request and its
 * tokens into the database.
 */
export const redactEventTitles = <T extends CollectedEvent>(events: readonly T[]): T[] =>
  events.map((event) => {
    if (!('title' in event) || typeof event.title !== 'string') return event;

    const title = redactTitleUrls(event.title);

    return title === event.title ? event : ({ ...event, title } as T);
  });

/**
 * Only the rows whose title the redaction changes. A row that is already clean is never written
 * back, so a second pass over a repaired store writes nothing.
 */
export const redactTitleRows = (rows: readonly StoredTitle[]): StoredTitle[] =>
  rows.flatMap((row) => {
    const title = redactTitleUrls(row.title);

    return title === row.title ? [] : [{ id: row.id, title }];
  });

/** What one repair pass read and what it had to change. */
export type TitleRepairReport = { scanned: number; rewritten: number };

const REPAIR_PAGE_SIZE = 500;

type RepairPage = TitleRepairReport & { afterId: number; done: boolean };

/**
 * Applies `redactTitleUrls` to every title already in the store, a page at a time, and reports what
 * it read and rewrote. Run it after the redaction rule changes: the rule runs on the way in, so a
 * title collected before it existed sits in the database whole.
 *
 * The pass is safe to run twice, and safe to interrupt — each page commits on its own, and a row it
 * already cleaned comes back unchanged.
 */
export const repairStoredTitles$ = (
  store: TimetrackTitleRepairStore,
  pageSize = REPAIR_PAGE_SIZE,
): Observable<TitleRepairReport> =>
  of<RepairPage>({ afterId: 0, scanned: 0, rewritten: 0, done: false }).pipe(
    expand((page) =>
      page.done
        ? EMPTY
        : store.titlesAfterId$(page.afterId, pageSize).pipe(
            concatMap((rows) => {
              const changed = redactTitleRows(rows);
              const next: RepairPage = {
                afterId: rows.at(-1)?.id ?? page.afterId,
                scanned: page.scanned + rows.length,
                rewritten: page.rewritten,
                done: rows.length < pageSize,
              };

              if (changed.length === 0) return of(next);

              return store
                .setTitles$(changed)
                .pipe(map((written) => ({ ...next, rewritten: next.rewritten + written })));
            }),
          ),
    ),
    last(),
    map(({ scanned, rewritten }): TitleRepairReport => ({ scanned, rewritten })),
  );
