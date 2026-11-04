---
status: accepted
open: none
decided: 2026-10-30
source: plans/ethlete-studio/design-system-actions/render-checks.md, 4.47, inventory approval view
---

# The inventory approval view

Studio shows the page's rest frame with a numbered box per control (green declared, red undeclared, amber
unclassified), a list beside it and one "approve inventory" button. The approval stores the control ids and part
hash in `.ethlete/design/<product>/inventory.json`; a control change or part edit reopens it, and a page with a red or
amber box cannot be approved. No keychain signature.
