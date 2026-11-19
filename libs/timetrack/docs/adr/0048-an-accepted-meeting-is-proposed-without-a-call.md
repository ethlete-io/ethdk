---
open: B626
decided: 2026-11-19
amends: 0010
---

# An accepted meeting is proposed without a call

On 2026-11-18 the human sat several hours in an in-person meeting. No call ran and the machine was idle, so ADR 0010
proposed nothing and the hours were invisible. The human: "bei anderen personen ist der kalender schon ggf exakt der
tagesablauf. das sollten wir nicht einfach ignorieren."

1. A calendar occurrence with no observed call is drawn in "Calls & meetings" as a **suggested** row. This replaces
   ADR 0010's "an accepted occurrence with no call observed proposes nothing".
2. Only an accepted occurrence that `isSharedOccurrence` admits (another attendee or a conference link) is proposed.
   An own blocker (commute, focus time) is not.
3. When a call runs over the occurrence, ADR 0010 still holds: the call is the fact and gives the real start and end.
4. Observed work over the occurrence does not suppress the suggestion. The human: "durch ki kann man ohne probleme
   während eines meetings arbeiten". Both rows stand side by side (ADR 0043); the human picks at review what is booked.
