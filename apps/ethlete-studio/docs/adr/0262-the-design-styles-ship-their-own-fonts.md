---
status: accepted
open: B490
decided: 2026-11-11
source: grill session 2026-11-11 (phone round), finding 811
governs: ['.ethlete/design/studio/foundations/type/type.css']
---

# The design styles ship their own fonts

The design frame loads no web font, so `--font-code` resolves to SF Mono on the Mac and to the generic monospace on
Linux. The OFF-CENTRE rule measures text against font metrics, so the two machines get different hits, and a check on
the Mac drops ready records that Linux keeps (finding 811). The design styles now ship one monospace font and the UI
font themselves, so every machine measures the same font. Thumbnails and goldens change once; a part that then hits on
both machines is fixed in its CSS. Rejected: a rule baseline per OS (two truths, records still drop per machine) and a
rule tool fix (it removes only the font share, not the layout split). The human: "q1ok".
