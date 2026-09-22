import { shouldAutoExecuteQuery } from './base-query-factory';
import { QueryArgs } from './query';
import { CreateQueryExecuteOptions, InternalQueryExecute } from './query-execute';
import { queryExecute } from './query-execute-utils';
import { InternalSecureCreateQueryCreatorOptions } from './secure-query-creator';
import { createSecureExecuteFactory } from './secure-query-execute-factory';

export type CreateSecureQueryExecuteOptions<TArgs extends QueryArgs> = Omit<
  CreateQueryExecuteOptions<TArgs>,
  'creatorInternals'
> & {
  creatorInternals: InternalSecureCreateQueryCreatorOptions<TArgs>;
};

export const createSecureExecuteFn = <TArgs extends QueryArgs>(
  executeOptions: CreateSecureQueryExecuteOptions<TArgs>,
): InternalQueryExecute<TArgs> => {
  const authProvider = executeOptions.creatorInternals.authProvider.inject();

  return createSecureExecuteFactory({
    authProvider,
    deps: executeOptions.deps,
    state: executeOptions.state,
    autoExecutes:
      shouldAutoExecuteQuery(executeOptions.creatorInternals.method) && !executeOptions.queryConfig.onlyManualExecution,
    transformAuthAndExec: (executeArgs, executeState) => {
      queryExecute({
        executeOptions: executeOptions,
        executeState,
        args: executeArgs.args,
        options: executeArgs.options,
        isSecure: true,
      });
    },
  });
};
