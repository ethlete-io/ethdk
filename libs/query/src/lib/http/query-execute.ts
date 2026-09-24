import { Signal, untracked } from '@angular/core';
import { Observable } from 'rxjs';
import { createQueryExecutionAborter } from './internal/query-execution-aborter';
import { QueryArgs, RequestArgs } from './query';
import { CreateQueryCreatorOptions, InternalCreateQueryCreatorOptions, QueryConfig } from './query-creator';
import { QueryDependencies } from './query-dependencies';
import {
  circularQueryDependencyChecker,
  queryExecute,
  resetExecuteState,
  RunQueryExecuteOptions,
  setupQueryExecuteState,
} from './query-execute-utils';
import { QueryKey } from './query-repository';
import { QueryState } from './query-state';

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
  abort: () => boolean;
  aborted$: Observable<void>;
  currentRepositoryKey: Signal<QueryKey | null>;
};

export type QueryExecute<TArgs extends QueryArgs> = (executeArgs?: QueryExecuteArgs<TArgs>) => void;

export const createExecuteFn = <TArgs extends QueryArgs>(
  executeOptions: CreateQueryExecuteOptions<TArgs>,
): InternalQueryExecute<TArgs> => {
  const executeState = setupQueryExecuteState();
  const circularChecker = circularQueryDependencyChecker();
  const aborter = createQueryExecutionAborter(executeOptions.state);

  const reset = () => untracked(() => resetExecuteState({ executeState, executeOptions }));

  const exec = (executeArgs?: QueryExecuteArgs<TArgs>) =>
    untracked(() => {
      const { args = executeOptions.state.args(), options } = executeArgs ?? {};

      circularChecker.check(args);

      aborter.capture();
      queryExecute({ executeOptions, executeState, args, options });
    });

  exec['reset'] = reset;
  exec['abort'] = () => aborter.abort();
  exec['aborted$'] = aborter.aborted$;

  exec['currentRepositoryKey'] = executeState.previousKey.asReadonly();

  return exec;
};
