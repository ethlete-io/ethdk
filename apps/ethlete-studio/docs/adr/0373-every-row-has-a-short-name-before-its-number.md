---
status: accepted
open: B609
decided: 2026-11-18
source: wish of the human 2026-11-18, form proposed by the analysis session (ethlete-sdk-3f) and approved by the human with "ok passt", relayed through the doc agent
---

# Every row has a short name before its number

The human: "nett wäre auch wenn wir anstelle von zb B503 ist fertig irgendwie zumindest etwas schreiben könnten damit
man erkennt was das ist ohne ins status doc zu sehen."

1. Every row gets a short name of 2 to 4 words (example B608: "Auto-Weg-Modus"). It stands first in the queue line and
   in its own column in `rows.md`.
2. Every text to the human puts the short name before the number: "Auto-Weg-Modus (B608) ist fertig", never "B608 ist
   fertig". This holds for the doc agent, builder reports, the supervisor and commit subject lines.
3. The same for ADR numbers in chat: at the first mention per message with a short content, "ADR 0354 (Plan-Ordnung)".
4. Old rows get their short name when they are sorted (B607), not in a pass of their own; new rows at once.
5. Enforced where the text is written: the queue command prints "short name (Bnnn)", so copied text is already right. A
   check for bare numbers only as fallback.
