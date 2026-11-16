---
status: accepted
open: B541
decided: 2026-11-16
source: doc-agent session 2026-11-16, fifa report Table L-1 (10 gg list tables without a header)
---

# et-table can hide its header row visually

`et-table` always renders its header row; gg has ten list tables without a visible header, and screen readers still
need the column headers. Offered (a) an input such as `headerHidden` that hides the header row visually and keeps it
for screen readers (the SDK already has `et-visually-hidden`), (b) an input that removes the header row for everyone,
(c) no SDK change, the app hides it with its own CSS. The human: "q2ok" (option a, the recommendation, in the same
prerelease as the stream changes).

`@ethlete/components` gets a `headerHidden` input on `et-table`. The header row stays in the DOM and in the
accessibility tree and is only visually hidden. Without the input nothing changes. Docs page and changeset are part
of the change.
