import { AnyLegacyQueryCreator } from '../experimental';
import { AnyQueryCreator, QueryArgsOf, QueryDataOf } from '../query-creator';
import { InfinityQueryConfig, PageParamCalculatorOptions } from './infinity-query.types';

export const createInfinityQueryConfig = <
  QueryCreator extends AnyQueryCreator | AnyLegacyQueryCreator,
  Args extends QueryArgsOf<QueryCreator>,
  QueryResponse extends QueryDataOf<QueryCreator>,
  InfinityResponse extends unknown[],
>(
  config: InfinityQueryConfig<QueryCreator, Args, QueryResponse, InfinityResponse>,
) => config;

export const skipPaginationPageParamCalculator = ({ page, itemsPerPage }: PageParamCalculatorOptions) =>
  itemsPerPage * (page - 1);
