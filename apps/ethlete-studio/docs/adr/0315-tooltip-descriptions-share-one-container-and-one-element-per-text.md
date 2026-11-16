---
status: accepted
built: 93b4415fa
decided: 2026-11-16
source: doc-agent session 2026-11-16, screenshot of 25 tooltip description divs on body
---

# Tooltip descriptions share one container and one element per text

Every tooltip trigger with an accessible description appends its own visually hidden `div` to `body`; in fifagg 25
triggers left 25 sibling divs with the same text "Rush 2026". The human asked whether they could live in one container
like the style manager's. Asked whether they should go into their own visually hidden container (not the style manager's,
which is `hidden` and `aria-hidden`, so a screen reader may not read a description inside it) and whether triggers with
the same text should share one reference-counted element, with the recommendation yes to both, the human answered "q1ok".

Tooltip descriptions live in one SDK container under `body` that is only visually hidden, never `hidden` or
`aria-hidden`. Triggers with the same description text share one element, counted by its users: it is removed when its
last trigger leaves, and the container when it is empty. A trigger whose text changes moves to the element for the new
text and leaves the others untouched.
