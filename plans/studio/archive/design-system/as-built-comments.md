# Archive: as-built logs, comments, notes, authors

### Comment done note (2026-10-27)

- `et design inbox done <id>` needs `--note "<reason>"`. The note replaces the part's note, not
  appends to it, and still explains the whole shape of the part; the agent may keep the old note
  when it still holds. Withdraw is a separate Studio path that deletes without a note.
- Breaking: `et design inbox --json` gives `{ items, waitingForUser }` instead of an array. No
  migration, since only agents read it.

### Frame reload files and done authors, as built (2026-10-27)

- 69b6c4f73 (`libs/cli`): `parts` on a file added or removed. `config.json` sends `{ all: true }`;
  comment files send no `parts` (only `comments`); `sketch.json` sends none (it holds decisions). A
  file in `<product>/<layer>/<part>/...` sends that part with `sketch: null`; only its shots drop,
  not the dependents'. A file in `sketches/<layer>-<part>/<variant>/...` sends every part drawn in
  that variant, each with `sketch: { target, variant }`. A file in no part folder sends
  `{ all: false, parts: [], errored: true }`.
- New optional field `errored: true`: also reload the frames that show an error now. The server
  cannot know which frames these are, so Studio applies it in the Studio side of step 6.
- `inbox done --by`: a comment on a sketch variant adds the id to `variantInfo[v].authors` (if
  absent; `madeBy` waits for the merge); a comment on a product part adds it to the part's `madeBy`
  (if absent, the same write as the note). Studio's own "done" passes no author.
- The design-exploration skill says in one sentence where `inbox done --by` stores the id.
- Builder choices beyond the plan: the `errored` field, and a sketch-variant file reloads all frames
  of that variant.

### Agent authors, as built (2026-10-27)

- 6746f09aa (CLI): `--by` is required on `sketch new|report|ready|rebase|merge|discard`, `inbox
done` and `comment reply`; without it the command exits 2 with its usage. `sketch.json` has
  `variantInfo: { a: { authors: [...] } }`, in first-report order, without duplicates. `sketch
report` takes `--variant`. A merge writes the picked variant's authors as `madeBy` in
  `definePart`, and removes `madeBy` when there are none.
- The API gives `variantInfo[v].authors`, `report.author`, `report.variant`, `replies[].author` and
  `part.madeBy` (`[]` when unknown).
- 414e7f23b (agent-rules): the synced skill tells agents to pass the exact model id to every write.
  No `et update` migration, since the callers are agents. The `@ethlete/cli` changeset is major.
- The Studio display: built, see "Agent author display, as built".

### Agent author display, as built (2026-10-27)

- 15021ef34: the matrix column head shows the first author after the variant, for example
  "a · gemini-3-argon". With more authors it adds a count: "b · gpt-5.6-sol +1". The tooltip lists
  all of them: "b by gpt-5.6-sol, claude-opus-5-5". While an agent draws, the head shows
  "a · claude-opus-5-5 · drawing …". Old data without authors shows only "a" and the old tooltip.
- A comment thread shows an agent reply as "Agent · gpt-5.6-sol". An old reply without an author
  shows "Agent".
- The part view has no header. Therefore "made by gemini-3-argon +1" (mono, subtle) is the first
  item in the floating bar at the top right, next to the theme and comment buttons. Its tooltip
  lists all authors. An empty or missing `madeBy` shows nothing.
- The report tooltip shows the message, a blank line, then "by claude-opus-5-5". A report without
  an author shows only the message.
- Builder calls use the same format: "made by" with the first author and "+N", and the column
  tooltip "<variant> by a, b".
- c7ec853d7: `studio-lab` shows it. Sketch `components/button` has authors on a and b, sketch
  `components/card` on a; the part view of `components/button` and `elements/list-row` shows "made
  by"; a comment on `components/button` (state outline) has an agent reply with an author. The live
  report is a temp file and is gone after a reboot.

### Answered threads server, as built (2026-10-27)

- d4a106c80, bdfbf05d2 (help), b56340707 (lab data). The Studio side is in progress.
- A flagged reply is `{ by: 'agent', author, text, createdAt, question: true }`. Only an agent reply
  can carry `question`, and only as `true`. The CLI prints "asked: <file>".
- `threadStateOf(comment)` gives `'agent'` (the user spoke last, or no replies), `'question'` (the
  agent spoke last, with the flag) or `'answered'` (the agent spoke last without the flag; also
  old data). `/__design/comments` and `inbox --json` add `threadState`. The inbox text marks
  "(question)" and "(answered)" and shows a flagged reply as "agent <id> asks:". An answered thread
  still waits for the user and blocks merge and discard.
- The skill: an agent passes `--question` only when it cannot go on without the answer.
- `studio-lab`: answered is on the `components/button` sketch, variant b, state outline ("The
  outline border looks thin next to the solid one."). The question is on the product part
  `components/button`, state solid ("The shipped solid button reads heavy in the card footer next
  to the ghost link."). Until the Studio side lands, Studio shows both as questions.

### Answered threads Studio, as built (2026-10-27)

- fd6fd55f4. Tree badge: "question" in the accent colour, "answered" neutral. The priority is
  question, then answered, then comment open.
- "N ?" and "Questions for you" count only real questions. An answered thread stays in its part's
  group in the panel, with "answered" in the subtle line under it, and still blocks merge and
  discard.
- Sketch view: pins and size notes use only comments with `sketch`. Next to the "N open comments"
  lock, a transparent `et-button` "1 comment on the product part" (plural for more) opens the part
  view. The lock still counts the product comments too.
- The pin number is global on purpose: `numberedCommentsOf` numbers all open comments of the
  product, sketch comments included, oldest first, so the panel and the pins agree.
- `CanvasPin.dot`, the question marker: the design canvas draws it since 35d609cee
  (`design-canvas.component.html`, a 12 px dot in the primary accent at the top right of the pin).
  Checked in the real app (2026-10-27): the question pin 239f in the `studio-lab`
  `components/button` part view (solid, rest) shows "3" and no dot. Cause: a stale server. The
  running Studio's `cli-runtime` was built before fd6fd55f4 and sends no `threadState`; the data
  is right. A Studio restart rebuilds the runtime. No code fault.
- `studio-lab`: Components, button shows "question"; Sketches, button shows "answered"; the top bar
  shows "1 ?"; the panel lists 7001 as "answered" and 239f under "Questions for you"; the
  `components/button` sketch view shows the product-part button next to "3 open comments".

### Studio comments, as built (2026-10-27)

- f13302bf3: a Comments toolbar button (with the count) toggles a sidebar on the right
  (`comment-panel.component.ts`); Studio remembers it (`commentsOpen` in the view state). Comment mode
  never opens it. It lists every open comment of the product grouped by part, the shown part first
  (`commentGroupsOf`); an entry shows number, text, where and age (`ageOf`). The meta line
  (`data-comment-meta`) is the place for the last sender and the reply count. A click selects the part
  or sketch, moves the camera to the pin and opens it; in a sketch it switches to the comment's size
  when the matrix offers it, and a comment without a shown pin focuses the frame of its state.
- f13302bf3: a frame label notes "N comments at other sizes" (`withOtherSizeNotes`).
- f13302bf3: with open comments on the target, the sketch view disables Merge and Discard and shows
  "N open comments"; a click opens the sidebar.
- f13302bf3: the pin popover's Withdraw is `transparent`, like the draft's Cancel. Esc in comment mode
  cancels a draft first and ends the mode only on a second press.
- f13302bf3: a matrix cell whose column lacks the row's state is a dashed empty cell
  (`CanvasFrame.empty`): "<variant> has no <state> state", or "new in this sketch" in `current`. It
  takes the largest size in its row, has no place (not commentable) and cannot be activated.
- f13302bf3: the row gap is 48 px when every frame fits its content (tile grid, fitted matrix), 120 px
  for pages and parts with `widths`. 48 px is a start value for the user to look at.
- 8bc302576: the studio-lab sample comment (on `components/button` variant b, `fitted`).
- Verified: unit specs (`sketchMatrixOf` empty cells, `commentGroupsOf`, `ageOf`, `withOtherSizeNotes`,
  `otherSizeFrameOf`), and headlessly against `:4221` with a stubbed host and a scratch design server
  on 4494: the rating matrix with "a has no disabled state" (`/tmp/studio-rating-matrix.png`), the
  button sketch lock ("1 open comment", Merge and Discard disabled), the sidebar and the jump that
  opens the pin, draft placement at the click point with a constant on-screen width at 44 % and
  150 %, Esc cancelling only the draft, a caption click in the tile grid starting a state comment,
  and the tree badges and draft field.

Open points, each with a recommendation:

- Decided: a frame reload per part, see "Frame reload decisions".
- Done: the merge lock, the row gap, the pin ring and the sketch row names, as in "Comment follow-up
  decisions" (53a10e894).
- Done: replies, the thread in the popover and the "N ?" question count (35d609cee, b5402b4d5).

### Studio comment threads, as built (2026-10-27)

- 35d609cee: the pin popover shows the whole thread (`comment-thread.component.ts`): sender ("You"
  or "Agent", the agent in the accent colour) and age per entry, a reply field (`Enter` sends,
  `Shift+Enter` breaks the line), Withdraw and Reply. A reply goes through the `comment-reply`
  endpoint as `{ by: 'user' }`.
- `ListedComment.replies` is `{ by, text, createdAt }[]`, oldest first. `isQuestion` is true when
  the agent has the last word; `lastSenderOf` falls back to the user, who wrote the first text.
- A question shows as a dot on its pin, as the "question" badge in the tree, in the sidebar, and as
  the "N ?" count on the Comment button ("N questions for you").
- b5402b4d5: a part with a question shows only the "question" badge, not "comment open" too.
