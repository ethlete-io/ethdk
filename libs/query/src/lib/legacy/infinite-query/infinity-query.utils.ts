import { AnyLegacyQueryCreator } from '../interop';
import { AnyV2QueryCreator, QueryDataOf, V2QueryArgsOf } from '../query-creator';
import { InfinityQueryConfig, PageParamCalculatorOptions } from './infinity-query.types';

export const createInfinityQueryConfig = <
  QueryCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator,
  Args extends V2QueryArgsOf<QueryCreator>,
  QueryResponse extends QueryDataOf<QueryCreator>,
  InfinityResponse extends unknown[],
>(
  config: InfinityQueryConfig<QueryCreator, Args, QueryResponse, InfinityResponse>,
) => config;

export const skipPaginationPageParamCalculator = ({ page, itemsPerPage }: PageParamCalculatorOptions) =>
  itemsPerPage * (page - 1);
