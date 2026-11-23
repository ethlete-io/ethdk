---
status: accepted
open: B685
decided: 2026-11-23
source: doc-agent session 2026-11-23, Q1
---

# Check findings are for the agent, not the human

The warning tooltip on the tomflix sketch row in the part tree listed about 40 raw check lines (6x LOGO-SECTION, 7
identical STATE-SENTENCE lines). The human: "der text der hier steht ist auch ein desaster. das hilft niemandem mal
davon ab dass das eig nur für den agenten wirchtige info ist. er sollte selbst das wissen und damit umgehen und beheben
/ erst gar nicht diesen haufen an violations erst einbauen".

- Studio shows no raw check findings to the human. The tooltip list goes away.
- The designer agent gets each finding while it writes, and fixes it before it hands the sketch back. A sketch does not
  reach the human with open findings.
- Removes: the planned rework of the tooltip (grouped, counted, German, capped).
