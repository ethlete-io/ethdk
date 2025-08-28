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
import { QueryKeyOrNone } from './query-repository';
import { QueryState } from './query-state';
import { circularQueryDependencyChecker } from './query-utils';

export type CreateQueryExecuteOptions<TArgs extends QueryArgs> = {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator?: CreateQueryCreatorOptions;
  creatorInternals: InternalCreateQueryCreatorOptions<TArgs>;
  queryConfig: QueryConfig;
};

export type QueryExecuteArgs<TArgs extends QueryArgs> = {
  args?: RequestArgs<TArgs> | null;
  options?: RunQueryExecuteOptions;
};

export type InternalQueryExecute<TArgs extends QueryArgs> = {
  (executeArgs?: QueryExecuteArgs<TArgs>): void;
  reset: () => void;
  currentRepositoryKey: Signal<QueryKeyOrNone>;
};

export type QueryExecute<TArgs extends QueryArgs> = (executeArgs?: QueryExecuteArgs<TArgs>) => void;

export const createExecuteFn = <TArgs extends QueryArgs>(
  executeOptions: CreateQueryExecuteOptions<TArgs>,
): InternalQueryExecute<TArgs> => {
  const executeState = setupQueryExecuteState();
  const circularChecker = circularQueryDependencyChecker();

  const reset = () => resetExecuteState({ executeState, executeOptions });

  const exec = (executeArgs?: QueryExecuteArgs<TArgs>) => {
    circularChecker.check();

    // Make sure all effects are flushed before reading the args.
    // A withArgs feature effect might still be pending otherwise resulting in the wrong args being read.
    executeOptions.deps.effectScheduler.flush();

    const { args = executeOptions.state.args(), options } = executeArgs ?? {};

    cleanupPreviousExecute({ executeOptions, executeState });
    queryExecute({ executeOptions, executeState, args, options });
  };

  exec['reset'] = reset;

  exec['currentRepositoryKey'] = executeState.previousKey.asReadonly();

  return exec;
};
