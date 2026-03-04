# Query Creator

A query creator defines a reusable HTTP endpoint. It holds the method, route, expected args type and expected response type. It does **not** execute anything — it is only a blueprint.

## Defining a query creator

```ts
import { createQuery } from '@ethlete/query';

export const getUser = createQuery({
  method: 'GET',
  route: '/users',
});

// With typed args
export const getUserById = createQuery({
  method: 'GET',
  route: (args: { id: number }) => `/users/${args.id}`,
  responseType: {} as User,
});

// POST with body
export const createUser = createQuery({
  method: 'POST',
  route: '/users',
  responseType: {} as User,
});
```

## Options

| Option                | Type                                                                     | Description                                               |
| --------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| `method`              | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE' \| 'HEAD' \| 'OPTIONS'` | HTTP method                                               |
| `route`               | `string \| ((args: TArgs) => string)`                                    | Static URL or function that computes the URL from args    |
| `responseType`        | `TResponse`                                                              | Phantom type for the response shape (not used at runtime) |
| `retryFn`             | `(error: HttpErrorResponse) => boolean`                                  | Custom retry logic                                        |
| `transferCache`       | `boolean \| TransferCacheOptions`                                        | Angular transfer cache options                            |
| `onlyManualExecution` | `boolean`                                                                | Prevents automatic execution                              |

## Using a query creator

```ts
// Inside an Angular component or service with injection context
const query = getUserById({ injector }, withArgs({ id: 42 }));
```

The first argument is always a context object containing an `injector`. The rest are [query features](./query-features).

## Secure queries

For endpoints that require authentication, use `createSecureQuery`:

```ts
import { createSecureQuery } from '@ethlete/query';

export const getProfile = createSecureQuery({
  method: 'GET',
  route: '/me',
  responseType: {} as UserProfile,
});
```

Secure queries automatically attach the `Authorization: Bearer <token>` header and retry after a token refresh.
