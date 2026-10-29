# @ethlete/cli

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
