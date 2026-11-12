---
status: accepted
built: ce1eb19f3
decided: 2026-11-12
source: decision of the human, about 13:00 local, relayed by the analysis session (claude2); supersedes rules of ADR 0239, 0245 and 0285
---

# CI is the only push gate, and the builder pushes after each row

A full local push suite takes about 10 min (checks, lint, typecheck and tools about 30 s, cli specs about 130 s, studio
15 s, quota 190-260 s, e2e 165-195 s). CI then runs nearly the same in 16-20 min. 10 of 67 full local runs ended
blocked, and 197 commits waited locally on 2026-11-12. The human said (German, verbatim):

> was machen wir denn nun mit dem workflow generell. ständig sind wir am warten auf ewige dinge wie e2e nichts passiert
> nur warten

The analysis session proposed the six points below and asked "Darf next kurz rot sein, mit dem CI als einziger
Sperre?". The human answered "ok". The points are the analysis session's text, approved by the human.

1. Before a push only the fast checks run locally: checks, lint, typecheck and tools (about 30 s). The cli specs, quota
   and e2e no longer gate a push; CI runs them.
2. The builder does not wait for CI. It pushes and takes the next row. `next` may be red for a short time. Red CI is
   fixed first, before new work.
3. Push small and often: after each finished row, not after a day of commits.
4. Quota leaves the push path and runs once a day. A GitHub schedule starts only from the default branch `main`
   (finding 998), so quota goes into the B505 workflow on `main` that checks `next` daily, not into a schedule on
   `next`.
5. The Mac and the Windows PC become CI runners. They are only sometimes on, so no job waits for them: GitHub-hosted
   runners stay the default, the own machines are extra capacity. If that needs more than a label change, it is its
   own row, not part of B507. Before a self-hosted runner goes live, the builder checks whether the repo is public and
   whether a fork pull request could run on it; if yes, that is a question for the human. The speed gain is not
   measured.
6. A release still comes only from a green state.

This removes gates. B507 adds no new check, hook or script beyond what the removal needs.

It supersedes:

- ADR 0239: "Push only after a green push suite".
- ADR 0245: the push suite as a blocking gate. Its lint and typecheck of the touched projects stay, in the fast set of
  point 1.
- ADR 0285, rule 1: the Mac and the Windows PC no longer run the push suite as a gate; they become CI runners
  (point 5).

Order: B507 is built after the B506 font proof and before B498.
