import { AnyLegacyQueryCreator } from '../interop';
import { AnyV2QueryCreator, QueryDataOf, V2QueryArgsOf } from '../query-creator';
import { InfinityQueryConfig, PageParamCalculatorOptions } from './infinity-query.types';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const createInfinityQueryConfig = <
  QueryCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator,
  Args extends V2QueryArgsOf<QueryCreator>,
  QueryResponse extends QueryDataOf<QueryCreator>,
  InfinityResponse extends unknown[],
>(
  config: InfinityQueryConfig<QueryCreator, Args, QueryResponse, InfinityResponse>,
) => config;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const skipPaginationPageParamCalculator = ({ page, itemsPerPage }: PageParamCalculatorOptions) =>
  itemsPerPage * (page - 1);
