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
@Component({/* … */})
export class LoginFormComponent {
  private auth = injectAuthProvider();

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
| `setTokens(access, refresh)`       | Seeds tokens issued outside the provider — see [External tokens](#external-tokens).                                                                                                                   |
| `logout()`                         | Clears tokens, unbinds all secure queries from the cache, and resets the ones still bound.                                                                                                            |
| `afterTokenRefresh$`               | Emits after every successful token refresh.                                                                                                                                                           |

`queries` keeps its literal keys, so `provider.queries.login` works. The escape-hatch `AnyBearerAuthProvider` type erases them; where the provider is reachable as a value, derive the real type with `BearerAuthProviderOf<typeof authProviderRef>` instead.

## Waiting for a token

A secure query executed before login does **not** fail — it parks until `accessToken()` is set and then runs. There is no need to gate secure queries on `isAuthenticated()`, or to hold their args at `CLEAR_QUERY_ARGS` until a session exists.

`logout()` is the mirror image: it drops the tokens, tears down every secure cache entry, **and** resets the secure queries still bound to them. A component that stays mounted across a logout stops showing the previous user's data on its own.

It also **abandons every unsaved-changes guard** (`injectUnsavedChangesCoordinator().abandonAll('logout')`). Without that, logging out with a dirty form left a "discard your changes?" dialog floating over the login page the app had already redirected to, and a tab that still refused to close — over edits that can no longer be saved anyway. Guards created after a re-login work normally again; see [Sessions ending underneath a guard](/core/utilities#unsaved-changes-coordinator) for how to close your own confirm dialog when it happens.

## Execution state

`executionState()` is the single place to watch what the provider is doing. Its `type` is either one of your query keys or one of the four internal operations, and `state` moves `loading → success | error`:

| `type`           | Raised by                                                          |
| ---------------- | ------------------------------------------------------------------ |
| your query key   | An explicit `provider.queries.<key>.execute(...)`, e.g. `'login'`. |
| `'autoLogin'`    | A session restore attempted by [`withPersistentAuth`](#features).  |
| `'tokenRefresh'` | Either refresh trigger — proactive timer or reactive `401`.        |
| `'logout'`       | `logout()`. Always `state: 'success'`.                             |
| `'revocation'`   | [`withTokenRevocation`](#features).                                |

This is what replaces watching a v2 query collection. A failed session restore, for instance, is `{ type: 'autoLogin', state: 'error', error }` — the signal to send the user to the login screen rather than to show a broken app.

## External tokens

`setTokens(access, refresh)` applies a token pair the provider did not fetch itself — an SSO/OIDC callback that arrives with both tokens in the URL, a token handed over by a native shell, a test harness:

```ts
const { accessToken, refreshToken } = parseCallbackFragment(location.hash);

auth.setTokens(accessToken, refreshToken);
```

It behaves exactly like a successful auth query: `bearerData` / `isAuthenticated` update, `afterTokenRefresh$` emits so waiting secure queries run, other tabs are synced, and `withPersistentAuth` picks the tokens up through the same signals it watches for query-issued ones.

## Token refresh

`withRefreshQuery` wires two refresh triggers:

- **Proactive** — a timer computed from the JWT's expiration claim (`expiresInPropertyName`, default `'exp'`) and the `refreshStrategy` (default: refresh at **75%** of the token lifetime, clamped between 1 and 10 minutes before expiry). With multi-tab sync active, only the elected leader tab refreshes.
- **Reactive** — any secure query failing with a `401` triggers a refresh (`autoRetryOn401`, default `true`), then re-executes.

Refresh failures retry on transient statuses (`0, 408, 425, 429, 500, 502, 503, 504` by default) with unlimited attempts (`retryConfig.maxAttempts: 0`) capped at 30s delay. By default the token extractor expects `{ accessToken, refreshToken }` in the response of both the authentication and refresh queries — override with `extractTokens`.

## Multi-tab sync

On by default (`multiTabSync`): tokens and logout are synchronized across tabs via a `BroadcastChannel` (`'ethlete-auth-sync'`) with leader election, so only one tab performs proactive refreshes. Pass `multiTabSync: false` to disable, or an options object to tune `syncTokens`, `syncLogout` and `leaderElection` individually.

This is separate from — and independent of — the query client's own [multi-tab sync](/query/multi-tab), which shares responses and deduplicates polling. Both are on by default and configured separately: this one is about the session, that one about data. They complement each other — because logout tears down secure entries in every tab, a shared response can never outlive the session it was fetched in.

## Features

Optional behaviors passed to the provider's `features` array (each usable once — a duplicate throws):

| Feature                      | Purpose                                                                                                                                                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withPersistentAuth`         | Cookie-backed "remember me" auto-login (encrypted token storage; cookie `etAuth`, 30 days, `sameSite: 'lax'` by default). It calls `tryLogin()` itself during setup — no app initializer needed; the attempt surfaces as `executionState()` with `type: 'autoLogin'`. |
| `withTokenExpirationWarning` | `isExpiringSoon` / `expiresIn` signals (default threshold 5 minutes).                                                                                                                                                                                                 |
| `withInactivityLogout`       | Auto-logout after inactivity (default 15 minutes; listens to mouse/keyboard/scroll/touch).                                                                                                                                                                            |
| `withTokenRevocation`        | Calls a revocation query — by default automatically on logout.                                                                                                                                                                                                        |
| `withTracking`               | Typed event bus for auth telemetry (query execute/success/failure, token refresh, logout, leader changes).                                                                                                                                                            |

## Error codes

The auth provider throws dev-mode `RuntimeError`s with codes **200–299** — missing token properties in a login/refresh response, or an auth feature used twice.
