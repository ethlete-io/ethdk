---
open: B641
decided: 2026-11-19
---

# The day is laid out by project, and a browser tab can name one

The day screen draws one lane per checkout (`rows/lane.ts`, `laneKeyOf`), and browser time is drawn but never counted
(ADR 0020). The human, 2026-11-19: "noch was für später; wir sollten auch browser evicene nehmen. zb. wenn ich 2
stunden auf fifa.gg bin dann hab ich warscheinlich dort getestet. ähnliche pattern bei sowas wie gitlab/github, weitere
kundenseiten (bvb,vbl) aber auch tools a la figma. ein figma plugin ist aber noch geplant. dafür warscheinlich nötig ist
dass wir so langsam in projekten denken und nicht mehr in repos. das hier sind ja repos [the day lanes]. könnte man ggf.
über die jira projekte mappen"

Asked three questions with recommendations (lane per project; a browser reporter that sends the tab's address, with a
host-to-project list; browser time on a mapped host counts as a proposed row), the human answered "q1ok wobei jira
optional bleibt. es kann auch sein dass das im tool selbst definiert wird oder aus anderen adaptern irgendwann kommt wie
linear oder co q2ok q3ok", and "ok" to the summary.

1. **A lane is a project.** A project may be defined in Timetrack itself, or come from Jira or later another adapter
   (Linear); Jira is optional.
2. **A browser reporter sends the tab's address**, and a host list maps hosts (fifa.gg, bvb, vbl) to a project.
3. **Browser time on a mapped host is work**: a proposed row in its project that counts toward the day and is booked
   only once an issue names it. This amends ADR 0020 for mapped hosts only; there the lane still decides what counts.

From the question options, accepted by "ok", not said by the human: the reporter sends no page content; GitHub and
GitLab repository paths resolve through the existing checkout link (ADR 0032); a checkout without a project keeps its
own lane.

## Consequences

- The roadmap gated the reporter on the M1 reading of unnamed focus ("only if the M1 decision says it is needed").
  This decision takes the reporter without that reading. The M1 title rules (no-work titles such as YouTube, Jellyfin,
  Spotify, Home Assistant; a title that names an issue) stay open.
- The reporter needs an `Origin` exception in `src-tauri/src/ingest.rs` (it refuses every request with an `Origin`
  today) and a native messaging host.
- No private link covers a browser host today (roadmap); the private-project rule (ADR 0042) must be extended to hosts.
- The human said "für später": the doc agent's queue sets when; the Figma plugin is a separate decision.

Cross-check (ADR 0358 in Studio): asked at the human's request after the answers; "fix" on the draft (wrong ADR for the
private rule, the M1 gate, additions marked); no question to the human saved.
