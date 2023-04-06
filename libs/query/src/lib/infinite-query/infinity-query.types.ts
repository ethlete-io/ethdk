import { BaseArguments, QueryStateData } from '../query';
import { AnyQueryCreator, QueryCreatorArgs, QueryCreatorResponse, QueryCreatorReturnType } from '../query-creator';
import { InfinityQuery } from './infinity-query';

export type InfinityQueryParamLocation = 'path' | 'query' | 'body' | 'header' | 'variable';

export type AppendItemsLocation = 'start' | 'end';

export interface PageParamCalculatorOptions {
  page: number;
  totalPages: number | null;
  itemsPerPage: number;
}

export interface TotalPagesExtractorOptions<QueryResponse> {
  response: QueryResponse;
  itemsPerPage: number;
}

export interface InfinityQueryConfig<
  QueryCreator extends AnyQueryCreator,
  Arguments extends BaseArguments | undefined,
  QueryResponse,
  InfinityResponse extends unknown[],
> {
  /**
   * The query creator to use for fetching pages.
   */
  queryCreator: QueryCreator;

  /**
   * The args that will be merged with the page arg.
   */
  defaultArgs?: Arguments;

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
    valueExtractor: (response: QueryResponse) => InfinityResponse;

    /**
     * The property in the response that contains the total page count.
     *
     * @default "totalPages"
     */
    totalPagesExtractor?: (data: TotalPagesExtractorOptions<QueryResponse>) => number;
  };
}

type OmitUndefined<T> = T extends undefined ? never : T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyInfinityQueryConfig = InfinityQueryConfig<any, any, any, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyInfinityQuery = InfinityQuery<any, any, any, any, any>;

export type InfinityQueryConfigType<
  QueryCreator extends AnyQueryCreator,
  InfinityResponse extends unknown[],
> = InfinityQueryConfig<
  QueryCreator,
  OmitUndefined<QueryCreatorArgs<QueryCreator>>,
  QueryStateData<QueryCreatorReturnType<QueryCreator>['state']>,
  InfinityResponse
>;

export type InfinityQueryOf<Cfg extends AnyInfinityQueryConfig> = InfinityQuery<
  Cfg['queryCreator'],
  QueryCreatorReturnType<Cfg['queryCreator']>,
  QueryCreatorArgs<Cfg['queryCreator']>,
  QueryCreatorResponse<Cfg['queryCreator']>,
  Cfg['response']['arrayType']
>;
