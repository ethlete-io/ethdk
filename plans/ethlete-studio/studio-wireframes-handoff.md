# Handoff: Studio design, real look, pages first

Branch: next · see `git log --oneline -15 -- .ethlete/design/studio plans/ethlete-studio`
Working tree: clean at handoff. No open sketch.

## Goal

Design Ethlete Studio in its own design product `studio` (`.ethlete/design/studio/`, base
`.ethlete/design/sdk`), real look, and fix the design tool by using it. The tool fixes are the main
output; the design is the side product (Tom, 2026-10-29). Every friction with Studio or the design CLI
goes as a finding with fix options into `plans/ethlete-studio/design-system-actions.md`. Fix the
findings in `libs/cli` and `apps/ethlete-studio`, then move each fixed entry, number kept, to
`design-system-actions-fixed.md`. Talk to Tom in German.

## Structure (fixed today, Tom: "das system fällt doch schon wieder auseinander")

- `elements/shell-main`: chrome ONLY (rail, floating side panel, canvas paper). Props `section`,
  `product`, `side`, `content`, `panel?: 'hidden'`. States `open`, `hidden` (hidden = panel gone,
  active rail bubble loses its fill; a click on the active section bubble toggles the panel).
- `elements/part-tree`: the dense tree (12 px-ish, no numbers). State `components-open`.
- `elements/canvas-frames`: frames of the real base button (`@system/components/button`, states
  filled / outline / tonal). State `default`, export `defaultFrames`.
- `pages/system`: composes the three. Child state props are named exports, because
  `part.states[...]` types as `Props | undefined` (finding in the plan).
- A section of the app is a PAGE, never a state of the shell.

## Order agreed with Tom

1. All pages first: `pages/inbox` next, then Sketches (variant matrix), Flows, merge compare.
2. Components after all pages (button, switch, tree row, comment card, project switcher...).
3. Page states (empty, loading, error, comment draft), then build into the real app.

## Process (do not re-litigate)

- The agent designs, Tom picks. One sketch at a time, 2-4 real alternative variants; a variant
  never stands for a state of another variant. No yes/no questions on content.
- One fresh opus subagent per sketch round; brief: skim `.agents/skills/ethlete-design-exploration/SKILL.md`,
  `sketch new <part> --variants a,b,c --round "<title>" --by claude-opus-5-5 --product studio`
  (`sketch variant` only adds to an open sketch), look at every shot via the read-only
  `curl "http://localhost:4402/__design/shot?product=studio&part=<layer>/<name>&state=<s>&width=1440&sketch=<layer>/<name>&variant=<v>"`
  (pages: `&preset=desktop`), no `sketch ready`, no commit, no stash, no git add, no zsh command
  in a variable. It reports friction; you write it into the plan and commit.
- Every change to a merged part is a sketch, also a small one; with nothing to choose, one variant
  (`--variants a`). Never edit a merged part directly (Tom, 2026-10-28).
- You look at the shots yourself, then `design sketch ready <part> --product studio --by ...`.
- After Tom merges: `design check --product studio`, prettier on the part files, commit at once.
- CLI: `node dist/libs/cli/src/index.js design ...`; build `NX_NO_CLOUD=true npx nx build cli`.
- Comments are now RESOLVED, not deleted (15bb60c99): `inbox done`, `--round`, merge, discard set
  `resolved`; Studio shows them behind "Show resolved".
- Studio folds states no variant changes (fba692ad6) and folds older rounds on a new round
  (24c887f1b). Tom must restart Studio to get CLI changes.

## Done at handoff

- `button` is a leaf in `elements/part-tree` (b7ea4084d): the tree lists frames, not states.
- `pages/inbox` variant a merged (180c2ed9d). Data reworked (0d3010b34): threads are an exchange
  between the human and Claude; the only human-to-human case is a teammate QC pass. Every future
  comment or inbox drawing must follow this model.
- Inbox groups: active part on top, "Andere" below (12bb47fdc). States `open`, `with-resolved`,
  `active-only`, `active-clear`, `all-clear` (801b28111, 0a7466ca9). Agents mixed (Claude, Codex,
  Gemini) with provider logos from `pages/inbox/agent-logos.ts`. Studio is agent-agnostic: UI copy
  says "Agent", never "Claude". Comments are committed to git (plan "Comments live in git").

## Next steps (state 2026-10-29)

The pause of 2026-10-28 is over. Merged on 2026-10-29:

- `pages/sketches`: page-only design, zoomed page with quiet header, grouped round line and inline
  variant heads (`6f6032799`, `49e56a200`).
- `pages/flows` and its empty state (`e1f8113a1`, `080ff322c`).
- `pages/start` and the empty `pages/system` (`290fcc73e`).

Next, in this order (state 2026-10-29 evening, after `c9e7f8273`):

1. Tom merges the ready sketch `foundations/logo` (exports `studioMark(size)`, no visible change).
   Then: `design check --product studio`, prettier on the part files, commit. Then a one-variant
   sketch on `pages/start` that imports `studioMark(24)` from `@system/foundations/logo` instead of
   its copy. `elements/shell-main` keeps its own glyph (Tom, 2026-10-29).
2. Asset question (5.13 in `design-system-actions.md`): Tom asked how we handle assets in general.
   Draw up the options with a recommendation and ask him; no build before his pick.
3. Finding 1.2: `localhost` gave 0 hangs in 10 x 100 (Result 3, `9e109eead`), but only with an
   unthrottled probe copy on the Mac (`/tmp/wk-probe/unlocked.swift`; the Mac screen is locked and
   WebKit suspends hidden pages, so the repo probe stops at batch 12). Next: repeat the LAN IPv4 run
   with that probe so both compare; consider putting the unthrottle switches into
   `tools/scripts/verify-webkit-frame-reloads.swift`. Mac cleaned 2026-10-29: five stale claude-at
   tmux sessions and an orphaned `nx tauri:dev ethlete-studio` (Tom approved) are stopped.
4. Done 2026-10-29: live checks moved 1.4, 2.1, 2.3, 3.1-3.7, 5.1, 5.2 to fixed (`eccdfdeba`); new
   friction 3.18-3.21 is open. Built and moved: 1.3, 3.17, 4.12, 5.12 (`293caba5c`). Still open:
   2.2, 2.6, 7.x Rust side (needs the Tauri host). The real `foundations/logo` sketch was already
   `ready`, so the new auto-merge does not apply to it; Tom merges it.
5. Built 2026-10-29: 3.18, 3.21 and assets 5.13 (`5b73392d9`, fonts and icons included), moved to
   fixed in `3270f820c`. 5.14 built (`3c89d65bf`). `foundations/logo` export merged (`be36d76d7`).
   The asset sketch on `foundations/logo` (mark in `a/assets/studio-mark.svg`) is `ready` and
   waits for Tom; it did not auto-merge because of 3.22. After the merge: `design check`, prettier,
   commit, then a one-variant sketch on `pages/start` that imports `studioMark(24)`. Free to build
   next: 3.22 (recommendation option 1), 5.15, 3.19. After Tom merges
   `foundations/logo`: a one-variant sketch that moves the mark to `assets/studio-mark.svg` and
   keeps `studioMark(size)` as the wrapper, then `pages/start` imports it.
6. Done 2026-10-29 evening: 3.22 (`4a9e89913`), 5.15 (`34e1f6185`), 3.23 (`d3726201c`), 3.19
   (`9614c830d`), 2.7 (`f57d27266`). `foundations/logo` is a valid standalone SVG with
   `studioMark = svgAsset(...)` (`b39f15b06`); `pages/start` imports `studioMark(24)` (`121c26650`).
   Then 4.12 priority lane (`d68239bd9`) and 5.17 step 1, the frame loads the product tokens
   (`43cec7ae9`). 5.17 step 2 done: no part imports the tokens; every sketch auto merged. Tom
   restarts Studio to get the CLI fixes. Built after that (2026-10-29 late): 5.16, 4.10+4.9,
   4.11, 4.8, 4.15, 5.18, 3.24 (Tom picked option 2: a server not started by Studio takes a free
   port), 6.1 (`yarn studio:verify`). Still open: 1.1 and 2.6 (need the Tauri host), plus the
   "Open" points of the fixed entries. Tom's Studio runs on a server (pid 1804851 on :4402) that
   an agent started by mistake; Tom keeps it, never stop it. Next: step 7.
   `design-system-actions-fixed.md` lost 52 entries from `d3726201c` to `d68239bd9` (each commit
   replaced the file); restored. Append a fixed entry, never rewrite the file.
7. Done: `pages/merge` merged as variant g (`acbdd9c92`). Next: components (button, switch, tree
   row, comment card, project switcher...), then page states, then the real app. Sketch `pages/merge`
   (a: two-column table, b: wipe frame + bottom bar, c: side panel review + 200 % crops; agent
   recommends c) is `ready` and waits for Tom's pick. Open design point: `shell-main` has no rail
   section for merge, the drawings use `'Sketches'`. Its friction is 4.16-4.18, 5.19-5.21. Tom took c; round r2 (d: back link on top + hint under the
   note, e: Cancel next to Merge, f: close X + label on the button; agent recommends d) is `ready`,
   friction 3.25, 3.26, 5.22. Tom took d and asked if the merge note is needed: no, it is optional
   in the tool. Round r3 (g: no note field, h: quiet "Add a note"; recommendation g) is `ready`,
   friction 4.19.

Rules from 2026-10-29: delegate to subagents; never share `node_modules/.design-explore` with Tom's
:4402 (4.13, fixed in `5eb5fff4c`); `design shot <part> --states --variants` draws merged and
variant rows without :4402. Skill source is `libs/agent-rules/content/skills/`, then
`yarn agents:sync`, never only `.agents/skills/`.

The dated sections below are the history of 2026-10-28. The parked points on `pages/sketches` are in
`design-system-actions.md` under "Parked".

## Built (2026-10-28, builder)

All four slices are built (CLI fixes 0ab2a8d18..57f1604f7, Studio rows de482bcee and in-progress
880283244, part API 1c3ef2d71 34c905611, in context 00f21b83e f4b32bb20 ae2b82f62):

1. CLI fixes: `--help` per command without the `--by` check; `sketch new --note`; `sketch variant`
   error names `sketch new`; shot error status on a zero-size root; `design check` flags an
   unknown `var(--token)`; `design check --tsconfig` covers sketch variants; stable sort in
   `comment.spec.ts`.
2. Part API types: `definePart` keeps state keys; `render` takes an optional interaction.
3. Studio sketch view: in-progress state on frames; each round its own row.
4. Element in context: an element sketch shows each variant inside the pages that use it.

## Built, second batch (2026-10-28, builder)

Skill rules 9a501e071; server snapshot b88ca124a (Tom restarts :4402 to get it); render check
8aacee251 8f05298d5 a335e65dd (OVERFLOW, CLIPPED, WRAP, ZERO-SIZE, RENDER; opt-out
`definePart({ checks: { skip: [...] } })`; about 3 s on `studio`; a merge does not run it);
Studio small-part grid 4dbfb0f4b and tree from frames 4f5bf7811.

## Next (2026-10-28)

`pages/sketches` merged as variant d, stacked rounds (7018dfff8), states `open` and `page-sketch`.
Its `sketch-data.css` carries the accent mapping of `apps/ethlete-studio/src/styles/sdk-token-map.css`.
Next: a one-variant sketch on `foundations/tokens` that adds the mapping, then drop it from the
page through a sketch. Then the Flows page and merge compare.

## Open, wait for Tom

- Done: the render check's `OVERFLOW` on `components/select` was a real SDK bug, the picker
  trigger hit area reached 1 px past the field; fixed in 5ed875567. The check draws from
  `dist/libs/components`, so a component fix shows there only after a components build.
- Remaining findings not built: CLI sketch commands (`variant d,e,f --from b`, `--round` shows
  earlier notes, per-variant `sketch check` lines, note-equals-base check, merge keeps `madeBy`,
  `--like`, per-sketch `shared/`), wireframe kit (divider, `align`, `fill` at 100%, tabs
  `line: false`, `navList`, round icon), `design shot --out` and a tiled shot, eslint on
  `libs/cli/design/`, a repo helper for the `__TAURI_INTERNALS__` stub.

- Done: `UNDEFINED-TOKEN` caught wrong token names in `foundations/logo`; fixed in 83accd941.

- Plan findings to build (Tom picks): element sketch shown "in context" inside its pages; Studio
  in-progress state on frames; rounds as rows; `sketch new --note`; `design check --tsconfig` on
  sketch variants; `--help` per command; shot error status on zero-size root; `definePart` state
  key types.
- `libs/cli/.../system/comments/comment.spec.ts` "lists oldest first" is flaky (same timestamp ids
  sort randomly), from 15bb60c99. Fix with a stable tiebreak on id.

## Sketches canvas round (2026-10-28)

Tom reopens `pages/sketches`: large designs should use the canvas and zoom instead of a
separate page-thumbnail/open treatment. One behavior should scale from components to pages.
Open sketch `studio / pages/sketches`, variant a, proposes native-size page frames, fit-to-round
initial camera, pointer-centered Ctrl/wheel zoom, wheel/drag pan and double-click frame fit.
The same viewport wraps the element state. Variant identities and decision buttons stay at
screen size above the viewport. This is a prototype for review, not a merged design or app change.
The previous page-specific 22% preview is the comparison baseline. Open: validate this camera
model with Tom before refining context frames and older-round navigation.

## Exploration order clarification (Tom, 2026-10-28)

Current work draws pages to discover the later component/element inventory. Do not interrupt
page exploration with immediate extraction work. Record roadblocks and possible fixes in
`design-system.md`; shared canvas is a candidate to assess across pages, not a decided next task.
The process is provisional, and Tom explicitly invites grounded disagreement.

## Sketches feedback round b (2026-10-28)

Tom left five comments on a: whitespace in both states, long drawing badge, duplicate round
letters and a long action label. Round b proposes top-aligned camera fit, inline drawing
status, no duplicate round letters and “Merge”. Findings and possible fixes, including the
CLI resolving source comments when a feedback round starts, are in `design-system.md`.

## Sketches feedback round c (2026-10-28)

Four comments on b: misaligned page columns, remaining whitespace, direct zoom into context.
Round c derives screen-size head columns from camera geometry, removes the extra viewport
inset, reduces header gaps and shows complete context pages. Canvas zoom allows up to 800%.
Type/lint and sketch checks pass; both states inspected via read-only Studio shots. High-zoom
interaction was not exercised; offscreen variant navigation remains a design question.
Roadblocks, causes and possible fixes are recorded in `design-system.md`.

## Own verification round d (2026-10-28)

Tom requested independent screen verification and documentation. Browser audit reproduced
empty content after 100%, disappearing head actions, clipped initial pin, stale fit geometry
and absent context focus in c. Variant d corrects these; real-pointer assertions caught and
fixed a further pointer-capture/double-click failure. Both states now pass pointer zoom, drag,
Fit, frame focus and visible-content-at-100% checks; context focus also passes. Fit, zoom,
100% and focus screenshots were inspected. Type/lint and sketch checks pass. WebKit stability
and touch remain unverified. All findings, causes and possible fixes are in `design-system.md`.

Tom also questioned CSS instead of Tailwind. The app uses Tailwind, drawings inherited CSS.
The design server has Tailwind's pipeline, but Studio's stylesheet source scope excludes the
product drawing tree. Registering drawing sources and using token-backed utilities for page
layout is a proposed workflow fix, not implemented during this camera correction.

## Feedback round e (2026-10-28)

Six comments on d addressed in e: painted-contour gutters for header buttons and frames,
older rounds moved into canvas flow directly after context, three visible pending placeholders,
and plain “Variante g/h/i” instead of boxed letters. Both states inspected at fit/zoom/100%/focus.
Type/lint, render, camera interaction and dedicated contour/round-gap assertions pass. The
first contour guard required one more header pixel; checks were repeated after that correction.
Findings and possible fixes recorded in `design-system.md`. Native pinch remains unresolved.

## Scope correction after e merge (Tom, 2026-10-28)

Accepted e baseline committed as `04f9337e2`. Tom keeps zoom composition open: hard inner
clipping and stretched variant heads feel wrong. He also explicitly calls out that the agent
went too deep into implementing a complete camera during design. Record this as a process
failure, not just a technical missing-reuse issue. Next proposal should draw overview/detail
zoom states to settle composition; do not extend `canvas-setup.ts` or implement another zoom
feature. Actual Studio bugs remain separate findings with possible fixes. Pages still lead
the later component/element inventory.

## Second UI hang interrupts the next visual round (2026-10-28)

Before a new sketch was created, Tom reported another 100% UI hang. Sample of WebContent PID
21017 at `/private/tmp/studio-webkit-hang-2.txt` matches the first: JS microtasks, module loader,
URL parser. It happened after a full native restart, so restart is recovery only. Stopped
native PID 20884 and restarted with `NX_NO_CLOUD=true yarn studio`. Further diagnosis and
possible fixes are recorded in `design-system.md`. No new camera code or next sketch was
created; scope correction to static overview/detail visual states still applies.

## New zoom composition after e (2026-10-28)

Sketch `pages/sketches`, variant a, four drawn states: `open`, `element-detail`, `page-sketch`,
`page-detail`. Full shell canvas behind floating chrome, compact grouped heads; partial
neighbor heads omitted in detail views. No `canvas-setup.ts` or gesture listeners in the
variant. Own screenshot review and geometry checks cover the composition only. Possible
fixes/tradeoffs are in `design-system.md`; do not revive camera implementation in this round.

## Latest a rejected; restore comparative exploration (Tom, 2026-10-28)

Tom rejects the new a's appearance and alignment and calls the four-screen, one-variant round
a waste of time. “One scalable behavior” does not mean one design alternative. Record this
misinterpretation and failed visual judgment in `design-system.md`. Next: three different
answers at one identical zoomed-page geometry, one screen each, with costs. Do not expand
one unchosen treatment into multiple states or add camera logic. Keep rejected a as reference.

## Comparative replacement ready: b/c/d (2026-10-28)

One `zoomed-page` screen each, same page content/60% camera. b: compact head attached to frame.
c: fixed comparison strip, a/b labels on frames. d: selected-variant inspector. All three
screens inspected side by side; world geometry identical. Type/lint/render checks pass.
Recommendation b; tradeoffs recorded in `design-system.md`. a remains rejected reference.
No camera logic added. Do not expand states before Tom chooses a direction.

## Tooling inventory reminder (Tom, 2026-10-28)

Temporary `.mjs` screenshot/audit helpers are candidates for Studio CLI capabilities. Their
paths, demonstrated needs, possible extraction and limits are recorded in `design-system.md`.
Prioritize reusable batch variant/state shots and comparison geometry over prototype-specific
camera assertions. Keep this in the inventory; no CLI implementation during page exploration.

## WebKit fix and immediate push (2026-10-28)

User explicitly requests immediate commit/push. Root cause reproduced in visible system
WKWebView: removing iframe during top-level await hangs module evaluation at 100% CPU.
CLI bootstrap now starts async work after synchronous ESM evaluation. Native 40-cycle repro
passes; pending-environment module-evaluation and paint-protocol regression tests pass.
Loading message prevents Studio's one-second fallback from showing a still-blank frame.
Optional native test: `tools/scripts/verify-webkit-frame-reloads.swift <full frame URL> ...`.
100-cycle test and full CLI/Studio verification were in flight at commit time; no claim of
full CI success. The user's Studio still needs a full restart to load the updated frozen
runtime assets. Design sketches b/c/d are open alternatives, one identical 60% screen each;
a is rejected. No further design changes before the user's pick. Pinch IPC failure is separate.
