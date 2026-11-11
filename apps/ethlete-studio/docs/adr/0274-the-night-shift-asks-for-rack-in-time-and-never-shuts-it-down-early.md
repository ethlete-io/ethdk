---
status: accepted
open: B480
decided: 2026-11-11
source: chat with the doc agent 2026-11-11 (late evening)
---

# The night shift asks for rack in time and never shuts it down early

ADR 0273 keeps `rack` off and has the human switch it on for a batch of Windows work. The human cannot be reached in
the night shift (ADR 0259). The human: "in der nachtschicht bin ich nicht erreichbar. wird rack also in nachtschicht
gebraucht so muss ich drauf hingewiesen werden rechtzeitig damit ich ihn einschalten kannn. ebenso darf die nachtschicht
ihn dann nicht aus versehen ausschalten oder sowas. nur wenn die arbeit aufnrack sicher erledigt ist". The human
confirmed this summary with "ok":

- If the night shift needs `rack`, the doc agent tells the human before the human leaves. At the latest when the human
  says "afk" or "Feierabend", the doc agent names the collected Windows work, and the human switches `rack` on.
- In the night shift no agent shuts `rack` down while work on it is open.
- Shutting `rack` down is allowed only when the work on it is surely done: the results are saved, and no process runs
  on `rack` any more.
- If the human does not switch `rack` on, the Windows work stays parked, and the night shift goes on with other work.
