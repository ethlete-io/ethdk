---
'@ethlete/query': patch
---

WebSockets: a malformed frame no longer writes to the console outside dev mode, so a chatty server cannot flood production logs.
