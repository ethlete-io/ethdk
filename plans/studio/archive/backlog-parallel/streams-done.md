# Parallel backlog - finished stream steps, first decisions and closed findings, archive

## Stream A, after its five steps

Pulled into this push (Tom, 2026-10-30): 4.47 approved exceptions, then the `handoff` status with CI.

- **Built (`aaa57a950`): 4.47 approved exceptions.** `design complete --request <part>.<control>.<requirement> --reason`
  writes a pending entry to `<product>/exceptions.json` (the owner's for a base part); the gap still fails, marked
  pending. `POST /__design/exception-approve?product=` `{ key, by }` records `by`, `at` and the part hash; then the gap
  drops. A later part edit reopens it. `GET /__design/exceptions?product=` lists them; `design complete` prints an
  `EXCEPTION` line each. Studio has no approve button yet (stream C).
- **Built (`acc020fd0`): the `handoff` status with CI.** `design complete <part> --handoff` writes a passing part to
  `<product>/handoff.json`; `design complete --handoff --product studio` re-checks each one and exits 1 on a
  regression. The CI Build job runs it. No studio part has the status yet: granting it is the user's call. Passing
  today: `components/disclosure`, `components/zoom-chip`, `elements/canvas-frames`, `foundations/logo`, `foundations/icons`.
- **Built (`c7c9a0be9`): `design complete <layer>/<name> --variant <key>`** (SDK base session request). Chose the flag
  over a `sketch check` section: it reuses `completenessOf` whole, only threading the variant into `seePart`. Every
  part is drawn as the variant draws it; a part the variant changes skips `PART-UNREVIEWED`. Approved exceptions and
  inventories hold the merged hash, so they read as reopened on a variant that changes the part.
- **Open (option focus):** the check forces only `data-et-force` (CSS `:hover`/`:focus-visible`/`:active` are
  rewritten to it) and needs a pixel diff with the force on vs off. `[data-active]:hover` counts only when the forced
  option also carries `data-active`; `data-active-source="keyboard"` is static, so option focus-visible fails until
  the drawing has a `:focus-visible` rule or the CLI maps the force to that attribute.

## Nothing to build

3.41 (did not reproduce), 4.7 (known limit), 5.21 (parked), 5.23 (SDK issue), 5.24 (done), 6.5 (covered by 4.47).

## Decisions (Tom, 2026-10-30)

- 5.39: the state grid shows an empty cell for each undrawn state combo; `sketch check` lists them. Stream A.
- 5.51: the tokens drawing prints the contrast of each token on each surface. Stream F (sketch).
- 5.52: if a generator already reads the tokens, generate all three theme blocks from that one source; else add
  `design tokens theme add <name> --type --oklch`. Check which first. Stream E.
- 5.55: `embedPage({ mark, css })`, both applied inside the iframe. Stream E.
- 5.56: `design check` warns when both `embedPage({ scale })` and the host's own scale are set. Stream A or E.
- 5.32: `elements/canvas-frames` exports the frame head, the frame box and the zoom chip as named parts. Stream F,
  after 2.2 on the same part.
- 6.6: a skill rule: before `ready`, critique hierarchy, spacing, form nesting and host context; no render gate.
  Stream D.
- 5.51 / Q42: `--surface-border` (1.2-1.6:1) is marked decorative and exempt from the 3:1 non-text bar (WCAG
  1.4.11: it only separates surfaces). Controls with a visible boundary (inputs, focus) keep their own 3:1 tokens.
- 5.32 / Q43: the zoom chip becomes its own part (for example `elements/zoom-chip`) with its own states, so it
  carries `data-et-part` and `design complete` checks it wherever it is drawn. Frame head and frame box stay named
  exports of `elements/canvas-frames` (layout pieces without states). Redo r1 (b907cf29d) before Tom merges.

## New finding 4.85 (Tom, 2026-10-30): a failed module import stays in the frame

- **Built (`91b224b61`):** `frame.ts` retries a failed part import after 300 ms and 1.5 s and shows the error only
  when all three tries fail. Chromium 156 fetches a failed module URL again (checked). Two specs in
  `frame-bootstrap.spec.ts` bite; its fixture got the missing `applyEmbed`. Not reproduced live in Studio.

- **Pain (screenshot):** on `components/tree-row` most state frames show `design-explore: state "<state>" of
"components/tree-row" failed / Failed to fetch dynamically imported module:
http://localhost:4402/@fs/.../.ethlete/design/studio/components/tree-row/tree-row.ts?design-product=studio`.
  The first states rendered, the rest failed. Tom sees this often, after parts change.
- **Likely cause (not verified):** the part file changed while the frames loaded (for example the auto-merged
  `34f73f3e2`), Vite invalidated the module, and each frame that imported it during the change failed. Nothing
  retries the import once the file settles, so the error stays until a manual reload.
- **Fix option:** reproduce first (edit a part while its grid loads). Then the frame retries a failed dynamic
  import after the next `parts` event for that part, or after a short back-off; only a repeated failure shows the
  error. A spec that bites. Stream A or C, whichever owns `libs/cli/design/web/frame.ts` now.
