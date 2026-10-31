# Open: 6. Agent process

## 6. Agent process

These pains came from how the agent worked, not from the tool. Each one has a rule now.

### 6.5 Completed sketch rounds were mistaken for complete product coverage - open

- **Pain (Tom, 2026-10-30):** after Switch and Project Picker were merged, the agent proposed
  only remaining page states and then app implementation. Tom corrected that much of Studio
  remains undesigned and that using Studio must continue to reveal workflow improvements.
- **Evidence:** `pages/inbox` has five list/filter states but no comment composer or thread
  reply. The running app already has `comment-draft.component.ts`, `comment-thread.component.ts`
  and `new-product-form.component.ts`; their workflows have no matching designed state.
  `pages/merge` has only `open`, while `sketch-view.component.ts` also handles comparison
  progress, comparison errors and a merge refused after the target changed. The existing
  start drawing sends product creation to the agent/CLI, while the app offers an in-app form.
- **Now:** the coverage inventory in `studio-wireframes-handoff.md` distinguishes existing
  drawings, missing workflows and separately planned capabilities. The next sketch compares
  three placements for composing a point-anchored comment in `pages/inbox`.
- **Fix options:** 1. maintain this evidence-based coverage inventory as each workflow is
  explored; record tool friction here with reproduction and options, then let Tom choose
  the design (recommended). 2. add workflow coverage metadata to the design tool so a list
  of parts/states can also reveal uncovered tasks; this needs a separate proposal.
- **Still open:** the inventory is an initial source audit, not an exhaustive product review.
  No tool change or missing workflow is complete merely because it has been listed.
- **Tom's follow-up audit:** repo/project picker hover and menu states, tree-icon tooltips,
  Inbox and Merge changed-list hover states, canvas zoom controls, the preset select's open
  body (`desktop 1440x900`) and the Merge unchanged accordion are also missing design coverage.
  These are recorded individually in the handoff's interaction-detail table. A page's presence,
  CSS pseudo-state or native `title` must not be counted as a reviewed interaction design.
- **Required systemic prevention:** finding 4.47 records Tom's demand for an enforceable
  completeness gate, including interactive-element declarations and associated surfaces.
  The manual inventory alone does not satisfy this requirement.

### 6.7 A reference was copied instead of informing an independent design - open

- **Feedback (Tom, 2026-10-30):** "das ist nun einfach eine kopie von figma. referenz heißt
  nicht klauen. feedback aufnehmen." Round 4 I/J is rejected; neither is an accepted
  direction for Studio or implementation.
- **What went wrong:** the agent used Figma's pin/input/send composition as the template
  for both candidates. The main comparison became a gap versus direct contact. That did
  not provide independent Studio solutions to the underlying comment task. Changing a
  palette or spacing does not establish a distinct design concept.
- **Scope of the earlier approval:** "sounds good" approved using the reference analysis
  to continue exploration. It did not approve copying Figma's visual composition or the
  resulting I/J drawings. The agent's recommendation and passing checks did not change this.
- **Required correction:** extract the problem a reference solves and its useful principles
  (low effort to start, clear point association, different entry/thread states), then derive
  a composition from Studio's own visual language and designer/agent workflow. Compare
  actual alternative answers to that problem; do not present minor variations of the
  reference as design exploration. More elaborate decoration is not a correction either.
- **Process improvement proposal:** before presenting a reference-led round, state which
  principle each reference contributes, what is specific to Studio and how the alternatives
  differ in concept. Review the candidates beside the reference to catch literal imitation.
  This supports human design judgment; no pixel-difference or render gate proves originality.
- **Decision (Tom, 2026-10-30):** option 1, as a rule in the `ethlete-design-exploration` skill:
  before a reference-led round is shown, the agent states the problem each reference solves, the
  principle it takes from it, and how each variant differs in concept, then reviews the variants
  beside the reference for literal copies. No fixed visual rubric.
- **Action at that turn:** record the negative feedback in the round note and handoff, leave
  the product unmerged and do not extend I/J into more states. This did not create a real
  rejection decision: I/J remained selectable. Tom corrected this false completion report;
  finding 3.45 records the missing lifecycle capability. Tom then explicitly requested that
  the design exploration continue with new work.

| Pain                                                                                                                                | Rule                                                                                                                                                | Ref        |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The agent said "visually checked" after static fit shots only                                                                       | Define the check from the design claim first. Report exactly which states and actions ran.                                                          | L2720      |
| The exploration became a second canvas implementation                                                                               | Name the visual question and the smallest artifact first. Reuse the real canvas.                                                                    | L2940      |
| One unchosen idea grew into four screens                                                                                            | Draw about three different alternatives next to each other.                                                                                         | L3020      |
| The agent blamed the wrong cause for an alignment comment                                                                           | Look at the real render before you name a cause.                                                                                                    | L2659      |
| A synthetic `dblclick` passed, a real double-click failed                                                                           | Use real pointer sequences.                                                                                                                         | L2818      |
| The agent extended the sketch while the tool was broken                                                                             | Stop the design work while a broken tool is repaired.                                                                                               | L2982      |
| New controls duplicated accepted controls                                                                                           | List the accepted controls before you draw. Name what you reuse.                                                                                    | L2579      |
| Shared elements were extracted too early                                                                                            | Draw pages first. Record repeats as findings. Compare before you extract.                                                                           | L2607      |
| The agent changed a ready variant without a report; Tom saw it change while no one was drawing                                      | Run `sketch report --variant <x>` before any edit to a variant, also a fix after `ready`.                                                           | 2026-10-29 |
| The agent guessed the direction of "spacing passt nicht" and drew one answer; it made the spacing worse                             | If a comment does not say which way, draw both directions as variants, or ask.                                                                      | 2026-10-29 |
| The agent answered Tom's comments with a variant in the running round; `sketch variant` defaults to it                              | An answer to comments opens a new round (`--round`, `--note`).                                                                                      | 2026-10-29 |
| A header decision went into one state; the sibling state kept the old header and Tom found it after the merge                       | Before `ready`, shoot every state that draws the changed chrome. Carry the decision into each, or ask.                                              | 2026-10-29 |
| After the zoom work the agent proposed more detail on `pages/sketches` (open points 5 to 8); that drifts from the base plan         | Before you propose the next step, read the agreed order: all pages first, then extract components (`design-system.md:905`).                         | 2026-10-29 |
| The agent wrote new plain CSS files (`header.css`, `heads.css`) for a sketch, though sketches may use the Studio Tailwind utilities | Use utilities in sketch markup (`f27c66d0e`). Plain CSS only for what utilities cannot express.                                                     | 2026-10-29 |
| `components/tree-row` was extracted with one host (`part-tree`); its sketch missed the host's cases and cost an extra round         | A part becomes a component only when two hosts draw the same case. Until then it stays in its host. `tree-row` has two: `part-tree`, `pages/flows`. | 2026-10-29 |

- **As built (`493d1f6f9`):** rule 6 of `ethlete-design-exploration`; it did not exist before.

### Parked: open points on `pages/sketches` (2026-10-29)

Parked until all pages exist and the components are extracted. Next is `pages/flows`, the only shell
section without a page.

- Several state rows per variant, with the head on the top frame.
- Pending "Wird gezeichnet" placeholders.
- The head of the "Aktuell" column.
- Pins and comments at zoom. Recommendation: keep them at screen size.
- Several screen sizes side by side.
