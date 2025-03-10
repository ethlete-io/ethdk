import { transformGql } from '../../gql';
import {
  circularQueryDependencyChecker,
  cleanupPreviousExecute,
  CreateQueryExecuteOptions,
  InternalQueryExecute,
  QueryArgs,
  QueryConfig,
  QueryDependencies,
  queryExecute,
  QueryExecuteArgs,
  QueryState,
  RequestArgs,
  resetExecuteState,
  RouteType,
  setupQueryExecuteState,
} from '../http';
import { GqlQueryArgs } from './gql-query';
import { CreateGqlQueryCreatorOptions, InternalCreateGqlQueryCreatorOptions } from './gql-query-creator';

export type CreateGqlQueryExecuteOptions<TArgs extends QueryArgs> = {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator?: CreateGqlQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateGqlQueryCreatorOptions;
  queryConfig: QueryConfig;
};

export const createGqlExecuteFn = <TArgs extends GqlQueryArgs>(
  executeOptions: CreateGqlQueryExecuteOptions<TArgs>,
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

    // TODO: This should get cleaned up
    const tpl = executeOptions.creatorInternals.query;
    const query = transformGql(tpl);
    let gqlParams = query(args?.variables);

    if (args?.queryParams && executeOptions.creatorInternals.transport === 'GET') {
      gqlParams = { ...gqlParams, ...args.queryParams };
    }

    const computedArgs = args ?? ({} as RequestArgs<TArgs>);

    if (executeOptions.creatorInternals.transport === 'GET') {
      computedArgs.queryParams = gqlParams;
    } else {
      computedArgs.body = gqlParams;
    }

    const normalizedOpts: CreateQueryExecuteOptions<TArgs> = {
      creator: executeOptions.creator ?? {},
      creatorInternals: {
        client: executeOptions.creatorInternals.client,
        method: executeOptions.creatorInternals.transport,
        route: (executeOptions.creator?.route ?? '') as RouteType<TArgs>,
      },
      deps: executeOptions.deps,
      queryConfig: executeOptions.queryConfig,
      state: executeOptions.state,
    };

    queryExecute({
      executeOptions: normalizedOpts,
      executeState,
      args: computedArgs,
      options,
      internalOptions: {
        useQueryRepositoryCache: executeOptions.creatorInternals.method === 'QUERY',
        forceJsonStringifyInQueryParams: executeOptions.creatorInternals.method === 'QUERY',
      },
      transformResponse: (originalResponse) => {
        if (originalResponse && 'data' in originalResponse) {
          return originalResponse.data;
        }

        return originalResponse;
      },
    });
  };

  exec['reset'] = reset;

  exec['currentRepositoryKey'] = executeState.previousKey.asReadonly();

  return exec;
};
