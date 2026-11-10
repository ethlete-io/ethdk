---
status: accepted
open: B249
decided: 2026-11-10
source: grill session 2026-11-10 (day shift), B249 question from the builder
---

# An edit with no old design gets a sketch with only `new`

When a part's picture changed but the tool finds no old design (`EDIT-OLD-NOT-FOUND`, for example after a rename),
Studio opens a `<part>@edit` sketch with only the variant `new`. Picking it records the edit. To discard it, the
builder reverts the file, because there is no `old` variant to pick. The hint no longer names `design accept`. The
human: "q2ok" (option a, recommended).
