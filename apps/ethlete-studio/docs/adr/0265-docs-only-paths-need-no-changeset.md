---
status: accepted
built: 853a1a9e3
decided: 2026-11-11
source: grill session 2026-11-11 (phone, late morning)
---

# Docs-only paths need no changeset

`yarn lint:changesets` decides by path, so an ADR edit under `apps/ethlete-studio/docs/adr/` counts as a change to the
`ethlete-studio` package and needs an `'ethlete-studio': none` changeset, which releases nothing. The check now skips a
fixed list of docs-only paths: the Studio ADRs and `plans/`. A change to code, a test or a story still needs a
changeset, and so does a published Markdown file (a package README or guide). Rejected: skip every `.md` file, because
package READMEs and guides ship with the package. The human: "q1ok".
