# GQL

`@ethlete/query` supports GraphQL queries via `createGqlQuery` and `createSecureGqlQuery`. GQL queries behave like regular queries but always use `POST` internally and expect the response to contain a `data` property.

## Defining a GQL query

```ts
import { createGqlQuery } from '@ethlete/query';

export const getUserGql = createGqlQuery({
  route: '/graphql',
  document: `
    query GetUser($id: ID!) {
      user(id: $id) {
        id
        name
        email
      }
    }
  `,
  responseType: {} as { user: User },
});
```

## Usage

```ts
const query = getUserGql({ injector }, withArgs({ variables: { id: '42' } }));
```

## Polling and auto-refresh

GQL queries support `withPolling` and `withAutoRefresh` like regular GET queries.

## Custom response shape

If your GraphQL server wraps the response differently, provide a `transformResponse` function to extract the data manually and bypass the default `data` property check (error `ET600`):

```ts
createGqlQuery({
  route: '/graphql',
  document: `...`,
  transformResponse: (raw) => raw.result.data,
});
```
