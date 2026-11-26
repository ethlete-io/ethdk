import { Injector } from '@angular/core';
import { AnyLegacyQueryCreator } from '../interop';
import { BaseArguments, WithHeaders } from '../query';
import { AnyV2QueryCreator, ConstructQuery, QueryDataOf, V2QueryArgsOf } from '../query-creator';
import { InfinityQuery } from './infinity-query';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type InfinityQueryParamLocation = 'path' | 'query' | 'body' | 'header' | 'variable';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type AppendItemsLocation = 'start' | 'end';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type PageParamCalculatorOptions = {
  page: number;
  totalPages: number | null;
  itemsPerPage: number;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type TotalPagesExtractorOptions<Arguments extends BaseArguments | undefined, QueryResponse> = {
  response: QueryResponse;
  itemsPerPage: number;
  args: Arguments;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type InfinityQueryConfig<
  QueryCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator,
  Arguments extends BaseArguments | undefined,
  QueryResponse,
  InfinityResponse extends unknown[],
> = {
  /**
   * The query creator to use for fetching pages.
   */
  queryCreator: QueryCreator;

  /**
   * The interval in milliseconds to poll on. If not provided, polling will be disabled.
   * @default undefined
   */
  pollingInterval?: number;

  /**
   * The args that will be merged with the page arg.
   */
  defaultArgs?: Arguments & WithHeaders;

  /**
   * The injector each page is prepared with. Required for a creator made by `createLegacyQueryCreator()`, which
   * cannot resolve one on its own. `[etInfinityQuery]` fills this in with its own injector.
   */
  injector?: Injector;

  /**
   * Enables or disables the infinite query functionality.
   * @default true
   */
  enabled?: boolean;

  pageParam?: {
    /**
     * The location where the page param is in request.
     *
     * @default "query"
     */
    location?: InfinityQueryParamLocation;

    /**
     * Used as page param name.
     *
     * @default "page"
     */
    key?: string;

    /**
     * A function that calculates the page value for the next request.
     * E.g. if the pagination is done with a `skip` param, the `pageParamName` should be `skip` and this function should return the correct value.
     */
    valueCalculator?: (data: PageParamCalculatorOptions) => number;
  };

  limitParam?: {
    /**
     * The location where the limit param is in request.
     *
     * @default "query"
     */
    location?: InfinityQueryParamLocation;

    /**
     * Used as limit param name.
     *
     * @default "limit"
     */
    key?: string;

    /**
     * The value of the limit param.
     *
     * @default 10
     */
    value?: number;
  };

  response: {
    /**
     * Determines if the response should get reversed before appending to the data array.
     *
     * @default false
     */
    reverse?: boolean;

    /**
     * Determines where to put the new items in the data array.
     *
     * @default "end"
     */
    appendItemsTo?: AppendItemsLocation;

    /**
     * The type of the array that will be created by the infinite query.
     */
    arrayType: InfinityResponse;

    /**
     * A function that returns the data array from the response.
     * This function should return the type provided in `responseArrayType`.
     */
    valueExtractor?: (response: QueryResponse) => InfinityResponse;

    /**
     * The property in the response that contains the total page count.
     *
     * @default "totalPages"
     */
    totalPagesExtractor?: (
      data: TotalPagesExtractorOptions<V2QueryArgsOf<QueryCreator> & WithHeaders, QueryResponse>,
    ) => number;
  };
};

type OmitUndefined<T> = T extends undefined ? never : T;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyInfinityQueryConfig = InfinityQueryConfig<any, any, any, any>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyInfinityQuery = InfinityQuery<any, any, any, any, any>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type InfinityQueryConfigType<
  QueryCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator,
  InfinityResponse extends unknown[],
> = InfinityQueryConfig<
  QueryCreator,
  OmitUndefined<V2QueryArgsOf<QueryCreator>>,
  QueryDataOf<QueryCreator>,
  InfinityResponse
>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type InfinityQueryOf<Cfg extends AnyInfinityQueryConfig | null> = InfinityQuery<
  NonNullable<Cfg>['queryCreator'],
  ConstructQuery<NonNullable<Cfg>['queryCreator']>,
  V2QueryArgsOf<NonNullable<Cfg>['queryCreator']>,
  QueryDataOf<NonNullable<Cfg>['queryCreator']>,
  NonNullable<Cfg>['response']['arrayType']
>;
