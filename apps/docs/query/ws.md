# WebSockets

A room-based realtime client built on **socket.io**. It is independent of the query system - no client or repository involved - but pairs naturally with the [`withResponseUpdate`](/query/features#withresponseupdate) feature to push socket messages into already-loaded queries.

Like the [query client](/query/queries#the-query-client), `createWebSocketClient` returns a root-provider tuple:

```ts
import { toInjectFn } from '@ethlete/core';
import { createWebSocketClient } from '@ethlete/query';

const MATCH_SOCKET = createWebSocketClient({
  name: 'match-events',
  url: 'https://ws.example.com',
});

export const injectMatchSocket = toInjectFn(MATCH_SOCKET);
```

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

## Error codes

The WebSocket client throws dev-mode `RuntimeError`s with codes **1000–1999**: leaving a room that was never joined (`1000`) and malformed incoming messages (`1001`). Both degrade silently in production.
