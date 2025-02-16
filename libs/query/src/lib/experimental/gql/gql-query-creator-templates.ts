import { GQL } from '../../gql';
import { QueryClientConfig } from '../http';
import { GqlQueryArgs } from './gql-query';
import { CreateGqlQueryCreatorOptions, createGqlQueryCreator } from './gql-query-creator';

/** A query creator that creates a GQL query where the payload is sent via GET (query params) */
export const createGqlQueryViaGet = (client: QueryClientConfig) => {
  return <TArgs extends GqlQueryArgs>(query: GQL, creatorOptions?: CreateGqlQueryCreatorOptions<TArgs>) =>
    createGqlQueryCreator<TArgs>(creatorOptions, { method: 'QUERY', client, transport: 'GET', query });
};

/** A query creator that creates a GQL query where the payload is sent via POST (body) */
export const createGqlQueryViaPost = (client: QueryClientConfig) => {
  return <TArgs extends GqlQueryArgs>(query: GQL, creatorOptions?: CreateGqlQueryCreatorOptions<TArgs>) =>
    createGqlQueryCreator<TArgs>(creatorOptions, { method: 'QUERY', client, transport: 'POST', query });
};

/** A query creator that creates a GQL mutation where the payload is sent via GET (query params) */
export const createGqlMutationViaGet = (client: QueryClientConfig) => {
  return <TArgs extends GqlQueryArgs>(query: GQL, creatorOptions?: CreateGqlQueryCreatorOptions<TArgs>) =>
    createGqlQueryCreator<TArgs>(creatorOptions, { method: 'MUTATE', client, transport: 'GET', query });
};

/** A query creator that creates a GQL mutation where the payload is sent via POST (body) */
export const createGqlMutationViaPost = (client: QueryClientConfig) => {
  return <TArgs extends GqlQueryArgs>(query: GQL, creatorOptions?: CreateGqlQueryCreatorOptions<TArgs>) =>
    createGqlQueryCreator<TArgs>(creatorOptions, { method: 'MUTATE', client, transport: 'POST', query });
};
