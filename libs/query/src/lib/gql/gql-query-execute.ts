import {
  circularQueryDependencyChecker,
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
import { createQueryExecutionAborter } from '../http/internal/query-execution-aborter';
import { GqlQueryArgs } from './gql-query';
import { AnyCreateGqlQueryCreatorOptions, InternalCreateGqlQueryCreatorOptions } from './gql-query-creator';
import { gqlTransformerFor } from './gql-transformer';

export type CreateGqlQueryExecuteOptions<TArgs extends QueryArgs> = {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator?: AnyCreateGqlQueryCreatorOptions;
  creatorInternals: InternalCreateGqlQueryCreatorOptions;
  queryConfig: QueryConfig;
};

/** @internal */
export const createGqlExecuteFn = <TArgs extends GqlQueryArgs>(
  executeOptions: CreateGqlQueryExecuteOptions<TArgs>,
): InternalQueryExecute<TArgs> => {
  const executeState = setupQueryExecuteState();
  const circularChecker = circularQueryDependencyChecker();
  const aborter = createQueryExecutionAborter(executeOptions.state);

  const reset = () => resetExecuteState({ executeState, executeOptions });

  const exec = (executeArgs?: QueryExecuteArgs<TArgs>) => {
    const { args = executeOptions.state.args(), options } = executeArgs ?? {};

    circularChecker.check(args);

    let gqlParams = gqlTransformerFor(executeOptions.creatorInternals)(
      args?.variables,
      executeOptions.creatorInternals.transport,
    );

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
      creator: {
        ...(executeOptions.creator ?? {}),
        subtle: {
          ...(executeOptions.creator?.subtle ?? {}),
          useQueryRepositoryCache:
            executeOptions.creator?.subtle?.useQueryRepositoryCache ??
            executeOptions.creatorInternals.method === 'QUERY',
        },
      },
      creatorInternals: {
        client: executeOptions.creatorInternals.client,
        method: executeOptions.creatorInternals.transport,
        route: (executeOptions.creator?.route ?? '') as RouteType<TArgs>,
      },
      deps: executeOptions.deps,
      queryConfig: executeOptions.queryConfig,
      state: executeOptions.state,
    };

    aborter.capture();
    queryExecute({
      executeOptions: normalizedOpts,
      executeState,
      args: computedArgs,
      options,
      isRefreshable: executeOptions.creatorInternals.method === 'QUERY',
    });
  };

  exec['reset'] = reset;
  exec['abort'] = () => aborter.abort();
  exec['aborted$'] = aborter.aborted$;

  exec['currentRepositoryKey'] = executeState.previousKey.asReadonly();

  return exec;
};
