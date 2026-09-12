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

export const filterStaticItems = (
  items: readonly RichTextEditorTriggerItem[],
  query: string,
): RichTextEditorTriggerItem[] => items.filter((item) => matchesQuery(item, query));

/**
 * Callers must pipe this through `switchMap`: that unsubscribes stale requests, which is why a
 * superseded Promise/Observable needs no manual generation guard.
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

type InternalState = RichTextEditorTriggerItemsState & { trigger: RichTextEditorTrigger | null };

const EMPTY_STATE: InternalState = { items: [], loading: false, error: null, trigger: null };

export type RichTextEditorTriggerRequest = { trigger: RichTextEditorTrigger; query: string } | null;

export const trackTriggerItems = (
  request$: Observable<RichTextEditorTriggerRequest>,
): Observable<RichTextEditorTriggerItemsState> =>
  request$.pipe(
    distinctUntilChanged((a, b) => a?.trigger === b?.trigger && a?.query === b?.query),
    switchMap((request): Observable<InternalState> => {
      // Emitting an empty state here would flash "No results" through the closing popup's fade-out.
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
      const keepPrevious = next.loading && next.items.length === 0 && previous.trigger === next.trigger;

      return { ...next, items: keepPrevious ? previous.items : next.items };
    }, EMPTY_STATE),
    map(({ items, loading, error }): RichTextEditorTriggerItemsState => ({ items, loading, error })),
  );

const delayFetch =
  (trigger: RichTextEditorTrigger) =>
  (source$: Observable<InternalState>): Observable<InternalState> =>
    timer(trigger.debounceTime ?? 150).pipe(switchMap(() => source$));
