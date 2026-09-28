import { Signal, computed, effect, linkedSignal, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { equal } from '@ethlete/core';
import { debounceTime as rxDebounceTime } from 'rxjs';
import { SelectOptionsFromQuery } from './select-options-from-query';
import { injectSelectLabels } from './select-labels';

type PageState<TItem> = {
  slices: TItem[][];
  ended: boolean;
};

/**
 * Whether a freshly settled page ends the pagination. Asking a paginated API for a page past the end
 * commonly clamps to the last one; appending that would show the tail of the list twice.
 */
const endsPagination = <TItem>(nextSlice: TItem[], previousSlice: TItem[] | undefined) =>
  nextSlice.length === 0 || (previousSlice !== undefined && equal(nextSlice, previousSlice));

type SelectOptionsPagingConfig = {
  minQueryLength?: number;
  debounceTime?: number;
  initialPage?: number;
};

type SelectOptionsPagingSource<TSettled, TOption> = {
  /** The latest settled result; each new value is folded into the slice of the page it was requested for. */
  settled: Signal<TSettled>;
  /** The option slice of a settled result, or `null` while it holds no successful response. */
  toSlice: (settled: TSettled) => TOption[] | null;
  /** Whether more pages follow the settled result. */
  hasMore: (settled: TSettled) => boolean;
  loading: Signal<boolean>;
  /** The failure message, or `null` without a failure; `undefined` falls back to the `error` label. */
  error: Signal<string | null | undefined>;
};

/**
 * The debounced search query, page counter and page fold shared by the query adapters. Call
 * `connect` with the adapter's query signals once the query is created from `query`, `page` and
 * `skipped`.
 *
 * @internal
 */
export const createSelectOptionsPaging = (config: SelectOptionsPagingConfig) => {
  const labels = injectSelectLabels();
  const rawQuery = signal('');
  const query = toSignal(toObservable(rawQuery).pipe(rxDebounceTime(config.debounceTime ?? 300)), {
    initialValue: '',
  });

  const minQueryLength = config.minQueryLength ?? 0;
  const skipped = computed(() => query().trim().length < minQueryLength);

  const initialPage = config.initialPage ?? 1;
  // keyed off the debounced query, so the reset lands in the same tick the request re-runs
  const page = linkedSignal<string, number>({
    source: query,
    computation: () => initialPage,
  });

  const connect = <TSettled, TOption>(
    source: SelectOptionsPagingSource<TSettled, TOption>,
  ): SelectOptionsFromQuery<TOption> => {
    // `page` is read untracked: only a new settled result, never an in-flight page bump, appends
    const pageState = linkedSignal<TSettled, PageState<TOption>>({
      source: source.settled,
      computation: (settled, previous) => {
        const index = untracked(page) - initialPage;
        const slices = (previous?.value?.slices ?? []).slice(0, index);
        const nextSlice = source.toSlice(settled);

        if (nextSlice === null) {
          return { slices, ended: index === 0 ? false : (previous?.value?.ended ?? false) };
        }

        const ended = endsPagination(nextSlice, slices[index - 1]);

        if (!ended) {
          slices[index] = nextSlice;
        }

        return { slices, ended };
      },
    });

    // a `linkedSignal` only folds while observed; without this a page that settles while the panel
    // is closed is skipped, and the next page folds over a stale `previous`
    effect(() => void pageState());

    const hasMore = computed(() => !skipped() && !pageState().ended && source.hasMore(source.settled()));

    return {
      options: computed(() => (skipped() ? [] : pageState().slices.flat())),
      loading: source.loading,
      error: computed(() => {
        const error = source.error();

        if (error === null || skipped()) {
          return null;
        }

        return error ?? labels().error;
      }),
      hasMore,
      query,
      setQuery: (value: string) => rawQuery.set(value),
      loadMore: () => {
        if (skipped() || source.loading() || !hasMore()) {
          return;
        }

        page.update((current) => current + 1);
      },
    };
  };

  return { query, page, skipped, connect };
};
