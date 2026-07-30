import { Signal, computed } from '@angular/core';
import { AnyQueryCreator, QueryArgsOf, RequestArgs, ResponseType, withArgs } from '@ethlete/query';
import { FilterOverlayPreview } from './filter-overlay.types';

/**
 * The usual live preview: one query, re-executed as the draft filters change, whose response says how many
 * results they would return.
 *
 * A factory of a factory, because the query has to be created in the overlay's injection context — which only
 * exists once the overlay is open. Pass the result as the config's `preview`; the filter overlay calls it with
 * its draft value.
 *
 * Debouncing is the query form's job, not this one's: the branch's value is already the debounced one where a
 * field asked for it, so typing in a search box does not fire a request per keystroke.
 *
 * @example
 * providers: [
 *   provideFilterOverlay({
 *     queryForm: filters,
 *     preview: filterOverlayPreviewFromQuery({
 *       queryCreator: searchTeams,
 *       args: (value) => ({ queryParams: { ...value, limit: 1 } }),
 *       toTotalHits: (response) => response.totalHits,
 *     }),
 *   }),
 * ]
 */
export const filterOverlayPreviewFromQuery =
  <TCreator extends AnyQueryCreator, TValue>(config: {
    /** The query creator to run. Created once, then re-executed as the draft changes. */
    queryCreator: TCreator;
    /**
     * Builds the request args from the draft value. Return `null` to skip the request — for a draft that is not
     * yet worth counting. Ask for as few rows as the endpoint allows: only the total is used.
     */
    args: (value: TValue) => RequestArgs<QueryArgsOf<TCreator>> | null;
    /** Pulls the total out of the response. @default `response.totalHits` */
    toTotalHits?: (response: ResponseType<QueryArgsOf<TCreator>>) => number;
  }) =>
  (draftValue: Signal<TValue>): FilterOverlayPreview => {
    const query = config.queryCreator(withArgs<QueryArgsOf<TCreator>>(() => config.args(draftValue()) ?? null));

    const totalHits = computed(() => {
      const response = query.response();

      if (response === null || response === undefined) return null;

      if (config.toTotalHits) return config.toTotalHits(response);

      if (typeof response !== 'object' || !('totalHits' in response)) {
        if (ngDevMode) {
          console.error(
            '[filterOverlayPreviewFromQuery] The response has no `totalHits` property, so the result count ' +
              'cannot be read. Pass `toTotalHits` to say where it is.',
            response,
          );
        }

        return null;
      }

      return response.totalHits as number;
    });

    return {
      loading: computed(() => query.loading() !== null),
      hasError: computed(() => query.error() !== null),
      totalHits,
    };
  };
