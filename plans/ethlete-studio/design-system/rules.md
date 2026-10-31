# Design system: rules, slices and kept call model

### Sketches

- A sketch always has a target: an existing part or a new one. A free sketch (mood, palette,
  logo) is allowed only for foundations, and its result goes into foundations.
- One open sketch per target. A new sketch on the same target needs the old one merged or
  discarded first.
- A sketch may change parts below its target (a new header with a new button variant).
- Status: `in progress` → `ready` → merged or discarded.
  - `in progress`: Studio re-renders live on each file change, with a clear frame and the
    label "in progress". The agent reports what it builds now ("variant B, phone"). The user can
    comment, but not pick.
  - `ready`: the user picks.
- Before the merge, a preview view shows every page and element that uses the changed parts,
  old and new side by side.
- After the merge the sketch is deleted. The picked variant is now the part; the reason is the
  note on the part. The other variants live only in git.

### Feedback

- The user comments on a state or on a point in the canvas. Studio writes the comment as a
  file in the repo.
- The agent reads open comments with `et design inbox` (and the MCP equivalent). A done comment
  is deleted; only the reason stays, as the part's note.

### Checks

`et design check` fails on:

- a dependency that points up a layer, or an element used by a component;
- a hard-coded colour outside foundations;
- a copy of a component inside a page or element;
- motion that is not CSS animations, CSS transitions or the Web Animations API (no
  `requestAnimationFrame` loops). A later timeline tool must stop any animation at time t.

### Canvas and navigation

- Each system entry (for example "button") is its own infinite canvas. Frames on it each show
  one state at one width, always at full height. No scrollbars, only pan and zoom.
- The sheet shows each state across the product presets in a row. A state opened alone gets a
  free-width canvas.
- Controls, as in Figma:
  - space + drag, middle mouse + drag: pan
  - wheel: pan vertically; shift + wheel: pan horizontally
  - ctrl + wheel, pinch: zoom to the pointer
  - `Shift+1` fit all, `Shift+2` fit selection, `Shift+0` 100 %
  - double-click a frame: the frame becomes active (click, hover, scroll inside); `Esc` leaves
  - drag the edge of an active frame: free width (replaced by "Frame size decisions": no drag
    handle for now, and a fitted tile never has one)
- Only frames in view run live. Frames out of view show a cached screenshot from the same core
  that makes the agent's screenshots, so agent and user see the same presets.
- Top: workspace and product picker. Left: a tree with Foundations, Components, Elements,
  Pages, Wireframes, Flows, Sketches and Legacy. Each entry shows badges: from base, overridden, sketch
  open, comment open.
- A sketch shows on its target's canvas: the current version left, the variants right in the
  same states and widths. "Sketches" in the tree lists open sketches as jump targets.

### Kept from the call model

- Studio stays an Angular app. A model name is never a fixed union in the code.
- `frame.html` stays the frame host. It takes `?surface=<name>&color=<name>` and puts the
  classes on `#root`; the theme switch is a Studio control and applies to every frame.
- `ng(template, { imports, fields })` renders real Angular components in Node with
  `@angular/compiler` (JIT) and `renderApplication`, from the built package: `dist/libs/*` in
  the SDK through a resolve hook, `node_modules/@ethlete/*` in a consumer. A product's
  `providers.ts` gives it colour and surface themes; the form field throws without them. A render
  error rejects `ng()`.
- A frame cannot import an `@ethlete` barrel: libs resolve to source, and the import dies with
  `ERR_INSUFFICIENT_RESOURCES`. Pre-bundle the library for a real component from another
  checkout.
- A drawing has a `setup(root)` hook (84ee476e9). It will take a function or an array.
- A drawing may set `et-surface--<name>` on an inner panel, never on its root. A variant
  overrides a colour theme with `themeCss()` in its styles.
- The status files of `et design` live in the temp dir `ethlete-studio-checks/`, one per
  checkout. `libs/cli/src/lib/design/check.ts` already launches a headless Chromium, and
  `serve.ts` already watches the files - the base for screenshots and the live view.

### Legacy calls

The old calls stay in a read-only Legacy tab, as reference for the transfer into the new system.
No new calls, no picks. The user can mark a call "transferred". The tab disappears when `calls/` is empty or missing.

Decided 2026-10-27, later the same day: the old call UI goes, because the Legacy section of the
system view replaces it. Removed in 4b2383ae2. The '' route is `studio-view/StudioViewComponent`:
the system view plus a status bar with the checkout picker, the server lifecycle and the update
buttons. Legacy calls stay reachable under Legacy in the system tree.

Removed in 02672803d: `design_statuses`, `design_system`, `design_set_verdict`, `design_set_closed`,
`design_set_mode`, `design_add_variants`, `tools::design_check`, `call_status.rs`, the `design.rs`
write helpers and `CheckReceipt`, with their tests. `tools.rs` keeps MCP serving for slice 8.
Correction: `design_status_watch` was wrongly on the list. It stays, because the sketch view needs
it: `host/design.ts` `designStatusChanges$` arms it, and the system view reloads the sketches on each
report change, as in 0f966f967. 02672803d removed it too, so live report lines and "drawing…" stopped
reaching Studio. Restored in a442b6acf (`StatusWatch` and `watch_statuses` in a trimmed
`call_status.rs`). The Studio spec "lists the sketches again when the host reports a changed status
file" fails without it. The Rust test `a_sketch_report_change_is_reported_and_a_receipt_is_not`
fails with `report()` made a no-op; it calls `watch_statuses` directly, so the command's
`changes.send(())` is covered only by the Studio spec. One `cargo test` run failed
`stop_reaches_the_whole_group`; it passed 6 of 6 on HEAD and 5 of 5 before 02672803d, so it is
flaky, not a regression. Likely cause, not confirmed: its fake tool listens on the fixed ports
45872-45877, which a parallel `cargo test` from another agent can take.

## Slices

1. **Core and data model**: workspace, product, base, layers, fixtures, states, presets, and
   `et design check` with all rules above.
2. **Canvas and navigation**: as above, plus the Legacy tab. The old UI is removed (see
   "Legacy calls").
3. **First real test**: rebuild the tomflix system with the new workflow, from its old calls in
   Legacy - foundations, components and elements only. It runs after slices 4 and 5, as the
   battle test of the workflow.
4. **Sketches**: status, live `in progress` view, merge preview, merge and discard.
5. **Feedback**: canvas comments and `et design inbox`.
6. **Pages and wireframes**: page states, the wireframe kit, the remaining kit-part count.
7. **Interaction**: a clickable prototype. Part rules, flow-line triggers, play mode and the
   prototype store, as in "Slice 7 decisions".
8. **MCP server**: `et design mcp` over the core, as in "Slice 8 decisions". It replaces
   `apps/ethlete-studio/src-tauri/src/tools.rs`.
9. **Motion**: its own plan, `plans/ethlete-studio/motion.md`. A timeline, controlled time, a
   screenshot per keyframe. Motion is a tool that extends components and elements.
10. **Studio designs Studio**: a full redesign of Studio through the whole workflow, as in "Slice
    10 decisions". It runs after slice 6 and before slices 7 to 9; the tomflix rebuild follows it.
    It needs states and interactions, fitted frames without a border, and the live mode first,
    as in "States and interactions decisions".

Each slice gets an "in progress" note here when it starts.

States and interactions: in progress since 2026-10-27, in six steps: (1) `interactions` in
`definePart` and the CSS rewrite in the server; (2) Studio forces the interaction and shows the part
table; (3) the interaction switch in the sketch matrix and `interaction` on comments; (4) fitted frames
without a border and the live mode; (5) the studio-lab button; (6) the frame reload per part, as in
"Frame reload decisions". Steps 1 to 5 done (c1c848c75, c62f52cd4, 37cc9d271, 95764db02, 129759c06, 5571eee5f, 97e42bd31,
242bdd69e). Step 6: the server side is done (027805054), the Studio side is built
(8ba222492, see "Frame reload Studio, as built"), and proven. The product picker ("Picker decisions") comes next in the builder queue.

Slice 1: done on 2026-10-27.

Slice 2: done on 2026-10-27. The canvas, the server, the CLI, the tree and Legacy are built, and
the old Calls UI is removed (4b2383ae2). Open: a Rust slice removes the commands only the old UI
used (see "Legacy calls"). The pickers and the "New product" screen are done (c1e8f5806). Open: the create form and
its endpoint, as in "Picker decisions".

Slice 4: done on 2026-10-27, with the frame sizes and the sketch matrix (see "Sketch matrix, as
built" for its open points).

Slice 5: the core and the Studio comments are done (see "Slices 4 and 5 core, as built" and "Studio
comments, as built"): store, comment mode, draft, pins, Withdraw (1209478a5, c0a8e5532), the sidebar,
other-size counts, merge lock and empty matrix cells (f13302bf3), replies and threads (35d609cee). Open:
the merge state and the "needs rebase" inbox entry, as in "Merge and rebase decisions".

Slice 3: the inventory is done (`tomflix-inventory.md`). The rebuild waits on purpose
(decided 2026-10-27) and runs after slice 10. Tomflix stays out until the new workflow works: canvas, sketches and
feedback. Then the old tomflix calls move to Legacy, and the rebuild from them is the battle
test of the workflow. The inventory is the reference for it.
