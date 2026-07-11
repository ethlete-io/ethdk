# GraphQL queries

A thin GraphQL layer over the [query fundamentals](/query/queries) — same client, same query object, same [caching repository](/query/caching). A GraphQL endpoint is just one route on a [query client](/query/queries#the-query-client); the GQL creators handle serializing the document + variables and unwrapping the `{ data }` envelope.

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
// In a component — variables are just query args
userQuery = getUser(withArgs(() => ({ variables: { userId: this.userId() } })));

user = computed(() => this.userQuery.response()?.user ?? null);
```

The `gql` tag is a branded template literal — no parsing happens at runtime. The operation name is extracted for the request, and in production builds the document is minified (whitespace collapsed); in dev mode it stays pretty-printed for readable network tabs.

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
The operation kind controls **caching**: queries are cached/deduplicated in the repository, mutations are not — even a query sent via POST is cached (its cache key hashes the body). The transport only controls **how the payload travels**: via GET it's serialized into URL query params (CDN/proxy-cache friendly), via POST it goes in the request body.
:::

The `Secure…` variants take `(client, authProviderRef)` and behave like [secure HTTP queries](/query/auth) (token gating, `Authorization` header, refresh-and-retry on 401). Note: secure GQL derives the HTTP method from the operation kind (query → GET, mutation → POST) rather than the transport suffix.

## Typing & args

GQL args extend the core `QueryArgs` with a `variables` bag:

| Field         | Description                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------- |
| `response`    | The unwrapped data type — what `query.response()` returns.                                    |
| `variables`   | GraphQL variables, passed via `withArgs` / `execute` and JSON-serialized into the request.    |
| `rawResponse` | Defaults to `{ data: TResponse }`; declare it only when your endpoint returns something else. |

**Response unwrapping:** by default the `{ data }` envelope is stripped automatically — a missing `data` property throws a dev-mode error. Supplying your own `transformResponse` replaces this default:

```ts
const getUserName = gqlQueryPost<GetUserNameQueryArgs>(gqlDocument, {
  transformResponse: (raw) => raw.data.user.name,
});
```

Creator options are otherwise the [HTTP creator options](/query/http#creator-options); `route` is optional (the client's `baseUrl` usually is the GraphQL endpoint already).

Everything else works exactly as described in the core guides, since GQL queries are regular queries underneath — [features](/query/features) like `withPolling`, [query stacks](/query/stacks) and [error handling](/query/errors).
