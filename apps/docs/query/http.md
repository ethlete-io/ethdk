# HTTP queries

REST-style query creators on top of the [query fundamentals](/query/queries). Each HTTP method has a template that binds a [client](/query/queries#the-query-client) and returns a factory for typed query creators; the `Secure…` variants additionally bind a [bearer auth provider](/query/auth) and attach an `Authorization` header to every request.

```ts
import { createGetQuery, createPostQuery, createQueryClient, createSecureGetQuery, withArgs } from '@ethlete/query';

const client = createQueryClient({ name: 'api', baseUrl: 'https://api.example.com/v1' });

const getQuery = createGetQuery(client);
const postQuery = createPostQuery(client);

type GetUsersQueryArgs = {
  response: Paginated<UserView>;
  queryParams: { page: number; search?: string };
};

type CreateUserQueryArgs = {
  response: UserView;
  body: { name: string; email: string };
};

export const getUsers = getQuery<GetUsersQueryArgs>('/users');
export const createUser = postQuery<CreateUserQueryArgs>('/users');
```

```ts
// In a component: GETs run reactively, mutations run manually
usersQuery = getUsers(withArgs(() => ({ queryParams: { page: this.page() } })));

createUserQuery = createUser();

save() {
  this.createUserQuery.execute({ args: { body: { name: 'Ada', email: 'ada@example.com' } } });
}
```

## Method templates

| Template             | Method    | Auto-executes | Cached |
| -------------------- | --------- | ------------- | ------ |
| `createGetQuery`     | `GET`     | yes           | yes    |
| `createHeadQuery`    | `HEAD`    | yes           | yes    |
| `createOptionsQuery` | `OPTIONS` | yes           | yes    |
| `createPostQuery`    | `POST`    | no            | no     |
| `createPutQuery`     | `PUT`     | no            | no     |
| `createPatchQuery`   | `PATCH`   | no            | no     |
| `createDeleteQuery`  | `DELETE`  | no            | no     |

Each has a `createSecure…Query(client, authProviderRef)` twin. Auto-execution and caching semantics are the core rules - see [auto-execution](/query/queries#auto-execution) and [caching](/query/caching).

The request method is part of the [cache key](/query/caching), so a `HEAD` and an `OPTIONS` query on the same route get their own entry and never read each other's response.

## Typing requests

The generic `TArgs` type passed to a creator describes the whole request/response contract:

| Field         | Description                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| `response`    | The (transformed) response type - what `query.response()` returns.                                              |
| `rawResponse` | The wire response type, when it differs from `response`. Declaring it makes `transformResponse` **required**.   |
| `pathParams`  | `Record<string, string \| number>` - declaring it requires a **function route**: `(p) => `/users/${p.userId}``. |
| `queryParams` | Serialized into the query string using the client's `queryString` config.                                       |
| `body`        | The request body (mutating methods).                                                                            |
| `headers`     | Extra headers (`HttpHeaders` or a function returning them).                                                     |

You pass everything except the type-only `response` and `rawResponse` fields when executing - via `withArgs(() => ({ … }))` or `execute({ args })`. A function route without a `withArgs` feature throws in dev mode (opt out with the `silenceMissingWithArgsFeatureError` query config if you always pass args to `execute`).

### Transforming responses

When the API shape isn't what you want to consume, declare both types and transform once at the creator:

```ts
type GetUserQueryArgs = {
  response: UserView;
  rawResponse: { data: UserView };
  pathParams: { userId: string };
};

const getUser = getQuery<GetUserQueryArgs>((p) => `/users/${p.userId}`, {
  transformResponse: (raw) => raw.data,
});
```

## Creator options

The second argument of a creator factory (required only when `rawResponse` differs from `response`):

| Option              | Default  | Description                                                                                                                                           |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transformResponse` | identity | Maps `rawResponse` → `response`. A throw lands in `error()` as a failure with code `0` - see [Errors](/query/errors#a-transformresponse-that-throws). |
| `reportProgress`    | `false`  | Emit upload/download progress into `query.loading()`. Not supported with the fetch backend (`withFetch()`) - upload progress needs XHR.               |
| `responseType`      | `'json'` | `'json' \| 'text' \| 'blob' \| 'arraybuffer'`.                                                                                                        |
| `withCredentials`   | `false`  | Send cookies on cross-origin requests.                                                                                                                |
| `transferCache`     | -        | Angular SSR transfer-cache config.                                                                                                                    |
| `retryFn`           | client's | Per-endpoint retry override.                                                                                                                          |
| `keepUnusedFor`     | client's | Per-endpoint override for how long an unused cache entry is kept - see [Caching](/query/caching#keeping-unused-entries-around).                       |

## Secure queries

Every template has a `createSecure…Query(client, authProviderRef)` twin that takes a bearer auth provider reference. Secure queries wait for a valid access token, attach the `Authorization` header, and re-execute automatically after a token refresh when they failed with a `401`. Setting up the provider - login/refresh queries, token refresh strategies, multi-tab sync and auth features - is covered in the [auth guide](/query/auth).

## Upload & download progress

With `reportProgress: true`, `query.loading()` carries a `progress` object (`percentage`, `loaded`, `total`, plus `speed` and `remainingTime` once ~2s of samples exist) for both directions - useful for file upload UIs.

## Error codes

HTTP queries throw the [query core error codes](/query/errors#error-codes); secure queries additionally throw the [auth error codes](/query/auth#error-codes).
