---
status: accepted
open: B510
decided: 2026-11-14
source: doc-agent session 2026-11-14, afternoon round on SDK bundle size
---

# The dropzone crop step is an opt-in add-on

The crop step of the dropzone (739cae49a) ships inside `DROPZONE_IMPORTS` and adds 5.1 KB gzip to every app that uses a
dropzone. The human: "zuschnitt extra ggf als directives oder so on top. das brauchen nur wenige. zb fut frontend
braucht es nicht."

The crop step leaves the default dropzone imports. It becomes an add-on on top of the dropzone, for example a directive
with its own imports constant, that only apps which crop load. An app without it, such as fut-frontend, pays nothing for
cropping.

In the same round the human accepted the match-card loading skeleton with its +1188 B gzip on the default bracket cards
("q2ok"): it stays as built.
