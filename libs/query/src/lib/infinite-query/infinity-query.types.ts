import { AnyLegacyQueryCreator } from '../experimental';
import { BaseArguments, WithHeaders } from '../query';
import { AnyQueryCreator, ConstructQuery, QueryArgsOf, QueryDataOf } from '../query-creator';
import { InfinityQuery } from './infinity-query';

export type InfinityQueryParamLocation = 'path' | 'query' | 'body' | 'header' | 'variable';

export type AppendItemsLocation = 'start' | 'end';

export interface PageParamCalculatorOptions {
  page: number;
  totalPages: number | null;
  itemsPerPage: number;
}

export interface TotalPagesExtractorOptions<Arguments extends BaseArguments | undefined, QueryResponse> {
  response: QueryResponse;
  itemsPerPage: number;
  args: Arguments;
}

export interface InfinityQueryConfig<
  QueryCreator extends AnyQueryCreator | AnyLegacyQueryCreator,
  Arguments extends BaseArguments | undefined,
  QueryResponse,
  InfinityResponse extends unknown[],
> {
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
      data: TotalPagesExtractorOptions<QueryArgsOf<QueryCreator> & WithHeaders, QueryResponse>,
    ) => number;
  };
}

type OmitUndefined<T> = T extends undefined ? never : T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyInfinityQueryConfig = InfinityQueryConfig<any, any, any, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyInfinityQuery = InfinityQuery<any, any, any, any, any>;

export type InfinityQueryConfigType<
  QueryCreator extends AnyQueryCreator | AnyLegacyQueryCreator,
  InfinityResponse extends unknown[],
> = InfinityQueryConfig<
  QueryCreator,
  OmitUndefined<QueryArgsOf<QueryCreator>>,
  QueryDataOf<QueryCreator>,
  InfinityResponse
>;

export type InfinityQueryOf<Cfg extends AnyInfinityQueryConfig | null> = InfinityQuery<
  NonNullable<Cfg>['queryCreator'],
  ConstructQuery<NonNullable<Cfg>['queryCreator']>,
  QueryArgsOf<NonNullable<Cfg>['queryCreator']>,
  QueryDataOf<NonNullable<Cfg>['queryCreator']>,
  NonNullable<Cfg>['response']['arrayType']
>;
