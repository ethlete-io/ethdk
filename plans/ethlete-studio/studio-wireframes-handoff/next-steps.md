# Wireframes handoff: next steps (state 2026-10-29)

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
   row, comment card, project switcher...), then page states, then the real app.
   `components/tree-row` merged as variant a (`984d745d6`), then j (`356894ba6`): kinds group, part
   (bright, chevron), leaf; `inert`; exported `Row`; stack without padding. End marks are ONE
   family of 12px line icons (pencil = in progress, check = ready, red triangle = warning, bubble =
   open comments, no count); details go in tooltips (Tom). Rejected: accent or red diamond, dots
   mixed with icons, red underline. `elements/part-tree` draws its rows with it (merged
   2026-10-29). Rule (Tom, 2026-10-29): a component needs two hosts that draw the same case.
   States per axis, not every combination; an icon set is a foundation asset (skill, `de754be55`).
   `tree-row` interaction states merged as variant a (`7e52fafb0`): hover, focus-visible, selected
   and combos via `Row.interaction` -> `data-et-force` (finding 5.28). `pages/flows` draws its list
   with `tree-row` (`5abfc6636`). A one-variant sketch "Pressed state" (`:active`) on `tree-row`
   is the open step; Tom agreed. Click, select and expand stay out of drawings until the prototype
   stage. Next component: the comment pin (`ib-pin` in inbox, `sk-pin` in sketches; axes: avatar
   or agent logo, with or without count, interaction); the inbox row stays in `pages/inbox` (one
   host). Then switch and project switcher. Tom restarts :4402 to get `0e6bd90a1`. "Pressed state" on `tree-row` merged
   (`2a39a5c7d`).
8. Done 2026-10-29 night, finding 2.10: `definePart({ grid })` (`688870301`, see
   `git log --oneline -12`); `tree-row` declares a grid (`832ec675b`) plus new state
   `selected-active`, which fixed a lost accent on a pressed selected row (`109ed0dc6`, finding
   5.39). Tom's grid look: `pages/system` `many-states` variant e (sunken frame body, cells as one
   `--surface` sheet with 1 px hairlines, groups "States by interaction" and "Rest only"). Tom: the
   old button table is obsolete, one look for all grids: `elements/canvas-frames` owns it
   (`stateGrid`, `canvasFrame`, `canvasView`; 8 px block cell padding, `a47a64158`);
   `pages/system` imports it (`20db1e618`). Studio builds it (`f35d52a2b`, `144e2d843`): every
   grid is a sheet, cells load with `fill=surface` (new frame query param in `libs/cli`). Tom
   restarts Studio to see it. A merge deletes base files a variant removed (verified).
   Owed: move the fixed entries 2.10 and 5.42 to `design-system-actions-fixed.md` (append, never
   rewrite). Open findings from tonight: 4.28-4.31, 5.32-5.43 (5.32 answered by the
   canvas-frames export). Next: the comment pin (`ib-pin` in inbox, `sk-pin` in sketches; axes:
   avatar or agent logo, with or without count, interaction); list every host first (5.24); it
   can use the new grid. Then switch and project switcher. Before a component sketch, list every host that draws the case
   (5.24). Sketch `pages/merge`
   (a: two-column table, b: wipe frame + bottom bar, c: side panel review + 200 % crops; agent
   recommends c) is `ready` and waits for Tom's pick. Open design point: `shell-main` has no rail
   section for merge, the drawings use `'Sketches'`. Its friction is 4.16-4.18, 5.19-5.21. Tom took c; round r2 (d: back link on top + hint under the
   note, e: Cancel next to Merge, f: close X + label on the button; agent recommends d) is `ready`,
   friction 3.25, 3.26, 5.22. Tom took d and asked if the merge note is needed: no, it is optional
   in the tool. Round r3 (g: no note field, h: quiet "Add a note"; recommendation g) is `ready`,
   friction 4.19.
9. 2026-10-29 late: `components/comment-pin` merged (a, `a7bda83fb`), then "Count alignment" a
   (count badge on the teardrop head, `0c22850c3`; Tom picked a, agent had recommended c). The part
   exports `commentPinMark(props)` (no stage padding) and `commentPinStyles` for hosts (5.46, 5.47).
   Prettier after that merge needed `design accept` (5.9 seen again, `e8d95750d`). Built:
   `sketch report --done` (3.28, `ef9fac592`); Studio says "Not ready yet" instead of "still
   drawing" on an idle sketch (`3086abc36`). `ready`, waiting for Tom: one-variant sketches
   `pages/inbox` and `pages/sketches` "Use the comment pin". The inbox one also brings back the pins
   lost since `a47a64158` (4.34). After the merges: `design check`, prettier, `design accept` if
   it warns, commit. Next: agent logos as a foundation asset (5.45; three copies now), then switch
   and project switcher. Open findings from tonight: 3.29, 3.30, 4.32-4.37, 5.44-5.48, 6.2.

10. 2026-10-29 night: Tom asked to build all open findings. Done: pin hosts merged (`6848e7de1`);
    `foundations/agent-logos` asset (`9594be0c0`, hosts `80d869ec7`; `pages/inbox` host sketch is
    `ready` but did not auto-merge despite 0 px, finding 3.35); Studio colour themes `warning` amber
    (`9594be0c0`) and `danger` signal red with Studio aliases (`96eff57ce`, 5.50). Wireframes are on
    hold (Tom; 5.5 closed `7d8f34fe2`). Built: CLI sketch commands (`e2a5a22f5`, `84b559f6a`), 3.31
    diff line under the Pick button (`6b4748a5c`), 2.8 (`49cb0ea40`). Tom decided on 3.31: keep the
    line there, a click zooms to the frame, compare rest only. Subagents running at handoff (check
    `git log` for their commits; each moves its fixed entries): CLI slice (3.35, 3.32-3.34, 3.36,
    3.37, 4.38, 5.53, 5.48, 5.26, checks 4.16/4.32/4.17/4.31/4.34/4.37/5.27/5.30/5.40); Studio UI
    (3.31 zoom-to-frame, 2.11, 2.6, 2.8 on screen); Mac over SSH (1.2 LAN rerun with unthrottled
    probe, 1.1 synthetic pinch; the Mac is free to use, Tom said); sketch `components/tree-row`
    "Status colours" (warning mark to `--warning`) is `ready`, waits for Tom's merge; then
    `design check`, Prettier, commit.
    Still to build, not yet started: shot slice 4.18-4.30, 4.33, 4.35, 4.36, 5.37, 5.41; part API
    slice 5.21, 5.28, 5.34, 5.44, 5.46, 5.47, 5.49; 3.36, 3.37 if the CLI slice did not reach them;
    5.51, 5.52, 6.3, 6.4. Blocked: 5.31 waits for the switch (Tom). Next design step after the
    findings: split `foundations/tokens` into `foundations/colors`, `/type`, `/spacing` (2.12, Tom
    approved option 1); needs 5.26 (`design part remove`) and a check how frames load the product
    tokens (5.17). Then switch and project switcher (list every host first, 5.24).
    Update 20:10: the CLI slice built 3.32-3.35, 4.38, 5.48, 5.53 (`f3c8208c9`). Not reached:
    5.26, 3.36, 3.37 and the checks 4.16/4.32 (`typecheckVariant` in `check-system.ts`), 4.17,
    4.31, 4.34, 4.37, 5.27, 5.30, 5.40. Shot slice part 1 runs (4.30, 5.41, 4.19, 4.36, 4.18,
    4.20, 4.29, 4.25, 4.33). Only one CLI agent at a time: parallel builds break `dist` (6.4).
    Update 21:00: shot slices done except 4.23, 4.24 (plan: extend the CLIPPED script in
    `system/render-check.ts` by the decoration ink box, and by outline and box-shadow extent).
    Studio UI done: 3.31, 2.11, 2.6 (`fe8130d06`), 2.8 checked. Mac: 1.2 not reproduced in 4000
    cycles; 1.1 cause found (WebKit gesture reply queue not cleared on WebContent exit, fixed from
    `safari-7624`), harness `tools/scripts/verify-webkit-pinch.swift`; Tom picks A rebuild the
    webview in Rust (recommended), B update Safari, C accept. Part API slice runs (5.49, 5.46,
    5.47, 5.34, 5.44, 5.28, 5.21). Then: 5.26 + checks slice (with 4.23, 4.24), then 3.36, 3.37,
    5.51, 5.52, 6.3, 6.4, then tokens split 2.12.
    Update 21:45: all CLI slices done (5.26 `part remove`, checks, 6.3/6.4, 3.36-3.40, 5.27, 4.34,
    4.37, 5.28, 5.44, 5.46, 5.47, 5.49, 5.54). `dist/libs/cli` builds are safe in parallel now.
    Merged: tree-row status colours + inbox agent logos (`d65df411d`), the part API refactors of
    agent-logos, comment-pin, tree-row, flows (auto, `cdf2b4c24`). Open, waits for Tom: sketch
    `pages/merge` "No page import" (a `embedPage`, recommended; b crop-only, has a label overlap);
    Tom merged a (`b2858fbcc`); `design check --product studio` is ok again. 1.1 option A built
    (`54bbc9a50`, `webview_rebuild.rs`, new window labels `main-N`), verified on ethlete-mac with
    synthetic pinches only; Tom still pinches on the real trackpad after a Studio update. Still open: 5.21, 5.34
    (only if Tom picks a grouped look), 3.39, 4.39 (GRID-COVERAGE contradicts the per-axis rule,
    recommend option 1), 4.40 (UNDEFINED-CLASS cleanup sketches), 5.51, 5.52, 5.55, 5.56; comment-pin
    hosts: one-variant sketches on `pages/inbox` and `pages/sketches` switch to `commentPin.styles`,
    then a comment-pin sketch drops `commentPinStyles`. Then tokens split 2.12 (`design part
remove` exists now).
    Update 2026-10-29 late night: pin hosts read `commentPin.styles` (`2e4348ab9`),
    `commentPinStyles` gone (`98e257959`); 4.39 option 1 built (`ee9b8ad8d`); 4.40 cleanup sketches
    merged (`798fe4cc3`), new finding 3.41 (flaky auto-merge skip). Tokens split 2.12: Tom picked
    "split the CSS too": a per-product explicit list of token parts in the CLI (default
    `foundations/tokens`; studio lists tokens, colors, type, spacing). A subagent builds the CLI
    part. Then three sketches `foundations/colors`, `/type`, `/spacing` go `ready` for Tom's merge,
    then `design part remove foundations/tokens`, drop it from the list, check, commit. That is the
    last sketch for today (Tom).
    Update 22:00: tokens split done. CLI list `e74f21315`; Tom merged colors, type, spacing;
    `foundations/tokens` removed, app imports the three sheets (`8c1671e23`). CI unit-test timeout
    fixed in `5b0677eea` (check the next CI run). Tom's :4402 serves 504 "Outdated Optimize Dep"
    after the split (4.41): Tom restarts it, then check `foundations/colors` (Tom saw overlapping
    cells, probably from the failed frames). Open from tonight: 2.13 (sdk `tokens` shows "from
    base" in studio), 3.42, 4.41, 4.42, 5.57, 5.58. Next: these findings, then switch and project
    switcher (list every host first, 5.24).
    Current resume state (after Tom merged both A variants): no open sketch, inbox empty.
    All six requested findings 2.13, 3.42, 4.41, 4.42, 5.57, 5.58 are fixed.
    Tool fixes cba51792e; shared sheet bbe2852a0; pixel-identical colors/type/spacing
    adoption 9807ff8a3, 083b839c9, 84f17bd6d. All four colors states also render cleanly
    on Tom's restarted :4402. Never stop that server.
    Tom picked and merged compact SDK Switch A (32x18) in pages/inbox and Project Picker A
    (above footer trigger) in elements/shell-main. Both remain in their sole independent host;
    no extracted component until a second host exists. Shared helper code lives under each
    part's shared/ after merge. Full Studio design check passes; merged files formatted.
    Project picker adds the first state project-picker and optional projectPicker: 'open';
    existing open/hidden shell states and all five Inbox states retained. Static design only.
    ng() returns HTML with embedded styles, not a Drawing; embed the string directly.
    Merge gotcha 3.43: target TS must contain a writable definePart({ note: <literal> });
    default-exporting a shared factory result rendered but failed metadata writing. Repaired
    wrappers preserve pixels; Tom retried successfully. Guard 90f3b9b48 rejects this before
    ready; 41 sketch tests, lint and CLI build passed. Feedback and current plan kept in git.
    Open: 4.43 (small changes hard to compare in full-page frames; recommend identical
    enlarged changed-region comparison). 5.59 is now fixed: reachable shared CSS and variant
    overrides participate in token validation. Also fixed 3.44: screenshot comparisons bypass
    source-only result caching, preventing stale failures or matches in later requests.
    3.41 remains open for the original intermittent first-run image mismatch.
    Native 1.5 remains open: nested Tokio runtime panic plus CEF/Mesa output. No concrete
    caller found; native panic hook captures a forced backtrace while preserving the prior
    hook. Requires app rebuild/restart and stderr capture for the next panic and action.
    Current requested design sequence is finished. Broader next stage: remaining page states
    and then implementation, following Tom's original order; do not open a new sketch as
    part of the commit/push request. Tom explicitly requested commit and push.
    Tom also explicitly requested the remaining plan files be committed and pushed:
    design-system.md, designer-workflow.md and sdk-component-catalog.md are committed
    in 083646c31. The initial merge commit 03f19acba is already on origin/next.
    Commits here carry no Co-Authored-By trailer (hook). New files: `git add -N <file>`, then
    `git commit -- <paths>`. Hook rejects scope `ethlete-studio`; use `repo`.
