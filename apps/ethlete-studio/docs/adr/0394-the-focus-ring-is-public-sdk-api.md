---
status: accepted
open: none
decided: 2026-11-20
source: grill session 2026-11-20 (evening), list item D3
---

# The focus ring is public SDK API

The SDK's existing focus ring component becomes public in `@ethlete/components`, with its three `--et-focus-ring-*`
tokens documented, so an app can apply and tune the ring instead of rebuilding it. Studio's own parts keep their
inset-shadow focus; that is a Studio look, not a reason to keep the ring internal.

The human, asked to choose between making it public and documenting it or keeping it internal, with the
recommendation "public": "Q1ok".
