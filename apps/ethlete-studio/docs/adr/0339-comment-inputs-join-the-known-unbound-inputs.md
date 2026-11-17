---
status: accepted
open: B539
decided: 2026-11-17
source: doc-agent session 2026-11-17 (late evening), the human on the comment mode inputs
---

# The comment inputs join the known unbound inputs

The comment mode's app component has three inputs the design does not feed: `comments`, `selectedComment` and
`writer`. They are runtime data. The permission check required the human's OK for the exception. The doc agent
recommended it; the human answered "ok".

- `comments`, `selectedComment` and `writer` join `KNOWN_UNBOUND_INPUTS`.
