import { transformGql } from '../../gql';
import { QueryArgs, RequestArgs } from '../query';
import { QueryConfig, RouteType } from '../query-creator';
import { QueryDependencies } from '../query-dependencies';
import { CreateQueryExecuteOptions, InternalQueryExecute, QueryExecuteArgs } from '../query-execute';
import {
  cleanupPreviousExecute,
  queryExecute,
  resetExecuteState,
  setupQueryExecuteState,
} from '../query-execute-utils';
import { QueryState } from '../query-state';
import { GqlQueryArgs } from './gql-query';
import { CreateGqlQueryCreatorOptions, InternalCreateGqlQueryCreatorOptions } from './gql-query-creator';

export type CreateGqlQueryExecuteOptions<TArgs extends QueryArgs> = {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator: CreateGqlQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateGqlQueryCreatorOptions;
  queryConfig: QueryConfig;
};

export const createGqlExecuteFn = <TArgs extends GqlQueryArgs>(
  executeOptions: CreateGqlQueryExecuteOptions<TArgs>,
): InternalQueryExecute<TArgs> => {
  const executeState = setupQueryExecuteState();

  const reset = () => resetExecuteState({ executeState, executeOptions });

  const exec = (executeArgs?: QueryExecuteArgs<TArgs>) => {
    const { args = executeOptions.state.args(), options } = executeArgs ?? {};
    cleanupPreviousExecute({ executeOptions, executeState });

    // TODO: This should get cleaned up
    const tpl = executeOptions.creator.query;
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
      creator: {
        route: (executeOptions.creator.route ?? '') as RouteType<TArgs>,
      },
      creatorInternals: {
        client: executeOptions.creatorInternals.client,
        method: executeOptions.creatorInternals.transport,
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
