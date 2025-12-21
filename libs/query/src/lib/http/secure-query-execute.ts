import { QueryArgs, RequestArgs } from './query';
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
  const [, injectAuthProvider] = executeOptions.creatorInternals.authProvider;
  const authProvider = injectAuthProvider();

  return createSecureExecuteFactory({
    authProvider: {
      tokens: authProvider.tokens,
      latestExecutedQuery: authProvider.latestExecutedQuery,
    },
    deps: executeOptions.deps,
    state: executeOptions.state,
    transformAuthAndExec: (executeArgs, _tokens, headers, executeState) => {
      const { options: runOptions } = executeArgs ?? {};
      const updatedArgs = { ...(executeArgs?.args ?? ({} as RequestArgs<TArgs>)), headers };

      queryExecute({
        executeOptions: executeOptions,
        executeState,
        args: updatedArgs,
        options: runOptions,
        isSecure: true,
      });
    },
  });
};
