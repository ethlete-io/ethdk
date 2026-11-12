---
status: accepted
open: B496
decided: 2026-11-12
source: chat with the doc agent 2026-11-12 (morning round)
---

# SDK component CSS moves into a components.sdk sublayer

All SDK component CSS sits in `@layer components`, the same layer as the CSS of the apps, so an app rule wins over an SDK
rule only by specificity or source order, and not at all on the internal parts of a component. The doc agent asked: put
all SDK component CSS into one sublayer `@layer components.sdk`, so an app rule in `@layer components` wins on every
button, internal parts too; a behaviour change for apps with a changeset and docs, and a change to the agent-rules
styling rule. The human answered "q3ok".

- Every SDK component CSS file wraps in `@layer components.sdk { … }` instead of `@layer components { … }`.
- An app rule in `@layer components` then wins over every SDK component rule, internal parts included.
- The change ships with a changeset (a behaviour change for apps), the docs page on styling, and the styling rule in
  `libs/agent-rules/content` (then `yarn agents:sync`).
