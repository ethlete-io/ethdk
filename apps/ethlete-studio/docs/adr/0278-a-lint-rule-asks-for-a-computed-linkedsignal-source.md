---
status: accepted
open: B497
decided: 2026-11-12
source: chat with the doc agent 2026-11-12 (morning round)
---

# A lint rule asks for a computed linkedSignal source

A `linkedSignal` whose source is an inline function over an input caused a defect in the night of 2026-11-11. The doc
agent asked whether a lint rule that asks for a `computed` source instead may go into the published
`@ethlete/eslint-plugin`, which changes lint for every consumer, with the recommendation "yes, as a warning first". The
human answered "q2ok".

- `@ethlete/eslint-plugin` gets a rule that reports a `linkedSignal` source written as an inline function over an input
  and asks for a `computed` source.
- The rule ships as a warning in the recommended config, not as an error.
- The rule ships with a changeset and an entry on the lint docs page.
