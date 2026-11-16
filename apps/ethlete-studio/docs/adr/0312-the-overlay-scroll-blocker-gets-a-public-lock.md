---
status: accepted
open: B528
decided: 2026-11-16
source: doc-agent session 2026-11-16, morning round
---

# The overlay scroll blocker gets a public lock

fifagg locks page scroll outside any overlay (header menu, Tappp integration) with the Angular CDK
`BlockScrollStrategy`; the SDK scroll blocker locks only while a modal SDK overlay is open. Asked whether the existing
blocker should get a public lock call that returns a release function, so one place owns document locking, with that
recommendation, the human answered "q5ok".

The SDK overlay scroll blocker gets a public lock call that returns a release function. fifagg moves header and Tappp
integration onto it and drops the CDK scroll strategy.
