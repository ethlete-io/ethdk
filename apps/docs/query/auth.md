# Auth Provider

`createBearerAuthProvider` manages the full bearer token lifecycle — login, token refresh, logout, multi-tab sync and leader election.

## Setup

```ts
import { createBearerAuthProvider, authQuery, tokenRefreshQuery } from '@ethlete/query';

export const [AuthProvider, injectAuthProvider] = createBearerAuthProvider({
  name: 'main',
  queryClientRef: QueryClientProvider,
  queries: [
    authQuery({
      key: 'login',
      queryCreator: postLogin,
    }),
    tokenRefreshQuery({
      key: 'refresh',
      queryCreator: postRefresh,
    }),
  ],
});
```

Register in `app.config.ts`:

```ts
providers: [AuthProvider];
```

## Token extraction

By default the auth provider expects the response to contain `accessToken` and `refreshToken` string properties (errors `ET207`, `ET208`, `ET209`). Override with a custom extractor:

```ts
authQuery({
  key: 'login',
  queryCreator: postLogin,
  extractTokens: (response) => ({
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  }),
});
```

## Using the provider

```ts
const auth = injectAuthProvider();

// Reactive state
auth.isAuthenticated(); // Signal<boolean>
auth.accessToken(); // Signal<string | null>
auth.bearerData(); // Signal<TBearerData | null>

// Actions
auth.queries.login.execute({ args: { body: { email, password } } });
auth.logout();
```

## Features

Features compose additional behavior onto the auth provider:

```ts
import { withPersistentAuth, withInactivityLogout, withTokenExpirationWarning } from '@ethlete/query';

createBearerAuthProvider({
  // ...
  features: [
    withPersistentAuth(),
    withInactivityLogout({ timeout: 15 * 60 * 1000 }),
    withTokenExpirationWarning({ warningThreshold: 60 }),
  ],
});
```

## Multi-tab sync

Multi-tab sync is enabled by default. It broadcasts token updates and logout events across browser tabs using `BroadcastChannel`, and uses leader election so only one tab performs automatic token refreshes.

```ts
createBearerAuthProvider({
  // ...
  multiTabSync: {
    channelName: 'my-app-auth-sync',
    syncTokens: true,
    syncLogout: true,
    leaderElection: true,
  },
});

// Disable entirely
multiTabSync: false,
```
