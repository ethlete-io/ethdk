---
status: accepted
built: b85cef043
decided: 2026-11-17
source: doc-agent session 2026-11-17 afternoon, part canvas with many states
---

# A page state changes the page itself

Asked whether a page keeps states that only change one inner part (for example `paused-reason` on the sketches page,
which only changes one variant header), with the recommendation that such a state belongs to the inner part; the human
answered "q2ok das ist ja so oder so eine violation die wir schon längst besprochen haben".

A page state is allowed only when the page itself changes (layout, empty, error, narrow width). A state that differs
from the page's default only inside one inner part belongs to that part as its own state, and the page draws the inner
part in its default. `design check` refuses such a page state.
