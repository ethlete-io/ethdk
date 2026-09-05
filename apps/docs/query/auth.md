# Auth

`createBearerAuthProvider` manages a JWT access/refresh token pair and powers the secure query creators of [HTTP](/query/http) and [GraphQL](/query/gql) queries. Secure queries wait for a valid token, inject `Authorization: Bearer <token>` (unless you set the header yourself), and automatically re-execute after a token refresh when they failed with a `401`.

Like the [query client](/query/queries#the-query-client), it returns a root-provider definition (`{ provide, inject, token }`) - the whole definition is what you hand to secure creator templates, and `toInjectFn(…)` is how you reach the provider inside components. Nothing needs to be registered in your app config; the `provide` function and token exist for tests and overrides.

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
| `bearerData()`                     | Decoded JWT payload - customize decoding with the `bearerDecryptFn` config option.                                                                                                                    |
| `isAuthenticated()`                | `true` while an access token is present.                                                                                                                                                              |
| `isAccessTokenExpired()`           | `true` while the access token this tab holds is past its expiry - see [Waiting for a token](#waiting-for-a-token). Not a signal: the answer changes with the clock.                                   |
| `sessionStatus()`                  | `'unknown' \| 'restoring' \| 'authenticated' \| 'anonymous'` - see [Is there a session?](#is-there-a-session).                                                                                        |
| `sessionEndCause()`                | Why the last session ended, or `null` - see [Why the session ended](#why-the-session-ended).                                                                                                          |
| `executionState()`                 | Progress of the current auth operation (`autoLogin`, `tokenRefresh`, `logout`, …) as loading/success/error.                                                                                           |
| `queries`                          | Registry of the configured auth queries: `queries.<key>.execute(args, options?)` runs one and returns a [snapshot](/query/queries#the-query-object); `queries.<key>.snapshot()` holds the latest one. |
| `features`                         | Registry of the configured [features](#features).                                                                                                                                                     |
| `setTokens(access, refresh)`       | Seeds tokens issued outside the provider - see [External tokens](#external-tokens).                                                                                                                   |
| `logout(cause?)`                   | Clears tokens, unbinds all secure queries from the cache, and resets the ones still bound. `cause` defaults to `'user'`.                                                                              |
| `afterTokenRefresh$`               | Emits after every successful token refresh.                                                                                                                                                           |

`queries` keeps its literal keys, so `provider.queries.login` works. The escape-hatch `AnyBearerAuthProvider` type erases them; where the provider is reachable as a value, derive the real type with `BearerAuthProviderOf<typeof authProviderRef>` instead.

## Waiting for a token

A secure query executed before login does **not** fail - it parks until `accessToken()` is set and then runs. There is no need to gate secure queries on `isAuthenticated()`, or to park their args until a session exists.

An access token that is **already expired** parks the query too. A token seed can hand one over - an SSO callback that arrives with the pair the identity provider issued minutes ago - and sending it can only earn a `401`. The refresh query's schedule fires on such a token at once, so the query waits for that refresh and then goes out with the new token: one request instead of a `401` and a retry. The wait ends after 5 seconds regardless, because nothing guarantees a refresh arrives; the request then goes out with the expired token and recovers the old way.

Two cases keep the token as-is and send it immediately: a token whose expiry cannot be read (an opaque access token, or a claim the refresh query is not configured to read), and `refreshIfExpired: false`, which says an expired token is not to be refreshed at all. `isAccessTokenExpired()` reads `false` in both.

`logout()` is the mirror image: it drops the tokens, tears down every secure cache entry, **and** resets the secure queries still bound to them. A component that stays mounted across a logout stops showing the previous user's data on its own. Any [persisted](/query/persistence#authenticated-responses) secure response is removed from disk at the same moment - and secure responses are not persisted at all unless the query opted in.

It also **abandons every unsaved-changes guard** (`injectUnsavedChangesCoordinator().abandonAll('logout')`). Without that, logging out with a dirty form left a "discard your changes?" dialog floating over the login page the app had already redirected to, and a tab that still refused to close - over edits that can no longer be saved anyway. Guards created after a re-login work normally again; see [Sessions ending underneath a guard](/core/utilities#unsaved-changes-coordinator) for how to close your own confirm dialog when it happens.

## Is there a session?

`sessionStatus()` answers the one question an app shell needs before it renders anything, and it always has a value:

| Value             | Meaning                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `'unknown'`       | The provider is still starting up. Not observable from a component - it is resolved by the time `inject` returns. |
| `'restoring'`     | A session restore is in flight ([`withPersistentAuth`](#features)'s auto-login).                                  |
| `'authenticated'` | Tokens are applied.                                                                                               |
| `'anonymous'`     | No session, and nothing is trying to get one.                                                                     |

```ts
@Component({
  template: `
    @if (auth.sessionStatus() === 'restoring') {
      <app-splash />
    } @else {
      <router-outlet />
    }
  `,
})
export class AppComponent {
  protected auth = injectAuthProvider();
}
```

Do **not** rebuild this from `executionState()`. The two differ in exactly the case that matters: with no cookie to restore from, `withPersistentAuth` never executes anything, so `executionState()` stays `null` forever - a shell gated on it waits for a state that is never coming. `sessionStatus()` reaches `'anonymous'` during provider setup instead.

`'restoring'` is reached synchronously while the provider is being created, so a component that injects the provider on a protected route sees it immediately rather than one tick later.

### Why the session ended

`sessionEndCause()` names what ended the last session, so an app can send a user back where they were after a session that ended on its own while leaving a deliberate logout on the login page:

| Cause          | Set by                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| `'user'`       | `logout()` with no argument - the default.                               |
| `'inactivity'` | [`withInactivityLogout`](#features)'s timer.                             |
| `'expired'`    | A refresh that [failed for good](#when-a-refresh-fails-for-good).        |
| `'otherTab'`   | A deliberate logout that arrived over [multi-tab sync](#multi-tab-sync). |

It is `null` before any session has ended, and cleared again as soon as tokens are applied. Pass your own cause for an app-specific path - `logout('expired')` from a handler that decided the session is unrecoverable.

A logout that arrives over [multi-tab sync](#multi-tab-sync) carries the cause it had in the tab it started in. A session that ended **on its own** ended for every tab, so `'inactivity'` and `'expired'` are reported as they are - only a deliberate `logout()` elsewhere reads as `'otherTab'` here, which is what keeps "someone signed out in another tab" distinguishable from "this session is over".

## Route guards

`createAuthGuard(providerRef, config)` returns the guards for a session **and** the redirect back once the visitor signs in. Both halves read the same return-URL param, so the guard and the login page cannot drift apart:

```ts
import { createAuthGuard } from '@ethlete/query';

export const authGuard = createAuthGuard(authProviderRef, { loginUrl: '/login', defaultUrl: '/dashboard' });

export const ROUTES: Routes = [
  { path: 'login', canMatch: [authGuard.canMatchAnonymous], loadComponent: () => import('./login') },
  { path: 'dashboard', canMatch: [authGuard.canMatch], loadChildren: () => import('./dashboard') },
];
```

```ts
@Component({/* … */})
export class LoginFormComponent {
  private auth = injectAuthProvider();

  // cold - nothing navigates until it is subscribed to
  private afterLogin$ = authGuard.navigateAfterLogin();

  constructor() {
    toObservable(this.auth.isAuthenticated)
      .pipe(
        filter(Boolean),
        take(1),
        switchMap(() => this.afterLogin$),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
```

| Member                 | Description                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `canMatch`             | Requires a session. On a lazy route this is the one to use - the child bundle is never downloaded.     |
| `canActivate`          | The same decision, as a `canActivate` guard.                                                           |
| `canMatchAnonymous`    | Requires _no_ session - keeps a signed-in visitor off the login route.                                 |
| `canActivateAnonymous` | The same decision, as a `canActivate` guard.                                                           |
| `returnUrl()`          | The URL the guard captured before redirecting here, or `null`. Call from an injection context.         |
| `navigateAfterLogin()` | A cold observable that navigates to `returnUrl()`, or to `defaultUrl`. Call from an injection context. |

| Option                      | Default                | Description                                                                                       |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `loginUrl`                  | required               | A path, a command array, a `UrlTree`, or `(router) => UrlTree`.                                   |
| `defaultUrl`                | `'/'`                  | Where a login lands when nothing was captured.                                                    |
| `returnUrlParam`            | `'returnUrl'`          | The query param carrying the attempted URL. `false` redirects without one.                        |
| `navigationBehaviorOptions` | `{ replaceUrl: true }` | How a guard's redirect navigates - the failed attempt does not become a history entry by default. |

A guard **pends while a session restore is in flight** rather than deciding against a session that is about to exist - it waits for [`sessionStatus()`](#is-there-a-session) to leave `'restoring'`. That is what makes a hard reload of a protected URL stay on that URL instead of bouncing through the login page. When there is nothing to restore, `sessionStatus()` is already `'anonymous'` and the guard answers synchronously, so a never-logged-in visitor never waits.

The attempted URL is captured when the guard runs, including its query params and fragment, and written to the return-URL param unencoded - Angular's URL serializer encodes it, and parses it back. Coming the other way, a captured URL is only followed when it points back into this app: anything not starting with `/`, and anything starting with `//`, is discarded in favour of `defaultUrl`.

## Execution state

`executionState()` is the single place to watch what the provider is doing. Its `type` is either one of your query keys or one of the internal operations, and `state` moves `loading → success | error`:

| `type`           | Raised by                                                          |
| ---------------- | ------------------------------------------------------------------ |
| your query key   | An explicit `provider.queries.<key>.execute(...)`, e.g. `'login'`. |
| `'autoLogin'`    | A session restore attempted by [`withPersistentAuth`](#features).  |
| `'tokenRefresh'` | Either refresh trigger - proactive timer or reactive `401`.        |
| `'logout'`       | `logout()`. Always `state: 'success'`.                             |
| `'revocation'`   | [`withTokenRevocation`](#features).                                |
| `'tokenSeed'`    | `setTokens(...)`. Always `state: 'success'`.                       |

This is what replaces watching a v2 query collection. A session restore, for instance, starts as `{ type: 'autoLogin', state: 'loading' }` and, when the cookie is still good, ends as `{ type: 'autoLogin', state: 'success' }`. A **rejected** restore does not end as `{ type: 'autoLogin', state: 'error' }`. The cookie is spent through the refresh query, so the default policy [ends the session](#when-a-refresh-fails-for-good) in the same pass, and what a consumer observes is `autoLogin` `loading` followed straight by `{ type: 'logout', state: 'success' }` with [`sessionEndCause()`](#why-the-session-ended) `'expired'`. `autoLogin` `error` is observable only where nothing ends the session: a restore run through a query that is not the refresh query, or a custom `onRefreshFailure` that keeps the session. To send the user to the login screen rather than show a broken app, watch [`sessionStatus()`](#is-there-a-session).

### Don't drive a form off `executionState()`

`executionState()` is **provider-global**: one slot, written by whichever auth operation ran last. A login form bound to it renders a background token refresh, or another tab's activity, as its own submit.

Use the per-attempt path instead. `execute()` returns a [`QuerySnapshot`](/query/queries#the-query-object) of that attempt, and `queries.<key>.snapshot` is a signal of the latest one:

```ts
@Component({/* … */})
export class LoginFormComponent {
  private auth = injectAuthProvider();

  // the latest login attempt, and nothing else
  protected attempt = this.auth.queries.login.snapshot;
  protected submitting = computed(() => this.attempt()?.loading() ?? false);
  protected error = computed(() => this.attempt()?.error() ?? null);

  submit(email: string, password: string) {
    this.auth.queries.login.execute({ body: { email, password } });
  }
}
```

The rule of thumb: **the snapshot drives the UI of the attempt that produced it; `executionState()` answers session-level questions** ("is a refresh running?", "did the restore fail?"). For "is there a session at all", reach for [`sessionStatus()`](#is-there-a-session) rather than either.

### Which execution wins

Only the most recently started token-issuing execution applies its tokens and writes `executionState()`. Everything else is ignored, however late it comes back.

`logout()` is a terminal supersession too: a login, auto-login or refresh that was already in flight cannot restore the session when its response arrives later. So is [`setTokens()`](#external-tokens): the seeded pair is here, so a cookie auto-login still out with an older refresh token neither applies what it comes back with nor reports its failure as the session's - which is what keeps an SSO callback that opens the app over a stale cookie from ending on that cookie's `401`.

This holds **across registry keys**, not just within one. A `401`-driven token refresh that is still in flight when the user submits a login used to end with the refresh's tokens applied and the login's outcome on display, or the reverse - two writers, two different executions. Now the login supersedes the refresh, and the refresh's late response is dropped entirely.

The other half of that rule: an automatic refresh does not **start** while any token-issuing execution is in flight, so a login already under way is never superseded by a refresh that began after it. A refresh you execute by hand is explicit intent and always runs.

## External tokens

`setTokens(access, refresh)` applies a token pair the provider did not fetch itself - an SSO/OIDC callback that arrives with both tokens in the URL, a token handed over by a native shell, a test harness. It behaves like a successful auth query: `executionState()` becomes `{ type: 'tokenSeed', state: 'success' }`, so login-redirect logic built on `executionState` works the same for this path as for a query-driven login.

```ts
const { accessToken, refreshToken } = parseCallbackFragment(location.hash);

auth.setTokens(accessToken, refreshToken);
```

It behaves exactly like a successful auth query: `bearerData` / `isAuthenticated` update, `afterTokenRefresh$` emits so waiting secure queries run, other tabs are synced, and `withPersistentAuth` picks the tokens up through the same signals it watches for query-issued ones. It also [supersedes](#which-execution-wins) whatever was in flight.

## Token refresh

`withRefreshQuery` wires two refresh triggers:

- **Proactive** - a timer computed from the JWT's expiration claim (`expiresInPropertyName`, default `'exp'`) and the `refreshStrategy` (default: refresh at **75%** of the token lifetime, clamped between 1 and 10 minutes before expiry). With multi-tab sync active, only the elected leader tab refreshes: a follower's timer comes due at the same instant (the tabs share the token), so it skips the tick rather than asking the leader for a refresh the leader is already doing - until the token is nearly expired, at which point the leader has provably not acted and the follower [takes it over](#when-the-leader-stops-answering).

A numeric `refreshStrategy` from `0` to `1` is the fraction of the token lifetime to use before refreshing; a larger number is a fixed buffer in milliseconds before expiry. The object form adds minimum and maximum buffer clamps.

- **Reactive** - any secure query failing with a `401` triggers a refresh (`autoRetryOn401`, default `true`), then re-executes.

A `401` is only ever retried once the refresh has actually **changed** the access token. A refresh that hands back the same token is not a reason to retry: the retry would `401` again, and that `401` would ask for another refresh - an endless loop for as long as the server keeps issuing a token it rejects. The query stays armed, so the next refresh that does change the token still retries it - including a refresh that completed **before** the `401` even landed, which is common when several requests are in flight as the token expires.

The reactive trigger also checks **which token the failing request went out with**. A `401` from a request still carrying an older access token asks for a refresh that already happened, so it refreshes nothing - the query just retries with the current token. Without this, every late-landing `401` would spend the refresh token the last refresh had just issued; with rotating refresh tokens that invalidates the tokens all other in-flight requests are using, whose `401`s refresh again - a self-sustaining loop for as long as requests are in flight.

`minRefreshInterval` (default 30s) throttles the **proactive** trigger, and any refresh that runs starts that interval - so a proactive tick right behind a `401`-driven rotation cannot spend a second refresh token. A refresh a `401` asked for is itself not throttled by it - a token revoked seconds after a proactive refresh is exactly when the request has to go out. Those are deduplicated instead (one refresh in flight at a time, stale `401`s refresh nothing), and only a streak of them - three fresh tokens in a row `401`ing again, with no secure request succeeding in between - falls back to one refresh per `minRefreshInterval`.

A proactive refresh that comes due while it cannot run - throttled, waiting on a login or refresh already in flight, or handed to a leader tab that has not answered - **comes back for it** rather than waiting out the token. A tick this tab could have run but did not re-arms up to five times before it leaves the session to the reactive trigger; a new token pair starts the schedule over. A tick that is **waiting on another tab** does not spend that budget at all: it comes back at a deadline rather than on a fixed interval - the moment the token goes stale for one left to the leader, 30 seconds for one already delegated - and a bounded budget would leave the tab with no armed timer at all, holding a dead token with nothing left to ask with.

**The schedule is also recomputed whenever the tab becomes visible again.** A backgrounded tab's timers are throttled, and a frozen page stops running them altogether while keeping the Web Lock that makes it the leader - so a tab that was away for a while can hold a token whose refresh time has long passed. Coming back to the foreground re-reads the token and refreshes right away if what is left of its lifetime is already inside the refresh buffer, instead of waiting for a secure query to `401`.

In a tab that is not the elected leader, a `401` asks the leader to refresh over the leader channel rather than refreshing itself - a single-use refresh token must only be spent once, and the resulting tokens arrive back through [multi-tab sync](#multi-tab-sync). Without the feature every tab is its own leader and refreshes directly.

Refresh failures retry on transient statuses (`0, 408, 425, 429, 500, 502, 503, 504` by default) with unlimited attempts (`retryConfig.maxAttempts: 0`) capped at 30s delay. By default the token extractor expects `{ accessToken, refreshToken }` in the response of both the authentication and refresh queries - override with `extractTokens`. A custom extractor's result is checked the same way: a pair without two token strings is an extraction failure, never a session. So is a `2xx` with an empty body - the login or refresh ends in `executionState()` `error`, not in a `loading` that never resolves.

### When the leader stops answering

A follower's delegated refresh is **re-asked for** if the leader does not answer within 3 seconds, up to three times. By the time it re-asks, the tab may be the leader itself, in which case it simply refreshes.

Every tab that starts a refresh - or that already has a login or refresh of its own in flight, which is about to issue a pair anyway - says so on the leader channel, which is what turns the request into more than a message into the void: a leader that answers gets six windows instead of three, and one that answers none of them has the refresh **taken over**. The follower then spends the refresh token itself, under a second lock (`ethlete-auth:refresh:<provider name>`) so that two tabs going stale at the same instant - they hold the same token, so they always do - cannot spend it twice. The tab that does not get the lock stands down and waits for the pair the winner broadcasts.

Without the takeover a frozen leader is a session nothing renews: the platform leaves it holding the leadership lock while it runs no timer and reads no message, so every other tab waits for a tab that will never act. A leader that is merely hidden still gets there first - the escalation only starts inside the last 30 seconds of the token's life. It is the second line of defence rather than the first: a visible tab [takes the leadership itself](#multi-tab-sync) from a leader that stopped answering, and then refreshes on its own timer.

A takeover that **could not run yet** - a refresh already in flight, or the floor under the `401`-driven ones - starts the ladder over rather than ending it. The tab is the only one left that can issue a token pair, so retiring the path would leave it holding a token nothing renews and no way to ask for another.

### When a refresh fails for good

A failure that survives `retryConfig` **ends the session**: any status the retry config does not list is one the refresh can never recover from, and leaving the tokens in place would leave `isAuthenticated()` reading `true` while every secure query `401`s. `executionState()` becomes `{ type: 'logout' }` like any other logout, [`sessionEndCause()`](#why-the-session-ended) becomes `'expired'`, and with multi-tab sync the other tabs follow.

Override the policy with `onRefreshFailure`:

```ts
withRefreshQuery('refresh', {
  queryCreator: refreshQuery,
  onRefreshFailure: ({ error, logout }) => {
    if (error.code !== 503) logout();
  },
});
```

It replaces the default entirely - a handler that never calls `logout()` keeps the session, which is what an app that shows its own "your session could not be renewed" prompt wants.

A `2xx` whose body `extractTokens` rejects is a refresh that failed for good too. The server answered and the answer holds no session, so there is no status for the retry policy to wait out - the default policy ends the session, even though the error it is reported as carries code `0`. A custom handler sees the same error and decides for itself.

The handler runs outside any reactive context, so it may create an `effect()` or a query - directly, or through whatever `logout()` sets off in the rest of the app.

**A rejected cookie auto-login takes the same path.** `withPersistentAuth` spends the cookie's refresh token through the refresh query, so a `401` there is a refresh that failed for good, even though the execution reports as `type: 'autoLogin'` rather than `'tokenRefresh'`. It reaches `onRefreshFailure` too, and the default policy ends the session with `sessionEndCause()` `'expired'` - which is what lets a startup screen tell "this session is over" from "the restore did not run". A session that arrived from another tab while the request was out is left alone: it is not the restore's to end. An auto-login through some other query (a login query, a dedicated restore query) is not a refresh and does not reach the handler.

## Multi-tab sync

Opt in with the `withBearerAuthMultiTabSync()` feature: tokens and logout are then synchronized across tabs via a `BroadcastChannel` (`'ethlete-auth-sync:<provider name>'`) with leader election, so only one tab performs proactive refreshes. The channel and the leader lock are both namespaced by the provider's `name`, so two providers reachable from the same origin keep separate sessions. Pass a config object to tune `channelName`, `syncTokens`, `syncLogout` and `leaderElection` individually.

```ts
export const AUTH_PROVIDER = createBearerAuthProvider({
  name: 'my-auth',
  queryClientRef: MY_CLIENT,
  queries: [loginQuery, refreshQuery],
  features: [withBearerAuthMultiTabSync()],
});

AUTH_PROVIDER.inject().features.multiTabSync.isLeader(); // and .instanceCount()
```

A received message takes the same path a local one does, which is what makes the other tabs equal citizens rather than tabs that merely hold the right token:

- **Incoming tokens** are applied like a successful refresh, so `afterTokenRefresh$` emits and every secure query in that tab which had failed with a `401` re-executes. Without this a follower tab would sit on a permanently failed page until reloaded, holding a perfectly valid token.
- **An incoming logout** runs the provider's own `logout()`, so `executionState()` becomes `{ type: 'logout' }` and unsaved-change guards are abandoned - the receiving tab reports the end of the session the same way the tab the user clicked in does. It reports `sessionEndCause()` as the cause the logout had in the tab it started in, with a deliberate `logout()` arriving as [`'otherTab'`](#why-the-session-ended) - so the receiving tab can both tell a logout it did not initiate from one it did, and see that a session ended because it expired or went idle.
- **A follower's refresh request** reaches the leader over the leader channel, so a `401` in a tab that may not spend the refresh token still gets one out immediately instead of waiting for the leader's own timer. The rule across the tabs is **one refresh per rotation**: the request carries the access token the asking tab holds, so a leader that has already rotated past it answers with the pair it holds instead of spending a second refresh token, and one that has a refresh in flight lets the broadcast of its result answer for it.
- **Activity is announced**, so `withInactivityLogout` measures the session's idleness rather than each tab's own - see [Idleness belongs to the session](#idleness-belongs-to-the-session).
- **A tab that comes back asks for the session again.** A page that was frozen or held in the back/forward cache ran nothing while it was away, so every rotation broadcast in the meantime went to a tab that was not listening. It re-asks on `resume` and on a `pageshow` out of the cache, which is what stops it waking up and spending a refresh token that was already spent - a request the server answers with a `401` and the provider with a logout for every tab.
- **A tab that just opened asks for the session** rather than starting one of its own. Sync is otherwise push-only - a tab broadcasts tokens that just _changed_ - so a tab joining a live session would hear nothing and run a full cookie auto-login, spending a refresh-token rotation every open tab then has to adopt. The joining tab posts a state request, the leader answers with its current tokens, and `withPersistentAuth` holds its auto-login for that answer. The wait is bounded (250ms) and only happens when there is a cookie to spend, so a lone tab is never held up by a reply that is not coming - and while it is out, `sessionStatus()` stays `'unknown'`, which is what keeps the [route guards](#route-guards) from sending a session that exists to the login page.

Neither message is echoed back out, so a login or logout settles in one round of broadcasts however many tabs are open.

Without the feature every tab is its own leader and refreshes its own token - exactly right for a single-tab app, a kiosk or an embedded webview, which then ship neither the channel nor the Web Locks election.

Leadership is one lock in the [Web Locks API](https://developer.mozilla.org/docs/Web/API/Web_Locks_API) - the same primitive the query client elects its [polling tabs](/query/multi-tab#polling-dedup) with. Every tab asks for it, one gets it, the rest queue: requests are granted FIFO, and a holder that closes, crashes or navigates away has its lock released by the platform, so the longest-waiting tab takes over. There is no heartbeat to tune and no window in which two tabs both believe they are the leader. Without Web Locks the tab elects itself, which is the single-tab behavior anyway.

**The leadership follows the tab the user is looking at.** The queue's order is the order the tabs opened in, which says nothing about which of them is awake: a hidden tab has its timers throttled to about once a minute and a frozen one runs none at all, so a session led from one is a session nothing refreshes while the tab in front of the user sits queued behind it. Three rules move it:

- A tab that becomes **hidden** while leading gives the lock up and asks again, which puts it behind whoever else wants it - and hands it straight back if nobody does.
- A tab that becomes **visible** without leading claims the leadership on the leader channel, and every hidden tab gives way to it. This is what brings the leadership back to a tab the user returns to, and what a tab opened next to a sleeping one uses to start leading immediately.
- A leader that answers neither - it is frozen, or the machine it runs on is asleep - has the lock **taken off it** (`steal`) once the claim goes unanswered for 1.5s. Nothing a tab does not run can hand anything over.

**A leader that is about to stop running leaves the election** as well. The platform releases a lock for a tab that closes or crashes, but not for one the browser _freezes_ - Chrome does that to a hidden tab after a few minutes, and to any page it puts in the back/forward cache. Such a page keeps the lock while it runs no timer, so the leadership is given up on `freeze` (and on a `pagehide` into the cache) and asked for again on `resume`, where the tab claims it back if the user is looking at it. A follower's [takeover](#when-the-leader-stops-answering) is what covers the refresh itself in a browser that fires neither event.

Two consequences worth knowing. `isLeader` starts `false` and flips on the next microtask, because the platform grants asynchronously - nothing observes the gap, since the proactive refresh it gates runs off a timer. And the instance count `withTracking` reports is best-effort: it is recounted when a tab announces itself, says goodbye or takes over the leadership, so a tab that _crashes_ without holding the lock is counted until the next of those happens. A frozen tab is not counted at all, which is what it is - a tab taking no part.

Because `isLeader` reads `true` in three quite different situations, `leadership` says which one you are in:

| `leadership`  | Means                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| `election`    | A Web Locks election is running. Exactly one tab reads `isLeader: true`.       |
| `off`         | `leaderElection: false` was configured, so every tab refreshes its own tokens. |
| `unsupported` | The browser has no Web Locks. Same effect, and `instanceCount` stays at `1`.   |

Without it, four tabs all reporting themselves as the leader is indistinguishable from a bug. The [devtools auth tab](/query-devtools/#which-tab-refreshes-the-tokens) renders exactly this distinction.

This is separate from - and independent of - the query client's own [multi-tab sync](/query/multi-tab), which shares responses and deduplicates polling. Both are opt-in and configured separately: this one is about the session, that one about data. They complement each other - because logout tears down secure entries in every tab, a shared response can never outlive the session it was fetched in.

## Features

Optional behaviors passed to the provider's `features` array (each usable once - a duplicate throws):

| Feature                      | Purpose                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withPersistentAuth`         | Cookie-backed "remember me" auto-login (encrypted token storage; cookie `etAuth`, 30 days, `sameSite: 'lax'` by default). It calls `tryLogin()` itself during setup - no app initializer needed; the attempt surfaces as `executionState()` with `type: 'autoLogin'` and as [`sessionStatus()`](#is-there-a-session) `'restoring'`. |
| `withTokenExpirationWarning` | `isExpiringSoon` / `expiresIn` signals (default threshold 5 minutes). It reads the claim named by `expiresInPropertyName` (default `'exp'`), which must match the refresh query's.                                                                                                                                                  |
| `withInactivityLogout`       | Auto-logout after inactivity (default 15 minutes; listens to mouse/keyboard/scroll/touch). Reports `sessionEndCause()` as `'inactivity'`. With multi-tab sync on, idleness is measured across tabs - see [Idleness belongs to the session](#idleness-belongs-to-the-session).                                                       |
| `withTokenRevocation`        | Calls a revocation query - by default automatically on logout.                                                                                                                                                                                                                                                                      |
| `withTracking`               | Typed event bus for auth telemetry (query execute/success/failure, token refresh, logout, leader changes). Its `logout` event carries `{ cause }`. Set `trackInternalEvents: false` to hear only the executions the app starts itself.                                                                                              |
| `withBearerAuthMultiTabSync` | Cross-tab token/logout sync and leader election - see [Multi-tab sync](#multi-tab-sync). Exposes `isLeader` / `instanceCount` / `leadership`.                                                                                                                                                                                       |

### Idleness belongs to the session

`withInactivityLogout` ends the session once the user has done nothing for `inactivityTimeout`. The
question that decides whether it is usable is _whose_ nothing: with [multi-tab sync](#multi-tab-sync)
on, a logout travels to every tab, so a per-tab timer would let a forgotten second tab log the user
out of the one they are typing in.

So activity is shared. Each tab announces the user doing something on the sync channel (at most once
per quarter of the timeout - enough to keep any other tab's countdown from expiring, without waking
every tab once a second while someone scrolls), and a tab that hears it postpones its own logout
without announcing anything onward. The countdown only runs out when it has run out everywhere.

Two things deliberately do **not** count as activity:

- **A token refresh.** That is the app working, not the user - and resetting on one would mean an app
  refreshing faster than the timeout never logs an idle user out at all.
- **A tab opening.** Restoring a session is not the user doing something in it.

Everything else feeds the same clock: the configured `activityEvents` on the tab's own document
(`activityEvents` **replaces** the defaults rather than extending them), a `customActivityCheck`
polled once a second, the start of a session, and an explicit `resetTimer()` - which also announces,
so telling one tab the user is active tells all of them. `calculateTimeUntilLogout()` reports the
same deadline the logout uses.

Without multi-tab sync - or with `syncLogout: false`, where a logout stays in the tab that decided it

- each tab times out on its own, which is correct there: nothing it does ends anybody else's session.

### Where auto-login should not run

Some routes must not restore a session - a password-reset link, an invite acceptance, anything that
carries its own token in the URL. `withPersistentAuth` takes two independent ways to say so:

```ts
withPersistentAuth({
  autoLogin: {
    queryKey: 'refresh',
    buildArgs: (token) => ({ body: { token } }),
    excludeRoutes: ['/login'],
    shouldAutoLogin: (url) => new URL(url, location.origin).pathname !== '/reset-password',
  },
});
```

`excludeRoutes` is **prefix-matched**, which is the trap: `'/reset-password'` also excludes
`/reset-password-templates`, and a route policy written as substrings drifts wrong as the route table
grows. `shouldAutoLogin` receives the current route and returns whether auto-login may run, so the
decision can be an exact path, a parsed URL, or a query parameter - whatever the policy actually is.

The two are **independent vetoes**: either one refusing skips auto-login. Adding a predicate can
never re-enable a route `excludeRoutes` excluded, so the two can be introduced in any order. Most
apps want one or the other, not both.

### When the remember-me cookie is written and deleted

`withPersistentAuth` treats the cookie as a record of the session, not a mirror of the current token. It is **written** whenever a token is applied - a login, a refresh, `setTokens`, an incoming cross-tab update - and whenever `setRememberMe` changes whether it should outlive the browser session.

The cookie is host-only by default, so its origin-local encryption key and the cookie always have the same scope. Set `cookie.domain` explicitly only when sibling subdomains deliberately share the same storage and key setup. HTTPS cookies are marked `Secure`, and `sameSite: 'none'` always adds the attribute browsers require.

A browser keeps one cookie per name **per scope**, and `document.cookie` reports only names and values. A host-only cookie on `app.example.com` and a domain cookie on `example.com` therefore both exist under the same name, a read returns one of them without saying which, and a delete that names the wrong scope misses. So the feature keeps one scope only: every write and every delete also clears the same name in every other scope the page can reach - the host-only cookie when `cookie.domain` is set, and each parent domain of the host down to two labels. A browser refuses a domain a cookie may not use, so a public suffix among them costs a write that does nothing.

An app that changes `cookie.domain` (or upgrades from a version with the other default) keeps its session. Before the first read, the feature takes the value of the cookie in the old scope, deletes every other scope, and writes the value back in the new one. Nothing is left to shadow the cookie it writes from then on.

It is **deleted** only on the two events that actually end a session:

- `logout()`, including a logout synced from another tab.
- A refresh or auto-login the server was definite about rejecting - a `401` or `403`. Any other failure (offline, a `500`, a tab closed mid-attempt) leaves the cookie in place so the next load can try again. An auto-login that goes through the refresh query also [ends the session](#when-a-refresh-fails-for-good), so the cookie and the session state go together.

The absence of a token is deliberately **not** one of those events. It is absent on every startup - `tryLogin()` reads the cookie synchronously and the auto-login only resolves a tick later - so deleting on "there is no token right now" would throw away a 30-day refresh token before it was ever used.

## Error codes

The auth provider throws dev-mode `RuntimeError`s with codes **200–299** - missing token properties in a login/refresh response, or an auth feature used twice.
