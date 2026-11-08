---
status: accepted
built: c99006d83
decided: 2026-11-07
source: doc-agent session 2026-11-07, Q1 and Q2 (red Studio e2e job)
---

# The Studio e2e job stays in CI, non-blocking until its cases pass

The Studio e2e job never passed in CI: it built only `cli`, so the design server had no `components`/`core` dist and
Studio stayed on "Design-Server startet". With the build fixed, several old canvas cases fail. The job runs with
`continue-on-error` so CI (Next) goes green now; the builder fixes the cases one by one, then the job blocks again.
The human: "q1ok" (option a, recommended).

The job stays in CI. ADR 0226 keeps design checks out of hooks and CI, but end-to-end tests of the Studio app are app
tests like the timetrack e2e suite. The human: "q2 ne das bleibt das sind ja e2e".
