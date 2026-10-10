# hunt-query-auth-ws — bug hunt 2026-10-10

Scope: `libs/query/src/lib/auth` (token refresh, concurrent 401s, logout during refresh, cookie sync),
`libs/query/src/lib/ws`, `libs/query/src/lib/query-form-signals`. Not repeated: everything in `query-b.md`
(all fixed) and `hunt-query-http.md`.

The refresh path (`bearer-auth-query-builders.ts` executeRefresh / delegation / takeover, the 401 retry in
`secure-query-execute-factory.ts`, supersession in `setupBearerQueryRegistry`) and the query-form commit /
URL paths were read end to end. They hold up against the sequences tried (concurrent 401s on one token, a
logout while a refresh is out, a debounced edit racing a back navigation, `unobserve` with a pending
commit). The findings are in the seams between the ws client and the auth session.

| ID     | Sev    | Kind | Decision | Title                                                                                               |
| ------ | ------ | ---- | -------- | --------------------------------------------------------------------------------------------------- |
| HQB-01 | Medium | bug  | no       | The ws socket keeps the previous user's handshake after `setTokens()` or a cross-tab account switch |
| HQB-02 | Medium | bug  | no       | Emits buffered before a logout reach the next session's socket, including room joins                |
| HQB-03 | Medium | bug  | yes      | After a logout, `joinRoom()` keeps returning the completed room and never re-joins after login      |
| HQB-04 | Low    | dx   | yes      | After a logout the ws client stays disconnected, while a fresh anonymous page load connects         |
| HQB-05 | Medium | bug  | yes      | A login over a live session keeps the previous user's secure cache entries                          |

## HQB-01 The ws socket keeps the previous user's handshake after `setTokens()` or a cross-tab account switch

- Where: `libs/query/src/lib/ws/web-socket-client.ts:535-545` (only a `login` execution in `success`
  counts as a new session); `libs/query/src/lib/auth/bearer-auth-provider.ts:865-872` (`setTokens` reports
  `{ type: 'tokenSeed' }`); `libs/query/src/lib/auth/internal/multi-tab-sync.ts:222-229` (a tab that holds
  tokens adopts another tab's pair with `applyTokens`, no execution state at all);
  `libs/query/src/lib/devtools/query-devtools-auth-sessions.ts:825` (devtools account switch calls
  `setTokens`).
- Problem: the docs (`apps/docs/query/ws.md:78`) promise a reconnect "when a session starts - a login
  after being anonymous, or a different user". Sequences that switch user without a `login` query leave the
  socket on the old identity:
  1. Authenticated as X, the app calls `auth.setTokens(yAccess, yRefresh)` (SSO hand-over, native shell).
     `sessionStatus` stays `'authenticated'`, `execution.type === 'tokenSeed'`, so `login` is `null`,
     `startedSession` is `false`, and the socket keeps X's handshake until it next drops.
  2. Devtools "switch account" with `reloadOnAuthSwitch: false` - the same path.
  3. Two tabs on X with `withMultiTabSync`; tab B logs in as Y. Tab A gets `tokens-updated`, takes the
     `applyTokens` branch (it already holds a token), and its socket stays on X.
- Fix: in the ws auth effect treat a `tokenSeed` success (a new object each call) like a `login` success.
  For the cross-tab case compare an identity: reconnect when the decoded `sub` (or a configurable
  `sessionIdentity(bearerData)` on the provider) differs from the one the socket connected with. Scenario:
  extend `ws.scenario.spec.ts` "with an auth provider" with `auth.setTokens(...)` while authenticated and
  assert a second handshake with the new token.
- Breaking: no. Decision: no (the identity comparison could be a follow-up).
- Status: fixed. New public `sessionId()` on the bearer provider (bumps on a session start or a different `sub`); the ws client reconnects when it changes or on a `tokenSeed` success. Scenario: `ws-auth-hunt-2026-10-10.scenario.spec.ts`.

## HQB-02 Emits buffered before a logout reach the next session's socket, including room joins

- Where: `libs/query/src/lib/ws/web-socket-client.ts:488-505` (`endSession` disconnects and clears `rooms`,
  not the socket's send buffer), `:256-265` (`emit`), `:557` (`send`). socket.io keeps `sendBuffer` across
  `disconnect()` and flushes it on the next `onconnect`
  (`node_modules/socket.io-client/build/esm/socket.js:648-660`, `:600-607`); the test double mirrors that
  (`libs/query/testing/web-socket-test-utils.ts:79, 131`).
- Problem: whatever was emitted while the transport was down, or after the logout, goes out on the next
  user's authenticated connection:
  1. User X is connected; the transport drops (`transport close`, socket.io retrying).
  2. A component joins `private-x` (`join-room` buffered) and X calls `send({ event: 'chat', data })`
     (buffered).
  3. X logs out: `endSession()` completes `private-x` and moves its holder to `endedRoomHolders`.
  4. Y logs in: `startConnection()`, handshake carries Y's token, socket.io flushes `join-room private-x` and
     `chat` into Y's session. The server joins Y to X's room; the client drops the frames (no room), and when
     the old component is destroyed `leaveRoom` takes the `endedRoomHolders` branch and never emits a
     `leave-room`, so Y stays in that room for the whole session.
     A `send()` made while logged out (the client is suspended) is also held and delivered to the next login.
- Fix: in `endSession()` empty the buffer (`socket.sendBuffer = []`, a public field in socket.io-client 4)
  before `disconnect()`. Keep buffering joins made while suspended (the next session needs them - the
  `connect` handler relies on it), but drop `send()` while `suspended`, with a dev-mode warning. Scenario:
  the sequence above with the test double; assert Y's session receives no `join-room private-x` and no
  `chat`.
- Breaking: no. Decision: no.
- Status: fixed. `endSession()` and a user-switch reconnect empty `socket.sendBuffer`. Scenario: `ws-auth-hunt-2026-10-10.scenario.spec.ts`.

## HQB-03 After a logout, `joinRoom()` keeps returning the completed room and never re-joins after login

- Where: `libs/query/src/lib/ws/web-socket-client.ts:294-304` (static join: `roomData` is only reset on
  destroy), `:309-331` (reactive join: `roomData` / `joinedRoomName` untouched), `:498-503` (`endSession`
  completes and forgets the rooms without telling the per-caller signals); docs `apps/docs/query/ws.md:79`
  ("Join again after the next login").
- Problem: a component that stays mounted across logout and login (a live ticker in the shell, a login
  dialog over the page) keeps `room()` non-null and pointing at a completed room. `room()?.latestMessage()`
  shows the last message of the ended session forever, `messages$` is complete, and after the next login
  nothing re-joins: the room is gone from `rooms`, so the `connect` handler has nothing to send. A static
  `joinRoom('lobby')` cannot "join again" without remounting; a reactive one only re-joins if its function
  happens to read auth state. `joinRoom`'s JSDoc says the signal is `null` when no room is joined - it is
  not.
- Fix: two options. (a) On `endSession`, set every caller's `roomData` to `null` (keep a registry of the
  writable signals) so a template can see the room is gone. (b) Keep the callers' holds and re-join them on
  the next session start, handing each caller a fresh room object. (b) matches "socket follows the session"
  but changes what `messages$` completion means.
- Breaking: (a) no, (b) behavior change. Decision: yes.
- Status: fixed (decision: rooms held at logout read `null` and re-join after the next login; joins made while anonymous work normally). Scenario: `ws-auth-hunt-2026-10-10.scenario.spec.ts`.

## HQB-04 After a logout the ws client stays disconnected, while a fresh anonymous page load connects

- Where: `libs/query/src/lib/ws/web-socket-client.ts:525-533` (`anonymous` after `authenticated` calls
  `endSession()` and sets `suspended`; only a first-ever `anonymous` calls `startConnection()`);
  scenario `libs/query/src/scenarios/ws.scenario.spec.ts` "disconnects on logout ... and stays down".
- Problem: an app with public rooms (live scores visible to guests) gets a connected anonymous socket on a
  fresh page load, but after a logout the same page has no socket until the next login or a reload. Joins
  made while logged out are buffered and silently wait for a login that may never come. The two anonymous
  states behave differently with nothing in the API to choose between them.
- Fix: after `endSession()`, reconnect anonymously (fresh session, empty buffer per HQB-02), or add an
  option `connectWhenAnonymous: boolean` that governs both the first load and the post-logout state.
  Document the choice in `ws.md`.
- Breaking: depends on the default. Decision: yes.
- Status: fixed (decision: reconnect as anonymous after logout). Clients without `authProvider` never react to auth; scenario proves it. Docs: `apps/docs/query/ws.md` (Public sockets).

## HQB-05 A login over a live session keeps the previous user's secure cache entries

- Where: `libs/query/src/lib/auth/bearer-auth-provider.ts:887-902` (`logout` is the only path that calls
  `queryClient.repository.unbindAllSecure()`, besides the first-session purge at `:938-955`);
  `:850-859` (`applyTokens`, used by a successful login and by `setTokens`, unbinds nothing). The devtools
  account switch does the unbind itself (`libs/query/src/lib/devtools/query-devtools-auth-sessions.ts:453-460`),
  which shows the gap.
- Problem: authenticated as X, the app runs the login query for Y (a "switch account" dialog, a login page
  reachable while signed in) or calls `setTokens()` with Y's pair. The tokens change, but every mounted
  secure query keeps X's `response`, and a new secure query with a key X already fetched is served X's
  cached entry (`afterTokenRefresh$` only re-runs queries that failed with a 401). The same happens in a
  second tab via multi-tab sync (HQB-01, case 3), where the incoming pair is applied as a plain rotation.
- Fix: decide the identity of a session (the decoded `sub`, or a provider option), and when a new pair
  carries a different identity run the same teardown a logout does for secure entries
  (`unbindAllSecure()`, which already re-arms auto-executing secure queries) before applying it. Without an
  identity, at least treat a `login` / `tokenSeed` success while `authenticated` as a session change.
  Scenario in `auth.scenario.spec.ts`: log in as X, fetch a secure query, log in as Y, assert the query
  refetches and the cache holds no X response.
- Breaking: no (a refetch where there was none). Decision: yes (what defines "a different user").
- Status: fixed (decision: different `sub` clears secure entries; without `sub` on both tokens a login/seed counts as different, a rotation does not). Scenario: `auth-hunt-2026-10-10.scenario.spec.ts`. Docs: `apps/docs/query/auth.md` (Switching users).
