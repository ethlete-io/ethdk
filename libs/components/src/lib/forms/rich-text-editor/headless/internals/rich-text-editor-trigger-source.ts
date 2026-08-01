import {
  catchError,
  concat,
  distinctUntilChanged,
  EMPTY,
  from,
  isObservable,
  map,
  Observable,
  of,
  scan,
  switchMap,
  timer,
} from 'rxjs';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from '../../rich-text-editor-trigger';

/** Reactive result of requesting a trigger's items for a query. */
export type RichTextEditorTriggerItemsState = {
  items: RichTextEditorTriggerItem[];
  loading: boolean;
  error: unknown | null;
};

const isPromiseLike = <T>(value: unknown): value is Promise<T> =>
  !!value && typeof (value as Promise<T>).then === 'function';

const matchesQuery = (item: RichTextEditorTriggerItem, query: string) => {
  if (!query) return true;

  const needle = query.toLowerCase();
  const haystack = [item.label, item.description ?? '', item.id].join(' ').toLowerCase();

  return haystack.includes(needle);
};

/** Client-side filtering applied to static (array) sources; function sources filter themselves. */
export const filterStaticItems = (
  items: readonly RichTextEditorTriggerItem[],
  query: string,
): RichTextEditorTriggerItem[] => items.filter((item) => matchesQuery(item, query));

/**
 * Resolves a trigger's items for `query` as an Observable, normalizing the sync array / function
 * (sync, `Promise`, or `Observable`) source forms. Static arrays are filtered client-side; function
 * sources receive the query and own their filtering. Emits `[]` below `minQueryLength`.
 *
 * Callers pipe this through `switchMap`, which unsubscribes stale requests - RxJS guarantees a
 * superseded Promise/Observable can no longer emit, so no manual generation guard is needed.
 */
export const resolveTriggerItems = (
  trigger: RichTextEditorTrigger,
  query: string,
): Observable<RichTextEditorTriggerItem[]> => {
  const source = trigger.items;

  if (typeof source !== 'function') {
    return of(filterStaticItems(source, query));
  }

  if (query.length < (trigger.minQueryLength ?? 0)) {
    return of([]);
  }

  const result = source(query);

  if (isObservable(result)) return result;
  if (isPromiseLike<RichTextEditorTriggerItem[]>(result)) return from(result);

  return of(result);
};

/** Internal state carrying the originating trigger so `scan` can reset items on a trigger switch. */
type InternalState = RichTextEditorTriggerItemsState & { trigger: RichTextEditorTrigger | null };

const EMPTY_STATE: InternalState = { items: [], loading: false, error: null, trigger: null };

/** A trigger + the query typed after its char, or `null` when no trigger is active. */
export type RichTextEditorTriggerRequest = { trigger: RichTextEditorTrigger; query: string } | null;

/**
 * Turns a stream of active requests into a stream of item states. Identical requests are ignored,
 * `switchMap` cancels superseded ones (so a stale async result can't emit), and function sources
 * are debounced with an immediate `loading` state. Static sources resolve synchronously.
 *
 * While an async source is loading, the previous results stay visible (menu-like) instead of
 * blanking - `scan` keeps them, but resets when the active trigger changes.
 */
export const trackTriggerItems = (
  request$: Observable<RichTextEditorTriggerRequest>,
): Observable<RichTextEditorTriggerItemsState> =>
  request$.pipe(
    distinctUntilChanged((a, b) => a?.trigger === b?.trigger && a?.query === b?.query),
    switchMap((request): Observable<InternalState> => {
      // Deactivated (trigger char removed / caret left): don't emit an empty state - the popup is
      // closing, so freeze on the last results and let it fade out instead of flashing "No results".
      if (!request) return EMPTY;

      const trigger = request.trigger;
      const fetch$ = resolveTriggerItems(trigger, request.query).pipe(
        map((items): InternalState => ({ items, loading: false, error: null, trigger })),
        catchError((error): Observable<InternalState> => of({ items: [], loading: false, error, trigger })),
      );

      if (typeof trigger.items !== 'function') return fetch$;

      return concat(
        of<InternalState>({ items: [], loading: true, error: null, trigger }),
        fetch$.pipe(delayFetch(trigger)),
      );
    }),
    scan((previous, next): InternalState => {
      // keep the last results visible while a same-trigger request is still loading
      const keepPrevious = next.loading && next.items.length === 0 && previous.trigger === next.trigger;

      return { ...next, items: keepPrevious ? previous.items : next.items };
    }, EMPTY_STATE),
    map(({ items, loading, error }): RichTextEditorTriggerItemsState => ({ items, loading, error })),
  );

/** Debounces a function source's fetch (the immediate `loading` state above is emitted first). */
const delayFetch =
  (trigger: RichTextEditorTrigger) =>
  (source$: Observable<InternalState>): Observable<InternalState> =>
    timer(trigger.debounceTime ?? 150).pipe(switchMap(() => source$));
