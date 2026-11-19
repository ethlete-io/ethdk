---
status: accepted
built: 68473db8c
decided: 2026-11-19
source: doc-agent session 2026-11-19, the human on the status line showing in both sessions
---

# The status line shows only in the grill/docs session

The status-line mod reads the same repo files in every session, so the builder and the grill/docs session both show
the same band above the prompt. The human (German, verbatim): "bekommeen wir das ggf so hin dass die statusleiste
ebenso wie die e2e leiste nicht in beiden sessions gespielgelt wird?"

Asked where it should show (only grill/docs, only builder, or split fields), the human chose the recommendation
("q1ok"): only the grill/docs session. The human talks to that session and reads the builder's state there; the
builder knows its own slice.

How a session knows its role is technical and the builder's call.
