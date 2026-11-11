---
status: accepted
built: de7098e65
decided: 2026-11-04
source: plans/ethlete-studio/build-ready.md, "Edit sketch decisions (2026-11-04)"
---

# Picking old is the discard of an edit sketch

A `<part>@edit` sketch (old/new after a direct edit) has no "Verwerfen" button. Picking `old` is the discard: the merge
writes the HEAD copy back into the part folder and records the hash, so the sketch does not reopen. Known limit:
`shared/` files are the working ones in both variants, so `old` does not undo a `shared/` edit.
