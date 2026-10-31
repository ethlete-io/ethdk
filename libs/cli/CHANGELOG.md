# @ethlete/cli

## 3.0.0-next.26

### Minor Changes

- `et design check` measures text contrast in each colour scheme a product renders (light and dark when its stylesheets use `prefers-color-scheme` or `light-dark()`) and names the scheme in a CONTRAST finding.
- `et design` takes a product `base` from `node_modules`: `render.packages` defaults to `node_modules` without `dist/libs`, and an installed base gets no generated `tsconfig.json`.
- The `et design mcp` `check` tool checks a call and its variant, and `et design check --receipt <path>` writes the result to a JSON file.
- The new `call` tool of `et design mcp` reads a call: its `call.ts`, its `fixture.ts`, the variant file and the frame URL.
- A design part can name its component with `implements`, and `et design check` prints the open points of each part.
- A design product can declare the colour schemes it draws with `schemes` in `.ethlete/design/config.json`; both when left out.
- The design server answers `GET /__design/queue` with its queued and drawing shots, the age of the oldest, and the last shots that failed.
- A design product can list `generatedFiles` in its config. The part hash skips them, so regenerating a file no longer makes `design check` warn that the part changed outside a sketch.
- Add `iconSheet` to `@design-system`: a shared icon foundation sheet with a `catalogue` and a `construction` view, drawing each icon on its own grid (from its viewBox or `grid`) with centre lines and the padding box.
- `design complete` counts an option or a `row` control with `data-active-source="keyboard"` as its focus-visible look, the same as an option named by `aria-activedescendant`.
- `@design-system` exports `logoSheet({ marks })`, which draws a `foundations/logo` part: each mark at its sizes, with an optional light bar.
- `et design shot` and `et design motion` take `--scheme <light|dark>` (MCP: `scheme`) to draw a part in that colour scheme.
- Add `et design sketch note <layer>/<name> <variant> <text> --by <model id>`: it sets the note of one variant in sketch.json and refuses an unknown sketch or variant.
- `et design check`, `sketch check`, `sketch ready` and `design complete` fail interaction states on a part that declares no control (`CONTROL-STATE`). `design complete` hints a state that changes under 10 % of its frame.
- `et design check` lists missing motions as open points: every ordered state pair, except focus, and a looping motion in an ongoing-work state. `definePart({ unreachable })` exempts a pair with a reason, checked by the `MOTION-UNREACHABLE-*` rules.
- The design render check measures non-text contrast: the border of each control (and the frame around an input) and each svg icon must reach 3:1 against what it sits on. Decorative borders give no finding.
- `et design check` lists two more open points: a component part with no controls declared, and the contrasts the render check found. With `--complete`, it also lists each control that lacks a drawn state or surface.
- The design server answers `GET /__design/open-points?product=&part=`, the open-point list of one part or of every part; `draw=true` adds the contrasts and missing control states of one part.
- Design checks report missing mock option values as hints for merged parts and block newly introduced gaps in sketches; use `omits` to record intentional omissions.
- `et design ready <part>` and `POST /__design/part-ready` mark a part ready in `ready.json`, refused while the part has open points; the mark drops when the part changes.
- `et design` shot requests take `view` (a number raised per view change) and `rank=active|visible`: the active frame of the shown view draws first, then its visible cells, then the rest, then older views. A hung-up request's queued shot is dropped.
- `et design sketch ready` refuses while a target in a live variant has open points the sketch can close: no controls declared or a missing motion.
- The Studio motion timeline makes the motion's start frame live and drives it: the slider pauses its animations at that time, play and speed run them, closing resumes them at 1x.
- Motion timeline tracks name the foundations duration and easing tokens they use.
- `et design sketch ready` now runs the render check on the sketch's variants and refuses on any render issue, as `sketch check` reports it. Skipped elements are honoured; without a browser the check is skipped.

### Patch Changes

- `et design check` now lists the findings of a base product's parts per rule and says they do not block the product, instead of pointing to `--product <base>`.
- A design product without its own `tokens` takes the token parts of its base, so frames of a product that extends a base draw under the base's tokens.
- `et design complete` no longer crashes on an option that is also a `data-et-control` in an open surface.
- The design contrast check measures text against a `z-index: -1` fill behind it (a positioned sibling or a `::before`/`::after`) instead of the panel under that fill.
- `et design complete` no longer fails a page on the gaps of a control part it uses from its base product; those gaps stay open points of the base part.
- `et design check` no longer fails a product on the findings of a part it takes from its base product. It counts them in one line that points to the base product's own check.
- `et design check` prints one `RENDER CHECK NOT RUN` line when failing checks stop the render, naming the rules and how many problems are in the base.
- `et design` commands that load design modules (`system --json`, `sketch ready`) no longer share the dependency cache of the running design server, so they stop deleting its optimized deps and blanking every live frame.
- `et design complete` reports `CONTROL-UNDECLARED` as a hint; the sketch check fails on a control a sketch adds. For a native control the hint says to mark it with `control(markup, name)` and declare the name in `controls`.
- `et design` listens on `DE_PORT` when it is set, also when Studio did not start it. Before, it took a free port.
- `design complete` no longer reports the focus container of a composite widget (a `menu`, `listbox`, `tree`, `grid`, `tablist` or similar with `tabindex="-1"` or `aria-activedescendant`) as an undeclared control; its items are still checked.
- A package rebuild that writes a file back unchanged no longer redraws the design shots that use it.
- `et design complete` requires hover, focus and active of a menu item but no selected look; a select still requires the selected look.
- The design server keeps its part shots on disk, so a restart serves them without redrawing until a file they draw from changes.
- `et design complete` names a `hover:`, `active:` or `focus:` class no stylesheet defines instead of reporting an unchanged box, and the Studio Tailwind theme gains the `surface-pressed` colour.
- A design frame no longer grows below a scroll container for an absolute element that the container clips, such as the scroll sentinels of an overlay body.
- A design frame no longer grows to the viewport for a fixed element on all four edges, such as an overlay backdrop.
- A part frame now grows to cover absolutely or fixed positioned content, so an open overlay panel no longer gets cut off at the trigger's height.
- Design tool: a forced `focus-visible` now also matches `:focus-within` on the element and its ancestors, so floating labels and focus rings draw as they do in a real focus.
- A shot of a missing part, state or sketch variant now always answers 404, a queued shot of a removed sketch is dropped, and the render queue no longer lists failures of removed sketches.
- A part shot is cut from the page with a clip of the root's box instead of an element screenshot, and the thumb queue draws eight shots at once instead of four, so a grid of forty states draws faster.
- `et design shot --crop changed` also crops the states the merged part does not draw, comparing them with its first state, so a new hover state is no longer cut off.
- `et design sketch check` and `sketch ready` print one count line per variant for the problems that were there before, instead of repeating each of them per variant.
- The design server lists sketches about three times faster: each part source is parsed once, and the product's rule problems are found once per list. A run of merges no longer stalls frames and Studio requests for seconds.
- The sketch check warns of an export in a sketch's `shared/` folder only when no variant imports it. An export that only some variants use no longer warns.
- The `STALE-REPLACE` design check no longer warns on a `.replace` on a function parameter that a call fills with markup from a package.
- `et design check` no longer reports an `rgb()` or `rgba()` as a hard-coded colour when every channel comes from `var()`, for example `rgb(var(--shadow-rgb) / 0.25)`. A literal channel is still reported.
- Draw part and call shots on a transparent page in both colour schemes, as a live frame does.
- `et design check` reports `CONTROL-PART-INPUT` again: an import cycle left the plain-control selector undefined, so the rule matched no element.
- The CONTROL-PART-INPUT hint now covers the same plain controls as `design complete`: `summary`, focusable `[tabindex]` and every interactive role.
- CONTROL-STATE counts an interaction word only as the last word of a state name, drops modifier words from the element name, and asks a component without controls to declare them (Q164).
- Design commands that run at the same time no longer share one Vite cache folder: the first keeps the shared cache, every other one draws from a folder of its own that it removes when it closes.
- The design contrast check no longer reports decorative separators, toolbar outlines or hidden svg lines, and measures text on a frame's page fill.
- The contrast check measures the border of a segmented group: a bordered wrapper counts as a control frame when all its controls together fill at least half of it. Toolbars stay excluded.
- Design checks report a drawn button, link, input or control role without `data-et-control` as `CONTROL-PART-INPUT`: a hint on merged parts, an error when a sketch adds one.
- Design checks now list existing interaction states on non-control parts as open points while blocking new or changed states in sketches.
- Design sketch checks accept unchanged interaction states when unrelated styles change.
- The design server no longer crashes when a sketch folder disappears while sketches are listed.
- The design server's parts list names each part's module file, relative to the workspace.
- The design server no longer pre-bundles its own authoring modules (`@design-system`, `@design-system/kit`, `@design-explore`), so a cold start no longer reloads every frame when Vite finds one of them late.
- The design server draws a rebuilt `render.packages` folder (such as `dist/libs/components`) without a restart, instead of serving the modules it loaded before the rebuild.
- Serve a shot from the disk cache after the design server restarts, instead of drawing it again
- Every design shot response carries an `x-design-shot` header (`disk`, `memory` or `drawn`) that says where the picture came from.
- `sketch check` no longer prints Angular's development mode line per render, and prints a finding that repeats across states, schemes and variants once, with a count.
- `et design sketch merge` formats the files it writes with the Prettier of the target repo. A format failure prints a warning and keeps the merge.
- `et design sketch ready` blocks only on open points a variant adds to the merged part; inherited points are listed as a note. A new part still blocks on all of its points.
- `et design sketch variant --from` keeps relative symlinks in the copied variant, so its `shared/` links point at the same files as the source variant.
- `et design` no longer rewrites an unchanged tsconfig, so a `design sketch check` stops redrawing every frame in Studio.
- A rule in a sketch's `shared/` stylesheet counts as used when any variant of the sketch draws it, so `sketch ready` no longer fails a variant on `UNUSED` for a rule only another variant uses.
- A design frame asked for a `fill` token its product lacks keeps the product's page colour, so an sdk grid cell in the light column draws on the light surface instead of on Studio's dark canvas.
- `et design shot <part> --variants` finds a sketch by an extra target, `sketch list` shows extra targets, and new `sketch target add <sketch> <part>` adds a target to an open sketch.
- `et design sketch report` on a ready sketch moves it back to in progress. It still refuses a decided sketch.
- STALE-REPLACE no longer flags a replace whose regex is anchored with `^` or `$`; the rule searches the source, not the markup string.
- A static shot draws in the colour scheme Studio prefers, like the live frames next to it, so a dark Studio no longer mixes light shots into a grid.
- Studio draws every part grid twice, under a Light and a Dark head, and `frame.html?scheme=` pins a live frame to one scheme.
- Swap a canvas frame between its shot and its live page without a blank frame: the frame page reports when it painted, and Studio keeps the old view until the new one is ready.

## 3.0.0-next.25

### Minor Changes

- `et design mcp` serves the design tools to an MCP client over stdio: parts, check, shot, motion_shots, the sketch commands and the inbox. `shot` and `motion_shots` return the sheet image; `motion_shots` also returns its JSON.
- The design server answers `GET /__design/motion` with the keyframes and tracks of one motion mode, and each keyframe as a PNG with `frame=<ms>`. The draw is kept until the part changes.
- `embedPage` takes `mark` and `css`, both applied inside the embedded page: every element matching `mark` gets an accent outline, and `css` is added as a stylesheet there.
- `et design check` warns with `EMBED-SCALE` when an element around an `embedPage` frame with a `scale` scales it again, so the page shrinks twice.
- `et design complete` accepts a `field` control kind for text fields: it needs a drawn hover and focus-visible, but no active.
- The shot sheet draws an empty "not drawn" cell for each state combo a grid row leaves out, and `sketch check` lists those cells on the grid line.
- `et design motion flow <flow> <line>` draws a flow line with `"transition": "view"` as a stepped View Transition from the `from` page to the `to` page, shot in the preset viewport. Lines are named by `id` or `from→to`.
- `et design motion shots` clips each shot to the part and every animated element over all keyframes, so an overshoot is not cut off, and names a track's element by `data-et-key` where it has one.
- Add `et design motion shots <part> <motion>`: it draws a motion at its keyframes in full and reduced motion into one sheet and writes its tracks as JSON.
- `spring({ damping, frequency })` from `@design-system` returns a `linear()` easing and its duration for a motion token. A motion's `interrupt` now switches back to its `from` state at that time in `motion shots`.
- `design sketch` merges a sketch of a base part into the base. `sketch new --override` opens a product override; `--into-base` moves an existing override into the base. `sketch ready` refuses a variant that does not load.
- Add `design sketch hold <sketch> --until <text>` and `design sketch release <sketch>`: a held sketch goes back to in progress, leaves the merge queue, and `sketch ready` refuses with the `--until` text until it is released.
- A sketch may carry an edit to a host of its target in a higher layer when the edit only changes the host's imports, so a rename across layers merges in one sketch.
- `sketch ready` refuses a live variant whose files, or the `shared/` files they import, keep an unused import, parameter or CSS class.
- Add `tokenSheet` to `@design-system`: it draws a foundations part as a sheet of its CSS custom properties, labelled with the values the drawing resolves, so every product draws its foundations the same way.
- `design complete` checks the `button`, `select`, `menu`, `row` and `tooltip` control kinds and a declared `disabled` look, and reads a base part's review from its base's `merged.json`.
- `design complete` fails a page as `INVENTORY-UNAPPROVED` until its control inventory is approved; the design server answers `/__design/inventory` and `/__design/inventory-approve`, which writes `inventory.json` and refuses pages with undeclared or unclassified controls.
- `design complete` gives each control inside an embedded part's `data-et-part` root to that part, fails the host while that part is incomplete, and fails a host CSS rule restyling it as `CONTROL-OVERRIDDEN`.
- `et design mcp` gains the tools `sketch_variant`, `sketch_round`, `sketch_list`, `sketch_check`, `sketch_preview`, `sketch_rebase` and `comment_reply`.

### Patch Changes

- `design complete` accepts an option named by `aria-activedescendant` as focus-visible evidence when it looks different from a plain option in its surface, and its gap says which evidence is missing.
- `design complete --request <part>.<control>.<requirement> --reason` writes a pending exception that still fails. Studio's approve endpoint records by, at and the part hash; then the gap passes until the part changes.
- `design complete <layer>/<name> --variant <key>` checks a variant of the part's open sketch, so a sketch proves it closes its gaps before it is merged.
- `design complete`: a `data-et-control-part` descendant of a `data-et-control` takes the forced interactions of its control, and its `disabled` or `aria-disabled="true"` counts as the control's disabled mark.
- `et design complete <part> --handoff` gives a design complete part the `handoff` status; `et design complete --handoff` re-checks every `handoff` part and exits 1 when one regressed, for CI.
- `design` renders no longer fail with "exports is not defined": the CLI build again ships the frame runtime as source only, with no CommonJS copies next to it.
- `STALE-REPLACE` no longer warns on a `.replace` of markup a package draws, such as `button(options)` from `@ethlete/components`, which the rule cannot read.
- `tokenSheet` styles now carry static fallbacks for every custom property, so design products without the Studio tokens draw a sane sheet.
- `tokenSheet` takes `scope`, classes on the sheet root where values are read, so theme-scoped tokens resolve, and `note`, markup drawn under the title.
- A design frame retries a failed part import twice after a short back-off, so a part file that changes while its grid loads no longer leaves "Failed to fetch dynamically imported module" in the frame.

## 3.0.0-next.24

### Minor Changes

- A sketch's changed area gives one box per cluster of changed pixels; `et design shot --crop changed` writes one sheet per cluster, and Studio shows one enlarged crop per cluster.
- `et design check` now fails with `CANONICAL-CLASS` when a Tailwind class in a design part has a shorter canonical form, for example `w-[420px]` that can be written as `w-2xl`.
- `et design sketch merge` takes `--variant <key> --allowed-by <plan ref>`: it merges a sketch with no pick when that variant is its only live one, and logs the plan in `accepted.json`.
- `et update` adds the packages a codemod requires, such as `ts-morph`, as dev dependencies before it runs the codemod, in a commit of its own. A migration declares them in its new `requires` field.
- A design product can list stylesheets a command generates from a part (`generated`). A frame of a sketch variant that changes that part runs the command against the variant's part and loads its output.
- `et design check` now fails a literal duration, delay or easing in a transition or animation outside `foundations/`, with `HARD-CODED-MOTION`.
- `et design check` now fails an inline `<svg>` outside `foundations/`, with `INLINE-SVG`. A computed drawing passes with `data-et-drawing`.
- `et design sketch merge` and `sketch discard` now resolve the addressed comments of the sketch, and a merge those of its parts without a sketch. New `et design comment resolve-ended` resolves the addressed comments of ended sketches.
- `et design complete <layer>/<name>` fails while a part's declared `controls` lack drawn, reviewed evidence; it checks the `disclosure` kind first.
- `et design complete` now discovers drawn controls: an unmarked native, ARIA or SDK control fails as `CONTROL-UNDECLARED`, a pointer or `:hover` element outside a control as `CONTROL-UNCLASSIFIED`, and `CONTROLS-MISSING` is gone.
- `et design complete` now fails a control whose part draws its interactions as flat states instead of an `interactionRows` grid.
- A page control in `definePart({ controls })` names the part that draws it in `part`; `et design complete` takes its interactions from that part and fails while that part is not design complete.
- `et design complete` now requires a state that forces `active` on a control with `pointer` input, next to the state that forces `hover`.
- `et design complete` now fails a control whose forced interaction changes a colour, background, border or shadow without a transition.
- `et design check` fails with `CONTRAST` when drawn text is below WCAG 2 AA against its composited background. Parts declare token `pairs` to compute and `exceptions` with a reason; `contrastRatioOf` draws a ratio table.
- A part's rules now run in its design frame. A switch morphs the existing DOM, so CSS transitions run, then plays the motion the rule names, with a controlled clock, seeded random and `from`-state measurements.
- A design part can declare `motions` between its states, and a rule can name one. `et design check` fails on a motion between unknown states, a rule naming an undeclared motion, and `setTimeout` in motion code.
- `et design check` now fails with `UTILITY-CSS` when a design part's CSS holds a declaration that a Tailwind utility of the product draws, for example `display: flex`.
- `et design`: a product's `shared/` folder holds helper modules that are no part; any part imports them as `@shared/<path>`, and editing one marks each importing part changed.
- The design server lists per sketch variant the states it adds and drops and its changed part note. Studio says on the canvas when a variant changes no pixel, and a click shows the old and new note.
- `et design sketch new` takes several parts: one sketch, one variant folder holding them all, one `ready`, one merge; `ready` and `preview` name every part a `shared/` edit reaches; Studio shows every target part.

### Patch Changes

- `et update --continue` no longer commits what you changed after the stopped run, such as a package you installed by hand, into its own commits.
- `et design check` no longer reports contrast for the label of a disabled control: a `label[for]`, a wrapping label, or an `aria-labelledby` target.
- The design server's Studio event stream now also sends `calls` and `sketches` when a call or sketch file changes, and a `parts` event for a design system change that redraws no frame.
- The design server draws up to four pictures at once instead of one, so cold shots, sketch lists and merge views render about three times faster. High-priority drawings still start before waiting low ones.
- `et design` draws with partial raster off, so two draws of a page with embedded frames give the same picture under load, and `sketch ready` gives the same answer on a re-run.
- The design auto-merge check now skips rejected variants, so only live variants can block a merge that is safe.
- `et design` now fails with the frame URL when a frame or an embedded frame never draws, instead of saving a blank picture. `sketch ready` draws a changed state once more before it counts as a change.
- Drawn design frames no longer show a real hover on a control at the frame's top-left corner, so `design shot` and `design complete` see only the interactions a state forces.
- `et design` `CANONICAL-CLASS` and `UTILITY-CSS` now check the files of a `shared/` folder that a part imports, also in a sketch, so `sketch check` and `sketch ready` catch them before a merge.
- Design screenshots now show the end of every finite CSS animation and transition, so an element that fades in with `@starting-style` is drawn fully visible.
- The design server draws each shot on a warm browser page per viewport and scale instead of opening a new browser context, so a warm shot is about 12 % faster and a batch uses about 20 % less CPU.
- The `et design` server now keeps the pixel compare of each sketch's unchanged states until a product file changes, so the sketch list loads in a fraction of the time after the first call.
- `et design` redraws only the affected parts, not every part, when a file that a product stylesheet scans as a Tailwind `@source` changes.
- `et design inbox done` now writes the note into the sketch variant for a comment on a part that exists only in the sketch, instead of failing with "is no part of".
- A multi-target sketch merge gives each target only the `shared/` files it imports, directly or transitively; an unimported file returns to the target that held it. `sketch new` refuses targets whose `shared/` files clash.
- `et design sketch ready` now also draws the parts that show the sketched part before it merges on its own. When one of them changes, the sketch stays ready and the output names the part and state.
- A sketch with several targets shows the diff marks and the pages that use any target part. Studio names the parts a `shared/` edit reaches. The sketch-diff endpoint takes `part=`.
- `et design` draws a sketch variant with its own part stylesheet where the product stylesheet `@import`s the merged one, so `sketch ready` no longer auto-merges a token value change as "no visible change".
- A cold sketch shows its first frame sooner: Studio lists the sketches without the slow unchanged-state comparison first (`?unchanged=no`), asks for shots and diffs at once, then lists them in full.

## 3.0.0-next.23

### Minor Changes

- `et design shot --variants --crop changed` cuts every cell to one box around the pixels the shown variants change from the merged part, and prints that box for a later `--crop`.
- Add `@ethlete/cli/playwright/failure-reporter`, a Playwright reporter that writes one JSON line per failed test attempt while the run goes on.
- The Playwright failure reporter writes a `detail` field: the first line past the kept error lines that holds a URL or a diff line, so a refused request stays visible.
- Reject and reopen single sketch variants with `et design sketch reject|reopen` or in Studio; a rejected variant keeps its reason, origin and history and can no longer be picked or merged.
- Studio's sketch view gets a "Changed area" switch per round that shows every column cropped to the one area the round's variants change, enlarged, under a small whole-page thumbnail, and the design server answers that area on `/__design/sketch-crop`.

### Patch Changes

- `et design` commands that render Angular markup now exit after they print their result.
- A sketch state whose markup differs or only renders in a browser now counts as unchanged when its pictures match the product. Studio folds such states and shows a count with a "Show all states" button.
- `design shot --state <s> --variants` shows a neutral "New state - no merged version" cell when only the variants have the state, instead of a red render error.
- `et design shot --variants` takes `--round <key>` and `--variant <name>` to draw only the current round next to the merged row.
- A design check now reports a type checker that failed without output as `NO-TYPE-CHECKER`, with the command and the process error, instead of an empty `TYPE-ERROR`.

## 3.0.0-next.22

### Major Changes

- Every agent write in `et design` (`sketch new|report|ready|rebase|merge|discard`, `inbox done`, `comment reply`) needs `--by <model id>`. `sketch report` takes `--variant`, records authors per variant in `sketch.json`, and a merge writes them into the part's `madeBy`.

### Minor Changes

- Design comments have an addressed state: the agent and the cli mark a thread addressed, and only the user resolves it in Studio.
- `design check` and Studio warn of a merged part whose files changed outside a sketch.
- A design comment takes an `interaction` (rest by default, also `--interaction` on `et design comment`); a comment file without one is on rest.
- `et design comment reply --question` marks a reply that waits for the user. Comments carry a `threadState` (`agent`, `question` or `answered`) in the Studio API and `inbox --json`.
- Comment threads: `et design comment reply <id> <text>` answers a comment, and `et design inbox` lists threads where the agent spoke last under "waiting for the user".
- A design comment stores `size` (a preset name, a width or `fitted`) in place of `preset`, `et design comment` takes `--size`, and the design server signals comment changes on `/__design/comment-events`.
- Rule `FLOW` accepts a frame that names a page existing only as an open sketch, checked against the states of the sketch's first variant. A name that exists nowhere still fails.
- Read a product's flows from `flows/<name>.json`, list them at `/__design/flows`, and fail `et design check` on a flow frame that names a missing state.
- The design server reloads only the frames of a part whose file was added or removed, and `et design inbox done --by` now records the id in the variant's authors or the part's `madeBy`.
- BREAKING: `et design inbox done <id>` now needs `--note "<reason>"`, which replaces the part's note; Studio withdraws a comment through the new `comment-withdraw`.
- Rule `WIREFRAME-KIT` lets an element import the wireframe kit, so a rough shell can be an element the pages import. Components and foundations still may not.
- The design server marks each part's root element with `data-et-part`, and `/__design/sketch-compare` draws every state that shows a sketched part before and after a merge, splits them by pixel change and returns the part's outlines.
- `et design inbox` lists a sketch whose baseline is stale as "needs rebase", with the changed parts. A merge the design server refuses for a stale baseline answers with `changed` and the `rebase` command.
- A pointed design note stores the `size` it was written at. `et design check` fails a pointed note without a size, or with a size the product no longer has.
- A design part can list the `interactions` Studio draws it in, and a frame can force `:hover`, `:focus-visible`, `:active` or disabled on the part's root element through `interaction=<name>`.
- `definePart` keeps a part's state names in its type, and `render` takes `{ interaction }` to force hover, focus-visible, active or disabled on the drawing's root.
- A design part imports another part's stylesheet as `@system/<layer>/<name>.css?inline`, resolved per product and sketch, so base parts draw with a product's own tokens. A part that comes or goes redraws its whole product.
- `GET /__design/system` lists for each part the pages that use it through the import graph, also in products that use its product as base.
- A design part can declare container `widths`, and the shot route draws a part at a `width` or fitted to its content when the address names no preset.
- The design server sends a `parts` event with the parts a file change redraws, per product and sketch variant, or `all`, and drops exactly those cached shots.
- `et design product new <name>` creates a design product: its `config.json` entry and the empty layer folders. `--base` sets the base, and `--from-project` copies the render settings of a project.
- `et design sketch variant <target> <name> --from <variant>` copies a variant into a new one and reopens the sketch; `sketch.json` groups variants into `rounds`, and `--round <title> --note <text>` starts a new round.
- Sketch variants share code through `@shared/<path>`, `sketch new --like` copies a part or variant, and `embedPage()` draws a page inside a page.
- The design server's sketch list carries the states and widths of the target as each variant draws it, and the agent's live report with the variant it names.
- Pages can draw wireframes with the grey kit from `@design-system/kit` (box, text lines, image, button, input, icon); `et design check` fails a part outside pages that imports it, and the system list counts each page's kit calls.
- `et design sketch check --fix` writes the variants in the checkout's Prettier format before it checks them; a FORMAT problem points to it.
- `et design sketch check` warns of a variant that restyles a class of the sketch's `shared/` folder and of a variant file nothing imports.
- `et design sketch new` takes `--variant-note`, `sketch variant` takes several variants, and sketch commands format their output, explain each flag and infer `--product`.
- `et design sketch round` edits an existing round, and `sketch list` shows the rounds of each sketch.
- The sketch listing for Studio names, per variant, the states it renders to the same markup and styles as the product does now (`unchanged`), cached by the part folder hashes.
- `design check` warns of an export in a part's `shared/` that nothing imports, and `sketch check` of a sketch `shared/` export a variant does not import.
- `sketch new --variant-note` keeps each variant's note in `sketch.json` instead of overwriting the part's merged note; Studio shows it in the variant's head, and a merge gives it to a new part.
- A sketch variant may hold its own copy of a shared file at `<variant>/shared/<path>`: `@shared/<path>` resolves to it first in rendering, typechecks and checks, and a merge of that variant carries it.
- The wireframe kit draws for narrow presets: a row `box` stacks below `stackBelow`, `image` takes a `ratio`, buttons and placeholders end with "…", boxes set the kit text colour, and `heading(text)` draws titles.
- Add `et design accept <layer>/<name> --by <model id> --note <why>`, which records a direct edit of a merged part the user approved so `design check` stops warning of it.
- `design shot --asset <file>` draws an image file into a PNG, and `design token <name> --hex` prints the colour a product token resolves to.
- The design render check warns of grid rows that leave out interaction columns other rows fill (`GRID-COVERAGE`).
- `et design check` also type-checks each variant of an open sketch and fails with a `TYPE-ERROR` line per broken variant. A merge's own check still types only the product.
- `design check` and `design sketch check` draw every state headlessly and report `OVERFLOW`, `CLIPPED`, `WRAP`, `ZERO-SIZE` and `RENDER` problems. A part opts out with `definePart({ checks: { skip: [...] } })`.
- `design check` warns of a `.replace` on markup that neither the part nor a part it uses draws (`STALE-REPLACE`).
- The design render check warns of a class with a product prefix that no stylesheet of the frame defines (`UNDEFINED-CLASS`).
- `et design sketch merge` now merges only the picked variant and refuses on parts changed since the sketch began (`sketch rebase` clears it); `check` flags stale notes and the system list carries product themes.
- The `CLIPPED` render check also reports an outline (width plus offset) or a crisp outer box shadow (no blur) that passes the nearest clipping ancestor or the frame. A soft shadow with blur is not counted.
- The `CLIPPED` render check also reports an underline (offset, thickness, and a wavy line's swing) that a clipping ancestor cuts off below the text.
- `forceInteraction` from `@design-system` forces an interaction on one element of a part's markup, not only its root.
- Every design frame loads its product's `foundations/tokens` stylesheet before the part's styles, so a part no longer imports the tokens itself.
- A design frame and its shot take `fill=<token>`: the page paints its background with that token in place of the product's page fill.
- The render check reads each drawn part's `grid`: `sketch check` prints `grid <rows> x <columns> ok` or the states it leaves out, and a state in two cells or a cell naming no state fails as `GRID`.
- `interactionRows` from `@design-system` builds a part's states and grid from one props object per row and a list of interactions.
- `et design serve` lists, writes, changes and deletes notes on states (`<product>/notes/<id>.json`) and free notes in a flow file's `notes`. A stale note now fails the check under rule `NOTE`; the flow rule checks free notes.
- `et design part remove <layer>/<name>` deletes a merged part with its `merged.json` entry and tsconfig path, and resolves its comments. It refuses a part another part imports, a base part, and a part with an open sketch.
- Design: hide inherited parts, clarify new-part merging, and protect parts imported by application source.
- `definePart({ styles })` exposes a part's stylesheet on its default export and adds it to every drawing of the part.
- POST `/__design/product` accepts `@ethlete/components` as `base`, like `--base @ethlete/components`.
- The design server creates a product on POST `/__design/product` with `{ name, base? }`, using the code of `et design product new`. `base` names another product of the checkout.
- A design server not started by Studio listens on a free port, so it never takes the port Studio expects.
- The design server answers Studio's sketch and comment requests: it lists open sketches, previews a merge, writes a pick or discard, merges or discards a sketch, and lists, adds and finishes canvas comments.
- The design server lists product systems, renders part states in frames and screenshots them. `et design system --json` prints the parts list.
- `design shot <part> --states --variants --at <commit>` draws a sketch as that commit held it, so a merged sketch can be compared again.
- Add `et design shot <layer>/<name> --states [--variants]`, which draws every state of a part and every variant of its open sketch into one labelled contact-sheet PNG and prints its path.
- `et design sketch` opens, checks, merges and discards sketches of a part. `et design inbox` lists open comments and the user's sketch decisions.
- `definePart` takes an optional `grid` that lays out small states as rows and columns, and `design shot --states` draws such a part one sheet row per grid row.
- `svgAsset` sets a `class` and `attrs` on the root `<svg>` of an asset.
- Add `svgAsset(raw, { size })` to `@design-system`, fail `design check` on an SVG asset without a root `<svg>` or the SVG namespace, print each variant's `assets/` folder, and add a pixel diff row to `design shot --variants`.
- `et design` supports product design systems with layers, a base and presets. `et design check --product <name>` checks a product's layer rules, colours, component copies and motion.
- The design render check reports `UNKNOWN-THEME` when a drawing uses a colour theme that no stylesheet of its frame defines.
- A design part may export named helpers next to its `definePart` default, and other parts import them from `@system/<layer>/<name>`.
- Closing a design comment thread (inbox done, a new sketch round, a merge or discard) now resolves it instead of deleting it, so it can be looked up later.
- `sketch round --drops <state,state>` lets a round remove part states on purpose, so `sketch check` and `sketch ready` no longer fail those variants for the dropped states.
- The design server answers `/__design/sketch-diff` with the box of the pixels a sketch variant changes per state against the merged part, cached per pair of pictures.

### Patch Changes

- `sketch ready` no longer fails its auto merge on a problem the product already had, and runs the check and the auto merge again on a sketch that is already ready.
- `/__design/shot` also draws a call variant: `call`, `variant` and `width` give a full-height PNG at that width, kept until a file of the call changes.
- `et design sketch check` reports an `@shared/` import that resolves to no file in the sketch's `shared/` folder.
- Design parts and stylesheets load product assets as `@assets/<file>`.
- `et design check --tsconfig` also typechecks each variant of an open sketch and prints the tsc output of a failing one.
- Fix the type errors and lint errors of the design sources, write the editor tsconfig of each product while the design server runs, and update two stale design specs.
- Design comments written in the same millisecond list in the order they were written.
- The design server picks up changes to `.ethlete/design/config.json` while it runs, and keeps the last good config if the file becomes invalid.
- A foundations part may import another foundations part, so a logo or an overview can draw with the product tokens. `et design check` still flags a foundation that imports a component, element or page.
- The design server no longer reloads every frame page on each change; Studio redraws frames from the `parts` event.
- `et design sketch variant` on a part with no open sketch names the `sketch new` command that starts one.
- Cover a product stylesheet that registers its drawing folders with Tailwind `@source`, so page sketches compile the utilities the app uses.
- `et design` copies its own code and frame assets into a per-process folder at start and serves them from there, so rebuilding or reinstalling the cli no longer changes what a running design server serves or renders.
- `/__design/shot` answers a timeout or a build error with an error status, and `et design` picks up config changes without a restart.
- `GET /__design/shot` answers 422 with the reason when the part root has zero size or the screenshot fails, instead of waiting out the 30 s Playwright timeout.
- `et design sketch new` takes `--note <text>`, the note of the first round.
- `design sketch new` scaffolds `definePart` without a type argument, so the part keeps its state names.
- The design server's frame page and shot route draw a part as a sketch variant holds it when the address names `sketch` and `variant`.
- `checks.skip` applies per sketch variant, and `data-et-skip` lets a drawn element opt out of a render check.
- A design frame now loads its project or product stylesheets in config order, so the last sheet in `styles` always wins.
- `et design <command> [<subcommand>] --help` prints the usage of that one command and skips its checks.
- A design product can name several token parts in its config `tokens`; frames load each one's stylesheet in order.
- `et design check` reports a `var(--token)` without a fallback that no part or stylesheet of the product or its base defines.
- A design drawing may leave out `styles`: `drawing({ body })` is enough when `definePart({ styles })` carries the stylesheet, and a part's `render` still answers a string of styles.
- Design: a frame page reports its viewport size with its height, and a frame fitted to its content never shows scrollbars.
- A part's dependencies include the parts a plain module of its own folder imports, so `sketch check` lists a page that uses a part through such a module, and the rules see the import.
- A design frame's height message carries its `href` and `errored: true` once the frame failed to draw or threw at runtime.
- `design sketch check` and `sketch ready` no longer fail on an open comment whose sketch was merged or discarded; they warn and say to reply with `comment reply --by` or have the user resolve it in Studio.
- `design check` no longer warns with GRID-COVERAGE about a grid row that fills only `rest`. It warns only about a row that fills some interaction columns but not all.
- `et design sketch ready` names why it did not merge a sketch automatically: the changed states, a failed shot, or a variant that holds another part.
- `et design sketch report --done` prints "<variant> marked done", also when the variant had no live report.
- Design validation now checks tokens in reachable shared stylesheets.
- `et design shot --crop x,y,width,height` and `/__design/shot?clip=x,y,width,height` cut a picture to a box in CSS pixels, so a hairline can be judged with `--scale`.
- `et design shot --variants --diff-props` compares each variant with the merged part drawn with the variant's state props, so changed props no longer paint the whole diff red.
- `et design shot --states --variants` lays out the merged row and each variant row by its own `grid`, with a diff row after each grid row.
- `et design shot` without `--product` takes the only product with an open sketch on the part, else the only product with the part.
- `et design shot --interaction <hover|focus-visible|active|disabled>` forces an interaction on every cell, and `--help` names it. The design-exploration skill names it.
- The diff row of `et design shot --variants` says "no pixel change, but the markup differs" when a variant draws other markup to the same pixels.
- A `/__design/shot` of a state the merged part or the variant lacks answers a 404 that names its states, instead of a 500 drawn as PNG.
- A `/__design/shot` request without `state=` answers a 400 that names the part's states.
- `et design shot --variants` on a part that is not merged yet heads the sheet with "new part, nothing to compare with".
- The diff row of `et design shot --variants` names a state the merged part does not have as "new state", on the sheet and among the printed lines.
- `et design shot` draws a non-page part with `widths` at its first width unless `--width` or `--preset` is given.
- `et design shot` prints the PNG path after the diff lines.
- `et design shot --scale <1-4>` and `/__design/shot?scale=` draw a part at a device scale, so a small part is legible. The design-exploration skill names it.
- `et design shot --state <a>,<b>` draws only the named states, side by side, and names the states of the part when one does not exist. The design-exploration skill names it.
- `sketch check` and `sketch ready` fail only on problems a variant brings in. A problem the product already had prints as `NOTE (was there before)`, as the merge does.
- `sketch new` prints the next steps: `sketch report` while you draw a variant, `report --done` only after a report, the round note when it is missing, then `sketch check` and `sketch ready`.
- `et design sketch new --round` requires `--note`, so `sketch ready` no longer stops on a round without a note.
- `et design sketch variant` refuses a sketch the user discarded and asks for a variant pick first; a pick is still cleared.
- The UNDEFINED-TOKEN check of `et design check` and `et design sketch check` also reads the stylesheets a part imports, and the tokens any file of the part folder sets.
- The wireframe kit draws more control types: `select`, `tabs`, `segmented`, `checkbox`, `badge` and `dot`.
- A wireframe kit `box` takes `fill: true` to be at least as tall as the frame, so a page or a shell needs no hand-written `min-height`.
- A wireframe kit `icon` is a rounded square instead of a circle that read as a radio button, and takes a `glyph` name (`'plus'`, `'close'`, `'menu'`, …) drawn inside it.
- Every `et design` command finds `.ethlete/design/config.json` in a parent folder, so a sketch report works from a subfolder.
- Studio refreshes its frames when optimized dependencies change, preventing stale module links after part removal.
- Write a gitignored `tsconfig.json` into `.ethlete/design` and each product folder so editors resolve `@design-system` and `@system/*`, typecheck products and sketch variants through one function, and lint the design frame sources.
- The pixel diff of `design shot --variants` runs about 3.5 times faster.
- The design server sends a `flows` event when a flow file changes, and Studio reads the flows again, so a flow edit shows without a server restart.
- The design frame page posts `Esc` to its parent. The Studio canvas now leaves an active cross-origin frame on `Esc` and takes its height from the frame page.
- `et design shot` and the render check take a free port even when 5173 is busy. Vite read port 0 as unset.
- `et design sketch new pages/<name>` scaffolds a page like its siblings: the tokens import, `madeBy` from `--by`, the product widths and no stylesheet.
- `et design product new --base` no longer writes an empty `fixtures.ts`, so the new product uses its base's fixture set.
- `et design product new` writes `config.json` in the layout Prettier gives it, so a later format run leaves it unchanged.
- The `CLIPPED` and `WRAP` render-check lines name their opt-out: `data-et-skip="<RULE>"` on the element, or `definePart({ checks: { skip: ['<RULE>'] } })`.
- The design server's JSON answers allow any origin, so Studio can read the parts list.
- The design server takes `--host <address>` (or `DE_HOST`) to listen on another address than localhost, e.g. `0.0.0.0` to reach it over the LAN.
- `design shot --states --variants` prints the pixel result of each diff cell, and scales each diff cell to the width of its state cell.
- The design server draws merge compares and plain `/__design/shot` asks before Studio's canvas shots, which now ask with `priority=low`.
- `design sketch new` and `design sketch variant` create the `assets/` folder of each variant, so the path they print exists.
- Design servers keep their own Vite cache per checkout, `design shot --variants` draws the merged state first, `sketch check` warns of a class two stylesheets of a part define, and `sketch ready` needs a note on the running round.
- `et design inbox done --note` on a sketch thread now writes the note into the variant's copy of the part, never into the product.
- A design merge that changes an asset re-records the other merged parts that use it, so they no longer show as changed outside a sketch, and lists them in the merge output.
- `et design sketch merge` takes `--note` as optional and keeps the variant's own note without one; `sketch new`, `variant` and `ready` record `--by` as the variant author, and a merge no longer drops `madeBy`.
- The `CLIPPED` render check measures a scaled `embedPage` at its scaled size, so a page that embeds a scaled page no longer needs `checks: { skip: ['CLIPPED'] }`.
- A failed design shot answers 500 with the error picture, a shot accepts a preset with its own width, and sketch check lists every drawn state with its result.
- `et design sketch check` and `sketch ready` now run the checkout's own Prettier over a variant and report each unformatted file, so an unformatted variant can no longer become ready or merge.
- A sketch merge or discard closes the open comments on its variants instead of refusing, and `sketch variant --round` closes those on its `--from` variant.
- A comment on a sketch variant now stores the `createdAt` of its sketch, so a later sketch on the same target no longer takes over, addresses or lists the comments of an earlier one.
- Design sketches compare fresh screenshots instead of reusing pixel results from earlier rendering sessions.
- `et design sketch check` and `sketch ready` fail when a variant drops a state the product's part has.
- Sketch checks now flag targets whose metadata cannot be written during merge.
- `design sketch new` on a merged part with a `shared/` folder moves that folder into the sketch's `shared/` and imports it as `@shared/`, so the variants no longer each hold a copy.
- `design sketch new` and `sketch variant` print the repo-relative path of each variant's part file.
- `et design sketch ready` merges a sketch by itself when no state of any variant differs by a pixel from the product, and logs it as `auto` in `accepted.json`.
- `design sketch ready` compares pixels when a state's markup differs, so a sketch that only changes whitespace in the markup counts as unchanged.
- `design sketch report` prints a confirmation, and refuses a sketch that is not in progress with a non-zero exit instead of recording a report Studio never shows.
- `sketch report --variant <key> --done` ends the live "drawing" report of that variant, so Studio shows its frames before `sketch ready`. The design exploration skill names the command.
- `sketch variant --round` stores why the running round lost in its own `lost` field instead of overwriting the round's note, and `--round-note` sets the new round's note so `sketch ready` accepts it.
- Studio now folds a sketch state whose styles changed but whose frames draw the same pixels, so CSS a variant adds for one state no longer unfolds every other state.
- `design sketch variant` without `--round` now fails while the sketch has open comments. It lists them and names the `--round` command, so an answer to comments starts a new round.
- A design server no longer outlives a Studio that dies without a clean exit.
- Remove the host commands only the old Calls view used: call statuses, verdicts, modes, closed states, new variants and check receipts.
- Restore the host command that reports sketch report changes, so a drawing agent's progress reaches Studio live again.
- Prevent macOS WebKit freezes when design frames reload, and keep previous content visible while asynchronous drawings finish loading.
- Design check warns about unscoped selectors in globally loaded token stylesheets.
- Studio no longer folds a sketch state as unchanged after the sketch's `shared/` folder or the variant's assets or fixtures change: the unchanged-states cache now keys on them too.
- Update all dependencies to their latest versions (Nx 24, Vitest 5, jsdom 30, ts-morph 28, @types/node 26 and others). The optional `@nx/devkit` peer dependency now requires `^24.0.0`, and the optional `ts-morph` peer of `@ethlete/core` requires `^28.0.0`.

## 3.0.0-next.21

### Minor Changes

- The design server draws a variant into a PNG at `/__design/thumb`, with the same query as `frame.html`, in one shared headless Chromium.

### Patch Changes

- Migrations: show zero-file scans as done, include failed detection output, and detect remaining legacy query wrappers before recommending deprecation.

## 3.0.0-next.20

### Minor Changes

- `et design new --feature <name>` groups a call under a feature, and `et design legacy` now also writes the stage its group folder implies.

### Patch Changes

- A design render now waits up to 60 seconds for a package that is being rebuilt into dist instead of failing at once.
- Studio reads a call's `closed` and `waitsFor`: closed calls count as settled, waiting calls sit under "On hold", legacy calls with a stage clear the stage gate, and open calls now lead the sidebar.

## 3.0.0-next.19

### Minor Changes

- A design call can name its `stage`, from `themes` to `prototype`. `et design check --call` warns when an `element`, `page` or `prototype` call imports nothing from the project's design system.
- `et design status <slug> <state>` records the state of a design call for Ethlete Studio. `et design new` records `scaffolded`, and `et design check --call` records `checking`, then `ready` or `failed` with the error.
- `et design check --call` warns when the call declares no `stage`, and names the seven stages.
- Design calls render real Angular components: `ng(template, { imports })` from `@design-explore` renders on the `et design` server with the checkout's built packages. Needs `@angular/compiler` and `@angular/platform-server`; a project names its `providers` module in `config.json`.
- A design drawing can show states: `ngStates({ closed, open }, { imports })` renders each one with `ng()`, and `on([{ click: '.trigger', go: 'open' }])` swaps them on a click in a View Transition.
- A design drawing's `setup` can now be an array of functions, run in order, so `flow.on(rules)` combines with the drawing's own setup. The first function that throws stops the rest.
- A design drawing can export `setup(root)` to wire behavior. The frame calls it once, after the markup is in `root`, and shows its error in the frame.
- A design call now needs a `stage`, or `et design check` fails: use `sketch` for a quick idea, and `et design legacy <project>` to mark older calls.
- A design project can name `themes` in `config.json`. The call page then shows a surface and a colour switch, and every frame gets the picked theme classes on its root.
- `et design` no longer serves a call page at `/`. Read calls in Ethlete Studio. The server still serves the variant frames and the render endpoint, and `et design check` now loads each frame directly.
- A wireframe call lists the parts it needs in `inventory`, each an SDK component or a new part with its component call. `et design check` warns about an inventory on any other call.
- `et design new` takes `--stage <stage>`, writes a readable eyebrow, and scaffolds variants with an `ng()` button when the project names `providers`.
- `et design new <project>/<group>/<name> [--variants a,b]` writes a call that renders at once: `call.ts`, `fixture.ts` and one drawing per variant.
- `ng()` and `ngStates()` take `fields`: each entry becomes a signal form field with a value, errors and a touched state, bound as `[formField]="fields.<name>"`.
- `ng()` in the design tool renders an open select panel or menu, and the frame places it below its trigger.

### Patch Changes

- `ng()` now names the missing Angular package and the checkout when it cannot render. A design drawing whose `setup` throws keeps its markup and shows the error on top.
- Design calls can import the `@ethlete/*/design` mocks: `?inline` CSS imports type-check, and the mocks skip dependency pre-bundling.
- Add `et design stamp`, which prints the version and build of the installed cli as JSON.
- `@angular/forms` is an optional peer dependency, for design calls that bind `fields`.
- Run `et` without `tslib` installed. The CLI now inlines its TypeScript helpers, so a fresh Yarn 4 repo no longer fails with "Cannot find module 'tslib'".
- `et design check` names the resolved playwright package when its Chromium fails to start, instead of claiming no browser package resolves.
- `et design check` also finds `playwright-core`, reports a stale server after a cli reinstall, and no longer marks a call failed when the check itself cannot run.
- `et design --help` prints the design commands, instead of reading `--help` as a checkout path.
- `placeOverlays` reads the `data-overlay-placement` an `etOverlay` host writes, so a bound `[placement]` places the panel too.
- `placeOverlays` pairs each open overlay with its own trigger, honours an `*-end` or `top*` placement, and pins a bottom sheet to the bottom at full width.
- An `ng()` render keeps the case of a custom property set through a style binding and no longer fails where a component uses `MutationObserver`.
- `render.packages` now maps subpath imports such as `@ethlete/core/design/theme-css` too, both in the browser and in the calls tsconfig. `ng()` looks import names up in `@ethlete/core` as well by default.

## 3.0.0-next.18

### Minor Changes

- Add `et api ready --profile` to bring an API's data up to date from a snapshot or its seeds, plus `exec`, `doctor [--fix]`, `run --lock`, `snapshot save|restore` and `status`, with a machine-wide lock and state.

## 3.0.0-next.17

### Minor Changes

- Add `et api seed` and `et api fixtures`, which copy `.ethlete/seeds/<api>/` into the API container and run the seeds its `seeds.json` names. A clone now gitignores only its own `/.ethlete/<api>/`.

## 3.0.0-next.16

### Major Changes

- Breaking: `release()` takes `{ args, root?, invocation? }` and resolves to an exit code instead of exiting. `et release` tags after the release commit and takes `--message` and `--help`; `et update` names the `.npmrc` whose token was refused.

### Minor Changes

- New `et migrations` lists the recommended and optional migrations an app has not run, and `et migrations run <package>:<name>` runs one and records it in `.ethlete/migrations.json`.
- `et update` runs only `required` migrations and points at the recommended and optional ones it left.
- `et migrations` shows the number of affected files next to each migration whose manifest entry names a `scan` generator.
- Peer dependencies are ranges (`^22.1.0` for Angular, `^7.8.0` for RxJS, ...) instead of the workspace's exact versions. `et update` says when another dist tag holds a newer major, also when the repo is up to date.

### Patch Changes

- `et release` and `et update` now reject values on boolean flags and empty `--tag=`/`--to=`, and version comparison ignores build metadata.
- `et update --from` rejects a version that is not one, such as `core@v5.0.0`, instead of running every migration of the package.
- The call title bar no longer covers the top of a drawing: the drawing starts below it, and it fades out while the drawing scrolls down and back in on scroll up.

## 2.1.0-next.15

### Minor Changes

- `et update --ai` ends an interactive agent session by itself once the agent writes the task's `.finished` file, then commits the task and starts the next one. `/exit` still works.

## 2.1.0-next.14

### Minor Changes

- `et update` commits each step by itself - the version bump, each codemod, the agent rules sync and each finished `--ai` task - and never a file that was dirty before the run; `--no-commit` turns this off.
- `et update --ai` without `updateAgentCommand` lists the agent CLIs on `PATH` and saves the one you pick, as an interactive session or a headless run.

### Patch Changes

- The Claude Code choices in `et update --ai` start the agent in auto mode, so it can run its checks without asking.
- `et update --ai` tells you, for each task and in the agent's last message, to type `/exit` so the next task starts.

## 2.1.0-next.13

### Patch Changes

- `et update` hands the migrations to the newly installed `et` when the update moves `@ethlete/cli`, so steps a newer CLI added, such as the agent rules sync, run in that same update.
- `et update` follows the dist tag that holds the newest version of the installed prerelease line, so a package that changesets published to `latest`, such as `@ethlete/agent-rules`, no longer stays on the older `next` version.

## 2.1.0-next.12

### Patch Changes

- `et api clear` keeps a checkout git cannot read, and `et api up` and `setup` no longer fail on output over 1 MB.
- `et api clear` also keeps a checkout with stashes or detached-HEAD commits, `checkout` never reads a branch as a flag or path, `-h` shows help, and a port held on loopback or IPv6 counts as taken.
- `ethlete api` no longer leaves an `ethlete-api-*` directory in the temp folder after each podman run.
- GitLab token checks refuse redirects, `auth.json` is narrowed before the token is written, `release` matches its flags exactly, and `doctor` reports a broken legacy config file.
- `et design check` closes the browser when the page fails, and `et design serve` resolves calls on Windows.
- `et doctor` reports an `ethlete.apis.js` that throws while it loads instead of crashing.
- `release --force` stages only the files `changeset version` changed instead of running `git add .`, so unrelated uncommitted changes stay out of the "Release versions" commit.
- `et update` passes the agent prompt through environment variables, sends `.npmrc` registry tokens, keeps CRLF line endings, skips git-ignored manifests, and rejects migration names or instructions outside the package.
- `et update` prefers the lockfile over the calling `npx`, runs package managers on Windows, and points every run to `--continue` while an update is unfinished.

## 2.1.0-next.11

### Minor Changes

- `et update` runs `ethlete-agents sync` after the install when it moved `@ethlete/agent-rules` and the repo has an `ethlete-agents.config.json`, so the regenerated rules and skills match the tasks the update writes.

### Patch Changes

- `et update --ai` stops before any change when `updateAgentCommand` is missing, hands the agent a real prompt, reports each task, and works on the tasks an earlier run left.
- `et update` gitignores its task list, so a later run no longer needs `--force`, and `--continue` keeps the `--from` versions and the codemods an earlier run applied.
- Fix `et update` for a real consumer: the `et` bin runs, `--continue` skips applied codemods, `--check` reports an unfinished run, lookups use the repo's registry, task links point at the right docs site, and failed syncs are reported.
- `yarn et update` on yarn 1 installs from the registry the repo's `.npmrc` or `.yarnrc` names, not the default registry yarn exports to scripts.
- `et update` drops deleted tasks from `tasks.md` even when nothing is pending, prints "none" for an empty dry-run migration list, and aligns the `--continue` plan.

## 2.1.0-next.10

### Patch Changes

- A design call now lists its drawings as `variants` in `variant-<key>.ts` files, and `et design check` takes `--variant`; the old `options` key and `--option` flag are gone.

## 2.1.0-next.9

### Minor Changes

- `et update` now writes the new range into every `package.json` in the repo, not only the root one, and refuses a dist tag that points at an older version than the repo is on.
- `et design [checkout]` serves the design page of any repository that keeps a `.ethlete/design`
  folder, and `et design check` says why a call does not render.

### Patch Changes

- `et release` now works with Changesets 3 and aborts when there are no pending changesets.
- `et design` now rules a drawing with its own Tailwind 4 pipeline, so a repository on Tailwind 3, or none at all, can hold design calls.
- `et design check --call` now reports `NO BROWSER` when neither the checkout nor the package
  resolves `playwright`, instead of throwing the module loader's own error.

## 2.1.0-next.8

### Minor Changes

- [#3075](https://github.com/ethlete-io/ethdk/pull/3075) [`004c32d`](https://github.com/ethlete-io/ethdk/commit/004c32d0ada3d7862947843dd6e8b204876160fe) Thanks [@github-actions](https://github.com/apps/github-actions)! - `doctorCommand` accepts an optional `composeTools` override for the container-engine check.

- [#3075](https://github.com/ethlete-io/ethdk/pull/3075) [`1d38e7e`](https://github.com/ethlete-io/ethdk/commit/1d38e7e0a025769f065d8ca7d506cb75ad89139a) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et update` moves the `@ethlete/*` packages to a newer version, runs the codemods those versions
  declare in their own `migrations.json`, and reports what needs a decision or an agent.

## 2.1.0-next.7

### Patch Changes

- [#3074](https://github.com/ethlete-io/ethdk/pull/3074) [`63a528a`](https://github.com/ethlete-io/ethdk/commit/63a528a0ab1b1e7163e71c1cf5f65415bdda32d9) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et auth` now takes a host written as a url, and asks before it replaces a token `auth.json`
  already holds for that host.

## 2.1.0-next.6

### Minor Changes

- [`a1c489e`](https://github.com/ethlete-io/ethdk/commit/a1c489e0a1da4b479fd6e47743dec4c1bad0152f) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api up` now refuses a port another program holds and prints a per-service state table instead of
  the engine's output. New `et api clear` removes a managed checkout, and offers to take its containers down first.

- [`12dcd51`](https://github.com/ethlete-io/ethdk/commit/12dcd5118ca8d2089cc3e9379efe4e9d0502a0f6) Thanks [@TomTomB](https://github.com/TomTomB)! - Every `et api` command now takes a comma-separated list of names, so `et api up hub,platform` starts
  both APIs.

- [`0e060b2`](https://github.com/ethlete-io/ethdk/commit/0e060b28436e9444726a35a93264a046242e348e) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api help <name>` now answers for one API: the commands it accepts, what each one runs, its url
  and services, and the state of its checkout. `--help` after a known API name prints the same text.

- [`0e060b2`](https://github.com/ethlete-io/ethdk/commit/0e060b28436e9444726a35a93264a046242e348e) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api` now runs an API's `setupCommand` itself: `et api setup <name>` on its own, or as an offer
  when a command finds the `envFile` missing. `--setup` accepts that offer without the question.

- [`c3dd7c3`](https://github.com/ethlete-io/ethdk/commit/c3dd7c3d7e0e2a060e081c7fe820f9774537418b) Thanks [@TomTomB](https://github.com/TomTomB)! - `et auth <token>` writes a GitLab token into composer's `auth.json`, which the API containers mount. It asks the host whether the token can download code before it writes anything.

### Patch Changes

- [`0e060b2`](https://github.com/ethlete-io/ethdk/commit/0e060b28436e9444726a35a93264a046242e348e) Thanks [@TomTomB](https://github.com/TomTomB)! - An unknown API name in `et api` now names the closest match and the APIs there are, in place of the
  whole help text. An unknown command suggests the closest command the same way.

- [`c3dd7c3`](https://github.com/ethlete-io/ethdk/commit/c3dd7c3d7e0e2a060e081c7fe820f9774537418b) Thanks [@TomTomB](https://github.com/TomTomB)! - A failing `et api` exec command no longer always blames a private dependency. That hint is kept for a command that installs dependencies; any other one suggests running the install command first.

- [`0e060b2`](https://github.com/ethlete-io/ethdk/commit/0e060b28436e9444726a35a93264a046242e348e) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api setup` keeps the setup command's own output back and prints one line for the result. The output is only shown when the command fails, so a checkout's advice about its Makefile no longer competes with the CLI.

- [`0e060b2`](https://github.com/ethlete-io/ethdk/commit/0e060b28436e9444726a35a93264a046242e348e) Thanks [@TomTomB](https://github.com/TomTomB)! - Every `et` message now names a command the reader can type, for example `yarn api` or `npx et api`,
  in place of a bare `et`. `et doctor` names the `et api` command that fixes each problem.

## 2.1.0-next.5

### Minor Changes

- [`612d735`](https://github.com/ethlete-io/ethdk/commit/612d73563e1689bbfcf948d26ebe7c59d2420781) Thanks [@TomTomB](https://github.com/TomTomB)! - `et api` now clones a missing API checkout from a `repoUrl` in `ethlete.apis.js`, making
  `apiRepoPaths` optional. `runApiCommand` is async as a result.

- [#3072](https://github.com/ethlete-io/ethdk/pull/3072) [`4bbbb51`](https://github.com/ethlete-io/ethdk/commit/4bbbb5167989a1c3ef2ffeba09fcfd18ba953fba) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et doctor` to check this machine's config, container engine and API checkouts, `et api
checkout` and `et api pull` (with `--force`) to move an API checkout to the branch it should be on,
  and `et api --help`.

### Patch Changes

- [#3072](https://github.com/ethlete-io/ethdk/pull/3072) [`0fd8ba3`](https://github.com/ethlete-io/ethdk/commit/0fd8ba3dd61cc78409c397c8180f0a675282642f) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et doctor` now says when a directory has neither config file rather than reporting no problems.

## 2.1.0-next.4

### Minor Changes

- [`b6fe4be`](https://github.com/ethlete-io/ethdk/commit/b6fe4beae010aaa2e0e367d636f6759442983395) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `et api` to run an app's backend from a local checkout, declared in `ethlete.apis.js`. The new
  `ethlete.config.local.json` says where the sibling checkouts on this machine live.

## 2.1.0-next.3

### Minor Changes

- [`edea44b`](https://github.com/ethlete-io/ethdk/commit/edea44bf1c494420f02b545202f4b24db9a6395c) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to angular 22

## 2.0.1-next.2

### Patch Changes

- [`b73a127`](https://github.com/ethlete-io/ethdk/commit/b73a127002a06e3aa0c4e7e977b1ad1f3e04e7e6) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump yet again, final one for sure, pinky promise

## 2.0.1-beta.1

### Patch Changes

- [`ddb5d09`](https://github.com/ethlete-io/ethdk/commit/ddb5d09e4bc56e18cc8c228aa78a200441e7a766) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump to beta

## 2.0.1-next.0

### Patch Changes

- [`a690217`](https://github.com/ethlete-io/ethdk/commit/a6902172efd9bd1956a16237e79acbfbd816d946) Thanks [@TomTomB](https://github.com/TomTomB)! - Version bump only

## 2.0.0

### Minor Changes

- [`10802c0`](https://github.com/ethlete-io/ethdk/commit/10802c0ecef8907b2ab27f42680aa5b47db76f7d) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular v20

### Patch Changes

- Updated dependencies [[`10802c0`](https://github.com/ethlete-io/ethdk/commit/10802c0ecef8907b2ab27f42680aa5b47db76f7d)]:
  - @ethlete/dsp@0.3.0

## 1.0.0

### Minor Changes

- [`1dd18fb`](https://github.com/ethlete-io/ethdk/commit/1dd18fb077b9b377384daac8eacae5732d7e7a3a) Thanks [@TomTomB](https://github.com/TomTomB)! - Update angular 19

### Patch Changes

- Updated dependencies [[`1dd18fb`](https://github.com/ethlete-io/ethdk/commit/1dd18fb077b9b377384daac8eacae5732d7e7a3a)]:
  - @ethlete/dsp@0.2.0

## 0.2.2

### Patch Changes

- [`69ee325`](https://github.com/ethlete-io/ethdk/commit/69ee32561bf0df78569a1649053a37edf9741b9c) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump only for updating peer deps

## 0.2.1

### Patch Changes

- [`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency sync only

- Updated dependencies [[`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63)]:
  - @ethlete/dsp@0.1.2

## 0.2.0

### Minor Changes

- [`9605da51`](https://github.com/ethlete-io/ethdk/commit/9605da5186a036ee052668a8c390be8332178398) Thanks [@TomTomB](https://github.com/TomTomB)! - Add release script

## 0.1.1

### Patch Changes

- [`04e0db6`](https://github.com/ethlete-io/ethdk/commit/04e0db6c0007d58705f88605f3f8ed2d0ad05ce3) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular 16

## 0.1.0

### Minor Changes

- [#609](https://github.com/ethlete-io/ethdk/pull/609) [`39eda21`](https://github.com/ethlete-io/ethdk/commit/39eda21929f50b75071ad464c3331d85f3645fa1) Thanks [@nziermann](https://github.com/nziermann)! - Add a dsp function to generate css based on input file
