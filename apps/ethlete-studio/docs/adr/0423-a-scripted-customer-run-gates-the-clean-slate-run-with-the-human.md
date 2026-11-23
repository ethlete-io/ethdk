---
status: accepted
open: B687
decided: 2026-11-23
amends: 0402
source: doc-agent session 2026-11-23, Q1 (afternoon)
---

# A scripted customer run gates the clean-slate run with the human

The tomflix sketch "Entwurf 46 B" reached the human with seven parts in one sketch and about 40 raw check lines. The
builder started to fix the sketch by hand. The human: "ich weiß nicht ob es smart ist nun das design so zu monkey
patchen. so prüfen wir ja nicht ob der workflow nun fixed ist. ggf. können wir dieses testen auch automatisieren. das
hier hätte ich ja nicht melden müssen. das ist purer quark". He chose the pre-run option ("q1ok").

- No agent fixes the output of a clean-slate run by hand. A workflow fix is proven by a new run.
- Before a clean-slate run with the human, a scripted run goes first: a customer agent gets the same first message
  (ADR 0416) and answers by fixed simple rules instead of the human.
- After the scripted run, a script checks the result: every sketch holds one part, no sketch reached the human view
  with open check findings, the design check is green. The human gets the report and the shots.
- Only a green scripted run leads to a run with the human. His judgement as a customer stays with that run.
- Amends ADR 0402: the design stage of the scripted run starts without the human; the run with him keeps his
  presence.
