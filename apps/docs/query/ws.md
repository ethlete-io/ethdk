# WebSockets

A room-based realtime client built on **socket.io**. It is independent of the query system - no client or repository involved - but pairs naturally with the [`withResponseUpdate`](/query/features#withresponseupdate) feature to push socket messages into already-loaded queries.

socket.io itself is not a dependency of `@ethlete/query` - install it in the apps that open a socket:

```sh
yarn add socket.io-client
```

Like the [query client](/query/queries#the-query-client), `createWebSocketClient` returns a root-provider tuple. You pass in socket.io's own `io` factory:

```ts
import { toInjectFn } from '@ethlete/core';
import { createWebSocketClient } from '@ethlete/query';
import { io } from 'socket.io-client';

const MATCH_SOCKET = createWebSocketClient({
  name: 'match-events',
  url: 'https://ws.example.com',
  io,
});

export const injectMatchSocket = toInjectFn(MATCH_SOCKET);
```

::: tip Why `io` is passed in
`socket.io-client` ships no `sideEffects: false`, so a single static import of it inside `@ethlete/query` could never be tree-shaken - every consumer would pay ~13 kB gz, in an app that never opens a socket too. Handing `io` to the one call site that needs it keeps the dependency where it belongs.
:::

```ts
@Component({/* … */})
export class MatchComponent {
  matchId = input.required<string>();

  private socket = injectMatchSocket();

  // reactive room: when matchId changes, the old room is left and the new one joined
  matchRoom = this.socket.joinRoom(() => `match:${this.matchId()}`);

  latestEvent = computed(() => this.matchRoom()?.latestMessage() ?? null);
}
```

## Configuration

| Option       | Default            | Description                                                           |
| ------------ | ------------------ | --------------------------------------------------------------------- |
| `name`       | - (required)       | Unique client name, used in the injection token.                      |
| `url`        | - (required)       | The socket.io server URL.                                             |
| `io`         | - (required)       | The `io` factory from `socket.io-client`.                             |
| `transports` | socket.io defaults | Ordered transport list: `'polling' \| 'websocket' \| 'webtransport'`. |

The underlying socket always connects with `withCredentials: true` and disconnects automatically when the providing scope is destroyed.

## Rooms

`joinRoom(room)` accepts a static room name or a reactive function and returns a `Signal<WebSocketRoom | null>`:

- A **function** is evaluated in a reactive context - returning a new string leaves the previous room and joins the new one; returning `null` joins nothing.
- Rooms are **shared**: joining the same room twice returns the same underlying room, and the room is left automatically when the consuming context is destroyed.
- A room exposes `latestMessage()` - a signal holding the most recent message for that room (or `null`).

## Connection state & reconnects

`isConnected()` reflects the socket connection. After a reconnect, the client automatically **re-joins every known room**, so consumers keep receiving messages without any handling on your side.

## Server protocol

The client speaks a small convention on top of socket.io:

- joining/leaving emits `'join-room'` / `'leave-room'` events with the room name,
- the server broadcasts JSON strings shaped like `{ room: string; event: string; data: TMessageData }` - the `room` field routes the message to the right `latestMessage` signal.

Malformed messages are logged and throw in dev mode only; in production they are silently dropped.

## Live-updating query responses

The canonical pairing - fetch once via HTTP, then patch the response from socket messages:

```ts
matchRoom = this.socket.joinRoom(() => `match:${this.matchId()}`);

matchQuery = getMatch(
  withArgs(() => ({ pathParams: { matchId: this.matchId() } })),
  withResponseUpdate({
    updater: ({ currentResponse }) => {
      const message = this.matchRoom()?.latestMessage();
      if (!message || !currentResponse) return null;

      return { ...currentResponse, ...message.data };
    },
  }),
);
```

The demo below shows exactly this pattern (with the socket simulated, since Storybook has no socket server):

<StoryEmbed id="query-demos-live-response-update--default" height="440px" />

## Testing it

Because `io` is an option rather than a hard import, a spec can hand the client a scripted socket -
`@ethlete/query/testing` ships one. Nothing connects on its own: the handshake happens when the test
says so, which is what makes "joined while disconnected, re-joined on connect" assertable.

```ts
import { createWebSocketTestDouble } from '@ethlete/query/testing';

const socket = createWebSocketTestDouble();
const MATCH_SOCKET = createWebSocketClient({ name: 'match', url: 'ws://localhost', io: socket.io });

TestBed.configureTestingModule({ providers: [MATCH_SOCKET.provide()] });
const client = TestBed.runInInjectionContext(() => MATCH_SOCKET.inject());

const room = TestBed.runInInjectionContext(() => client.joinRoom('lobby'));
TestBed.tick();

expect(socket.sent()).toEqual([{ event: 'join-room', data: 'lobby' }]);

socket.serverConnect(); // → isConnected() is true, every known room is re-joined
socket.serverSend({ room: 'lobby', event: 'score', data: { home: 1 } });

expect(room()?.latestMessage()).toEqual({ room: 'lobby', event: 'score', data: { home: 1 } });
```

`serverSendRaw()` delivers an unparsable frame, for the malformed-message path.

## Debugging it

With [`provideQueryDevtools()`](/components/query-devtools) installed, the panel's
**Sockets** tab lists every client with its connection state, its joined rooms and a
rolling log of **both directions** - the room joins and leaves this client sent as well
as the messages that came back. That is what tells a room that was never joined apart
from a room the server is simply quiet on.

Its **Emit** box sends a message as the app would, so a server that only answers a client
that asked can be provoked without adding a temporary button to the UI.

Without the provider none of it is recorded: the client checks once whether devtools are
installed, and every capture call is a no-op after that.

## Error codes

The WebSocket client throws dev-mode `RuntimeError`s with codes **1000–1999**: leaving a room that was never joined (`1000`) and malformed incoming messages (`1001`). Both degrade silently in production.
