import {
  CreateQueryExecuteOptions,
  InternalQueryExecute,
  QueryConfig,
  QueryDependencies,
  queryExecute,
  QueryState,
  RequestArgs,
  RouteType,
  shouldAutoExecuteGqlQuery,
} from '../http';
import { createSecureExecuteFactory } from '../http/secure-query-execute-factory';
import { GqlQueryArgs } from './gql-query';
import { AnyCreateGqlQueryCreatorOptions } from './gql-query-creator';
import { transformGql } from './gql-transformer';
import { InternalSecureCreateGqlQueryCreatorOptions } from './secure-gql-query-creator';

export type CreateSecureGqlQueryExecuteOptions<TArgs extends GqlQueryArgs> = {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator?: AnyCreateGqlQueryCreatorOptions;
  creatorInternals: InternalSecureCreateGqlQueryCreatorOptions;
  queryConfig: QueryConfig;
};

export const createSecureGqlExecuteFn = <TArgs extends GqlQueryArgs>(
  executeOptions: CreateSecureGqlQueryExecuteOptions<TArgs>,
): InternalQueryExecute<TArgs> => {
  const authProvider = executeOptions.creatorInternals.authProvider.inject();

  return createSecureExecuteFactory({
    authProvider,
    deps: executeOptions.deps,
    state: executeOptions.state,
    autoExecutes:
      shouldAutoExecuteGqlQuery(executeOptions.creatorInternals.method) &&
      !executeOptions.queryConfig.onlyManualExecution,
    transformAuthAndExec: (executeArgs, executeState) => {
      const { args, options: runOptions } = executeArgs ?? {};

      const query = transformGql(executeOptions.creatorInternals.query);
      let gqlParams = query(args?.variables);

      if (args?.queryParams && executeOptions.creatorInternals.transport === 'GET') {
        gqlParams = { ...gqlParams, ...args.queryParams };
      }

      const computedArgs = { ...(args ?? ({} as RequestArgs<TArgs>)) };

      if (executeOptions.creatorInternals.transport === 'GET') {
        computedArgs.queryParams = gqlParams;
      } else {
        computedArgs.body = gqlParams;
      }

      const normalizedOpts: CreateQueryExecuteOptions<TArgs> = {
        ...executeOptions,
        creatorInternals: {
          client: executeOptions.creatorInternals.client,
          method: executeOptions.creatorInternals.method === 'QUERY' ? 'GET' : 'POST',
          route: (executeOptions.creator?.route ?? '') as RouteType<TArgs>,
        },
      };

      queryExecute({
        executeOptions: normalizedOpts,
        executeState,
        args: computedArgs,
        options: runOptions,
        isSecure: true,
      });
    },
  });
};
