---
status: accepted
open: B610
decided: 2026-11-18
amends: 0370
source: proposal of the analysis session (ethlete-sdk-3f) 2026-11-18, approved by the human with "das klingt gut so", relayed through the doc agent
---

# Consumers get the agent workflow from the agent-rules package

The human, after ADR 0372 (auto away mode) and ADR 0373 (short name before number): "der consumer agent sollte aber
auch nach dem system arbeiten dann denke ich".

1. Shipped through the package: the short-name rule, the queue command, the plan-system check script and the timestamp
   hook of the away mode move to `libs/agent-rules/content`. A consumer gets them with `ethlete-agents sync`.
2. ADR 0370 point 4 changes: instead of "the consumer builds that part itself", the consumer gets the tooling from the
   package and fills in only its own content. Otherwise two variants drift apart.
3. The away mode applies to the session that asks the human questions. A consumer repo has no doc agent, so it applies
   to the consumer session itself. The rule is written role-neutral.
4. Unchanged from ADR 0370: own decisions in the consumer repo, own queue and own row numbers, one channel into the SDK;
   the doc agent here does not manage the consumer session.
5. Order: build here first and run it for one week, then ship. Auto-Weg-Modus (B608) and Kurznamen (B609) are built
   package-ready from the start: no fixed paths or role names of this repo.

Not checked: whether the consumer (fifagg) already built its own plan system; the doc agent asks it through the one
channel.
