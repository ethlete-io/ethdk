---
status: accepted
open: B552
decided: 2026-11-17
source: doc-agent session 2026-11-17 morning round, the KNOWN_UNBOUND_INPUTS question for pages/system
---

# The system page places comment pins in one place

The pages/system component draws comment pins and the comment list on its own stand-in canvas, but the app never uses
that path: the system view places the pins itself through the shared design canvas. So the design inputs `comments`,
`selectedComment` and `writer` have no app source, and `design check` reports them three times as STATE-NO-SOURCE.
The human asked whether this is duplicated code again. Offered (A) exempting the three inputs in the known-unbound list
or (B) the system view passing its comments to the page component, so pins are placed one way; the human said "ok"
to B.

The system view hands its comments to the pages/system component, and pins are placed through one path. The three
inputs get no exemption.
