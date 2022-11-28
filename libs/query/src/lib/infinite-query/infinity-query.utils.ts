import { QueryStateData } from '../query';
import { AnyQueryCreator, QueryCreatorArgs, QueryCreatorReturnType } from '../query-client';
import { InfinityQueryConfig, PageParamCalculatorOptions } from './infinity-query.types';

export const createInfinityQueryConfig = <
  QueryCreator extends AnyQueryCreator,
  Query extends QueryCreatorReturnType<QueryCreator>,
  Args extends QueryCreatorArgs<QueryCreator>,
  QueryResponse extends QueryStateData<Query['state']>,
  InfinityResponse extends unknown[],
>(
  config: InfinityQueryConfig<QueryCreator, Args, QueryResponse, InfinityResponse>,
) => config;

export const skipPaginationPageParamCalculator = ({ page, itemsPerPage }: PageParamCalculatorOptions) =>
  itemsPerPage * (page - 1);
