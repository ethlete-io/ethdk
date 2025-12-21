import { AnyQueryClient } from '../http';
import { GqlQueryArgs } from './gql-query';
import {
  createGqlQueryCreator,
  CreateGqlQueryCreatorOptions,
  GqlQueryMethod,
  GqlQueryTransport,
} from './gql-query-creator';
import { GQL } from './gql-transformer';

const createGqlCreatorTemplate = (method: GqlQueryMethod, transport: GqlQueryTransport) => {
  return (client: AnyQueryClient) => {
    return <TArgs extends GqlQueryArgs>(query: GQL, creatorOptions?: CreateGqlQueryCreatorOptions<TArgs>) =>
      createGqlQueryCreator<TArgs>(creatorOptions, { method, client, transport, query });
  };
};

/** A query creator that creates a GQL query where the payload is sent via GET (query params) */
export const createGqlQueryViaGet = createGqlCreatorTemplate('QUERY', 'GET');

/** A query creator that creates a GQL query where the payload is sent via POST (body) */
export const createGqlQueryViaPost = createGqlCreatorTemplate('QUERY', 'POST');

/** A query creator that creates a GQL mutation where the payload is sent via GET (query params) */
export const createGqlMutationViaGet = createGqlCreatorTemplate('MUTATE', 'GET');

/** A query creator that creates a GQL mutation where the payload is sent via POST (body) */
export const createGqlMutationViaPost = createGqlCreatorTemplate('MUTATE', 'POST');
