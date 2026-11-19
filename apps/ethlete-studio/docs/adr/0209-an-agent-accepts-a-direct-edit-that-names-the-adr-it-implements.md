---
status: superseded by 0048
open: B412
governs: ['.ethlete/design/*/merged.json', '.ethlete/design/**/sketches/**']
decided: 2026-11-06
source: doc-agent session 2026-11-06, finding 514 (shell-main@edit)
---

# An agent accepts a direct edit that names the ADR it implements

The human on the `elements/shell-main@edit` pick, which offered to drop the embedded title bar: "das ist doch totaler quatsch,
wieso sollte man jemals die titlebar aus der shell werfen?" A direct edit (a design change outside a sketch round)
that implements a decision the human already made is accepted by the agent itself, with the ADR in the note
(`et design accept <part> --by builder --note "ADR 0050"`); it shows in the part's history, not as a pick. A visible
direct edit without an ADR reference stays an `@edit` sketch for the human. The human: "ok" (option a, recommended).
