# `BearerAuthProvider.setTokens()` doesn't update `executionState`, despite its JSDoc

Found 2026-08-05 debugging an Entra SSO callback in `fut-frontend` (`@ethlete/query@6.0.0-next.25`)
that silently never redirected the user after a successful login - no console error, no failed
request, the app just sat on the "logging you in" screen forever.

`libs/query/src/lib/auth/bearer-auth-provider.ts`'s `setTokens` JSDoc reads:

> Behaves exactly like a successful auth query: the tokens are applied, `bearerData` /
> `isAuthenticated` update, `afterTokenRefresh$` emits so waiting secure queries run, and (unless
> disabled) other tabs are synced.

The implementation only does this:

```ts
const setTokens = (access: string, refresh: string) => {
  accessToken.set(access);
  refreshToken.set(refresh);
  afterTokenRefresh$.next();
};
```

`executionState` is untouched. It's only ever set inside `setupBearerQueryRegistry`'s query-execute
effects (`loading` / `success` / `error` around an actual query run) and in `logout()`. A consumer
whose "login succeeded, now redirect" logic is driven by `executionState().state === 'success'` -
which is the natural thing to build once `executionState` exists as a signal for exactly that
purpose, and is how the rest of `fut-frontend`'s login flow already works for the password and
credentials logins - never fires for a `setTokens()`-seeded login (SSO/OIDC callback, native-shell
token handover, test harness: the three cases the JSDoc itself names as `setTokens`'s use cases).

**Workaround used:** the consumer (`fut-frontend`'s Entra success-route handler) now calls its own
redirect function directly, right after `setTokens(...)`, instead of relying on the app-wide
`executionState`-watching redirect logic that every other login path shares.

**Suggested fix:** either make `setTokens` set `executionState` to a `'success'` state (e.g.
`{ type: 'tokenSeed', state: 'success' }`, mirroring the `{ type: 'logout', state: 'success' }` that
`logout()` already sets) so it's fully interchangeable with a query-driven login as the JSDoc
claims, or - if that's deliberately out of scope for `setTokens` - correct the JSDoc to say so
explicitly, since "behaves exactly like a successful auth query" currently reads as a stronger
guarantee than the code delivers.
