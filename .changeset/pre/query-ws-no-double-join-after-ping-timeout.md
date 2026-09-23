---
'@ethlete/query': minor
---

WebSocket client: a room joined after the ping expired, or held across a recovered reconnect, is no longer joined twice. `WebSocketClientSocket` now requires `onAnyOutgoing` and `recovered`; add both to a hand-written fake.
