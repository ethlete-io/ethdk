---
status: accepted
built: cc89e18d5
decided: 2026-10-28
source: plans/studio/design-system/decisions-comments.md (deleted in B597), rulings of the human in the slice 5, 6 and 10 rounds
---

# Comment, note and author rulings of 2026-10-27

## Comments

- Comment mode is a toolbar button or `C`. A click on a frame sets a point, a click on a tile label comments on the state
  without a point. A popover holds a textarea: `Enter` sends, `Shift+Enter` breaks the line, `Esc` cancels; the mode stays
  on after a send.
- A comment stores its `size` (a preset name, a width such as `520`, or `fitted`) and its `interaction` (default rest). A
  pin shows only on a frame of the same size and the same interaction; elsewhere the label counts it ("N comments at
  another size"), on part canvases and on flows. A point is in CSS pixels from the top left of the frame.
- Comments are files, `<product>/comments/<id>.json`, committed and pushed like the parts: git is the only way a
  teammate's QC pass or an agent reply reaches anyone else. `et design check` fails on a comment whose part or state is
  gone. A change under `comments/` reloads the comments only, not the frames.
- A thread has replies (`by`, `text`, `createdAt`); the first text is always the user's. Done and Withdraw act on the
  whole thread: done deletes it and writes the note, Withdraw deletes it without a note. Every open thread blocks merge
  and discard on its part, whoever has the last word, also one older than the sketch.
- `et design inbox` lists a thread as work only when the last word is the user's; a thread the agent answered goes to
  "waiting for the user". `et design comment reply --question` marks a real question; any other agent reply makes the
  thread "answered" (tree badge "answered"). "Questions for you", the accent dot on the pin, the tree badge "question"
  and the "N ?" count on the comment button include real questions only.
- The sidebar lists all open threads of the product grouped by part; a click selects the part, moves the camera to the
  pin and opens it. Its own toolbar button toggles it, the state is remembered, and it never opens by itself.
- The sketch view shows only comments on sketch variants; comments on the product part show as one line that links to the
  part view. A pin without a point sits on the right edge of its state tile. An open pin shows a ring in the accent
  colour. A tree row with a question hides "comment open".
- A comment on a flow frame belongs to the state; the sidebar lists it as a part comment and a jump from outside the
  shown flow opens the part.
- When a `/__design` request answers HTML, Studio says "The design server is older than Studio - restart it" and never
  restarts the server itself. Only `content-type: text/html` triggers it.

## Notes

- A note explains a state and is not a task; a comment is feedback that needs an answer. The human writes, changes and
  deletes notes in Studio. A note on a state is `<product>/notes/<id>.json`; a free note (a heading over frames) lives in
  its flow's file. `et design check` fails on a note whose part or state is gone.
- A pointed note stores the `size` it was written at, required, and shows only at that size; a note without a point
  shows at every size. The frame label counts notes at other sizes with the comments.
- A pointed note is a small numbered square marker; its card sits below the frame in the column of notes, with the same
  number per frame. The connecting line is thin and right-angled and shows only while the pointer is over the marker or
  the card. Below zoom 0.25 a pointed note shows its marker only, and a note without a point disappears, so no card
  covers a design and cards of one note do not overlap. The matrix reserves note room at zoom 1.
- "Show notes" is a toolbar toggle, on at start, remembered per product. Note mode turns it on. Z-order, bottom to top:
  frames, flow lines, notes, comment pins, open popovers.

## Authors

- The agent's name comes only from data; UI copy says "Agent", never a model or vendor name. The avatar is the provider
  logo (official sources, ADR 0146). Every CLI command with which an agent writes needs `--by <model id>`, the exact
  id as free text; the coordinating agent writes it into each sub-agent prompt, an agent never guesses it.
- The CLI keeps authors per variant in `sketch.json` (first report first). `inbox done --by` goes to the variant's
  authors, or to `madeBy` of a product part. A merge writes `madeBy: string[]` into `definePart`, never drops it, and
  stores the variant's authors, not its own `--by`. Old data without an author shows none.
- Studio shows the author in the variant head ("a · <id>", first plus "+N"), in the thread, in the part head and in a
  report's tooltip.
