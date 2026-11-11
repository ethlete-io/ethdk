---
status: accepted
built: 0a4f4d36b
decided: 2026-11-11
source: chat with the doc agent 2026-11-11 (evening), findings 864 and 865
---

# User-facing tool fixes are built; agent machinery fixes wait for a weekly block

Since 2026-11-05 the Studio app gained about 3,300 lines and the tooling about 43,500. Of findings 849-865, about 5
change the tool for every Studio project and about 11 fix only the agent machinery (push order between the machines,
a full `/tmp`, restarts, the mailbox, the archive, built markers). The human: "seit tagen passiert nicht wirklich was in
studio abseits von kleinkram. alles sind fix loops" and "einfach sagen wir machen jetzt keine tool fixes mehr kann doch
auch nicht die lösung sein".

The doc agent asked: should the builders keep building tool fixes for Studio users right after the current STATUS
item, while a fix to the agent machinery runs only when CI is red or it really blocks the work, and every other one is
written down in one line and collected for a fixed cleanup block, for example once a week? The human: "q1ok".

- A finding whose tool fix every Studio project feels is built right after the current STATUS item (ADR 0234 order
  stays).
- A finding about the agent machinery is built only when CI is red (ADR 0230) or it blocks the current item.
  Otherwise it is one line in the machinery backlog, worked in one cleanup block per week.
