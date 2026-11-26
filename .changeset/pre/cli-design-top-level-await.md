---
'@ethlete/cli': patch
'@ethlete/agent-rules': patch
---

`et design check` fails a frame-loaded design module that awaits at the top level (`TOP-LEVEL-AWAIT`), which can hang WebKit; a call variant may default-export a promise of its drawing instead.
