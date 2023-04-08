import { AnyQueryCreator, QueryArgsOf, QueryResponseOf } from '../query-creator';
import { InfinityQueryConfig, PageParamCalculatorOptions } from './infinity-query.types';

export const createInfinityQueryConfig = <
  QueryCreator extends AnyQueryCreator,
  Args extends QueryArgsOf<QueryCreator>,
  QueryResponse extends QueryResponseOf<QueryCreator>,
  InfinityResponse extends unknown[],
>(
  config: InfinityQueryConfig<QueryCreator, Args, QueryResponse, InfinityResponse>,
) => config;

export const skipPaginationPageParamCalculator = ({ page, itemsPerPage }: PageParamCalculatorOptions) =>
  itemsPerPage * (page - 1);
