---
status: accepted
built: f28fee046
decided: 2026-11-14
source: doc-agent session 2026-11-14, about 01:30 local
---

# The builder builds the SDK fixes, and the night of 2026-11-14 uses all capacity

The human: "der builder soll auch die sdk fixes bauen. gerne paralel arbeiten." The one builder (ADR 0285) also builds
the SDK fixes, such as fifagg requests, in parallel with its Studio work, for example in a subagent. No separate SDK
session exists any more; this replaces the third session of ADR 0200. The fifagg session sends its SDK requests to the
builder directly.

The human: "reset ist um 6:30 uhr. und dann nochmal um 11:30 uhr. um 14 uhr ist weeklz limit reset bnis dato wollen wir
verbrauchen was maximal möglich ist. also go ham". Until the weekly reset at 14:00 on 2026-11-14 the sessions use as much
capacity as they can, with parallel subagents on disjoint paths. The order of ADR 0285 stays: CI red first, then the
evening list, the second list, the rebuild groups. One-shot watchdogs at 06:35, 11:35 and 14:05 type a resume line into
an agent pane stopped at a usage limit, as in ADR 0220. The human: "kümmere dich auch um den fifa agent. manage ihn
auch." The doc agent also resumes and steers the fifagg session.

The human answered "beides ok" to the summary. `built` names HEAD at the decision, because no code change builds it.

Addendum, 01:50: the human: "um 15 uhr dann wollen wir nur noch angebrochene arbeit beenden. nicht mehr full ham mode
dann." From 15:00 the sessions only finish work already started and start nothing new.

Addendum, 02:00: the human: "ich erlaube dir auch den nötigen merge auf gh für den pre release den die fifa session
braucht sobald dort alles drin ist." The doc agent merges the prerelease PR on GitHub (`changeset-release/next`) once
the SDK fixes the fifagg session needs are on `next` and its CI is green.
