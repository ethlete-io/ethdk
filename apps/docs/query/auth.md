# Auth

`createBearerAuthProvider` manages a JWT access/refresh token pair and powers the secure query creators of [HTTP](/query/http) and [GraphQL](/query/gql) queries. Secure queries wait for a valid token, inject `Authorization: Bearer <token>` (unless you set the header yourself), and automatically re-execute after a token refresh when they failed with a `401`.

Like the [query client](/query/queries#the-query-client), it returns a root-provider tuple (`[provide, inject, token]`) — the whole tuple is what you hand to secure creator templates, and its `inject` function is how you reach the provider inside components. Nothing needs to be registered in your app config; the `provide` function and token exist for tests and overrides.

```ts
import {
  createBearerAuthProvider,
  createSecureGetQuery,
  withAuthenticationQuery,
  withRefreshQuery,
} from '@ethlete/query';

const login = postQuery<LoginQueryArgs>('/auth/login');
const refreshToken = postQuery<RefreshTokenQueryArgs>('/auth/refresh');

export const authProviderRef = createBearerAuthProvider({
  name: 'api',
  queryClientRef: client,
  queries: [
    withAuthenticationQuery('login', { queryCreator: login }),
    withRefreshQuery('refreshToken', { queryCreator: refreshToken }),
  ],
});

export const [, injectAuthProvider] = authProviderRef;

// secure creators take the whole tuple
const secureGetQuery = createSecureGetQuery(client, authProviderRef);
export const getMe = secureGetQuery<GetMeQueryArgs>('/me');
```

```ts
@Component({
  /* … */
})
export class LoginFormComponent {
  auth = injectAuthProvider();

  // a signal holding a frozen snapshot of the latest login execution
  loginState = this.auth.queries.login.snapshot;

  submit(email: string, password: string) {
    this.auth.queries.login.execute({ body: { email, password } });
  }

  logout() {
    this.auth.logout(); // clears tokens and drops all authenticated requests from the cache
  }
}
```

## The provider object

| Member                             | Description                                                                                                                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessToken()` / `refreshToken()` | The current tokens (signals), or `null`.                                                                                                                                                              |
| `bearerData()`                     | Decoded JWT payload — customize decoding with the `bearerDecryptFn` config option.                                                                                                                    |
| `isAuthenticated()`                | `true` while an access token is present.                                                                                                                                                              |
| `executionState()`                 | Progress of the current auth operation (`autoLogin`, `tokenRefresh`, `logout`, …) as loading/success/error.                                                                                           |
| `queries`                          | Registry of the configured auth queries: `queries.<key>.execute(args, options?)` runs one and returns a [snapshot](/query/queries#the-query-object); `queries.<key>.snapshot()` holds the latest one. |
| `features`                         | Registry of the configured [features](#features).                                                                                                                                                     |
| `logout()`                         | Clears tokens and unbinds all secure queries from the cache.                                                                                                                                          |
| `afterTokenRefresh$`               | Emits after every successful token refresh.                                                                                                                                                           |

## Token refresh

`withRefreshQuery` wires two refresh triggers:

- **Proactive** — a timer computed from the JWT's expiration claim (`expiresInPropertyName`, default `'exp'`) and the `refreshStrategy` (default: refresh at **75%** of the token lifetime, clamped between 1 and 10 minutes before expiry). With multi-tab sync active, only the elected leader tab refreshes.
- **Reactive** — any secure query failing with a `401` triggers a refresh (`autoRetryOn401`, default `true`), then re-executes.

Refresh failures retry on transient statuses (`0, 408, 425, 429, 500, 502, 503, 504` by default) with unlimited attempts (`retryConfig.maxAttempts: 0`) capped at 30s delay. By default the token extractor expects `{ accessToken, refreshToken }` in the response of both the authentication and refresh queries — override with `extractTokens`.

## Multi-tab sync

On by default (`multiTabSync`): tokens and logout are synchronized across tabs via a `BroadcastChannel` (`'ethlete-auth-sync'`) with leader election, so only one tab performs proactive refreshes. Pass `multiTabSync: false` to disable, or an options object to tune `syncTokens`, `syncLogout` and `leaderElection` individually.

## Features

Optional behaviors passed to the provider's `features` array (each usable once — a duplicate throws):

| Feature                      | Purpose                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `withPersistentAuth`         | Cookie-backed "remember me" auto-login (encrypted token storage; cookie `etAuth`, 30 days, `sameSite: 'lax'` by default). |
| `withTokenExpirationWarning` | `isExpiringSoon` / `expiresIn` signals (default threshold 5 minutes).                                                     |
| `withInactivityLogout`       | Auto-logout after inactivity (default 15 minutes; listens to mouse/keyboard/scroll/touch).                                |
| `withTokenRevocation`        | Calls a revocation query — by default automatically on logout.                                                            |
| `withTracking`               | Typed event bus for auth telemetry (query execute/success/failure, token refresh, logout, leader changes).                |

## Error codes

The auth provider throws dev-mode `RuntimeError`s with codes **200–299** — missing token properties in a login/refresh response, or an auth feature used twice.
