# Handoff: Studio design, real look, pages first

Branch: next · see `git log --oneline -15 -- .ethlete/design/studio plans/ethlete-studio`
Working tree: clean at handoff. No open sketch.

## Goal

Design Ethlete Studio in its own design product `studio` (`.ethlete/design/studio/`, base
`.ethlete/design/sdk`), real look. The process mainly TESTS Studio and the design CLI as a product:
every friction goes as a finding with a prevention idea into `plans/ethlete-studio/design-system.md`
(section "Studio as a product, findings from the clean-slate session", newest at its end). Talk to
Tom in German.

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

## Next steps

PAUSED. Tom on 2026-10-28: "keine weiteren designs nun mehr bitte". Start no new sketch until Tom
asks. When he does: Sketches page (variant matrix), Flows page, merge compare.

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
