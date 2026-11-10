---
status: accepted
open: B249
decided: 2026-11-10
source: grill session 2026-11-10 (day shift), B249 question from the builder
---

# Studio does not jump into an edit sketch by itself

When a direct edit to a merged part changes its picture, the CLI creates the `<part>@edit` sketch with the variants
`old` and `new`. Studio does not switch the view to that sketch by itself. The part shows the "Direkte Änderung"
blocker, and the "Sketch öffnen" button opens the sketch. Until the human picks, the part is not build-ready. The human:
"q1ok" (option a, recommended).
