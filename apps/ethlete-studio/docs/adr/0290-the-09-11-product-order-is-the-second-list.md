---
status: accepted
built: c98c549d4
decided: 2026-11-12
source: chat with the doc agent 2026-11-12, afternoon local
---

# The 09.11 product order is the second list

ADR 0285 puts the human's evening list and second list before the rebuild rows B498-B506. On 2026-11-12 neither list
existed, but STATUS still held the human's binding product order of 09.11 (A1 rest, B345, A13, A24, A2 + A3).

The doc agent recommended: this order counts as the second list until the human writes a new one. The human answered
"ok".

- The builder builds the open rows of the 09.11 order before B498.
- A new evening list or second list from the human replaces it.
- In effect since the decision; `built` names HEAD at that time, because no code change builds it.
