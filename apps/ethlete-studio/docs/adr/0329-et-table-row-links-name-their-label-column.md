---
status: accepted
built: 76b68b2b1
decided: 2026-11-17
source: doc-agent session 2026-11-17 morning round, fifa report on et-table row link names
---

# et-table row links name their label column

A linked `et-table` row takes its accessible name from the first column without `interactive: true`; when that column
holds an image, the link reads "Image of <name>". The fifagg session worked around it in the app by merging the image
into the name column. Asked how the SDK should handle it, with the recommendation of a column option that picks the
label column and a default that skips image-only cells, the human said "ok".

`et-table` gains a column option that marks the column a row link takes its name from. Without it, the row link skips
image-only cells when it picks its name.
