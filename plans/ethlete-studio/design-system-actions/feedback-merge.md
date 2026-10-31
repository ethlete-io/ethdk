# Open: 3. Feedback, rounds and merge

## 3. Feedback, rounds and merge

### 3.41 A `sketch ready` run skipped the auto-merge on a markup-only change - open

- **Pain:** five cleanup sketches (4.40) went `ready` one after the other. Four merged at once;
  `pages/merge` printed `auto-merge skipped: variant a changes open`. `design shot pages/merge
--states --variants` then said "no pixel change, but the markup differs", and a second `sketch
ready` merged it. The first shot probably ran against a base that the merges just before had
  changed (`elements/shell-main`, `components/tree-row`), so the result is flaky.
- **Fix options:** 1. `autoMerged` draws the merged side fresh after a base change since the
  sketch opened, or retries once on a diff (recommended). 2. print the changed pixel count with the
  skip line, so the agent sees noise.

- **Reproduction tried (2026-10-30, `claude-sdk58`):** the `sketch ready` comparison
  (`shotsShowNoChange`) ran from source on `pages/inbox` variant c, the pixel-identical
  correction: three cold runs one after the other, then three at the same time on an emptied
  `vite-check-*` cache. All six returned `true`. Not reproduced, so no retry was added. On the
  next skip, run `design shot <part> --states --variants` at once and record the diff lines.

- **Related fix 3.44:** pixel-comparison results no longer survive into later screenshot requests. Regression reproduces a transient screenshot failure remaining cached, and a stale match hiding a later difference. This removes a confirmed cache hazard; the original first-run visual mismatch is still not independently reproduced.

### 3.45 Recording rejection in prose does not reject a variant in Studio - open

- **Pain (Tom, 2026-10-30):** after the agent said I/J were rejected, Tom corrected it:
  "abgelhent sind sie btw noch nicht, das hast du nur geschrieben. weiteres findings".
  The feedback was in the round note and plans, but both variants remained selectable.
  The agent falsely reported a lifecycle change it had not performed.
- **Evidence:** `SketchVariantInfo` in `system/sketch/sketch.ts` has authors, round and note,
  with no variant rejection/withdrawal state. CLI help exposes whole-sketch discard but no
  per-variant rejection. A round's note or `lost` text does not prevent choosing a variant.
  Discarding the entire sketch would remove the ongoing exploration, not just exclude I/J.
- **Required outcome:** a designer's rejection must be represented as a real, inspectable
  state that affects the permitted actions, rather than merely a sentence in chat or docs.
  Feedback recorded, variant rejected and whole sketch discarded are distinct operations.
- **Fix options:** 1. add a persisted per-variant rejection decision, with reason, decision
  origin and time, exposed in Studio and the CLI (recommended). Keep the drawings in history
  but prevent pick/merge of rejected variants in the backend as well as the UI. Reopening
  requires an explicit designer decision and retains the earlier verdict. 2. a round-level
  rejection that applies explicitly to its variants, with the same enforcement and history.
  Decide whether both scopes are needed; do not infer rejection merely from a newer round.
- **Guardrails:** distinguish unfinished, superseded and rejected work; old alternatives are
  not automatically rejected. An agent must only record a designer's actual decision, with
  its origin clear. A new round's prose is not a verdict. Do not delete files or discard
  the entire sketch as a substitute for a missing operation.
- **Acceptance:** explicitly reject I/J, reload, and see them as rejected history without
  working pick/merge actions. Direct API/CLI attempts fail with the verdict and reason.
  Other variants and new rounds remain usable. Reopening is explicit and auditable. Agent
  completion reports must verify the persisted decision and distinguish unsupported actions
  from completed ones.
- **Status:** missing lifecycle capability confirmed; no rejection API/CLI/UI implemented.
  I/J currently have negative feedback recorded but are not technically rejected. The next
  design round continues separately; the agent must not claim this finding is already fixed.
- **Proposal (2026-10-30, `claude-sdk58`, for Tom - not built):**
  - **Data:** a new optional `rejected` map in the sketch file, next to `variantInfo`:
    `rejected: { [variant]: { reason: string; by: 'designer'; decidedAt: string; reopened?:
{ reason: string; decidedAt: string }[] } }`. It is separate from `decision`, because
    `decision` holds one pick or one discard for the whole sketch.
  - **Write paths:** `decideSketch` gets two more kinds: `reject` (variant, reason) and
    `reopen` (variant, reason). Studio sends them through `SKETCH_DECISION_PATH`. The CLI gets
    `et design sketch reject <part> --variant <v> --reason <text>` and `... reopen ...`.
  - **Who may write:** only Studio writes a `reject` or a `reopen`, from a designer click. The
    CLI commands exist for the designer at a terminal and print the stored state after the
    write. An agent never calls them from prose.
  - **Enforcement:** `decideSketch` refuses a `pick` of a rejected variant. The merge route and
    `sketch merge` refuse it too, with the reason. `sketch copy --from` a rejected variant is
    allowed, because a new variant from an old idea is a new idea.
  - **Studio:** a rejected variant stays in its round, dimmed, with "Rejected: <reason>" and a
    "Reopen" action. Pick and Merge are hidden for it. `design shot --variants` still draws it,
    with a "rejected" label.
  - **Scope:** per variant only. A round rejection is "reject every variant of the round" in
    the UI, not a second stored kind.
  - **Open points, with recommendations:**
    - Reason required? Recommended yes: one line, so the history says why.
    - May the agent record a rejection the designer said in chat? Recommended no: Studio or
      the terminal only, so the origin stays true.
    - Does a rejected variant count for "all variants decided" checks? Recommended yes, as
      decided.
- **Decided (Tom, 2026-10-30):** build it as proposed, with these changes. The reason is
  optional. An agent may reject a variant itself, for example when Tom says "X is out" in chat.
  Each rejection and each reason stores who wrote it (`by: 'designer' | 'agent'`), each on its
  own. A rejected variant counts as decided and drops out of the pick and merge choice, but
  stays visible.
- **Built (2026-10-30, `claude-sdk58`):** `rejections` in the sketch file (a list per variant,
  so a reject after a reopen keeps the history). `et design sketch reject|reopen <part> --variant
<v> [--reason <text>] --by <model id | designer>`. Pick, merge and the auto-merge refuse a
  rejected variant; Studio dims it with Reject, Reopen and "Note as reason". Specs only: not yet
  seen in a real browser, and I/J are not rejected yet. Stays open until Tom accepts it in Studio.
