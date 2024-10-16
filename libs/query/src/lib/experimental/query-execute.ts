import { Signal } from '@angular/core';
import { QueryArgs, RequestArgs } from './query';
import { CreateQueryCreatorOptions, InternalCreateQueryCreatorOptions, QueryConfig } from './query-creator';
import { QueryDependencies } from './query-dependencies';
import {
  cleanupPreviousExecute,
  queryExecute,
  resetExecuteState,
  RunQueryExecuteOptions,
  setupQueryExecuteState,
} from './query-execute-utils';
import { QueryState } from './query-state';

export type CreateQueryExecuteOptions<TArgs extends QueryArgs> = {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator: CreateQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateQueryCreatorOptions;
  queryConfig: QueryConfig;
};

export type QueryExecuteArgs<TArgs extends QueryArgs> = {
  args?: RequestArgs<TArgs> | null;
  options?: RunQueryExecuteOptions;
};

export type QueryExecute<TArgs extends QueryArgs> = {
  (executeArgs?: QueryExecuteArgs<TArgs>): void;
  reset: () => void;
  currentRepositoryKey: Signal<string | false>;
};

export const createExecuteFn = <TArgs extends QueryArgs>(
  executeOptions: CreateQueryExecuteOptions<TArgs>,
): QueryExecute<TArgs> => {
  const executeState = setupQueryExecuteState();

  const reset = () => resetExecuteState({ executeState, executeOptions });

  const exec = (executeArgs?: QueryExecuteArgs<TArgs>) => {
    const { args = executeOptions.state.args(), options } = executeArgs ?? {};
    cleanupPreviousExecute({ executeOptions, executeState });
    queryExecute({ executeOptions, executeState, args, options });
  };

  exec['reset'] = reset;

  exec['currentRepositoryKey'] = executeState.previousKey.asReadonly();

  return exec;
};
