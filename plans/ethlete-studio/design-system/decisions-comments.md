# Design system: comment, note, thread and author decisions

### Comment UI decisions (2026-10-27)

- Comment mode: a toolbar button or the key `C`. A click on a frame sets a point; a click on a
  tile label comments on the state without a point. `Esc` ends the mode.
- A popover at the click point holds an `et` textarea. `Enter` sends, `Shift+Enter` breaks the
  line, `Esc` cancels. The mode stays on after a send.
- The comment field `preset` becomes `size`: a preset name, a width such as `520`, or `fitted`.
  A pin shows only on a frame of the same size; other sizes show only a count on the label. A
  point in percent would land on another element once the layout wraps differently.
- Numbered pins open a popover with the text and "Withdraw". The comment sidebar lists the
  threads; see "Comment thread decisions", which replaces the earlier panel for one part.
- "Withdraw" deletes a comment through `comment-done`, without a restriction and without a note.
- With open comments, the sketch view disables Merge and Discard with "N open comments"; a click
  on it opens the panel.
- The design server sends its own signal on a change under `comments/`. Studio then reloads the
  comments only, not the frames.

### Comment thread decisions (2026-10-27)

- The user and the agent both reply. The agent replies with `et design comment reply <id> <text>`,
  so it can ask back instead of guessing.
- The comment file gets `replies: { by: 'user' | 'agent', text, createdAt }[]`. The first text
  stays in the comment itself and is always the user's.
- Done and withdraw act on the whole thread: done deletes it and writes the note, withdraw deletes
  it without a note.
- `et design inbox` lists a thread as work only when the last word is the user's. A thread whose
  last word is the agent's goes into a separate group, "waiting for the user".
- Every open thread blocks merge and discard, whoever has the last word.
- The pin popover shows the whole thread with sender and time, and a reply field (`Enter` sends,
  `Shift+Enter` breaks the line).
- The comment sidebar lists all open threads of the product, grouped by part, the selected part's
  group on top. Each entry shows the first text, the last sender, the reply count and the age. A
  click selects the part, moves the camera to the pin and opens its popover.
- An agent question (the last word is the agent's) shows in four places: a group "Questions for
  you" at the top of the sidebar, an accent dot on the pin, a tree badge "question" next to
  "comment open", and a count on the comment toolbar button.
- A toolbar button of its own toggles the sidebar, and Studio remembers the state. A click on the
  question count opens it. Comment mode does not open it, and it never opens by itself.

### Comments live in git (2026-10-28)

- Comment files under `.ethlete/design/<product>/comments/` are committed and pushed like the
  parts. Tom: "wie sonst soll dieses system hier funktionieren?" Git is the only way a teammate's
  QC pass or Claude's reply reaches anyone else; there is no server.
- A thread is mostly a human writing for the AI. The one human-to-human case is a QC pass: a
  teammate comments many parts, pushes, and someone else works the comments off or answers.
- Open: a comment file has no author, and a reply has only `by: 'user' | 'agent'`. A QC pass needs
  the person, as the inbox page draws it. Candidate: the git user name at write time. The agent
  needs its name too (the `--by` model id), since the AI is not always Claude.
- Studio is agent-agnostic. Tom: "der user muss nicht unbedingt claude nutzen". UI copy says
  "Agent", never "Claude"; an agent's name only comes from the data.
- An agent's avatar is its provider logo, in the brand colour on a neutral circle. The drawing
  takes the paths from simple-icons (`pages/inbox/agent-logos.ts`): Claude and Gemini from
  16.36.0, OpenAI from 13.0.0, because later versions dropped it at OpenAI's request. The real
  app must check the brand terms before it ships these logos.

### Slice 10, lab and note follow-up decisions (2026-10-27)

- Tokens: base components pick up a product's tokens override through an import, not only through
  the config `styles` entry, so a `foundations/tokens` sketch shows on every part (button, field).
  A small core change, built before the first foundations sketch.
  As built (cli 627b9739d, skill 8a24a92ab, proven headlessly, 346 cli tests green, bite proven): a
  part imports another part's stylesheet as `@system/<layer>/<name>.css?inline`. It resolves to the
  drawing product's own part, else the base's, else the sketch variant's. `sdk` button, form-field
  and select import `@system/foundations/tokens.css?inline` and put it first in `styles`. The tokens
  entry is gone from config `styles` of `sdk` and `studio`; the import is the only path, so
  `studio` needs no `styles` change after the tokens merge. Fix from the proof: a running server
  kept the old resolution after a merge; now a part file that appears or disappears redraws its
  whole product (`serve.ts` `unresolveParts`, `changed-parts.ts`). Proof: `studio` button
  `rgb(37,99,235)`; a tokens sketch with accent `200 0 0` turned filled and outline buttons
  `rgb(200,0,0)`; after `sketch merge` on the running server the product frame turned red with no
  restart.
- `sdk` stays in `.ethlete/design/sdk` for now. It moves to `libs/cli/design/systems` as a built-in
  base only after the redesign proves it (and a cross-repo base from a package is checked).
- No `vh` in parts: the `ethlete-design-exploration` skill says so; a full page uses a frame with a
  fixed size. A check warning can follow if the rule is often broken.
- Real lab flows: the builder rebuilds `studio-lab` with two flows that make sense. "Add a film":
  empty library → "add a film" dialog → library with one film → film detail. "Sign in": library
  with a "Log in" button in the shell → login dialog → wrong-password error → signed-in library.
  Every line has a label, and the element it names is visible in the frame before. The
  `ethlete-design-exploration` skill gets that rule. Seen: the old `sign-in` flow showed a film
  count growing, one line had no label, and "user clicks 'Anmelden'" named a button the page lacks.
- Pointed notes: a small marker at the point; the card sits outside the frame, below it in the
  column of notes without a point; a thin line connects marker and card. The card never covers the
  design. Free dragging of cards may come later (needs a stored position).
- A "Show notes" toggle in the toolbar, on at start, remembered per product like the flow preset.
- Fixed z-order, bottom to top: frames, flow lines, notes, comment pins, open popovers (thread,
  note editor). Seen: a note card covered the reply field of an open comment thread. Prove headlessly
  with an open thread over a note.

As built, skill rules and lab flows (agent-rules c28c7b30a, lab 2ca95f12f, proven headlessly,
`et design check --product studio-lab` ok):

- Skill: no `vh`, `dvh` or `svh` in parts, a full page is a fixed-size frame; every flow line has a
  label, and the element it names is visible in the frame before.
- Flow `add-a-film`: library empty → add open → one → film-detail rest, labels "user clicks 'Add a
  film'", "user clicks 'Save film'", "user clicks the film 'Night Train'".
- Flow `sign-in`: library three → login open → login error → signed in, labels "user clicks 'Log
  in'", "wrong password, user clicks 'Log in'", "right password, user clicks 'Log in'".
- `shell-main` shows a "Log in" button or the signed-in user "Ada"; its `min-height: 100vh` is now
  a fixed 480px. `login-dialog` has a password field; new element `add-film-dialog`; dialogs render
  only in the states that need one. The old `sign-in` flow is gone; Tom's notes and comments still
  point at existing frames.

Findings:

- The design server caches flow files, so a flow edit needs a server restart before Studio shows
  it.
- At the phone preset the gaps between flow frames are narrow, so long line labels are tight.

Design canvas on Tailwind, as built (fc02e4a8c): Studio has no component `.css` file left. Modifier
classes became data attributes (frame: `data-selected`, `data-active`, `data-empty`, `data-fitted`,
`data-unsized`; canvas: `data-dragging` with `group/canvas`). Headless before and after on
`studio-lab`: 14 canvas screenshots byte-identical, bounding rects equal, computed styles equal or
equivalent. Empty, error and unsized frames were not seen visually (no such data); specs cover
them.

Pointed notes, "Show notes" and z-order, as built (proven headlessly):

- 62a13aa52: a pointed note is a small square marker at the point. Its card sits in the column
  below the frame with the notes without a point. A thin right-angled line runs from the marker
  down into the gap, along the column's left edge, into the card's left edge, so it never crosses a
  card. Below zoom 0.25 markers only. New lab note `notes/20261027T163000Z-e5f6.json` (pointed,
  library "three").
- 2d15c4646: a "Show notes" button next to "Note" in the part and flow toolbars, on at start,
  remembered per product (`notesShown`, keyed like product themes); survives reloads.
- e804e1bc9: z-order frames < flow lines and labels < notes < comment pins < open popovers (thread,
  comment and note forms, the note being edited). Proven: the thread reply textarea sits on top of a
  note card; the note editor sits on top of a pin and a card.

### Pointed note link decision (2026-10-27)

Seen on the `add-a-film` flow: the always-on line ran down through the whole frame and crossed text
and buttons, the thing the card below the frame was meant to avoid.

- A pointed note's marker shows a small number, and its card below the frame shows the same number
  (numbered per frame). The line from marker to card appears only while the pointer is over the
  marker or the card. No line otherwise.

### Note size decisions (2026-10-27)

Replaces "a state note shows on every rest frame of its state" for pointed notes. Seen on
`film-detail` "rest": a note pointed at the text under the phone title showed on desktop too, at the
same x and y, in empty space.

- A pointed note stores the size (preset) it was written at, as `size` like a comment's place, and
  shows only at that size. A note without a point still shows at every size.
- The frame note for other sizes covers notes too, in one line with comments, for example "1 comment,
  1 note at another size". On a flow it follows the picked preset, as for comments.
- `size` is required on a pointed note; `et design check` reports a missing one as an error. The
  builder adds `size: "phone"` to the two existing pointed lab notes (`film-detail` "rest", Tom's
  uncommitted `notes/20261027T144809Z-db30.json`, and `library` "three",
  `notes/20261027T163000Z-e5f6.json`).

Slice C, as built (2c6878d4e cli, c2ea12698 Studio; 3 CLI and 7 Studio specs fail with the old
behaviour; Studio vitest 202, cli 347, tsc, ngc, eslint, `design check --product studio-lab` ok):

- `note.ts` stores `size`, typed and checked like a comment's size. A pointed note without size, or
  with a preset the product lacks, is refused; clearing the point drops the size. `et design check`:
  a pointed note without size is an error; a size the product no longer has is stale (also the
  `stale` field in Studio's note listing). A note without size stays readable and shows at every
  size.
- A pointed note shows only on frames at its size; on a flow it follows the picked preset. Studio
  writes `size`. Frame label "1 comment, 1 note at another size" ("other sizes" if spread), following
  Show notes. Marker and card show the same number per frame; the line shows only while the pointer
  is over the marker or the card (the marker takes pointer events).
- Lab notes: db30 and e5f6 `phone`, b7c8 `fitted` (component matrix frames are fitted), d9e0 has no
  point; db30 committed. A third pointed note, `notes/20261027T120000Z-a1b2.json` (library "empty"),
  also got `phone`.
- Proven headlessly on `film-detail` "rest" (number "1" on marker and card, phone only, desktop label
  "1 note at another size", line on hover only). Not proven headlessly: flows and the component
  matrix (unit tests only); writing a note through the real UI. The exploration skill documents the note format
  (806aa94d9, 848f76d15).
- Decided (2026-10-27): `phone` for `a1b2` confirmed. A click right on a marker in comment or note
  mode starts nothing; accepted. The thin vertical line along the left edge of phone frames (also
  on rows without notes, not the note line) gets its own check of the frame chrome. The
  `ethlete-design-exploration` skill gets a short notes section: the file format (`part`, `state`,
  `point`, `size`, `text`) and when to write a note instead of a comment - a note explains a state,
  a comment is feedback that needs an answer.

Also seen there: on `pages/library` "add open" the dialog backdrop ends at about 410px and the rest
of the frame stays dark - a lab drawing bug, likely the fixed 480px `shell-main` height.
Fixed in 9222b044f: the scrim in `pages/library/library.ts` was `position: absolute; inset: 0`, so it
filled only `.lab-shell` (480px). It is now `position: fixed; inset: 0`, and frames are iframes, so it
fills the frame. Also fixes "login open" and "login error". Rendered check, all pass (headless):
the scrim fills the viewport at phone 390x844 and desktop 1440x900 for all three states, live and in
`/__design/shot`; fitted frames stay at 512px over 4s at iframe heights 300 and 900, no loop.
A reported 512px live vs 480px shot mismatch was wrong: the check compared a live `&fit` frame with
a `width=390` shot, two different renders. A shot without preset or width also loads with fit, so the
16px padding is in the PNG too (`shot.ts` `partShotOf`). Measured headless, live and PNG equal:
`pages/library` fit 319x512, no-fit 390x480; `list-row` 352x69; `film-detail` reviewing 674x492;
`card` 173x115. In the canvas each frame keeps its size from live (68-100%) to shot (<50%). No code
change. Not checked: Tom's window (HiDPI), other products.

### Comment follow-up decisions (2026-10-27)

Built in 53a10e894; the merge lock needed no change.

- The canvas row gap stays 48 px for fitted frames; Tom approved the rating matrix screenshot.
- An open pin drops `[pressed]` and shows a ring in the accent colour instead of a hollow button.
- The Sketches group in the tree names a sketch without its layer prefix ("card", not
  "components/card"); the full name is the tooltip. The look of tree rows and badges is a design
  question again in slice 10.
- A tree row with a question hides "comment open", since a question implies an open comment. In
  slice 10, a row keeps its full name and shows one dot per status, labels in the tooltip, the
  question dot in the accent colour.
- The "N ?" question count stays attached to the Comment toolbar button as one control.
- The merge lock keeps counting every open comment on the target part, also one older than the
  sketch: the merge changes the part, so the agent reviews each first.

### Agent author decisions (2026-10-27)

Not built yet. The user wants to see which model made what, for example variant a by Gemini Argon,
b by Codex Sol, c by Claude Opus. Today only comment replies know `by: 'user' | 'agent'`.

- An author goes on sketch variants, thread replies, reports, comments an agent closes with
  `inbox done`, and parts after a merge.
- Every CLI command with which an agent writes, `sketch new` included, needs `--by <model id>` and
  fails without it.
- `et design sketch report` takes `--variant` and `--by`. The CLI keeps the authors per variant in
  `sketch.json`; the variant name comes from the flag, no longer from the message text.
- The name is the exact model id as free text, for example `gemini-3-argon`, `gpt-5.6-sol`,
  `claude-opus-5-5`. No fixed list.
- Several authors are kept in the order of their first report. Studio shows the first and "+N";
  the tooltip lists all.
- A merge writes `madeBy: string[]` into `definePart`, next to `note`. A later merge replaces it;
  git keeps the history.
- Studio shows the author in each variant column head ("a · gemini-3-argon"), in the thread
  ("Agent · gpt-5.6-sol"), in the part view head ("made by gemini-3-argon") and in a report's
  tooltip.
- Old data without an author shows none. No migration.
- The coordinating agent writes the exact id into each sub-agent prompt; an agent never guesses its
  id. This goes into the `ethlete-design-exploration` skill.

### Agent author follow-up decisions (2026-10-27)

- `inbox done` deletes the comment, so its `--by` goes where the comment sat: on a sketch variant,
  into that variant's authors (a merge then carries them into `madeBy`); on a product part,
  directly into the part's `madeBy`. Only when the id is not there yet.
- `sketch new|ready|rebase|discard` keep requiring `--by` and keep not storing it; a merge stores the
  variant's authors, not its own `--by`. `madeBy` names who designed, not who ran a command.

### Product comments and answered threads decisions (2026-10-27)

Seen in the real app: a comment on the product part `components/button` showed in the part view
and again in the sketch view's "current" column, and a plain agent report ("Raised the outline
border to 2px") showed as "question".

- The sketch view shows only comments on sketch variants. For comments on the product part it
  shows one line, for example "1 comment on the product part", that links to the part view. Open
  comments on the target part still block merge and discard.
- `et design comment reply --question` marks a real question. Any other agent reply makes the
  thread "answered". The tree badge shows "question" or "answered"; "Questions for you" and the
  "N ?" count include only real questions. The user closes an answered thread with Withdraw, or
  replies. Until then an answered thread still blocks merge and discard. The design-exploration
  skill tells agents when to pass `--question`.
- `studio-lab` data: the comment "The outline border looks thin…" (20261027T120000Z-7001) moves to
  variant b of the `components/button` sketch. The part view gets its own product comment with
  fitting text. The lab then holds one real question and one answered thread.

### No-point pin and drawing report decisions (2026-10-27)

- A comment pin with no point sits on the right edge of its tile, not of the part. A pin with no
  point belongs to the whole state frame, and all such pins in a column line up.
- The stale live report for `studio-lab` `components/button` variant b (written 12:24 by a seeding
  run, never ended with `sketch ready`) is to be deleted; the builder's permission check blocked the
  delete, so it stays as the live test case for the expiry below, and Tom deletes it after. It kept the variant b column at "drawing…" with
  no frames, so pin 7001 had no place to render. Not a code fault.
- A `drawing` report expires 30 minutes after its `updatedAt`. Studio then draws the variant's frames
  as if it were drawn, and the column head shows "No report for 30 min" instead of "drawing…", so a
  stopped agent stays visible and is not taken for a finished one. A new report from the agent
  ends the note. `sketch ready` and a discard still end a report at once.
- Built in fb346c749 (Studio only): `reportExpiryOf` in `system-tree.ts` is `updatedAt` + 30 min;
  past it the column draws its frames and the head shows a muted second line "No report for 30 min".
  A missing or unreadable `updatedAt` never expires. `sketch-view.component.ts` sets one RxJS timer
  at the expiry, restarted by a new report; no polling. Specs at 29:59 and 30:00 and a timer-only
  flip fail without the fix. Live on own servers, `studio-lab` `components/button` variant b: a
  45-minute-old report drew 30 frames with the note; a fresh one showed "drawing …" and no frames.
- Replaced the same day: a stale built cli now shows as `stale`. The existing check
  (`design_server.rs` `is_stale`) compares the running server's stamp with the stamp of the built
  cli in `dist`, so a `dist/apps/ethlete-studio/cli-runtime` older than its source passes as
  `running`. In a dev build only, the footer also shows `stale` when the `libs/cli` source is newer
  than the built cli. A restart rebuilds the cli, and the line goes back to `running`.
- Built in 6e818c148 (`design_server.rs` `judged`, behind `cfg!(debug_assertions)`): `stale` when a
  file in `libs/cli/src`, `libs/cli/design` or `libs/cli/package.json` has a newer mtime than the
  built cli's `src/index.js`. It skips `node_modules`, dot folders and `*.spec.*`, stops at the first
  newer file or after 5000 entries, and a missing build counts as not stale. The Rust test
  `a_cli_source_newer_than_its_build_reads_as_outdated` fails without the check. 1e2d102c4: a
  directory with a newer mtime counts too, so a deleted source file also marks the server stale. Not yet seen in the real footer.

### Note and flow comment decisions (2026-10-27)

- Note cards at low zoom: a state note still shows on every rest frame of its state. Below a zoom
  threshold each frame shows the marker only, no card - the same rule as a label that does not
  fit. This stops the phone and desktop cards of one note from overlapping (~21% zoom).
- Flow frames get the "N comments at another size" frame note (`withOtherSizeNotes`, as on the
  part canvas), so a comment made at another preset is visible on a flow.
- The comments sidebar keeps listing a flow comment as a part comment. A jump from outside the
  shown flow opens the part; inside the shown flow it opens on the flow. The comment belongs to
  the state, and a state appears in many flows.
- An outdated design server: when a `/__design` request gets HTML instead of JSON, Studio shows
  "The design server is older than Studio - restart it". Studio does not restart the server
  itself.

As built (2026-10-27):

- 918490a48: below zoom 0.25 (where labels stop holding their size) a pointed note shows its marker
  only. Free-note headings stay at every zoom.
- 80b987c1f: flow frames show "N comments at another size", following the shown preset.
- a38f0bf58: every `/__design` JSON read goes through one helper. An HTML answer
  (`content-type: text/html`) raises the "older than Studio" error, shown where design errors
  already show (system read error, comment and note stores, sketch and new-product forms). Before,
  `designAnswer$` silently turned the HTML into `null`.

Follow-up decisions (2026-10-27), all kept as built:

- Below zoom 0.25 a note without a point has no marker and disappears completely. Its text is not
  readable at that zoom anyway.
- Below zoom 0.25 a marker is not clickable; a note opens only after zooming in.
- The outdated-server check looks at `content-type: text/html` only. An old server always answers
  HTML; a wider check would hide real errors behind the wrong message.
