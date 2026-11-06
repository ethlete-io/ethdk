---
status: accepted
open: B398
decided: 2026-11-06
source: grill session 2026-11-06
---

# A second builder session builds the UI in parallel

Tom: "ich würde gern auch mal wieder fortschritt machen an der eigentlichen ui". The first builder works on tool fixes
(slice B rework of finding 482 in the sketch view and `sketch ready`, then 477 and 481), so visible Studio UI waited
behind the whole tool queue.

A second builder session runs in its own tmux session with its own context, not as a subagent of the first builder. It
takes only parts that do not touch the sketch view or `libs/cli`, and claims its paths with agent-sessions. A tool
defect it meets goes to the grill session and the first builder as a finding; it does not fix the tool itself. Its
order: A1 (title bar code to the merged variant C: window buttons, search field "studio / Part", update button only
when an update is ready), then A2 (title search, click or Ctrl+K opens the command palette), then A3 (update button),
then A36 (explorer) as a sketch with variants for Tom. Tom: "q1ok q2ok".
