---
status: accepted
open: B452
decided: 2026-11-09
source: doc-agent session 2026-11-09, screenshot of the sketch `components/title-bar@ci-red`
---

# Studio shows no CI state in the title bar

The human, on the "CI rot" badge of the sketch `components/title-bar@ci-red`: "aber wem bringt diese hässliche badge
was?" To dropping the badge: "ne soll er nicht".

This replaces the title bar part of ADR 0230. The builder reads the CI state from `et design status` and refuses a
feature slice while CI is red; the grill session reports a red CI to the human in chat. The title bar gets no CI badge,
and the sketch `components/title-bar@ci-red` is dropped.
