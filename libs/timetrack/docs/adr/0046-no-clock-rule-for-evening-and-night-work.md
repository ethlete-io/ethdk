---
built: 4681e8512
---

# No clock rule for evening and night work

Lesson 4 of the September booking (`plans/timetrack/booking-lessons.md`) asked that after 20:00 and at night only
desk input counts. That contradicts ADR 0033: work a person steers from a phone is work, without a cap. The phantom
night presence that prompted the lesson came from prompts agent tools typed via tmux (ADR 0045), not from a person.

On 2026-11-18 the human chose: no clock rule. Lesson 4 is dropped.

- ADR 0045 removes the cause: a prompt another program typed is not presence.
- An accepted or edited row inside 00:00-06:00 carries a `night-row` warning. It only makes the row visible; nothing
  is refused.
- The agent CLI `rows` output names each row's presence evidence (desk events, human prompts), and an agent names a
  night row only with desk evidence.
