# @ethlete/cli

## 3.0.0-next.28

### Minor Changes

- `et design check` warns when a part's design misses a declared real input, zoom extreme or unknown state, repeats the live chrome in a sample, or shows one status twice in a view.
- `et design compare --affected` compares every implemented part whose app files changed since its record on one harness and records each green one again; `IMPLEMENTATION-UNCOMPARED` points to it and the gate names the uncompared parts.
- Ready marks and sketch picks now record who wrote them (`by`, `cmd`, `pid`), and a write without `by` is refused; `et design ready` needs `--by`.
- `design status` without a call shows the unpushed commits, the age of the oldest and the last push gate result (`--json` for tools).
- `et design sketch covers` on a multi-target sketch takes the part, `<layer>/<name>:<state>[@x,y,w,h]`, and refuses a bare state; compare matches a covered DIFF against that part.
- `et design compare` lists a DIFF that an open sketch covers (`covers` in its `sketch.json`) with the sketch name instead of failing it.
- `et design sketch covers <layer>/<name> <state>[@x,y,w,h]…` sets the compare DIFFs an open sketch covers. A region cover takes a DIFF only when every differing pixel lies inside its box, and never a size change. Other sketch writes keep `covers`.
- `design accept` takes an agent `--by` when `--note` names an existing ADR, an Impl Q or a finding, and stores the refs. `sketch merge <part>@edit --variant --allowed-by <ref>` picks either live variant.
- `et design check` reports command text in a drawing or an app template as `COMMAND-TEXT` for a product that sets `commandText: 'deny'`.
- `et design compare` runs in a self-starting resident design process that keeps its design server, Chromium and harness app warm; `et design stop` ends it.
- `design check` fails with `SDK-PRIVATE-VAR` when a part's stylesheet sets a private `--_et-*` variable of an SDK component.
- Every `et design` run logs its timings, and `et design timings` reports them against the speed targets.
- `design check --rules --base` passes the parts listed in a product's `implementation-baseline.json` while their drift matches the pinned file hashes, prints each entry, and fails an added or removable entry.
- Design checks pass rule hits listed in a product's `rule-baseline.json`, and `design check --slow` now runs CONTROL-STATE, DROPPED-PROP and ACTION-LOST.
- `design compare` draws SDK controls a design restyles and names the states it skips; `design check` refuses SDK attribute values the SDK does not declare.
- A sketch merge checks in a clean copy of HEAD, so other uncommitted edits no longer block it; it refuses only when it would overwrite one, and names the file.
- A product's `noteLanguage` in `design/config.json` makes `sketch new` name the language for notes and `sketch check` warn `NOTE-LANGUAGE` on a note in another one. `sketch note <layer>/<name> --round <round> <text>` rewrites a round note, also of a ready sketch.
- `et design sketch ready` records the content hash of each variant it judged. `sketch check` and `sketch ready` move an undecided ready sketch back to in progress when a variant changed since.
- `design sketch check` and `design sketch ready` run in the resident design process on its warm design server and Chromium, one request at a time, and every warm run draws the design files as they are now.
- `design check` reports `STATE-NO-SOURCE` for a design state prop whose input no app template feeds, or feeds only with a fixed value the state does not set, so the app can never reach that state.
- The design frame aims the arrow of an `anchoredDialog({ anchor })`, and `design check` reports `ARROW-ANCHOR` when a drawn arrow misses its anchor or is moved by hand.
- `design sketch ready` refuses a variant that draws a control no `controls` entry declares (`CONTROL-UNDECLARED`), and `design sketch merge --decided-by <name>` records who picked the variant.
- A Studio or CLI sketch merge commits its own result, one commit per merge with only the files it wrote, so a second merge in a row is not held back by the first.
- **Breaking:** `et design go` and `et design accept` (and their Studio endpoints and MCP tool) are removed; a part is build-ready once its checks are green, and `design check` warns of a leftover `go.json` or `accepted.json` to delete.
- The render check warns with `OFF-CENTRE` about a line of text that sits off the vertical centre of its filled box, or an icon that sticks out of it.
- `design sketch new --ready` runs the ready gates right after opening a sketch and fails loudly when they refuse. A sketch still in progress now shows on its part as an open point naming the missing step.

### Patch Changes

- The design editor tsconfigs no longer point at a temporary CLI build, are repaired by every design command when their `@design-system` file is gone, and cover sketch variants with the paths of their typecheck.
- Classify the design lint baseline as a refused kind in the commit-hunks spec, since its keys are source files rather than parts.
- `design check`, `sketch ready` and `sketch merge` lint the design part and sketch variant files with the checkout's ESLint config and fail on a warning over the product's `lint-baseline.json`, which may only shrink.
- `design check --part` settles the slow rules of a part in a product with a harness, and a whole-product check names the parts that still wait for them.
- `design check --product <name> --app-classes --fix` rewrites every Tailwind class that has a canonical form, in the harness app source and in the product's parts.
- Drop the unused `auto`, `refreshedBy` and `cause` fields from the design go type and fix the docs paragraph on `design check`.
- `et design check` repeats the stale cli dist warning at the head of its summary.
- `data-et-action` accepts a `dblclick:` prefix; the action checks press that element with a double click.
- `capabilities.json` accepts `"automatic": true` with a required `why`; such a capability needs no place and is listed as a warning in every check.
- `sketch variant --from <withdrawn variant>` prints `from withdrawn <variant>` under the new variant.
- `design check` and `design ready` record the actions a part declares in its check record, and regenerate a stale harness map.
- Keep the recorded action keys of a part when `design check` drops its check record, so ACTION-LOST keeps reporting a lost action on every check instead of clearing itself on the next one.
- A product without a harness now blocks build-ready with a no-harness blocker instead of staying pending.
- `design serve` writes or drops the check record of each part after its slow checks settle, as `design check` does, so Studio shows a part with green checks as build-ready without a manual `design check`.
- Answer `/__design/system` with a 503 that names the missing `dist/libs/<lib>` build and the command that builds it, instead of leaving the request waiting.
- Fix the design shot route: it takes a sketch folder name as the sketch id and names the known sketch ids when one is unknown.
- Add `et design serve-state`: it prints who serves the design port, which cli build it runs and how to restart it.
- `et design check --slow` now compares a part whose design changed after it was implemented, and fails a state the app has no element to drive, naming the app component to build.
- The action check reports ACCESSIBLE-NAME when a control's accessible name in the app differs from the one the design draws.
- `et design compare` stays warm after a cli update that does not touch its drawing code, and `et design timings` judges targets only on runs of the current commit on an idle machine.
- `et design compare` in the resident process stops a request whose client went away, compares pictures faster, names an animation that never settles, and prints the slowest phase when a run misses its 10 s target.
- `design compare` draws forced states in embedded frames statically, masks the slot stand-ins of embedded parts on a page, and fails when a frame look's selector matches nothing in the app.
- `et design compare` shoots eight states at once instead of four, so a compare after an app edit takes about two seconds less on a large page.
- `design check --rules` prints one line per rule it skipped, with the reason. Under `CI`, a rule skipped for a missing input, such as no `--base`, fails the check; a rule that does not apply stays a note.
- `et design check --rules --base` finds the app files of an implemented part faster: it walks a barrel's exports once and reaches only the parts whose records list a changed file.
- The known-unbound-input list no longer holds the title bar's `part` input, which is bound, so `design check --rules` passes for Studio.
- The focus ring takes public `--et-focus-ring-*` tokens; `design check` stops flagging base parts and spinner clipping.
- `et design check` now fails on an OFF-CENTRE hit that the product's rule baseline does not list, instead of warning.
- `et design status` prints the state of the latest CI (Next) run on GitHub (`ci: green|red|running|unknown`), read through `gh` and cached for a minute. A red run says to fix or revert before any feature slice.
- The action check of `et design compare` and `et design actions` draws the start states at once and checks up to four states at once, so a part with many states finishes faster.
- A Studio merge no longer blocks the design server while it reads and commits the changed files with git.
- `et design sketch ready` records on the sketch why it did not merge by itself, runs once per sketch at a time, and
  commits its own automatic merge when the product was clean.
- Read the `implements` link history of all changed merged parts with two git calls per repository instead of two or more per part file.
- `design check` writes no render or completeness cache entry when an input could not be fetched, and each run's timings line records the count of unfetched inputs; `design timings` flags those runs.
- `design check` reuses each part's completeness drawing while every response it loaded answers the same, an SDK render included. A cached render or completeness result prints the warnings its drawing logged again.
- A part's check record (and so `design task --verify`) needs only its own passing check, the action check skips parts without an `implements` link, and `design check --part` says why it wrote no record.
- `et design check` keys a cached drawing on the registry entries its frame reads, not on every sketch, and ignores the SDK id counters in render responses, so a check's own sketch writes no longer redraw every part.
- `design check` keeps the render issues of each part on disk and reuses them while every response the part's drawing loaded answers the same, so an unchanged part is not drawn again.
- `design check --product`/`--part` runs in the resident design process on its warm design server and Chromium, records a phase per step, and lets a waiting compare run between two parts. `design timings` flags runs with unexplained time.
- `design check` keeps its render and completeness caches across a resident restart: the Vite client's per-start websocket token and inline source maps no longer change a cache key.
- `design compare` keeps each state's action check result on disk while its app and design inputs stay the same, and the focus ring probe no longer waits 30 s for an element its click removed.
- `design compare` ignores a colour shift of 8 of 255 or less per channel, the same anti-alias rule as the sketch merge diff, and the ADR check refuses a new `open: none` ADR.
- `design compare` starts the harness app once for the states and the actions of a part, and prints its phases with `ETHLETE_DESIGN_PHASES=1`.
- `et design compare` runs the action check while it shoots and compares the states, and keeps each state's pixel compare in a disk cache, so a run after an edit finishes sooner.
- `design compare` draws design and app shots four at once, waits at most 1 s for drawn overlay panes, and names a state whose app opened fewer panes than its design draws as a problem.
- `design compare` keeps design and app pictures on disk by a hash of their inputs (design files, frame, props, built app, browser), so an unchanged state is not drawn again; `design timings` counts the hits.
- `design check` marks old problems without changing which problems it reports, and marks none when the base cannot be read or written.
- `design check` marks each render problem the base already shows with `OLD`, so a change sees at once which problems it added.
- The "wird gebaut …" state of a design frame shows the elapsed build time and ticks it every second; its colors come from SDK surface tokens.
- A design frame whose `render.packages` build folder is missing shows a quiet "wird gebaut …" state instead of the red error while an `nx build` of that package runs; the error shows only when no build runs.
- The resident design process keeps the harness app current with an incremental watch build, and the harness build cache key covers only the files the app's build reads.
- The design hash no longer covers a part's `implements` link, so a link-only change keeps the part and the parts that embed it current; records written at the old hash still hold.
- `et design check --slow` reports `IMPLEMENTS-UNRENDERED` when the app does not render a part's `implements` component where the live page draws that part.
- Design calls that run at once in one checkout no longer race on `dist/libs`: a call waits for another call's lib build, and a rebuild waits until no call still renders from the old build.
- The design server logs a line to stderr when Vite sends a full reload.
- The design server keeps the sketch compare of every part a file change does not redraw, and a full sketch listing asked after a change no longer joins one that started before it.
- `design sketch check` and `ready` draw the merged part alongside the sketch, about 10 s faster on a large page; `ETHLETE_DESIGN_PHASES=1` prints a `PHASE <name> <seconds>s` line per phase of `check`, `ready` and `merge`.
- A shared design shot draw now takes over a live lock when its age reaches the wait. Before, the wait could time out in the same poll.
- The old/new sketch of a direct edit takes `old` from the newest commit at the part's merged hash, so a committed edit no longer gets stuck.
- An edit sketch merges again over the uncommitted edit it was opened on, and `CHECK_RULES` lists the coverage, sample chrome and status-twice rules.
- The glued-interpolation design rule no longer reports a hole whose every branch starts with whitespace.
- `et design go --by tom` now finds a committed `Impl Q` decision with the git that ships with macOS, whose `log -G` regex has no `\s` or `\b`.
- The resident design process serves the watch-built harness app again: it waits until the build has written its output files, and a served build no longer reports its URL as an error.
- `design sketch check` and `ready` shoot the states of each variant several at once when they look for variants that draw alike, so a large page checks faster.
- The render check of the slow `et design check` draws up to four frames of a part at once, each on a page of its own.
- A Studio merge of a sketch that is not ready, has no pick or has a rejected pick is refused at once, without
  starting the merge worker.
- A design command's own server now moves to the next free port when another process takes its probed port first, instead of failing with "port in use".
- `et design check` warns with `PENDING-STATE-MISSING` on an `emit:` action of a part whose app handler reaches a host invoke or HTTP call while the part draws no pending state, and names the traced path.
- Captured child-process output in `et` (type check, lint, prettier, git, compose, migration scan, release) goes through one helper that sets `NO_COLOR` and strips ANSI, so a forced colour environment no longer breaks parsing of tool output.
- `design status` counts unpushed commits against `origin/<branch>` and warns when the branch tracks an upstream with another name.
- The design editor tsconfig now treats a missing CLI build folder under a symlinked temporary folder as transient, so a run from it no longer overwrites the tsconfig.
- A rule that is new in `rule-baseline.json` may start with the hits that predate it; its entries stay shrink-only after that commit. `IMPLEMENTS-UNRENDERED` problems carry the page as their place, so the baseline key is `<part>: <page>`.
- The rules gate names only the failing products, and the action check no longer fails a renamed control of an embedded part.
- Design servers of checkouts that share a `node_modules` now share one shot store, so a part picture whose read files are unchanged is drawn once, not once per checkout.
- The design server keeps each product's sketch and rule check result until a file the check read changes, so a repeated sketch listing does not run the check again.
- Fix the sketch auto-merge refusing to run when the product lives under a symlinked path such as macOS `/var`.
- `STATE-NO-SOURCE` skips inputs on the known unbound list and counts a tag that leaves an input out as feeding its literal default.
- A Studio merge runs its git status and commit in the merge worker, so forking git no longer stalls the design server on Linux.
- `et design` works in a checkout reached through a symlink: the checkout path is resolved to its real path, and the
  sketch rebase, `sketch at` and the harness build cache spell the git root the way the checkout is spelled.
- The design server runs the rule checks of a `/__design/system` listing in a worker, so it keeps answering stamp, comment and ping requests while a listing runs.
- `et design task` verifies one commit over several parts: `task <part> <part>... --product <p> --verify <rev>`.
- `et design check --visible-change` clones the base checkout again when the reused clone cannot check out the base commit, instead of failing with `fatal: reference is not a tree`.
- `design compare` no longer counts an overlay mock inside a `hidden` element as a drawn pane, so a closed embedded menu costs no pane wait. A state whose app opens fewer panes than its design draws now fails.
- `et design compare` waits longer for a design frame on a loaded machine and fails its summary when the action check could not run.
- `design check` also lints the changed call files under `.ethlete/design/calls` and fails on a warning over their own `lint-baseline.json`.
- `design check` draws the parts of its completeness check in parallel, as many at once as the render check, with the same output order.
- The design server computes open points in a worker thread, so other Studio requests no longer wait seconds behind them.
- The design server removes the old path-keyed `shots-*` folders of the shot store when it starts.
- The design server can hold each `/frame.html` document for `ETHLETE_DESIGN_DELAY_FRAMES_MS` ms, for tests of slow frame loads.
- A design server now exits when its parent process is gone instead of living on as an orphan.
- `et design shot` and `et design check` end with exit code 124 and a log after a hard deadline, and a part draw that never settles fails instead of stalling the shot.
- `design sketch ready` shares one server and Chromium across its phases, skips embedding states that draw as merged, and shows progress; the Studio merge no longer freezes the server.
- `et design status` no longer prints a `push gate:` line, because the design rules gate that wrote it is deleted; the unpushed and CI lines stay.
- The `old` variant of an edit sketch rebases the imports of its files and its `shared/` folder that leave the part, so it draws.
- Design sketches: a sketch folder that holds no files no longer counts as an open sketch, and merge and discard remove an emptied `sketches/` folder.
- `design check` prints a line when the checkout's git hooks are not installed, so commit and push checks that silently never ran are noticed.
- `design` reports a worktree whose `core.hooksPath` is not the relative `.husky`.
- `et design compare` and the design rules check now report an action check that could not run as the shared "no verdict, retry" result, instead of their own wording.
- The OFF-CENTRE design rule measures scaled text at its scale and skips underlined headings, boxes their line box fills, top-aligned rows and boxes with a form control.
- `/__design/open-points` reuses its rule results only while every file and folder the rules read is unchanged. The design server redraws a part in Studio whenever it keeps a changed picture that no redraw announced.
- `design check --rules --base <rev|range>` fails with `IMPLEMENTATION-UNCOMPARED` on an app file in the range that an implemented part reaches and that changed since its implemented record; the pre-push gate passes the pushed range.
- `et design check` reuses kept part pictures for auto-accept and rewrites no edit sketch on a rerun, survives unrelated cli edits, judges load against physical cores, and `design shot --variant` writes one file per variant.
- `design check` no longer counts a static `et-chip` as an undeclared control; only a removable or role-carrying chip is a control.
- Design servers that share a shot store wait for a shot another server is drawing right now, instead of drawing it again.
- `et design shot --crop` with a box outside the content writes an empty transparent picture and prints a note with the content box, instead of failing with "the screenshot failed".
- Lint now rejects a try/catch that ignores its error and returns a fallback in Studio and the design rules. A malformed token stylesheet is reported as a TOKEN-SELECTOR problem, and an invalid harness props JSON names its parse error.
- `et design sketch ready` and `sketch check` end as "no verdict, retry" when the base part does not draw in time, instead of reporting its problems as sketch problems.
- A sketch file change now starts a new sketch listing for the next request, so Studio no longer receives a listing from before a merge or discard and keeps a gone sketch open.
- A sketch whose automatic merge uncommitted files refused merges by itself on the next sketch command or Studio listing once they are committed; Studio shows one notice instead of a manual Übernehmen.
- `sketch new` writes the right number of `../` into the imports of a copied `shared/` folder that leave it.
- The "is stale" line `et design sketch ready` prints now names the commit that changed the base parts.
- `et design sketch ready` now refuses a sketch whose base changed since it was drawn, with the same SKETCH-BASE-STALE line `sketch check` prints.
- Studio picture URLs stay the same across page switches, so a page shown before paints its stored pictures at once. Draw ranking moves to `POST /__design/view`; shots carry an ETag and answer 304.
- `/__design/open-points` reuses its product-wide open points and rule results while no design, stylesheet or harness app file changed. Studio asks for a part's open points once per page switch.
- `design timings` lists Studio page switches (`page-switch`, target 100 ms for a page seen before; `page-switch (first)`) logged by the canvas e2e, and shows sub-second times in ms.
- A ready mark or sketch pick no longer records an absolute path, such as the home directory, in its `cmd`.

## 3.0.0-next.27

### Minor Changes

- `et design check` treats a busy drawing as ongoing work and fails with `STATE-NOT-IN-COMPONENT` when a state is not named after the app phase it sets.
- `et design check` and `et design part-check` name the `motions` entry a missing looping motion needs, and `et design sketch check` and `sketch ready` count a state the variant draws busy as ongoing work.
- The design check now flags doubled and lost card surfaces, and a page or sketch that rewrites an imported part's markup.
- Add `design sketch target remove`, and make `sketch target add` refuse a part that would break the layer rule (UPWARD-DEPENDENCY) up front.
- Add the manifest field `addsWhenFound`: `et update` adds a package only when a `.ts` file names one of the listed identifiers. The `to-query-v3` migration adds `@ethlete/query-devtools` only for repos that use `QueryDevtoolsComponent`.
- `et design ready` drops `--by` and writes a tool-checked build-ready record that `design check` keeps current; the open-points answer gains `buildReady`, and the `no-go` / `stale-go` points are gone.
- `design commit-hunks` now splits every shared JSON under `.ethlete/design` per entry (`--part`, or `--id` for `capabilities.json`), writes keys sorted, refuses files it cannot split, and waits for a held index lock.
- Add `et design commit-hunks <file> --part <p>`, which commits only the entries of one part from a shared JSON file; `sketch ready` prints it for each shared file it wrote.
- Add `et design actions --live`, which checks the shell controls on the app's real pages; `et design ready --url` runs it too.
- New `et design actions` checks that each control reaches the state or fires the output its design declares in `data-et-action`; `et design complete` fails an undeclared one.
- `design go` and `design accept` store a picture hash per state in `pictures.json`; `design check` carries a review or go to a part's new hash as an `auto` acceptance when every state draws pixel-identical.
- Design frames resolve `data-et-auto-surface` by elevation like `etAutoSurface` and style `data-et-surface-interactive` like `etSurfaceInteractive`; `et design task` maps both attributes to the `@ethlete/core` directives.
- `design check` prints a `DONE <product>: n of m` line counting the parts implemented at their go hash and marked ready.
- `et design check` now lists the missing control states and undrawable parts `et design ready` refuses on without `--complete`, which is no longer needed.
- `design check --product <name> --rules` runs only the static design rules, in seconds.
- `et design check` reports `CLASS-UNDEFINED` for a Tailwind class in a design part that compiles to no CSS against the product's stylesheets. A sketch fails only on a class it adds.
- `design compare --all --product <name>` compares every done part and exits 1 on any deviation or part it cannot compare. `design compare` on a foundation part prints that there is nothing to compare and exits 0.
- `et design compare` and `et design task --verify` no longer need `--url`: without it they start the harness app's dev server on a free port and stop it afterwards.
- Add `et design compare`, which shoots each part state against the app's `/__design-harness` route at 0 px. `task --verify --url` records the implementation when compare is green, and a page link may name its `component`.
- `et design check` warns with `DENIED-CLASS` and `DENIED-STYLESHEET` when a part, or the product's stylesheet, uses a class or `var()` that the product's `deniedClasses` patterns deny.
- `et design go` and `et design accept` with `--by tom` need a confirm at a terminal; `et design go --batch <file>` confirms a go list at once.
- `et design go --by tom` needs `--note "Impl Qnn"` naming a committed plan decision, and refuses when the part's design changed after that decision. The note is stored in the go entry.
- `design compare --live --sketch <variant>` compares live states against a sketch variant, `design sketch check` flags live-spec design states that do not exist, and an old record no longer absorbs a changed imported part.
- Add `definePart({ frame })`: a demo frame that wraps only the part's own states. A part that calls `render` of another part gets it without the frame.
- Add `et design go`, a go per design part that stores the released design. A linked part without a current go lists the open points `no go` and `go is stale`.
- Add `et design task`, which prints what implementing a part with a current go takes: its states, the states changed since the last implementation, and the allowed files. `--verify` rejects a commit that changes other files.
- `et design actions` and `et design actions --live` click each focusable element with a real mouse click and fail when it shows a focus ring afterwards. A missing ring on keyboard focus is reported as a warning.
- Design frames resolve `data-et-semantic-color="<type>"` to the colour theme of that type and apply the surface's `colorThemeVariants` swap on auto surfaces; `et design task` maps it to `injectSemanticColorTheme`.
- `slot(name)` from `@design-system` marks a part's region whose content the implementing component projects with `<ng-content>`. `et design compare` empties every such region in the design picture, as the harness projects nothing.
- `et design` part hashes cover every imported file and the app component's files, and `design check` names what made a ready or done part `STALE`.
- A grid row that forces only plain SDK components the part does not style draws at rest only; shot, compare and the visible-change gate skip its interaction states.
- `et design check --product <name> --visible-change [--base <rev>]` fails a harness part whose app looks different since the merge base, unless a picked or merged sketch of it is in the range or it moved closer to its design.
- A visible edit of a merged design part outside a sketch now opens an old/new sketch to pick in Studio, and merges no longer write `accepted.json`.
- `et design go --batch` takes `"action": "merge"` entries: a sketch merge as Tom, checked with every other entry before the one prompt. The merge refusal for a sketch in progress names the `sketch ready` command.
- `design check` keeps a go when a design change adds a state but leaves every existing state pixel-identical, and lists the new state for the next review.
- `design check` and sketch variants fail with `INLINE-UI-IN-PAGE` when a page writes interactive markup instead of embedding a part.
- A design part can declare `instant: 'reason'` when its states switch without motion, instead of listing every pair as `unreachable`; `design sketch ready` prints a NOTE for it.
- `design check --product <name> --live` and `design compare --live` report visible app regions no part covers (UNCOVERED), unless the live spec lists them under `partless`.
- `ORPHAN-ENDPOINT` known entries now name the state they expect, and fail when the code no longer matches it.
- The render check fails `UNREACHABLE` on a declared action a state hides, fades out, shrinks to nothing or buries under
  another element, and `COVERED` on an action or a nested projected region an opaque element of another subtree paints
  over.
- `et design ready` and `POST /__design/part-ready` refuse a part while `et design actions` fails for it, and list the failed checks. `et design ready` takes `--url` for a running harness app.
- `design check` SAMPLE-DEFAULT also flags an implementing app component that falls back to a sample constant (`_SAMPLE`, `_ROWS` or a literal `UPPER_CASE` class field of the file) via `??`, `||` or a ternary.
- Add `et design sketch new --name <n>`: a second sketch on a part gets its own folder, `sketch.json` and id (`<layer>/<name>@<n>`), and the unnamed single-sketch layout is unchanged.
- `et design sketch report` refuses a ready sketch. Add `--reopen` to move it back to in progress when the user asks for a change.
- Add `design sketch withdraw` for an agent to retract its own identical variant; verdict commands now refuse an unknown `--by`.
- Studio can now record a go and accept a direct edit by a click (new `/__design/part-accept` route).
- New slow design rules `APP-SPEC`, `UNCOVERED-REGION` and `VISIBLE-CHANGE` run with `et design check --product <name> --slow` and in the background of `et design serve`; their results feed build-ready.
- `et design task` starts only on a build-ready part and lists its blockers; done, STALE and ACTION-LOST read the check record instead of go.json.
- `et design check` now fails on CLASS-UNDEFINED, DENIED-CLASS and DENIED-STYLESHEET findings, and `design accept` refuses a part with a check finding.
- `design sketch check` warns `VARIANT-UNCHANGED` when every state of a live variant draws the same pixels as Aktuell.
- `design compare pages/<name> --live` compares a page design with the app's real page, run on the fixed sample the product names in `harness.live`.
- `design compare` now runs on a part that changed since its go and marks its output `unapproved`. `design task --verify`, `ready` and `accept` still require a current go.
- `et design harness --product <name>` generates the design harness part map from the parts' `implements` links; `compare` and `task --verify` refuse a stale map.
- The design system listing flags a base part no part of the product imports with `unusedInProduct`, and Studio lists those parts in a folded "Not used in <product>" group.
- `design shot --variants` leaves out variants their agent withdrew; `--all` or `--variant <name>` draws them.
- `design sketch merge` records the picked variant, who decided it and when in `merged.json`, next to the part's hash. Hash-only entries still read.
- `design sketch rebase --ported` keeps files already ported by hand and ports the rest.
- `design sketch rebase` merges the product's changes into each variant and stops on a conflict; `sketch ready` on a ready sketch exits 0.

### Patch Changes

- The design action check drops the keyboard focus ring of a control pressed with Enter or Space before comparing
  against a goal state drawn unfocused, so an in-place toggle reaches its state.
- `ethlete-agents sync` and `et` write their JSON files (`.mcp.json`, design and update state) in the checkout's Prettier format.
- A refused auto-merge in `design sketch ready` no longer leaves a `pick` decision in `sketch.json`.
- `design sketch check` and `ready` print each pre-existing problem as its own line, and the "no looping motion" refusal names the `motions` entry to add.
- Do not refuse `design` for a checkout whose `dist/libs/cli` is a symlink into another checkout, as in the e2e-check worktrees.
- Settle the embedded frames of a part before a motion shot, so an animation inside an iframe is finished in every keyframe.
- The stale cli build refusal now also compares the source hash when `dist/libs/cli` is symlinked from outside the checkout: a matching build runs, a build from other sources is refused.
- The stale cli build refusal of `et design` now also applies when it runs from a subfolder of the checkout, so `compare`, `check` and every other design command refuse a build made from other `libs/cli` sources.
- The System page popover ends in a build-ready footer with a Gründe disclosure, and `design compare` now clicks open a trigger that sits inside an overlay.
- The action check checks only the elements a part draws itself, leaving an embedded part's to its own check, and prints a `host` line only when it skipped one.
- `design actions` checks an action declared inside an embedded part against that part's own app component, not the host page.
- `design actions` and `design live-actions` name the state a missed press reaches instead when only `aria-expanded` can tell the states apart.
- `design actions` names what a missed state action reached instead: "reaches state X instead" when the app drawing matches another declared state, or "reaches no declared state (closest X, N px)" otherwise.
- `design actions` expects a surface opened from another state over that state, and resolves a state an embedded part already draws against the page.
- `design actions` presses at the frame size and no longer fails elements that differ only in tag, accessible name, or an action their embedded part owns.
- `et design actions` and the live action check press a switch, checkbox or radio with click and Space only, as a native checkbox; Enter no longer counts as a missed action on them.
- `design actions` prints each action check as soon as it is known instead of all at the end, so a killed run keeps its results.
- `design actions` waits for the part to mount on a page-layout harness before it scans its controls.
- A spec now fails when a Studio-server route changes without a bump of the Studio API level.
- `et design check --app-classes` no longer refuses while the design mocks are unbuilt, since it reads only the app source.
- `design check` no longer carries a go past a change inside a slot.
- Drop the INLINE-UI-IN-PAGE open entries the Studio pages no longer need.
- Empty the INLINE-UI-IN-PAGE open list: the inbox and system pages embed the comment-draft part.
- The refusal of a second sketch on a target with an open sketch names the way out: extract the region into a part and sketch that.
- `design complete` accepts a bare `data-et-surface` on a part's root element as the part's own surface, with no control declaration. A bare one anywhere else is still a gap.
- The cli build now writes its build time into a shipped build-info.json, so the design server can tell a newer install from an older one even when the package files all carry the same timestamp.
- `design check` runs the `CAPABILITY-PLACE` rule: a capability no design action draws fails the check, and one listed as `missing` prints a warning.
- `et design check` ends with one count line per rule, zeros included, then `check complete: <n> parts, <m> findings`, so a log read mid-run no longer looks clean.
- `design check` names every stateful part that `design ready` cannot draw, also when the render check is skipped or blocked, so it lists the same refusal reasons as `ready`.
- `design check` prints the instant line of a part that declares instant state switches, like `sketch ready`.
- `et design check` runs the render check even when a static rule fails, and names each part it could not draw in a `NOT CHECKED` line.
- A part whose drawing times out in `design check` is drawn once more alone, and a second timeout reports `RENDER-TIMEOUT` instead of `RENDER`.
- `design check` now reports every SDK error (`ET` code) a part logs while it draws as a `RENDER` issue.
- `design ready` refuses a part with a state that does not draw, and `design check` names it as a part ready refuses. The `RENDER` line of an undrawn state now carries the error that stopped it.
- `design check <layer>/<name>` reports only that part, and a flag `design check` does not read fails with exit code 2.
- The design check no longer reports the string options of a design renderer call, such as a dialog placement, as undefined classes; only the class option and HTML content are read.
- `CLASS-UNDEFINED` no longer reads the option values of a `part.render({ ... })` call on an `@system/` part as classes.
- `et design check` prints `CLASS-UNDEFINED` as a warning for now, so a product can migrate its classes; a sketch still fails on a class it adds.
- The design server stops a sketch listing, compare or diff once every client that asked for it has closed its request, instead of drawing the remaining pictures.
- `et design commit-hunks` waits for a held `.git/index.lock` and retries, and the `sketch ready` refusal on a held sketch names the `sketch release` command.
- `design compare` opens each state a part's `controls` name as a surface by a real pointer click on the app trigger, from the state whose props differ least, instead of passing the open props to the harness.
- `design compare` fails a state whose harness page or live page logs an SDK error (`ET` code), and names each code and message.
- `design compare` hovers, presses or keyboard-focuses each element the design picture forces, found in the app by its `aria-label`, before it shoots the harness.
- `design compare` and the `DROPPED-PROP` check accept a design prop that the harness `DESIGN_HARNESS_SAMPLES` function of the part consumes, even without a matching input.
- `et design compare` shoots a fitted app part with its overflowing positioned content and the design's pixel rounding, and a forced press also forces hover, as a real pointer press does.
- `design compare` draws a part that declares `widths` at its first width, in the design and in the app's harness host, instead of fitting the app component to its content.
- `design compare` no longer fails a state on a design prop that no state differs by, or that only forcing states set.
- `design compare` lets the harness drop a design prop set to `selected` in a state whose design draws a selected option, as the app draws that look from its own value.
- `design compare` fails a state it cannot check: one that differs from another only inside emptied slots, or one with a design prop the app component has no input for.
- `design compare` no longer fails when the app opens fewer overlay panes than the design draws, such as a static dialog. It waits 3 seconds for the panes, then shoots anyway so the pixel compare decides.
- `design compare` waits until the app opened and settled as many overlay panes as the design picture draws before it shoots the app, so a popover that opens on mount is no longer missing from the app picture.
- The COVERED rule no longer flags an aria-hidden decoration with pointer-events none or an aria-modal layer over its anchor.
- `DENIED-CLASS` also matches the Tailwind short form of a variable, such as `text-(--warning)`.
- A product's `harness.hosts` declares the app's shared host components by accessible name. The action check skips them and prints one `host <name>: not checked` line per run instead of a miss in every state.
- `et design check` reports ACTION-LOST for an action a part's go recorded that no part of the product draws any more; a new go of the part confirms the removal.
- `design go` and the Studio go record the action keys a part declares, so a later check can report an action that was released with a go and is gone from the product.
- `design check`, `design sketch check` and `sketch ready` now report an interactive design element (button, `[aria-expanded]`, interactive role, click listener) without `data-et-action` as ACTION-UNDECLARED while drawing.
- `design check` now reports ACTION-UNDECLARED in a part whose go still holds as one warning line per part, with the hit count and first element. A part without a go, or changed since it, still fails.
- `design actions` exempts a part from declaring its actions when another part declares it as a control's `part`; that embedding part declares the actions.
- `design actions` runs about four times faster, with the same results and output order.
- `design actions --live` clicks every control that opens an overlay three times and fails when its `aria-pressed` or `aria-expanded` no longer matches whether the overlay is open.
- The design server serves frames from a checkout whose `node_modules` is a symlink, instead of answering `403 Restricted`. The studio canvas e2e checks that a frame shows content.
- A design product can list its user capabilities in `capabilities.json`, and the `CAPABILITY-PLACE` rule reports each one without a design action place.
- `design check` no longer reports each render finding twice, once per colour scheme.
- `design check` prints a progress line per part and reports a part stuck for 120 s as a `RENDER` issue; the design frame no longer logs a ResizeObserver loop error.
- The design server's comments list carries the checkout's `git config user.name`, and the Studio inbox shows it as the author of the user's comments instead of "Du".
- `design compare` on one part also runs the action check that `design task --verify` runs and fails on a miss. When the check cannot run it fails with `actions not checked: <reason>` instead of passing.
- `design compare` empties only the `slot()` regions the compared part draws itself, no longer those of the parts it embeds, so a page keeps the content of its shell.
- `design compare` no longer flips an overlay that opens above a fitted part below it.
- Read the harness room from the compared part's own design mark in `design compare`.
- `et design check --complete` no longer stops on a forced control clipped outside the page, and reports a frame it cannot draw as a RENDER finding instead of crashing.
- `design check` now fails with CUT-CONTROL when a control is partly clipped, and with SKIP-SCOPE when `data-et-skip="CLIPPED"` covers interactive controls.
- `design complete` refuses a part whose drawing root paints the fill of the surface it sits on (`DEMO-BACKDROP`): a demo backdrop the app part does not draw. Pages are exempt.
- The design tool no longer forces hover, active or focus-visible on a disabled element: `interactionRows` draws a row with `disabled: true` only at rest, and `forceInteraction` and the frame leave a `disabled` or `aria-disabled="true"` root alone.
- `design dom --app` refuses a state it cannot render (a forced hover, active or focus state, or a state a click opens) instead of printing idle or closed HTML.
- Add `design dom <layer>/<name>`, which prints the pretty-printed HTML of a part state: its rendered design, or with `--app` the app harness element that compare shoots.
- Send a heartbeat on the design server's event stream every 20 seconds. WebKit dropped the quiet stream after 60 seconds. Studio then reloaded every list and frame after each reconnect, so Studio on macOS showed no frames.
- `design check` reports `CLASS-GLUED-INTERPOLATION` as a problem, not a warning, so a class glued to an interpolation blocks `sketch ready` and a merge.
- The design server now marks the markup of a part's exported helpers as that part, and slots their arguments. A page control declared with `part` also counts on the root of that part.
- A design render of a `render.packages` folder whose `dist` is missing now fails at once, naming the folder and `nx build <package>`, instead of waiting 60 seconds per module.
- `design` pictures keep SDK component styles when the first render sits in an emptied slot, and `design check` flags SDK markup drawn without its CSS.
- `et design check` reports ORPHAN-ENDPOINT for a path the design server serves that the product's app never calls.
- `design check` carries a shrink-only list of known orphan Studio API endpoints, each tied to a backlog id: a listed one is a warning, a new orphan or a listed path with a caller again fails.
- `et design` restarts itself on the same port when the cli is rebuilt or reinstalled, so a running server never draws with old frame or rule code.
- `design check` and the pre-push check now fail with SKETCH-BASE-STALE while an open sketch's base part changed since it was drawn, naming the `sketch rebase` command.
- SKETCH-BASE-STALE now also reports a picked sketch, skips only a discarded one, and prints the repo's own `design` invocation.
- `et design check` and `et design ready` warn when a lib the drawings load from `dist/libs` has source changes newer than its build.
- `et design task --verify` now also allows a changeset and the generated harness map of the product, for every product.
- `et design sketch new` and `et design task` now name the SDK surface and colour theming systems and point to the `theming` skill.
- `et design check` fails a frame-loaded design module that awaits at the top level (`TOP-LEVEL-AWAIT`), which can hang WebKit; a call variant may default-export a promise of its drawing instead.
- Add the UNBOUND-INPUT and SAMPLE-DEFAULT rules for inputs of app components that implement a part, ratcheted by known lists.
- `design product`, `new`, `system` and every `sketch` command refuse an unknown flag with exit code 2 and list only their own flags. `commit-hunks` exits 2 on bad usage.
- Design subcommands refuse an unknown flag with exit code 2 and list the flags they take, instead of ignoring it.
- `et design check` no longer counts a part without an `implements` link as an open point. It lists those parts on one `UNLINKED <product>: <part>, ...` line, and they stay clean and ready.
- Every wait in `et design` now has a limit and names what it waited for when it times out.
- Add the `withAction(markup, action)` design helper: it declares a `data-et-action` on the first `<button>` (or the element `{ action, on }` names) and throws when nothing matches, instead of a string replace that silently adds nothing.
- `CONTROL-PART-INPUT` treats a `dialog` or `alertdialog` pane with `tabindex="-1"` as a focus container, not a control.
- The design check no longer asks for hover, active or focus cells on a disabled control row, and it reports a disabled control whose hover or active look differs from its plain look as DISABLED-INTERACTION.
- When an embedded part's app files change, `design check` asks for a re-run of the embedding parts' action checks, and `design ready` names that reason.
- `et design go` writes `go.json` in the checkout's Prettier format.
- Opening a design frame now fails with the URL and HTTP status when the design server answered 400 or above (such as Vite's 403 for a file outside `server.fs.allow`), instead of measuring the error page.
- `design go` and `design accept` refuse every `--by` but `tom`: only Tom grants a go or an accept, and agents report ready instead.
- A refused `design go --batch` without a terminal now prints the exact command to run in your own terminal.
- The Studio go answer now reports a failed harness map regeneration as `harness`.
- Every `go.json` entry records the command that wrote it in `via` (`design go` or `studio click`). An automatic refresh of its hash keeps `by` and `via` and adds `refreshedBy` and `cause`.
- `et design` reuses the last harness app build while none of its inputs changed (tracked and untracked files, installed packages, Node version, build command) and rebuilds only when one did.
- The harness build cache key no longer includes plans, changesets and the design sketches and comments, which the build does not read, so editing them keeps the cached build.
- `design compare` draws a part that inherits its text style in the design frame's type, not the app body's.
- `design sketch ready` compares each variant at its own first changed state and names that state when it draws like an earlier variant's first change, so reordering a variant's states now clears the refusal.
- `definePart` accepts the `instant` field that `design check` already reads, so a part that declares it type-checks.
- The design control inventory marks a control another element fully covers as covered. Studio lists it but draws no outline or number badge for it.
- The quick sketch list (`/__design/sketches?unchanged=no`) answers without `problems` and `targets`: it runs no rule check and loads no part module, so it returns in milliseconds.
- `design actions --live` ends its wait after a press as soon as the declared output fired or the page went quiet, instead of always waiting 400 ms.
- The sketch check prints `NOTE <part>: live states not checked: spread states` when it skips the live state check of a
  part whose state names cannot be read statically.
- The live check counts an app region as designed when an open sketch targets the part that covers it.
- Stop the LOST-SURFACE render rule from flagging a bar with a one-side divider; only a box with a border on all four sides, a shadow or an outline counts as a card.
- The merge preview also draws a state that only the merged variant has, or that the merge removes, as a change drawn on its one side.
- The merge preview draws each sketched element and page itself, so a page sketch shows its before and after instead of an empty canvas.
- A design sketch merge keeps a comment thread open when it has no reply yet or its last entry asks a question, and `design check` lists an addressed thread as waiting on the user.
- `design compare` and `design actions` count a `model()` of the app component as an input plus a `<name>Change` output, so a two-way bound toggle reaches its declared emit.
- A named sketch (`sketch new --name`) is now checked against its own part: the metadata check of sketch check and ready,
  and the variant diff, compare the part key instead of the sketch id.
- Add the opt-in `NATIVE-TITLE` rule to `design check`: a product config with `nativeTitle: 'deny'` fails on a native `title` attribute in the design markup
- `design check` prints a `NOT CHECKED` line for each state that does not draw, not only for a whole part.
- `design compare --live` fails a state as OCCLUDED when a shell panel covers a design frame (opt out per live state with `"occluded": true`), and waits for overlay panes to end their enter animation before each shot.
- The open point of an unmerged sketch names the sketch, for example "sketch pages-system is ready, not merged", and adds "(it also targets this part)" on a part that is not the sketch's main target.
- A part that declares an explicit `controls: {}` no longer gets a "no controls declared" open point; a part without a
  `controls` key keeps it.
- The ORPHAN-ENDPOINT rule counts an endpoint that a host function builds from a bare segment (`productUrl(address, 'comment')`) as used only when an app file calls that function. The unwritten comment reply, done and withdraw endpoints are tracked as known orphans.
- Page parts no longer list missing motions as open points; their states are data scenarios, like the missing states they already skip.
- The pointer-focus check accepts a ring that a key after the click brings up on a control, as browsers draw it on a plain button.
- The pointer-focus check presses Shift after the click and fails when the ring shows up then.
- The pre-push live check counts the working tree's uncommitted open sketches, so a part an open sketch targets no longer fails the push as uncovered.
- Add the pre-push helpers that pick the Studio specs and the design parts a push reaches, so the hook runs `vitest related` on those specs and the static design rules on those parts.
- The quick sketch listing carries each variant's states, widths and interactions, so the Studio sketch grid shows them before the pictures are compared.
- The render rules that walk controls (`CUT-CONTROL`, `SKIP-SCOPE`, `UNREACHABLE`) share one reachable-controls helper, so they agree on inert, hidden and `display: none` subtrees.
- `design ready` on a part that is already ready at the same hash keeps the mark's `by` and `at` and only refreshes the embedded record.
- `design sketch ready` takes each variant's first changed state from the pixel diff `design shot` uses, at the frame a shot draws, so ready and shot no longer disagree on which state a variant changes first.
- `et design` rebuilds a stale lib with `--skip-nx-cache`, so nx no longer restores the old cached build.
- `design check`, `design sketch check`, `design sketch ready` and `design shot` now refuse while `libs/components/design` differs from its build in `dist/libs/components/design`, and print the build command that refreshes it.
- `design` refuses to run from a build whose libs/cli sources changed since it was built, and names `NX_NO_CLOUD=true npx nx build cli`. The build records a content hash of the sources in `build-info.json`.
- The `POST /__design/part-ready` Studio endpoint is removed (no app called it; `et design ready` stays) and the Studio API level moves to 3.
- `et design check` now fails with exit 1 and names the browser it looked for when no Chromium is usable on a dev machine. Under `CI` it still prints `RENDER CHECK SKIPPED` and passes.
- A render server that fails to start is now reported by `design sketch ready` and `check` ("could not render ...") instead of passing silently.
- The design render check reports NESTED-SCROLL when a box in a design frame scrolls content that does not fit it, and measures the contrast of text inside `inert` previews.
- The design render check reports SEE-THROUGH when text under an open overlay pane (overlay, popover, menu or dialog) shows through it, or when text outside any overlay paints over the pane.
- Fix the types of the render-timeout key so the cli compiles again.
- The design render worker restarts once a package build that was missing when it loaded appears, so a render that ran
  during an SDK rebuild no longer keeps failing with "missing, run `nx build ...`" until the server restarts.
- `design sketch check` fails with `ROUND-NOT-READY` on a drawn round that is neither ready nor on hold, and `sketch report --done` and the pre-commit hook refuse it too.
- `design sketch check` warns `ROUND-NOT-READY` when a sketch's round is fully drawn but still in progress.
- Declare `rxjs` as a dependency; `design check` uses it for the per-part timeout.
- `design sketch ready` refuses, and `sketch check` warns, when one sample a part opts into with `sample` carries different marks in two states of a host (`SAMPLE-MARK-DRIFT`).
- The design server's stamp route now also reports its API level, build time, project and the cli installed in that project, and a new judge function tells Studio whether to restart the server or update the cli.
- `design compare` and `design actions` no longer wait out their settle timeout on a scroll-driven animation (an open SDK menu's scroll fade), which made `design actions` and `design ready` look hung.
- The token and icon sheets no longer repaint the page fill on their bordered panels, which tripped LOST-SURFACE in every product's foundations.
- `design shot` finishes the transitions of embedded frames before it draws, and draws each state twice: a state whose two renders differ is reported with its changed pixel count and box, and the command exits non-zero.
- `design shot` draws the hover, active and focus-visible cells of a grid row the grid leaves out as unchanged, instead of printing "not drawn".
- `design shot --state <name>` draws an interaction state of a grid row the grid leaves out as unchanged, and `design sketch check` no longer checks a withdrawn variant: it prints a `NOTE` line.
- `sketch check` reports, as `ready will refuse:` lines, a variant that does not load, an open point a live variant adds and a running round without a note, so it fails on what `sketch ready` refuses.
- `sketch check` reports the unused imports, parameters and classes that `sketch ready` refuses, so the two no longer disagree.
- `design sketch check` and `sketch ready` fail a variant on `CONTROL-STATE` only for an interaction state its base part does not already draw, so they agree with the product check.
- `sketch ready` refuses a variant that draws like another variant or the current part in every state; `sketch check` now warns of ready refusals instead of failing.
- `et design serve` checks the sketches of a full listing in a worker and lists them in turns, so frames and renders keep answering while it runs; listings asked at once share one check.
- The sketch listing answers `&targets=no` without loading part modules, and `sketch check` warns when a sketch draws more than 24 frames.
- A sketch merge refused for a dirty product no longer leaves the sketch half-merged, and uncommitted decision files such as `go.json` no longer block it.
- `design sketch merge` refuses before writing when the product has uncommitted edits outside the sketch, and names a type error in a file the merge did not change as "product broken outside this sketch".
- `design sketch merge --note` keeps each target part's note and logs the reason in `accepted.json`; `--replace-note` writes the note over the part's note as before.
- `sketch check` and `sketch ready` catch rule problems in the sketch's `shared/` files that only the post-merge check used to find, and a refused merge answers Studio with the check's findings.
- `sketch new` now lists `sketch ready` before `sketch report --done` in its next steps.
- `et design sketch ready` no longer refuses on a render issue the merged part already shows; new issues still block.
- `design sketch ready` no longer refuses a sketch because of problems in its rejected variants.
- The sketch check reports a parameter of a `shared/` function as unused only when no call in any variant passes it. A parameter that only some variants pass no longer reports.
- The SKIP-SCOPE rule reports a skip site once per part instead of once per rendered state.
- `et design` run from a repo checkout prints a WARN on stderr as its first line when the built cli is older than `libs/cli/src`. It names the build time, the newest source time and the rebuild command, and never refuses.
- The design server answers `/__design/stale-mocks` with the design mocks whose build is stale and the command that
  rebuilds them (Studio API level 4).
- The design check no longer reports a stale replace on markup that a package draws in one branch of a conditional.
- The design server's `/__design/stamp` answer now carries the `pid` of the serving process, so a client can tell a restarted server from the one it talked to before.
- `design compare` clicks a surface state open from the first of equally close states when they all share the same props, instead of stopping as ambiguous.
- `design task --verify` now also runs the actions check and fails when an action misses or the check cannot run, so a part with a dead control is no longer recorded as implemented.
- The design type check runs `tsc` with `--pretty false`, so a forced colour setting no longer hides the failing file from the sketch merge.
- Drop the Studio inbox `draft` input from the known unbound inputs; the inbox binds it again.
- The check command warns per product of decision files (go.json, accepted.json, merged.json, pictures.json, sketch.json) that differ from HEAD, and honours a positional part like `--part`.
- The `VISIBLE-CHANGE` slow rule reports a state the app cannot be driven into as a problem of its part, so the part is not build-ready.
- The design system no longer folds a base part under "Not used in Studio" when a product part names it in a `controls` entry or draws its SDK component through `ng(…, { imports })`.
- `UTILITY-CSS` checks a part inherited from a base product under the stylesheets of that base, not of the inheriting product.
- The cli spec run now prints how many browser specs were skipped for a missing Chromium and, in GitHub Actions, emits a warning annotation.
- The visible-change gate counts a sketch merge recorded only in `merged.json`, still judges states that compare cannot check against their design, and lists a state neither app can be driven into as a problem of the part.
- The visible-change gate passes a state without a base picture when the app at HEAD matches its design, and prints how many pixels such a state is off its design.
- `et design check --visible-change` takes `--part <layer>/<name>…` to draw only those parts.
- The visible-change gate fails a part with unjudged states and names each state with its reason. The pre-push live check builds components too, so a fresh clone judges the design side instead of waiting.
- `et design check --visible-change` ends with every state it could not judge, so a pass that judged nothing no longer reads as a clean pass.
- `design check` runs `UNBOUND-INPUT` and `SAMPLE-DEFAULT`, and both rules cover inputs declared with `model()`.
- The `WRAP` render check skips text with a `line-clamp`, because clamped text is multi-line on purpose.
- `CLIPPED` no longer reports an outline or box-shadow cut at the edge of a clip box whose content outgrows it or is moved by a transform, since content there is cut by panning or scrolling.
- `CLIPPED` measures content scaled by a transform at its drawn size, honours `overflow-clip-margin`, and no longer reports the content of a grab-to-pan box or one whose content is moved by a translation.
- `design compare` now shoots the design and the app over the same fixed checkerboard instead of a transparent background, so a background a part adds or drops shows as a pixel difference.
- `et design compare` shoots a fitted part without the frame padding, and draws a `pages` part at a product preset (`--preset`, default the first) against a harness host that fills that viewport (`layout=page`).
- `design compare` waits until menu and select panes have settled before the shot, and holds the app's spinners, progress bars and brand loaders at the frame their design mock is frozen at.
- The COVERED render rule ignores a cover marked `data-et-skip="COVERED"`.
- `DENIED-CLASS` exempts the copy of a foundations part in a sketch, like the part itself.
- `design check` now fails a part with several controls when one of them is drawn markup instead of an SDK component or embedded part (`CONTROL-STATE`).
- `design check` now fails a part whose design states set a prop the app component has no input for and compare cannot reproduce, the same finding compare reports as dropped props.
- `design check --part <layer>/<name>` keeps only that part's findings, and `design check` ends with one line per part with findings plus a count of the clean parts.
- `design check` lists each view of a product's harness app (`*-view.component.ts`) that no part names in `implements` as an open point.
- `et design compare` no longer clicks a surface open from a state whose design picture already draws that surface.
- `et design compare` keeps the pointer off rest shots, finds forced elements by accessible name in the host or an overlay root, and opens a surface state from a state of the same interaction.
- `design complete` counts a control that a host declares with `part` as drawn when it sits anywhere inside that embedded part, not only on its root.
- `CONTRAST` no longer checks the outer border of a floating panel: an SDK overlay pane, or an element with its own surface step and a shadow.
- The CONTROL-PART-INPUT warning names a control by its `aria-label` first, and its text no longer includes inline `style`, `script` or `template` content.
- A design frame that does not draw within the timeout gets one reload before the shot or check fails, so a check under load no longer aborts on one slow frame.
- `design go` and `design sketch merge` now regenerate a stale harness map instead of leaving `design compare` to refuse it.
- Fix the design server breaking every frame after a sketch is merged or discarded: a gone sketch now draws as the product, with a `sketchGone` note.
- Without `--url`, `et design compare` and `task --verify` build and serve the harness app themselves, so they work next to a running dev server of the same app.
- The design inventory no longer counts a disabled control with `pointer-events: none` as covered, so it keeps its outline and number.
- The design reach check now also flags actions that a transparent element covers, or that a sticky column or header covers after a canvas pans.
- `et design` commands that draw now rebuild a stale `dist/libs/<lib>` first, and refuse with the build command when the rebuild fails, instead of drawing from the old build.
- The product check and the sketch check read the foundations exemption of `HARD-CODED-COLOUR`, `HARD-CODED-MOTION`, `INLINE-SVG`, `UTILITY-CSS` and `DENIED-CLASS` from one place, so a sketched copy of a part passes or fails like the part.
- The design check reads the tokens that an imported `@ethlete/<lib>/design` module defines in its stylesheets, so `var(--_et-focus-ring-width)` from `buttonStyles` no longer shows as UNDEFINED-TOKEN.
- Design task verify and check accept the app files a product's harness shares, and compare shoots open states and their overlays like a real pointer.
- `et design task --verify` skips files under `.ethlete/design` with one summary line and allows the part's wiring files (the app files importing the part and their direct imports), which `et design task` now lists.
- `design check` rewords the round and variant notes of an old/new edit sketch opened before they were German.
- A direct edit without pictures at its merged hash is now compared with the design at HEAD instead of older `go` pictures, and the `old` variant of an edit sketch keeps the shared files at HEAD.
- `design check` draws an open edit sketch's `old` variant from HEAD and fails an `old` that does not draw as `EDIT-OLD-NOT-DRAWN`. Studio's full sketch listing no longer fails in WebKit after 60 s.
- `design check` re-checks open edit sketches without a decision and closes them as held when every state draws as at HEAD. A direct edit compares only `record` pictures drawn at the merged part hash.
- A migration can list `adds`, packages its codemod imports. `et update` adds a missing one before the codemod, and `to-query-v3` adds `@ethlete/query-devtools`.
- The design check warns with `CLASS-GLUED-INTERPOLATION` for a class written directly against a `${...}` interpolation in a part's class attribute, which Tailwind's scanner reads as one candidate and emits no CSS for.
- The design pictures now cancel running infinite animations, as the app pictures already do, so an `animate-pulse` or a looping CSS animation no longer fails the compare as a pixel diff.
- Write the approved control inventory (`inventory.json`) the way Prettier formats it, so the repo's format check no longer fails on it.
- An inventory label uses the visible text of a control, so a select no longer lists its hidden options.
- A page's control inventory lists the controls an embedded part draws as `owned by <part>`. They no longer vanish, and they do not block the approval.
- A page's inventory numbers two controls at the same place apart by their label, and the list shows each label.
- A page's inventory also lists an owned control that carries its own part's control mark, for example every SDK button.
- `design compare --live` reads an optional fixed `now` from the live spec, so relative times draw the same on every run, and waits for a drawn page host before it sizes the viewport.
- `design compare --live` draws the same fixed frame content on both sides and can compare a page with its shell panel hidden.
- `design compare --live` waits for the app page's requests to settle before it shoots, so canvas frames that load late are in the picture.
- `LOST-SURFACE` no longer flags a card whose fill hides a patterned backdrop, such as a dot grid behind it.
- The sketch merge compare and the auto-merge count a pixel as changed only when a channel differs by more than 8 of 255, so anti-alias noise no longer blocks an auto-merge.
- `design sketch check` warns when the Aktuell column of the Studio sketch view would show only placeholders.
- `design shot` names the missing or conflicting flag when it refuses a flag combination, and every documented
  combination has a spec. `design sketch check` skips rejected variants with the same NOTE as withdrawn ones.
- `/__design/shot` with a `sketch` but a missing or unknown `variant` answers 400 with the sketch's variants instead of the product picture.
- `design sketch check` also checks the product part a sketch targets and prints its problems as `before` lines, which do not fail the check.
- `design check` and `design complete` print the non-blocking CONTROL-STATE, CONTROL-UNDECLARED and OPTION-VALUE-MISSING hints with a `HINT` prefix, like the small-change hints.
- Skip the live state check of a sketched part whose states are spread from another file instead of reporting false LIVE errors.
- `design sketch ready` refuses while a variant that changes pixels has no shot viewed since its last edit.
- A sketch merge rebases the other open sketches it makes stale and marks the conflicting ones for their agent; `sketch check` reports a sketch whose embedded part changed.
- `design sketch new` rewrites a part's relative imports that leave its folder so they resolve from the sketch, and the merge rewrites them back.
- `SKIP-SCOPE` no longer counts controls inside an `[inert]` subtree.
- `et design check --product <name> --app-classes` now reports Tailwind classes in the harness app source that have a canonical form.
- Studio now judges a stale cli build by the same source hash the cli guards itself with, instead of file modification times.
- Studio starts its design server from a CLI copy built from the last `libs/cli` commit and no longer restarts it on a rebuild; `yarn et:design` runs design commands from that copy.
- The part tree shows every listed problem, and the system listing names the component each part implements.
- `design task --verify` now also accepts commit files that import the part, such as a live wrapper.
- Design task wiring files now also include the non-spec app files a part's direct importers import, one level only.
- `et design task` now counts every non-spec app file that imports the part, directly or through other importers, as wiring, plus the part's own spec. What a spec imports no longer becomes wiring.
- `design shot` and the Studio sketch view label a variant its agent withdrew as "withdrawn by agent" with its reason, and keep "rejected" for a designer's rejection.

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
