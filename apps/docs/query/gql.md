# GraphQL queries

A thin GraphQL layer over the [query fundamentals](/query/queries) - same client, same query object, same [caching repository](/query/caching). A GraphQL endpoint is just one route on a [query client](/query/queries#the-query-client); the GQL creators handle serializing the document + variables and unwrapping the `{ data }` envelope.

```ts
import { createGqlQueryViaPost, createQueryClient, gql, withArgs } from '@ethlete/query';

const client = createQueryClient({ name: 'gql', baseUrl: 'https://api.example.com/graphql' });

const gqlQueryPost = createGqlQueryViaPost(client);

type GetUserQueryArgs = {
  response: { user: { id: string; name: string } };
  variables: { userId: string };
};

export const getUser = gqlQueryPost<GetUserQueryArgs>(gql`
  query GetUser($userId: ID!) {
    user(id: $userId) {
      id
      name
    }
  }
`);
```

```ts
// In a component - variables are just query args
userQuery = getUser(withArgs(() => ({ variables: { userId: this.userId() } })));

user = computed(() => this.userQuery.response()?.user ?? null);
```

The `gql` tag is a branded template literal - no parsing happens at runtime. The operation name is extracted for the request, and in production builds the document is minified (`#` comments dropped, whitespace outside string literals collapsed); in dev mode it stays pretty-printed for readable network tabs.

## Creator templates

Two orthogonal axes: the **operation kind** (`Query` vs `Mutation`) and the **HTTP transport** (`Get` vs `Post`).

| Template                         | Kind     | Transport | Cached by default |
| -------------------------------- | -------- | --------- | ----------------- |
| `createGqlQueryViaGet`           | query    | GET       | yes               |
| `createGqlQueryViaPost`          | query    | POST      | yes               |
| `createGqlMutationViaGet`        | mutation | GET       | no                |
| `createGqlMutationViaPost`       | mutation | POST      | no                |
| `createSecureGqlQueryViaGet`     | query    | GET       | yes               |
| `createSecureGqlQueryViaPost`    | query    | POST      | yes               |
| `createSecureGqlMutationViaGet`  | mutation | GET       | no                |
| `createSecureGqlMutationViaPost` | mutation | POST      | no                |

::: info Kind ≠ transport
The operation kind controls **caching**: queries are cached/deduplicated in the repository, mutations are not - even a query sent via POST is cached (its cache key hashes the body). The transport only controls **how the payload travels**: via GET the `query`, `variables` and `operationName` become URL query params (CDN/proxy-cache friendly), with `variables` as a JSON string because a query param is always a string; via POST the same three go into the JSON request body, with `variables` as an object - what the GraphQL-over-HTTP specification requires.
:::

The `Secure…` variants take `(client, authProviderRef)` and behave like [secure HTTP queries](/query/auth) (token gating, `Authorization` header, refresh-and-retry on 401). Their transport suffix controls the HTTP method exactly like the non-secure variants.

## Typing & args

GQL args extend the core `QueryArgs` with a `variables` bag:

| Field         | Description                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `response`    | The unwrapped data type - what `query.response()` returns.                                                                                                  |
| `variables`   | GraphQL variables, passed via `withArgs` / `execute` - a JSON string query param via GET, a JSON object in the body via POST.                               |
| `rawResponse` | The envelope on the wire - what `transformResponse` receives. Defaults to `{ data: TResponse }`; declare it only when your endpoint returns something else. |

**Response unwrapping:** by default the `{ data }` envelope is stripped automatically. A `200` without a `data` property (a GraphQL errors payload) is a `failure`: `error()` carries the `ET600` error with code `0`, in every build - see [a `transformResponse` that throws](/query/errors#a-transformresponse-that-throws). Supplying your own `transformResponse` replaces this default:

```ts
const getUserName = gqlQueryPost<GetUserNameQueryArgs>(gqlDocument, {
  transformResponse: (raw) => raw.data.user.name,
});
```

An endpoint behind a gateway that wraps the envelope differently declares it as `rawResponse` - the default unwrapping only reads `data`, so such a query needs its own `transformResponse`:

```ts
type GetUserQueryArgs = {
  response: { user: { id: string; name: string } };
  rawResponse: { payload: { user: { id: string; name: string } } };
};

const getUser = gqlQueryPost<GetUserQueryArgs>(gqlDocument, {
  transformResponse: (raw) => raw.payload,
});
```

Creator options are otherwise the [HTTP creator options](/query/http#creator-options); `route` is optional (the client's `baseUrl` usually is the GraphQL endpoint already).

Everything else works exactly as described in the core guides, since GQL queries are regular queries underneath - [features](/query/features) like `withPolling`, [query stacks](/query/stacks) and [error handling](/query/errors).

## Types

A GQL creator's `TArgs` is a `GqlQueryArgs` - the core [`QueryArgs`](/query/queries#types) plus
`variables` - and `GqlVariablesType<TArgs>` extracts that bag the way `ResponseType` extracts the
response. `GqlRawResponseType<TArgs>` is what `transformResponse` receives: the declared
`rawResponse`, or `{ data: TResponse }` when none was declared.

The document a creator takes is a `GQL`, the branded string the `gql` tag returns, and the second
argument is a `CreateGqlQueryCreatorOptions` - the [HTTP creator options](/query/http#creator-options)
with `route` made optional. `GqlQueryMethod` (`'QUERY' | 'MUTATE'`) and `GqlQueryTransport`
(`'GET' | 'POST'`) are the two axes of the [template table](#creator-templates).
