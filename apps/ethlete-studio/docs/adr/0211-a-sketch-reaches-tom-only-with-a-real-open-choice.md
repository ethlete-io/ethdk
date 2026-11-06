---
status: accepted
open: B412
decided: 2026-11-06
source: doc-agent session 2026-11-06, findings 514-518
---

# A sketch reaches Tom only with a real open choice

All four `@edit` sketches sent to Tom on 2026-11-06 were needless: three implemented decisions he had already made
(title bar in the shell, button states in the existing style, inventory texts and placeholder), one showed no
difference at all. Tom: "ergo 4 skizzen und 4 davon sind unnötig? ... das darf nicht mehr passieren". A sketch waits
for Tom only when all three hold: (1) at least one drawn state differs, else the tool closes it itself; (2) no ADR or
plan decision covers the change, else the agent accepts it (ADR 0209, 0210); (3) the doc agent has seen a shot of the
sketch view showing the choice. The commit-time rule of B412 catches a direct edit at its author, so it never waits
hours for Tom. A sketch that fails (1) and still shows as "wartet auf deine Wahl" is a tool bug.
