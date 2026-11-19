---
open: B602
decided: 2026-11-19
---

# A call draft without a clear project asks for one

In auto mode a call without an issue gets a new-issue draft that queues as a create approval (ADR 0035, 0054). The
draft needs a Jira project. Until now it got one only from a single favourite project or a single project among the
day's logged issues; on 2026-11-19 both FIFAGG and ET were logged, so a one-hour Slack call got no draft at all and
stayed "Not yet named".

When the project is not clear:

1. If the call has a transcript (only while the transcript switch is on, ADR 0044), the project is read from it.
2. Otherwise, or when the transcript names no single project, the draft still appears, with a project picker in its
   chip listing the candidate projects. One click picks it.

A call in auto mode is never left without a draft. The human: "vielleicht könnte man das aus dem transcript lesen
ansonsten a" (a = the draft with a project picker in the chip).
