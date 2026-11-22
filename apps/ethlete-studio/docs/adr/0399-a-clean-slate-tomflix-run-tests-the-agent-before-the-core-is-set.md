---
status: accepted
open: B662
decided: 2026-11-22
source: doc-agent session 2026-11-22 (night), after the morning questions on translation, motion editor and Git
---

# A clean-slate tomflix run tests the agent before the core is set

The human parks translation (A34), the motion editor (A35) and Git in Studio (A38): "Das sind ja eher schon nice to
have Sachen. Dafür ist Studio noch nicht rund genug". What the Studio core is, the human sets after using the tool
again: "Das möchte ich selbst festlegen".

To get there, a test run rebuilds tomflix in Studio from a clean slate. It does not replace the tomflix rebuild of
ADR 0362, which keeps the old inventory as its reference.

- The agent gets only a short product description that the human writes as a customer would: no app code, no old
  design calls, no word on foundations, nesting or Studio. It works in its own tomflix branch.
- It is a fresh agent in the tomflix repo with only the skills every product repo gets. No hints from the SDK sessions.
- The human talks to it in the terminal like a customer and works in Studio (pick sketches, comment, merge).
- A silent examiner session reads the agent's transcript "wie ein Fahrprüfer" and never writes to it. It keeps the
  human's observation list (does it start with foundations, nest parts logically, think of interactions, propose a
  refactor when a nested design turns out to belong to two pages, fix Studio violations without the user noticing)
  and notes each miss as one line in the owning rebuild group.
- The agent must not find a finished design to copy: "wir müssen echt aufpassen dass der Agent nicht einfach Dinge
  wie das Studio Design findet". The run starts only once its checkout, skills and design tools give it no path to
  the Studio design, the SDK repo's design files or the old tomflix calls.
- CI on `next` is green before the run starts.
