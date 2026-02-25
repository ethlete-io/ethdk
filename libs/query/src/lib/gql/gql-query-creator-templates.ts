import { AnyCreateBearerAuthProviderResult } from '../auth';
import { AnyCreateQueryClientResult } from '../http';
import { GqlQueryArgs } from './gql-query';
import {
  createGqlQueryCreator,
  CreateGqlQueryCreatorOptions,
  GqlQueryMethod,
  GqlQueryTransport,
} from './gql-query-creator';
import { GQL } from './gql-transformer';
import { createSecureGqlQueryCreator } from './secure-gql-query-creator';

const createGqlCreatorTemplate = (method: GqlQueryMethod, transport: GqlQueryTransport) => {
  return (client: AnyCreateQueryClientResult) => {
    return <TArgs extends GqlQueryArgs>(query: GQL, creatorOptions?: CreateGqlQueryCreatorOptions<TArgs>) =>
      createGqlQueryCreator<TArgs>(creatorOptions, {
        method,
        client,
        transport,
        query,
      });
  };
};

const createSecureGqlCreatorTemplate = (method: GqlQueryMethod, transport: GqlQueryTransport) => {
  return (client: AnyCreateQueryClientResult, authProvider: AnyCreateBearerAuthProviderResult) => {
    return <TArgs extends GqlQueryArgs>(query: GQL, creatorOptions?: CreateGqlQueryCreatorOptions<TArgs>) =>
      createSecureGqlQueryCreator<TArgs>(creatorOptions, {
        method,
        client,
        transport,
        query,
        authProvider,
      });
  };
};

/** A query creator that creates a GQL query where the payload is sent via GET (query params) */
export const createGqlQueryViaGet = createGqlCreatorTemplate('QUERY', 'GET');

/** A query creator that creates a secure GQL query where the payload is sent via GET (query params) */
export const createSecureGqlQueryViaGet = createSecureGqlCreatorTemplate('QUERY', 'GET');

/** A query creator that creates a GQL query where the payload is sent via POST (body) */
export const createGqlQueryViaPost = createGqlCreatorTemplate('QUERY', 'POST');

/** A query creator that creates a secure GQL query where the payload is sent via POST (body) */
export const createSecureGqlQueryViaPost = createSecureGqlCreatorTemplate('QUERY', 'POST');

/** A query creator that creates a GQL mutation where the payload is sent via GET (query params) */
export const createGqlMutationViaGet = createGqlCreatorTemplate('MUTATE', 'GET');

/** A query creator that creates a secure GQL mutation where the payload is sent via GET (query params) */
export const createSecureGqlMutationViaGet = createSecureGqlCreatorTemplate('MUTATE', 'GET');

/** A query creator that creates a GQL mutation where the payload is sent via POST (body) */
export const createGqlMutationViaPost = createGqlCreatorTemplate('MUTATE', 'POST');

/** A query creator that creates a secure GQL mutation where the payload is sent via POST (body) */
export const createSecureGqlMutationViaPost = createSecureGqlCreatorTemplate('MUTATE', 'POST');
