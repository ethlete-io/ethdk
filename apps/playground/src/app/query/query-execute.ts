import { QueryArgs, RequestArgs } from './query';
import { CreateQueryCreatorOptions, InternalCreateQueryCreatorOptions, QueryConfig } from './query-creator';
import { QueryDependencies } from './query-dependencies';
import { cleanupPreviousExecute, queryExecute, resetExecuteState, setupQueryExecuteState } from './query-execute-utils';
import { QueryState } from './query-state';

export type CreateQueryExecuteOptions<TArgs extends QueryArgs> = {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator: CreateQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateQueryCreatorOptions;
  queryConfig: QueryConfig;
};

export type QueryExecute<TArgs extends QueryArgs> = {
  (args?: RequestArgs<TArgs> | null): void;
  reset: () => void;
};

export const createExecuteFn = <TArgs extends QueryArgs>(
  options: CreateQueryExecuteOptions<TArgs>,
): QueryExecute<TArgs> => {
  const executeState = setupQueryExecuteState();

  const reset = () => resetExecuteState({ executeState, executeOptions: options });

  const exec = (args = options.state.args()) => {
    cleanupPreviousExecute({ executeOptions: options, executeState, args });
    queryExecute({ executeOptions: options, executeState, args });
  };

  exec['reset'] = reset;

  return exec;
};
