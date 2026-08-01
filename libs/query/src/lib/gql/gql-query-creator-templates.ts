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
export const createGqlQueryViaGet = /* @__PURE__ */ createGqlCreatorTemplate('QUERY', 'GET');

/** A query creator that creates a secure GQL query where the payload is sent via GET (query params) */
export const createSecureGqlQueryViaGet = /* @__PURE__ */ createSecureGqlCreatorTemplate('QUERY', 'GET');

/** A query creator that creates a GQL query where the payload is sent via POST (body) */
export const createGqlQueryViaPost = /* @__PURE__ */ createGqlCreatorTemplate('QUERY', 'POST');

/** A query creator that creates a secure GQL query where the payload is sent via POST (body) */
export const createSecureGqlQueryViaPost = /* @__PURE__ */ createSecureGqlCreatorTemplate('QUERY', 'POST');

/** A query creator that creates a GQL mutation where the payload is sent via GET (query params) */
export const createGqlMutationViaGet = /* @__PURE__ */ createGqlCreatorTemplate('MUTATE', 'GET');

/** A query creator that creates a secure GQL mutation where the payload is sent via GET (query params) */
export const createSecureGqlMutationViaGet = /* @__PURE__ */ createSecureGqlCreatorTemplate('MUTATE', 'GET');

/** A query creator that creates a GQL mutation where the payload is sent via POST (body) */
export const createGqlMutationViaPost = /* @__PURE__ */ createGqlCreatorTemplate('MUTATE', 'POST');

/** A query creator that creates a secure GQL mutation where the payload is sent via POST (body) */
export const createSecureGqlMutationViaPost = /* @__PURE__ */ createSecureGqlCreatorTemplate('MUTATE', 'POST');
