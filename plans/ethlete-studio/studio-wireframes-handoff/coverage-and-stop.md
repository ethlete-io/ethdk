# Wireframes handoff: coverage review, interaction gaps, stop instruction, open items

## Coverage review and resumed exploration (2026-10-30)

Tom: much of Studio is still undesigned. Designing Studio is also how we discover defects and
improvements in the tool and workflow; keep recording them in `design-system-actions.md`.
Completion of the previous component round does not authorize jumping to app implementation.
Finding 6.5 records the mistaken coverage assumption.

Initial source audit, not a complete specification:

| Area                           | Drawn today                                               | Missing or unresolved design coverage                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start and setup                | `pages/start`: no repo, no products                       | In-app product creation and base selection, opening/preparing a repository, starting/stopped server and recovery. The app already has a product form; the drawing currently delegates to the agent/CLI. |
| Shell/navigation               | Open/hidden panel; project picker                         | Navigation with a draft in progress; clear relation of checkout and product selection. Check actual tasks before adding controls.                                                                       |
| System                         | Part, empty, many-states                                  | Loading/failed frames, inherited part/override provenance and changed-outside-sketch recovery.                                                                                                          |
| Inbox                          | Open, with resolved, active only, active clear, all clear | New point-anchored comment, reading/replying to a thread, agent questions versus answers, addressed versus user-resolved threads, sending/failure/draft recovery.                                       |
| Sketches                       | Page sketch and zoomed page                               | No sketches, drawing/not-ready/ready, multi-state and preset comparison, older rounds, feedback and discard. Parked zoom/pin questions remain in the findings file.                                     |
| Merge                          | Open comparison                                           | Comparing/progress, failed comparison, unchanged result, refused merge after target changes, merging and completion. The app has explicit refusal/rebase handling.                                      |
| Flows                          | Open flow, empty                                          | Frame/target failures and following a branch into the relevant page state. Scope any flow editing proposal separately.                                                                                  |
| Application maintenance        | No dedicated drawing in this product                      | Update available/downloading/failed and server status/restart already exist in the app; assess their place in the new shell.                                                                            |
| Future designer workspace      | Requirements in `designer-workflow.md`                    | In-app agent chat, persistent direct editing and repository operations remain future planning; they are not covered by current pages.                                                                   |
| SDK catalog and importing code | Separate plans                                            | Catalog needs the agreed grill before implementation; existing-code import remains a separate planned workflow.                                                                                         |

### Interaction detail gaps (Tom's first-look audit, 2026-10-30)

These are explicit remaining design work, not optional polish after implementation. Inventory
coverage per control, including its body/overlay and visible interaction states. An existing
CSS `:hover` or native `title` is not evidence that the state has been drawn and reviewed.
Use states per axis and representative host contexts, not a Cartesian product.

| Control or region                  | Required review/design coverage                                                                                                                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo picker                        | Trigger hover/focus/pressed, open menu, selected and hovered entries and opening another repo.                                                                                                                                                                 |
| Project picker                     | Trigger and menu-entry interactions, selected versus hovered entry, open/closed presentation. Preserve Tom's distinction from repo selection; current shell code calls its repository list `project-picker`, so clarify this naming/mapping during that round. |
| Tree status icons                  | Actual tooltip appearance and placement for status, warning and comments; hover and keyboard focus. `tree-row` currently supplies only native `title` strings.                                                                                                 |
| Inbox rows                         | Hover, focus, selected and selected-hover; interaction with the comment pin and thread. Existing five list/filter states do not cover these.                                                                                                                   |
| Merge changed list                 | Hover/focus, selected and selected-hover rows; relationship to the selected comparison on the canvas.                                                                                                                                                          |
| Canvas zoom controls               | Fit and percentage trigger hover/focus/pressed, plus the zoom menu/input if proposed. System canvas currently draws `span`s; Sketches has its own button-based controls. Review both hosts before extracting a shared component.                               |
| Preset select (`desktop 1440x900`) | Open select body/options and their hover/focus/selected states, anchored to its trigger. A closed select is not the whole control.                                                                                                                             |
| Merge unchanged accordion          | Collapsed and expanded body, contents, chevron/header hover/focus and item interactions where applicable. `pages/merge` currently has only one state and a button-shaped unchanged line.                                                                       |

This list is Tom's initial inspection, not a claim that everything else is complete. Audit
the remaining visible controls with the same criteria as we work through the pages. Track
tool/workflow defects in the findings file separately from these missing design decisions.

Tom explicitly requires systemic prevention, not just an inventory: finding 4.47 in
`design-system-actions.md` records a proposed interactive-element declaration, linked
subsurfaces and blocking completeness checks. A review-ready exploration is not an
implementation-ready design. The flag/API and gate are not implemented; passing today's
CLI checks does not establish completeness. Do not use the current ready Inbox sketch
or its 18 passing renders as permission to move the product into implementation.

Next focused question: where to compose feedback anchored to a visible design point?
Sketch `pages/inbox`, round "Kommentar am Design schreiben": A beside the pin, B in the
Inbox side panel, C in a bottom tray. Same draft, target and canvas geometry in all variants;
all five existing states retained. Static design only, no replacement camera or comment
implementation. Review tool friction as part of creating/checking/shooting this sketch.

The three composer placements have been drawn and visually inspected in
`/tmp/inbox-draft-revised.png`. B was corrected to reserve space in the panel rather than
cover comment rows. The author reports all 18 variant/state renders passing and no pixel
change in the 15 pre-existing state drawings (`/tmp/inbox-all-revised.png`). Independent
check passed all 18 renders and corrected two unregistered `text-muted` utilities to
`text-text-muted`. The sketch is `ready`, waiting for Tom's choice; no auto-merge because
the variants differ. No busy/error state, responsive placement or comment interaction is
implemented or verified by this static sketch. Findings 4.44 (read failure appears empty,
source audit), 4.45 (new-state baseline appears broken) and 4.46 (empty checker diagnostic)
were recorded during the round; no fixes to those tools have been made.

Tom's review of the live sketch (2026-10-30): too many screens, unclear what to inspect.
Finding 4.48 records the screenshot and proposed focused initial comparison. Retaining all
states for regression checking must not force Tom to inspect all of them for a one-question
decision. No composer variant has been chosen. Do not treat the ready sketch as successfully
presented: the current review presentation is itself a workflow defect. Existing unchanged
row folding needs a live diagnosis before claiming its specific failure cause.

Tom commented on A / `comment-draft`: "geht in die richtige richtung aber sollte mehr
attached zu einem avatar sein" (thread `20261030T104310Z-0461`). Round 2, "Kommentar am
Avatar verankern", explores D/E/F from A, comparing only the visible connection between
the same avatar anchor and the editor. B/C are not developed further; A is not yet merged.
Do not expand to another workflow while this question is open. D uses a bubble pointer,
E docks the avatar on the editor edge, F uses a narrow connector. Parent inspected final
context and enlarged attachment shots (`/tmp/inbox-context-final.png`,
`/tmp/inbox-attachments-final.png`, crop `530,160,480,300`, scale 2). All three visibly connect
to the same avatar; E's header was spaced below the overlap. Recommendation D for the
direct connection with least extra chrome. Both author and independent check passed all
36 variant/state renders; round 2 is `ready`, waiting for Tom. No auto-merge, no source
change from the independent check. No placement behavior or completeness claim.
Read the design inbox for newer feedback before resuming. The live server reports empty
`unchanged` arrays for every variant (finding 4.48); no server restarted.

Coordination: Claude session `claude-sdk57` reports Tom authorized implementation of findings
4.44, 4.45, 4.46 and 4.48. It owns the CLI/Studio code fixes; this session owns the sketch
and currently these plan updates. 4.47 and 6.5 remain planning. Shared CLI `dist` must survive
the sketch checks; the other session was asked to defer builds/deletion until they finish.

Latest feedback: Tom rejects D/E/F as a whole: "das schaut alles nicht wirklich gut aus".
Record the visual failure separately from their passing render checks (finding 6.6). No
variant is approved or merged. A new round G/H from A redesigns the composer itself around
avatar/editor composition, with less competing header chrome and no decorative bridges.
The agent is drawing; parent visual critique and independent checks still required. The
approved scope remains one point-comment question, not a product implementation.

Latest steering supersedes active drawing: Tom supplied a compact Figma comment-input
screenshot (`/tmp/codex-clipboard-ZMjDSV.png`) and requested Figma/other-tool references first.
G/H drawing was interrupted. Round 3 and its drafts exist but are unreviewed, unchecked and
not ready; the author released its claim. Do not present them as completed options. No
previous variant has won. Finding 6.6 now holds source links and the reference comparison:
compact initial entry differs from a filled multiline editor and from an existing thread.
Local inspected references: `/tmp/studio-reference-figma-frame-82.png` (official animation,
filled editor), `/tmp/studio-reference-miro-editor.png` (edit existing thread),
`/tmp/studio-reference-miro-draft.png` (saved-draft notice),
`/tmp/studio-reference-penpot-comments.webp` (existing thread). Use Tom's screenshot for the
compact empty state. Reframe the next round with these distinctions; do not merely style
the unfinished G/H or infer automatic resize/animation behavior from unrelated screenshots.

Tom approved the reference-led direction ("sounds good"). Round 4 I/J from A is drawing
"Kompakter Kommentareinstieg": pin, compact input and integrated send. Empty `comment-entry`
and filled/multiline `comment-draft` are states of each option; existing thread design is
deferred until the entry composition is selected. G/H remain unfinished reference history.
No product implementation or completeness approval follows from this direction.

Round 4 I/J is now drawn and parent-reviewed. I keeps an 8 px gap between pin and field;
J touches them. Both have empty `comment-entry` and multiline `comment-draft`, no extra
heading/breadcrumb/footer, an integrated gray disabled send action when empty and primary
send when filled. The arrow is a variant asset, not inline copied artwork. Parent inspected
`/tmp/inbox-round4-anchor-final.png` and full-page context. Initial draft moved the marker;
browser measurement caught it and corrected both: A/I/J all x=609, y=187, 22×22 at 1440×900.
This geometry failure and possible anchoring-tool improvement are recorded under 6.6.
The independent check passed all 62 variant/state renders without source changes; round 4
is `ready`, no auto-merge. Five old states are correctly unchanged. Recommendation I for clearer
separation of marker and input. Hover/focus/pressed, send progress/error, draft preservation,
edge collision/zoom behavior and existing threads remain undesigned/unverified by this round.
Finding 4.49 records that CLI shots still include all prior rounds; no round filter exists.

Latest feedback overrides the recommendation above: Tom rejects I/J as a Figma copy:
"das ist nun einfach eine kopie von figma. referenz heißt nicht klauen. feedback aufnehmen."
Finding 6.7 records the process failure and the required distinction between learning from
reference principles and reproducing its visual composition. "Sounds good" was permission
to explore from the analysis, not approval of these drawings. No candidate is approved or
merged. Record this rejection in r4's note; preserve history and stop drawing for this
feedback-capture request. Do not extend I/J or carry their composition forward as settled.

Correction and current task: Tom says I/J have not actually been rejected in the tool,
only in our prose, and explicitly asks us to get on with the design. He is right: the
model/CLI has no per-variant rejection, and round notes do not disable choosing I/J.
Finding 3.45 records the missing lifecycle state and the false completion claim. Do not
discard the whole sketch or delete alternatives as a substitute. Negative feedback is
recorded; technical rejection remains unsupported. Round 5 K/L now explores independent
Studio compositions from the underlying task. Do not continue or recolor I/J as a solution.

Round 5 K/L: the first pair was withheld from user review after author/parent found the
same card at two positions. Revised K is a lightweight annotation line beside the pin,
with bottom rule and a text Send action; L is a small pinned note below it with a flat
editing surface and quiet text action. Both retain empty/multiline states and the original
point. Parent reviewed `/tmp/studio-kl2-crop.png` and full context; final disabled-action
visibility was refined in `/tmp/studio-kl3-crop.png`. Recommendation L for longer feedback,
K when minimizing canvas coverage matters. Independent final check passed all 76 states
without source changes; round 5 is `ready`, no auto-merge. These are proposals,
not an accepted design or complete interaction implementation.

Mailbox verification update: 4.44 and 4.45 moved to the fixed findings file after Claude's
headless/live checks. 4.44 retains explicit limits: no native check, and an already-open
live stream could not be forcibly interrupted headlessly. The initial-failure/reconnect
path was fixed in `d9bbc3f27` and verified. 4.45's neutral baseline was verified live after
Tom's rebuild. 3.45's missing formal rejection remains open and unimplemented.

Tool update: Claude fixed 4.48 in `b78bff197`; Tom rebuilt/restarted :4402 himself. The live
API now recognizes all five retained states as unchanged across A-H, so folding has its
missing data. Cause: `ng()` failed during Node markup comparison and the old code never
tried pixels. Source/live evidence is recorded in 4.48; focus-region metadata and detail
scale remain proposals. Updated dist also contains 4.45 and 4.46; no build needed here.

## L merged and next focus question (2026-10-30)

Tom merged L. The selected part, merged hash and feedback thread were committed immediately
as `4a960f125` (`feat(repo): Adopt the pinned Studio comment note`), without the unrelated
plan edits. Formatting unchanged. Product check printed `ok`, but did not exit after
1 min 40 sec; only the owned check PID was terminated, exit 143 (finding 4.50). Do not claim
a clean zero-exit check or native behavior verification. No push requested or performed.

New sketch `pages/inbox`, "Fokus beim Kommentieren", is drawing: A highlights the whole
note for keyboard focus in its textarea, B highlights the writing area only. One new
`comment-draft-focus` state per alternative, all seven merged states retained. The shared
helper also drops unused A-K exploration branches in this sketch; no base edit and no
appearance change to the seven existing states allowed (finding 5.60).

Focus sketch now drawn and parent-reviewed: `/tmp/inbox-focus-crop.png` and
`/tmp/inbox-focus-full.png`. A rings the whole note; B rings the writing area. Recommendation
A for a calmer whole-note boundary. Both have all seven old states pixel-identical and
one new focus state. Old placement code was removed in sketch shared helpers/styles.
Independent final check passed 16 frames; the sketch is `ready`, no auto-merge, and only
`comment-draft-focus` changes in either variant. The SDK bare
textarea suppresses outline, so these drawings add an explicit targeted focus treatment;
no real keyboard behavior is verified. The send control is not drawn as focused. Hover,
send/error/progress, draft recovery and thread states still remain.

Tom's correction overrides the focus recommendation and its assumed state model: the
already merged L appearance IS the focused comment editor. No focus means the editor
closes; there is no open/unfocused editor to decorate. Focus within the editor (including
moving to Send) keeps it open. Closing does not imply send; draft retention/discard is not
settled. Finding 6.8 records the agent's invalid state expansion and the missing reachability
check. Do not carry the A/B focus rings forward as an agreed design.

Corrective round C, "Kommentar bleibt nur mit Fokus offen", is being prepared from A:
restore accepted L visuals, remove the speculative `comment-draft-focus` in C, preserve all
seven actual product states and shared-helper cleanup. This is a deterministic correction,
not a new visual choice. Parent review/independent check precedes ready; no runtime focus
behavior is implemented here. Old A/B history still lacks a formal rejection mechanism.

## Stop instruction — no further sketches (2026-10-30)

Tom's latest instructions, verbatim: "no more new sketches for you" and "wrap it up".
Design work is stopped. Do not create, extend, ready or merge sketches unless Tom explicitly
authorizes new work. This boundary overrides earlier automatic continuation instructions.

**Lifted (Tom, 2026-10-30):** the stop held only for that evening. It no longer applies, and it
never applied to plan and docs work. Sketches for the missing designs may go ahead.

Current truth: L is committed as `4a960f125`. The focus sketch is still `in progress`,
containing A/B and corrective C in round 2. C has all seven baseline states pixel-identical,
and the author's 23-state check passed. It has NOT received independent final review, been
marked ready or merged. Keep it as an unmerged artifact; do not continue it automatically.
The accepted rule is that L already shows the focused editor, and focus leaving the whole
editor closes it. No real focus/blur behavior has been implemented. No claim that old
variants were formally rejected is valid; that lifecycle feature remains finding 3.45.

Claude session `claude-sdk58` now owns agreed tool fixes after `claude-sdk57`: 4.49 first,
then repro/triage for 3.41, 3.20 and 1.5; verify whether 5.45 is stale; shared crop CLI/API
for 4.43 with Studio presentation still a proposal; 3.45 lifecycle proposal only. It will
ask before rebuilding shared dist. Our current work is the Inbox focus sketch and plans.

Rules from 2026-10-29: delegate to subagents; never share `node_modules/.design-explore` with Tom's
:4402 (4.13, fixed in `5eb5fff4c`); `design shot <part> --states --variants` draws merged and
variant rows without :4402. Skill source is `libs/agent-rules/content/skills/`, then
`yarn agents:sync`, never only `.agents/skills/`.

The dated sections below are the history of 2026-10-28. The parked points on `pages/sketches` are in
`design-system-actions.md` under "Parked".

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

## Tooling inventory reminder (Tom, 2026-10-28)

Temporary `.mjs` screenshot/audit helpers are candidates for Studio CLI capabilities. Their
paths, demonstrated needs, possible extraction and limits are recorded in `design-system.md`.
Prioritize reusable batch variant/state shots and comparison geometry over prototype-specific
camera assertions. Keep this in the inventory; no CLI implementation during page exploration.
