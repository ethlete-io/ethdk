# Design system: wireframes round 1, flow, wireframe kit and note size decisions

### Wireframes first decisions and round 1 (2026-10-27)

- Tom: the component layer waits for the wireframes. The component list comes from the Studio
  wireframes, not from the current app. Every SDK component needs a design in the `sdk` base,
  the 3 mocks included; now only the ones the Studio wireframes need, one sketch round each,
  button first, then form-field with input, textarea and label, then select, then tree.
- Tom: the skill order is now wireframes, foundations, logo and CI, components (5157e0517).
- Round 1 (not committed, Tom picks in Studio): sketches `pages-system` (shell variants A sidebar
  plus fixed panel, B top bar plus tree plus panel on demand, C icon rail plus bottom panel; the
  agent picks B), `pages-sketch`, `pages-inbox`, `pages-flows`, all drawn on B. Flows in
  `studio/flows/drafts/`, the inventory in `studio/inventory.ts` (20 SDK rows, 11 new parts).
- Open foundations gap: no Studio tokens for subtle text, interaction, danger, disabled.
- Tom (2026-10-27): clean slate. Only `pages/system` on shell B was accepted. The page sketches
  `pages-sketch`, `pages-inbox`, `pages-flows`, the inventory and the four flows are deleted.
  Each next step is one question to Tom, and nothing is drawn before he accepts it.
- Tom: design granularly, the shell first. `pages/system` and `elements/shell-main` are cut to one
  state each. The shell keeps the logo, the four section tabs, the side list and the content.
  Product select, checkout, panel, overlay and the other states come back one question at a time.
- Finding: the kit `heading` and `tabs` shrink in a narrow row, so "Studio" wrapped and the tabs
  were cut off in the element frame. `shell-main.css` sets `flex-shrink: 0` and `nowrap` on its
  bar. Rec: the kit sets both on `heading` and `tabs` itself.

Studio as a product, findings from the clean-slate session (2026-10-27). Tom: this design
process exists only to test Studio as a product, and here the tool worked against us at every
step. Each finding names what happened and the fix it needs.

- No gate between agent and Tom. The builder drew three page sketches, four flows and an
  inventory that Tom never accepted, and Studio showed all of it as open work. Fix: a sketch or
  flow starts only from an accepted question; Studio shows one open sketch at a time.
- Nothing pushes a wireframe to start small. `pages/system` had five states and `shell-main`
  four, so Tom saw about ten screens at once. Fix: the skill says one state per new part, and
  each further state is its own question.
- A sketch with one variant is valid (see above). Fix: the CLI refuses it.
- `design check` passes broken drawings: wrapped text, cut-off tabs, content running into the
  panel, a missing bottom border, a state taller than its frame. Fix: a check that renders each
  state and reports overflow, clipping and text that wraps where it should not.
- An element has no frame size. Only pages get the product presets
  (`apps/ethlete-studio/src/app/system-view/system-tree.ts:296-340`); any other part is fitted
  to its content, so the shell showed portrait at about 780 px. `widths` gives a width, never a
  height, and the label then reads as a width. Fix: a part can name the presets it is drawn at.
- No agent can see a drawing. Only the design server renders a PNG (`/__design/shot`), Tom's
  server is off limits, and starting an own server was denied by the permission check. Every
  visual question went back to Tom as a screenshot. Fix: `et design shot <part> --state <s>
--preset <p> --out <file>` renders without a server.
  Tom (2026-10-27): an agent may fetch `GET /__design/shot` from his open Studio server, read
  only, as long as it never steers Studio. The command stays the fix for a session without Studio.
- The kit has no shape for an app window. A `box` is either bordered with round corners or
  plain, so a shell built from boxes looks like stacked cards. Fix: a kit `split` or `divider`
  that draws one line between regions.
- The kit grey is private (`LINE` in `libs/cli/design/wireframe-kit.ts:10`), and
  `HARD-CODED-COLOUR` also rejects a fallback inside `var()`. A wireframe that draws its own line
  must import the product colour tokens. Fix: the kit exports its line colour, or the divider
  above makes it unneeded.
- Only a bordered kit `box` paints the wireframe paper. A region drawn in plain HTML is
  transparent, so the shell showed Studio's dark frame behind light kit parts. The paper colour
  is private too. Workaround: the shell sits in one bordered kit box. Fix: the kit `split` above
  paints the paper.
- A part with `height: 900px` and a 1px border overflowed its 900 px page frame, and Studio
  showed a scroll bar. Nothing warned. Fix: the render check above.
- Tom, after the clean slate: "ich bin mit dem Wireframe-Prozess noch ziemlich auf Kriegsfuß".
  The step-by-step rhythm (one question, one change, Tom looks in Studio) works, but each look
  costs Tom a screenshot because no agent can see the drawing. Fix: the shot command above, so
  the agent shows the result in the question.
- The agent dictated the design. After the clean slate it asked yes/no questions about parts of
  the old, never accepted draft (product select, checkout, panel), with its own recommendation,
  and edited `shell-main` directly. Tom: "du diktierst mir in die Feder". No sketch, no variants,
  no pick in Studio, so Studio was not tested at all. Prevent: a design choice always goes to
  Studio as a sketch with variants; a direct edit to a part is only for a bug in a drawing Tom
  already accepted. The skill says so, and `design check` warns when an accepted part changes
  outside a sketch merge.
- The agent then overcorrected and asked Tom what the shell should hold. Tom: the agent's job is
  to deliver good variants, Tom picks the best. The process is: one sketch at a time, two to four
  strong variants, one state each, the agent looks at each shot before it marks the sketch ready.
  Prevent: the skill names both failure modes (yes/no on content, "what do you want?") as
  forbidden, and the builder prompt template starts with the question of the sketch and its
  variants, never with a question to Tom.
- Shell sketch round (`elements-shell-main`, variants a, b, c), friction the drawing agent hit:
  - A row `box` has no cross-axis alignment, so text sits at the top next to a 24 px icon (the
    accepted shell has this bug too). Prevent: `align: 'center'` in `BoxOptions`.
  - `tabs()` draws its bottom line as an inline style; inside a bar it floats above the bar
    border, and only `!important` removes it. Prevent: `tabs(..., { line: false })`, or the line
    in a class.
  - The kit has no vertical nav or rail, and no glyphs for sections, so icon fallbacks repeat
    letters ("S" for System and Sketches). Prevent: a kit `navList(labels, { active })`.
  - `sketch new` copies the part with its `note`, so each variant said "Shell b: ..." until the
    agent overwrote it. Prevent: `sketch check` fails a variant whose note equals the base note.
  - `sketch check` passed a misaligned logo and the floating tab line. Prevent: the render check
    above, and `sketch check` prints the shot URL of each variant to look at.
  - The kit `fill: true` uses `100vh`, but the skill forbids `vh` in parts, so the shell needs a
    fixed `height: 900`. Prevent: `fill` uses `100%` of the frame.
- Shell sketch round 2 ("Discord bubble rail", variants d, e, f from b), friction:
  - The kit has no bubble: `icon()` sets its radius inline and shows one letter, so the agent
    drew its own bubbles in variant CSS. Prevent: `icon({ round: true })` or a kit `avatar(text,
{ active })`.
  - `yarn et ...`, as the skill and the inbox output write it, fails with "Couldn't find a script
    named et"; only `node dist/libs/cli/src/index.js` works. Prevent: an `et` script in the root
    `package.json`, or the inbox prints the command that works in this repo.
  - `sketch variant --round` asks for a note on the previous round but shows none of its variant
    notes; the agent fixed its guess in `sketch.json` by hand. Prevent: `--round` prints the
    running round's variant notes, or drafts the note from them.
  - `sketch check` prints only "ok", so the agent cannot tell which variants and rules it
    covered. Prevent: one line per variant with the rules it ran.
  - `sketch variant` makes one letter per call. Prevent: accept `d,e,f --from b`.
- Tom merged variant f of `elements/shell-main` in Studio (2026-10-27). The part note became the
  bare letter `'f'` (as `'b'` on `pages/system`), so the idea of the variant is lost. Prevent: a
  merge without a note keeps the variant's own note. Tom (2026-10-28): "es ist auch nervig dass
  ich beim merge immer einen text angeben muss. eig habe ich denke ich in der regel nichts mehr zu
  sagen wenn ich etwas merge". So the merge must not ask for a note: the agent writes the note of
  each variant when it draws it, the merge copies it into the part, and Tom's text is optional.
- Tom (2026-10-28), during the content area round: "ich frag mich noch immer ob wireframes
  wirklich noch relevant sind oder ob wir nicht hätten genauso gut direkt in den nächsten step
  gehen können... fühlt sich noch immer komisch an". Open question for the process: which
  questions need a wireframe at all. The drawing agents spent most of their effort on kit gaps
  (alignment, padding, markers), which is look, not structure.
- Content area sketch round (`pages-system`, variants a focus view, b state matrix, c canvas plus
  inspector), friction:
  - Confirmed: `sketch new --by` and `sketch ready --by` write no `authors`; only `sketch report`
    does. All three variants have none, so a merge drops `madeBy` again. Prevent: `new`,
    `variant` and `ready` record `--by`, and `ready` refuses a variant without authors.
  - A variant is a copy of the whole page file, so a new helper can collide with a copied one
    (`stateRow`), and the shot then shows the Vite error overlay, not the design. Prevent: shared
    page helpers live in an importable module, and the shot reports a build error as an error.
  - A `box` with `height: 1` draws a 3 px rounded bar, so variant c has no dividers (see `split`).
  - To fill the shell height, `image` needs a growing wrapper and the content root a hard-coded
    `height: 852` (900 minus the shell padding); `fill: true` means `min-height: 100vh`.
    Prevent: `image({ grow })` and a box option that fills its parent.
  - A note line can only be a small `heading`; `textLines` draws grey bars. Prevent: the muted
    `text()` above.
- Tom on the content area round (2026-10-28): "was hier gerade entsteht ist müll leider. und auch
  einfach zu filigran für wireframes. der canvas soll ein unendlicher canvas bleiben nichts
  weiter." The agent asked a question Studio had already answered: the content is Studio's
  infinite canvas, and all three variants replaced it with new layouts (focus view, matrix,
  inspector) at a detail level no wireframe needs. Prevent: before a sketch, the agent lists what
  the running app already does in that region and keeps it, unless the question is about it; a
  wireframe answers only which regions exist, never labels, badges or field lists.
- `design check --lint <file> --tsconfig` passed a part with an unused kit import (`image`).
  Prevent: the lint step reports unused imports.
- Tom (2026-10-28): in the editor every import in a product part fails, for example "Cannot find
  module '@design-system' or its corresponding type declarations" in `elements/shell-main.ts`. Only
  the TS server sees it; `design check --tsconfig` and the render work. Cause: the aliases
  (`@design-system`, `@design-system/kit`, `@system/*`) exist only in a tsconfig the CLI writes
  on demand into `node_modules/.design-explore/`, which `writeCallsTsconfig`
  (`libs/cli/src/lib/design/calls-tsconfig.ts`) builds for legacy calls; no `tsconfig.json` an
  editor finds covers `.ethlete/design/<product>/`. Prevent: `design product new` and
  `design check` write a gitignored `.ethlete/design/tsconfig.json` with the same paths that the
  check uses, so the editor and the check type a part the same way.
- Real look sketch round (`elements-shell-main`, variants a dense, b single surface, c floating
  panels), friction:
  - A sketch on an element may not carry the page that uses it (`SKETCH`: "may change elements
    and the layers below it"), so a shell look cannot be shown with its page; the page shot mixes
    the new shell with the old kit tree. The agent moved the tree into the element's own state.
    Prevent: a sketch on an element may carry the pages `sketch preview` lists under "shows".
  - The kit writes inline styles, so an element's CSS cannot restyle kit markup a page passes in.
  - The product tokens have no warning or danger colour; the warning marker uses the accent.
  - The agent put layer counts back into the tree, though Tom's pick f of the side tree removed all
    numbers. The brief said "keep this structure" but not what the earlier picks decided. Prevent:
    a part's note lists what its picks ruled out, and the brief quotes the notes of the parts it draws.
- Real look round 2 ("Calmer and collapsible", d panel collapse, e full hide, f floating panel,
  from a): `sketch variant --round` closed Tom's seven comments on a, as 26a6baffb intends.
  Friction: `--from a` copies all of a's code, so variant e (chrome hidden) had to delete most of
  it by hand. Prevent: nothing needed now; note it if it recurs.
- Tom on round 2 (2026-10-28):
  - "es ist echt kaum zu erkennen ob an einem frame noch vom ki gearbeitet wird". Studio barely
    shows that an agent still draws a variant. Prevent: a clear in-progress state on the frame
    (label and dimmed frame) until `sketch ready`.
  - "doof dass wir die 2te round jetzt einfach hinten dran rendern anstelle darunter". Studio
    renders a new round to the right of the old one. Prevent: each round is its own row, newest
    below (or on top), with the round title.
  - "e ist ein zustand von d quasi". The agent's brief made a state (UI hidden) a variant; variants
    must be alternatives, a hidden mode is a further state of the picked variant. Prevent: the
    skill says a variant never stands for a state of another variant. Tom merges f.
- Round 3 "Smaller tree type" (g 12 px, h 11.5 px denser, i 11 px with muted groups, all from f):
  - Tom: "werden meine kommentare nun eig beantwortet und dann gelöscht vom agenten in einem zuge?
    ... eigentlich wäre es smart wenn wir comments eher resolven damit man auf diese zurückgreifen
    kann". `inbox done` and `sketch variant --round` delete the comment file, so the thread and its
    answer are gone. Prevent: close means resolve. The thread keeps its file with `resolved` (who,
    when, the note or the round that answered it); the inbox and the open-comment merge gate skip
    resolved threads; Studio shows them hidden by default, behind a "show resolved" toggle.
  - `design sketch variant --help` runs the `--by` check and prints the usage of all sketch
    commands. Prevent: `--help` skips the checks and prints the usage of that one command.
- Round "Hidden panel" (a new state `hidden` on the merged shell, variants a, b, c):
  - Tom: "wieso zeigen wir bei system eig nun 4 mal das gleiche an? wir arbeiten nun ja an
    hidden". The matrix draws every state of every variant, so the unchanged `system` row repeats
    the current part four times and pushes the state under work down. Prevent: a sketch knows which
    states it works on. A state whose render is the same as `current` in every variant folds to
    one thin row ("system · unchanged in a b c"), which opens on a click; the sketch view starts
    on the changed states. The CLI can find "unchanged" by a hash of the rendered HTML per state.
  - Tom on the first draft (chip, pill, strip): "ich dachte der button hier zeigt den explorer bei
    klick einfach wieder", the active section bubble in the rail is the toggle, like the VS Code
    activity bar. The round was redrawn: the panel is gone, and the variants differ only in the
    cue on the active bubble (a none, b no fill, c short bar). Prevent: the agent's brief named
    three new controls and never asked whether an existing control already does the job; the skill
    could say "look for a control that already does it before you draw a new one".
  - `sketch variant <part> a --round ...` on a part with no open sketch printed
    `NO SKETCH on elements/shell-main in studio`; the start is `sketch new --variants a,b,c --round`,
    which has no `--note`, so the round note stayed empty. Prevent: `sketch variant` names
    `sketch new` in its error, and `sketch new` takes `--note`.
  - `design check --tsconfig` does not typecheck sketch variants; the subagent had to rewrite the
    generated `node_modules/.design-explore/system-studio.tsconfig.json` per variant to run tsc.
    Prevent: the check covers the variants of the open sketch and prints the tsc output.
- Inbox round on `elements/shell-main` (stopped and discarded): Tom: "wir bauen ja gerade alle
  pages in shell-main. das ist doch quatsch oder? shell-main sollte doch eig eher nur ein element
  sein was die shell beinhaltet? das system fällt doch schon wieder auseinander". The real-look
  rounds put the System page content (tree, canvas frames) into the shell as defaults, and the next
  section went in as a shell state. Fixed: the shell holds only the chrome (states open, hidden),
  the tree and the canvas frames are their own elements, and each section is a page that composes
  them. Prevent: a sketch on an element may not add a state that is page content; the skill says
  "a section of the app is a page, never a state of the shell", and `design check` could warn
  when an element's state differs from another state only inside a slot. Order agreed with Tom:
  all pages first (shell sections as pages), components after.
  - Split (20367eb09) friction: a page cannot pass a child's state as props,
    `partTree.states['components-open']` fails with `TS2345: Argument of type 'Props | undefined'`
    because `states` is a `Record`; the parts now name-export their state props. Prevent:
    `definePart` keeps the state keys in its type, or a `part.state('name')` helper.
  - An element that fills its container (`position: absolute; inset: 0`) has zero size alone, and
    `GET /__design/shot` answered a 30 s Playwright timeout as text inside a `.png` with status 200.
    Prevent: the shot answers an error status with "part root has zero size", and the skill says
    a filling element needs a min-height.
  - Tom on `elements/part-tree` alone in Studio (232 px on an empty canvas): "angenommen ich will
    nun part tree nochmal anpassen dann wäre es gut den auch im page kontext sehen zu können und
    zu kommentieren ... so wird das schwierig die relationen in font size etc im großen ganzen zu
    sehen". Prevent: Studio knows which pages use an element (the import graph), and a sketch on
    an element shows each variant also inside those pages ("in context" rows: `pages/system` with
    the variant swapped in), commentable like any frame. The part view offers the same "used in"
    row for the merged element.
  - Canvas grid of button states x interactions (60ba860f7): a part's `Props` has no `disabled`
    and no `data-et-force`, so `elements/canvas-frames` patches the first tag of the rendered
    markup with a regex to force an interaction. Prevent: `render` takes an optional interaction
    and applies it the way the shot's frame does. The base button's `pressed` swaps the fill
    (filled looks outline, outline and tonal look filled): that is the toggle look of the mock,
    to settle in the components phase.
  - Tom on the 3x6 grid of separate frames: "sieht nett aus aber da geht noch was. wir müssen bei
    so einzel components von den frames wegkommen. es kann ruhig 1 frame sein in dem alle sind".
    One frame per state x interaction cell is noise for a small component. The design drawing now
    puts all 18 buttons in one frame. Prevent: Studio's own part matrix does the same for small
    parts: one frame per part (or per state) with the interactions laid out inside it, captions as
    a header row and a first column; separate frames only for parts that fill a page width.
  - One-frame grid (194b8280c): `var(--space-8)` does not exist (the scale ends at `--space-7`),
    and the padding silently became nothing; only the shot showed it. Prevent: `design check`
    flags a `var(--token)` that no tokens file defines and that has no fallback.
  - Tom on the tree after the one-frame grid: "die filled,outline,tonal in der sidebar, machen die
    jetzt noch sinn? hilft das?" They did not: all three opened the same frame. Tom chose: the tree
    lists frames, not states. A part drawn in one frame is a leaf (`button`); the frame's captions
    are the navigation, and no row caption is marked selected. Prevent: Studio builds the tree
    children from the part's frames, so a one-frame part never shows children.
  - Inbox page sketch round (`pages/inbox`, a flat list, b grouped by part, c cards with the first
    reply), friction from the subagent:
    - Only `side` is open to a page, so a "show resolved" switch in the panel header or foot is a
      bar drawn inside `side`, with negative margins. Prevent: `shell-main` slots `sideHead`,
      `sideFoot`.
    - `canvas-frames` takes no overlays, so the page places comment pins by a regex on
      `st-canvas-cell`; a class rename breaks it silently. Prevent: an `annotations` prop
      (state x interaction to markup).
    - `sketch new pages/<x>` scaffolds an empty `definePart<Record<string, never>>`, though every
      page composes the shell. Prevent: `sketch new --like pages/system`.
    - A variant cannot import a sibling variant, so a, b and c copy the same comment data, switch
      and pin code. Prevent: a per-sketch `shared/` folder.
    - The checks print only `ok`; the agent opened every PNG and tiled states with PIL itself.
      Prevent: a shot option that tiles all states of a variant into one image.
    - `sketch new --help` prints a "needs --by" error, then the usage of every `sketch`
      subcommand. Prevent: per-subcommand `--help` without the error line.
  - Tom merged variant a, then on its data: designers commenting at each other ("32 px abgleichen
    bitte") is unrealistic. Studio replaces Figma; a thread is an exchange between a human and
    the AI, and the human writes for the AI. The one human-to-human case is a teammate QC pass:
    many comments pushed at once, for someone else to work off or answer. The page data now shows
    Claude's replies, Tom's instructions and a QC pass. Prevent: the briefing for any
    comment or inbox drawing states this model, and sample data follows it.
  - Each element's CSS imports the tokens, so a page carries them once per child. Harmless now;
    the render could de-duplicate identical style blocks.
- Building the findings with parallel subagents (2026-10-28), friction:
  - `git commit -- <paths>` refuses an untracked file, so each new changeset needed `git add -N`
    against the "never git add" brief. Prevent: the commit rules say how to commit a new file
    (`git add -N <file>` for that one path, then `git commit -- <paths>`).
  - The Studio subagent fed `git diff --name-only` to prettier and `eslint --fix`, and so touched
    the CLI subagent's `check.ts` in the shared checkout. Prevent: a tool run names the paths it
    changed, never a list from git.
  - Typed state names (1c3ef2d71) hold only for `definePart({ states, render: (props: Props) => … })`;
    a `definePart<Props>(…)` part compiles but keeps the loose `states`, because TypeScript infers
    no partial type arguments. Prevent: a lint or check that flags the explicit type argument.
  - The design assets under `libs/cli/design/` are excluded from eslint. Prevent: lint them too.
  - Tom's design server on :4402 runs from `dist`, so an agent's `nx build cli` changes what Tom
    sees mid-session. Prevent: agents build into their own out dir, or the server pins its build.
  - Element in context (00f21b83e, ae2b82f62): the newest round stays dimmed while the sketch is
    in progress, so an agent cannot judge its own variant in context before `sketch ready`.
    Prevent: dim only in Studio, never in the agent's shot, or a Studio toggle to look anyway.
  - "Used in" and the context band show only pages of the same product, though `usedIn` also
    names pages of products built on it.
  - `design serve` reads `serve` as a checkout path (serving is plain `design`), and
    `sketch discard` needs `--by` while `sketch new` does not. Prevent: one rule for `--by`, and
    an unknown subcommand is an error.
  - Small-part grid (4dbfb0f4b) and tree from frames (4f5bf7811): the server has no frame page
    that draws many cells, so Studio loads one `frame.html` iframe per cell. Prevent: a grid
    frame page on the server, if the iframe count gets slow.
  - The `sdk` button failed to load on a cold server: a 60 s Vite `fetchModule` timeout on
    `libs/components/design/button.ts`. Not reproduced on a warm server; watch for it.
  - The `__TAURI_INTERNALS__` stub for headless Studio checks lives only in memory notes, so each
    agent writes it again. Prevent: a stub helper in the repo, next to the Studio e2e setup.
  - tsc on `tsconfig.app.json` does not check Angular templates; only the dev server caught a
    template type error. `nx serve` beside Tom's serve needs `NX_WORKSPACE_DATA_DIRECTORY`.
- Sketches page round (`pages/sketches`, a stacked rounds, b round switcher, c matrix), friction:
  - `@system/...` imports from a helper file in a part folder fail at render ("Failed to
    resolve") while tsc accepts them. Prevent: resolve `@system` for every file in a part folder.
  - A page cannot import a page (UPWARD-DEPENDENCY), so "in context" rebuilds `pages/system` from
    its elements and can drift. Prevent: a helper that embeds a page.
  - Bug: the render check keys `checks.skip` by part only (`render-check.ts` ~260), so the last
    loaded variant wins. Prevent: key it by product, sketch and variant.
  - Sample data and agent logos are copied into each variant. Prevent: a per-sketch shared file.
  - The scaffold's empty `default` state reports ZERO-SIZE, and `sketch report` prints nothing.
  - The base SDK button draws in SDK blue inside the Studio chrome, so the pick buttons look off
    the Studio palette.
    Cause: `foundations/tokens` sets `--et-color-primary*` to SDK blue and lacks the accent
    mapping of `apps/ethlete-studio/src/styles/sdk-token-map.css`. Round 2 carries the mapping in
    each variant's `sketch-data.css`; the merged `foundations/tokens` needs it through a sketch.
  - Round 2: `design check --tsconfig` said ok while `sketch check` found TS2322 in all three
    variants, so 3b56750ec does not cover this case. Prevent: one typecheck path for both.
  - `sketch variant --round` resolves the comments on the `--from` variant, and then
    `comment reply` refuses them, so the agent cannot say what it changed. Prevent: allow a reply
    on a resolved comment, or `sketch variant --reply`.
  - `sketch report` without `--product` fails. Prevent: take the product of the open sketch.
- Side tree sketch round (`pages-system`, variants a flat grouped list, b collapsible tree, c list
  with status columns), friction:
  - `design check --lint <files> --tsconfig` printed `ok` on variant files with TS2322 errors;
    only `sketch check` found them, and the shot rendered fine. Prevent: `design check` types the
    sketch folders too.
  - `box({ padding })` is typed `number`, but the runtime accepts `'4px 8px'`, so per-side padding
    renders and then fails the typecheck. Tree indentation needed spacer boxes. Prevent: accept
    `[y, x]` or per-side padding, or an `indent` option.
  - The missing row `align` hit again: a 13 px heading sits 1 to 3 px above an 18 px badge, and a
    dot in a column box sticks to the top. Every label was nudged by hand.
  - No selected-row look, no `justify`, no muted text: the agent used a bordered box for the
    selection, an empty `grow` box as a spacer, and small headings for all secondary text.
    Prevent: a kit `listRow(label, { selected, depth, trailing })`, a `spacer()`, a
    `text(value, { muted })`.
  - No `warn`, `comment` or `edit` glyph; `glyph: '!'` works only because an unknown name draws
    its first character. Prevent: add the glyphs, and reject an unknown name.
  - A variant that is reported as in progress still renders in `/__design/shot`, though the skill
    says a report hides its frames. Prevent: the skill says what a report hides, and where.
  - Only variant a got `authors` in `sketch.json`; b and c, made by the same `sketch new
--by`, have none. Prevent: `sketch new` writes the author on every variant.
- Side tree round 2 ("Fewer numbers", variants d, e, f from b), friction:
  - `icon({ glyph: '!' })` draws its fallback letter at 60% of the icon, so a 14 px marker shows an
    8 px "!". Prevent: a kit `warning` glyph or an `attention` marker.
  - `heading` sets its font on the `h2`, so a wrapper can fade a count but not lighten its weight.
    Prevent: the muted `text()` above.
  - Every CLI usage line prints `yarn et design ...`, which fails here (see round 2 of the shell).
- Tom picked variant f of `pages/system` in Studio (2026-10-28). The sketch kept status `ready`
  with `decision: pick`, and nothing merged. The inbox then printed
  `run: yarn et design sketch merge ...` as the agent's task, but the skill says "Studio merges on
  the user's click. Never run `sketch merge` yourself". The agent cannot tell which one is wrong.
  Prevent: one rule. Either the pick merges in Studio, or the inbox and the skill both name the
  merge as the agent's step after a pick.
- The merge refuses while a comment is open, so Tom had to withdraw his own comment on b before he
  could merge f. Tom: "es ist nervig dass ich immer die kommentare withdrawen muss um eine variante
  zu mergen". The agent answered the comment with a new round but never ran `inbox done`, and
  nothing reminded it. Prevent: `sketch variant --from <v> --round` closes the open comments on
  `<v>` with the round note, and a pick in Studio closes the comments of the sketch it merges.
- The merge of f wrote the bare note `'f'` again and removed `madeBy` from `pages/system`, because
  variant f had no `authors` (see the missing authors above). Prevent: a merge never drops
  `madeBy`, and `sketch variant --by` records its author.

Findings:

- A flow in `<product>/flows/` that names a page that exists only as a sketch fails `FLOW`, and
  `sketch merge` runs that check, so it refuses every page merge. A sketch cannot carry a flow.
  Fix: a sketch can carry its flow changes, and `FLOW` resolves pages against the sketch too.
- A product has no place for the inventory (only legacy calls have `inventory`); nothing reads
  `studio/inventory.ts`. Fix: decide in a grill whether a product needs an inventory at all;
  until then, an agent writes none.
- Parts and variants have no cost field; the cost line goes into the variant `note`. Fix: a
  `cost` field on a variant, shown next to the pick in Studio.
- Only pages may import the kit, so a rough shell element cannot exist; each page repeats the
  shell, and a shell pick has to be copied to every page. Resolved: elements may use the kit
  since `elements/shell-main`.
- The agent cannot see whether a state fits its preset frame. Nothing in the CLI reports the
  drawn height of a state, and `et design check` does not fail on overflow. The matrix state of
  `pages-sketch` was 992 px in the 900 px desktop frame; after the fix to 128 px cells, only
  Tom's look in Studio showed that it fits. Rec: `et design check` (or a `design shot --report`) names every state
  taller or wider than its frame, so no agent has to start a server and measure by hand.
- `pages-sketch`, `pages-inbox` and `pages-flows` each hold one variant (`a`), so Tom has nothing
  to pick. The skill asks for two to four variants per question, but nothing enforces it: the
  builder passed `--variants a` to `sketch new` after the shell pick, and treated each page as
  "draw it on shell b", not as a question. To stop it:
  - `et design sketch new` refuses fewer than two variants, and `sketch ready` and `check` fail
    on a ready sketch with fewer than two.
  - Each builder or subagent prompt for a sketch names the question of the sketch and its two to
    four answers before any drawing starts. A pick upstream (the shell) does not make the page
    below it a one-answer sketch.
  - One open sketch at a time, as the skill's rule 1 says. Three page sketches with up to five
    states each put about ten screens in front of Tom at once.
- The `sdk` base gives `studio` a phone preset that a desktop-only app does not need.
- A kit page cannot fill the frame height without custom CSS.
- `--round` on a one-variant `sketch new` still needs a title.

As built (2026-10-27):

- Flows on sketch-only pages, 5106b71c8, be8e6a1f4, 58af3f149: rule `FLOW` checks a frame whose part the
  product lacks against the first variant of that part's open sketch; a name that exists nowhere still
  fails. Studio's Flows view draws that variant (`flowFramesOf` takes the sketch list). The four flows
  moved from `drafts/` to `studio/flows/`. Proven headlessly: `read-a-flow` draws `pages/flows` and
  `pages/inbox` from their sketches.
- Kit in elements, dd6e4c490, 37ac923d2: `WIREFRAME-KIT` fails components and foundations only. New
  element `elements/shell-main` (shell b: top bar, side list, content, panel and overlay on demand);
  `pages/system` imports it and drops its own CSS. The three page sketches still draw the shell inline
  and need a redraw on `shell-main` once Tom picks. Studio lists kit pages under "Wireframes", not
  kit elements.
- Own sizes, 0e9c30133: no code change; a product's own `presets` already replace the base's whole.
  `studio` lists `desktop` (1440x900) alone. No note, flow, part or sketch named phone or 390.
- Kit fidelity, 261a9bedb, b8f3258fc, 3baeae901, f81183a80, 21ee366d5: the kit draws `select`, `tabs`,
  `segmented`, `checkbox`, `badge` and `dot`; `box({ fill: true })` is as tall as the frame (`min-height:
100vh`), so `shell-main` drops its `min-height` hack; `icon` is a rounded square with an optional
  `glyph`. Studio labels a sized frame with its state ("comment open · desktop"). `shell-main` and
  `pages/system` use the new controls. The Inbox count stays text inside its tab.

### Flow, tokens and note layout decisions (2026-10-27)

- The design server watches `flows/` like the other files and sends an event, so a flow edit shows
  in Studio without a server restart. As built, e1aa11c2c: `serve.ts` sends a `flows` event when a
  `.json` in a `flows/` folder is added, changed or removed; a flow file no longer rebuilds the parts
  registry. Studio's `flowChanges$` (`host/design-flows.ts`) refetches `flowList`. Finding: the
  server never cached flows (`listFlows` reads per request); Studio refetched only on the tick that
  the Tauri host watcher moves, so the stale view likely came from a headless run.
- Long flow line labels: the gap between two flow frames grows with its label, up to a limit; above
  it the label wraps. A short line needs no extra space.
- A part that uses `var(--et-...)` without importing the tokens draws without them. No check warning
  for now; add one only once it happens.
- A part file that appears or disappears (for example on a merge) keeps redrawing its whole product.
  Narrow it only if Studio visibly flickers.
- `product new` writes `config.json` in the same layout as Prettier, without Prettier as a CLI
  dependency. As built, 1184684eb: `json-layout.ts` (`jsonLayoutOf`) expands objects, keeps an array
  on one line if it fits 120 chars, and puts an array of arrays on many lines. A spec runs the
  Prettier check with the repo `.prettierrc.js`. Gap: long number arrays do not wrap like Prettier
  (none in `config.json` today).
- Slice B as built (each spec fails without its fix; Studio vitest 201, tsc, ngc, eslint; proven
  headlessly):
  - Flow labels, 11adcb4b1 and 109ed97ab: `flow-layout.ts` grows the column gap to fit the longest
    label between two columns, 280 px up to 560 px; label width estimated at 7 px per character, not
    measured. The max label width is the real gap minus margins, divided by the label scale, so a
    label wraps instead of covering frames at any zoom (109ed97ab fixed an overlap at 59%).
  - Matrix notes, 1b9712c10: `layoutMatrix` takes a `below` map; the canvas measures each note
    column after each render and starts the next row below the tallest.
  - Note mode, 806b5e015: `toggleNotes()` also calls `showNotes(true)`, so the remembered setting
    updates.
  - Lab: new `flows/review-a-film.json` (long label), notes `20261027T170000Z-b7c8` and
    `20261027T170100Z-d9e0` on `components/button` solid.
  - Decided (2026-10-27): the matrix reserves note room at zoom 1. Between 25% and 100% the
    counter-scaled cards can still reach into the next row; accepted, because zoom-dependent rows
    would move while zooming and fight auto-fit. Reserve at the fitted zoom only if Tom sees overlap
    on page matrices. Sheet and grid layouts reserve no note room, and right-to-left arc labels keep
    their fixed 480 px limit, until a real case shows a problem.
- Slice A verified by specs that bite (cli vitest 347, Studio vitest 199, tsc, ngc, eslint); no
  headless run against a live server and Studio.
- In the part matrix the gap under a row grows by the tallest note column in that row, so a note card
  never covers a frame or size label of the next row.
- Turning on note mode also turns "Show notes" on, so a new note does not vanish after save.
- The line from a note marker to its card stays right-angled; a straight line would cross the cards
  above. Replaced the same day, see below.

### Flow, wireframe and note decisions (2026-10-27)

- Comment mode works on the flow canvas, built with slice 6c. A comment on a flow frame belongs to
  that state, the same as a comment on the part canvas.
- Studio remembers the picked flow preset per flow in the view state, like the size pick of the
  sketch matrix.
- A wireframe page may import real elements and components next to kit parts, so it grows into a
  page step by step. Only a kit import outside `pages/` fails.
- A state note shows on every rest frame of its state, at every size.
- A note point is in CSS px and may shift between widths, the same as a comment point.
- A free note without `at` stacks above the flow; a note created by a click always gets `at`.
- A flow file write re-serializes the whole file in the standard JSON layout; accepted.
- Moving a note (drag to a new point or `at`) comes in a later slice; until then delete and create
  again.
- Notes whose state is gone get a list later, like stale comments; until then the `NOTE` check
  reports them.
- No control removes a free note's `at`; delete and create again does the same.

Flow comments and preset, as built (bc8801096, proven headlessly 2026-10-27: pins on flow and part
canvas, the other-size note, exclusive Comment/Note modes, a flow comment stored as
`{part, state, size, point}`, no comment on empty flow space, the preset kept across reload and
flow switch):

- A flow frame's place is `{ part, state, size: <preset> }`, the same as a rest frame at that preset,
  so a flow comment uses the same store and pins on both canvases. On the flow a pin shows only
  while its preset is picked. Comment (with count and questions) sits next to Note in the flow bar;
  the modes are exclusive; `c` toggles. A sidebar click on a comment that pins on the shown flow
  opens it there. Lab: `comments/20261027T150000Z-f1a0.json`.
- The preset is remembered per flow as `ViewState.flowPresets["<product> flow:<name>"]`, else the
  previous pick, else the first preset.

### Wireframe kit fix decisions (2026-10-27)

Seen on `studio-lab` `pages/film-detail` at phone 390: image and text stay side by side, the button
sticks out with a horizontal scrollbar, the title is light on light, the input placeholder wraps.
Causes: a kit row never stacks and the page gives the image 220 × 320 px; kit parts set no text
colour, so text inherits the product colour; the kit button has `white-space: nowrap`.

- A row `box` takes an explicit `stackBelow: <px>`; below that width it stacks its children. It is a
  container query on the box's own width, so a row in a narrow column stacks too. The kit renders
  the container. Risk: `container-type: inline-size` drops the intrinsic width, so a fitted frame
  can collapse; prove a page in a fitted frame.
- Every kit `box` sets the kit text colour, so text between kit parts stays kit grey. The kit gets
  `heading(text)` for titles.
- `image` takes `ratio` (for example `'2/3'`) and fills the width. The kit button is at most as wide
  as its space and ends its text with "…". The design-exploration skill teaches `ratio` and
  `stackBelow` instead of fixed px.
- The builder then fixes `studio-lab` `pages/film-detail` to use them.

Wireframe kit fix, as built (kit 2dc8bd572, skill ae6a590ca, film-detail 2c20cbd63, proven
headlessly):

- `box` takes `stackBelow?: number` (rows only); every box sets the kit ink colour. A stacking row
  renders an outer box with `container-type: inline-size` and
  `contain-intrinsic-inline-size: <stackBelow>px`, a scoped `<style>` with an `@container` rule keyed
  by threshold (nested rows do not clash), and an inner flex row. Rows without `stackBelow` are
  unchanged. Without the intrinsic size a fitted frame collapsed the row to 122px; with it the row is
  560px wide and stays a row.
- `heading(text, { size? })` is a kit-grey `<h2>`, escaped, long words break. `image` `ratio?` sets
  `aspect-ratio` and fills the width; every image has `max-width: 100%`. The button has
  `max-width: 100%` and its label ends in "…". The input placeholder also ends in "…" instead of
  wrapping. Kit count 12 → 13.
- film-detail: heading, image `{ width: 220, ratio: '2/3' }`, `stackBelow: 560`. Phone 390 is a
  column without horizontal scroll, title `rgb(107,107,107)`, buttons inside the width; desktop is a
  row.

### Wireframe kit follow-up decisions (2026-10-27)

- In a fitted frame a stacking row is exactly `stackBelow` wide, even if its content wants more.
  `stackBelow` is the width the author says the row needs; a wider row needs a larger threshold.
- A stacked image keeps its `width` cap. For a full-width image on phone, the author drops `width`.
  No hidden rule widens images in a stacked row.
- The input placeholder ends in "…" instead of wrapping, like the button label. Kept.

Fitted-frame resize loop, fixed (60bd969e9):

- Seen on `studio-lab` `elements/shell-main`: the frame shrank, jumped back and shrank again.
  Cause: the part uses `min-height: 100vh` and a fitted frame adds 16px padding on each side, so the
  content is always 32px taller than the frame. Studio sized the frame to the content, the content
  grew 32px with it, endlessly. The growing frame zoomed the canvas out; below zoom 0.5 Studio
  swapped in the 832px screenshot, zoomed back in, went live, and the loop started over. The
  overflow also caused the scrollbars. The width stayed 259px.
- Fix in the measurement, not the part: Studio drops a measure that repeats the overflow it caused
  itself (real content changes are still followed). `frame.ts` reports its viewport size and hides
  overflow in fit mode.
- Limit: a `vh` part in a fitted frame has no true size. It settles about 32px taller than its
  start, and the live and screenshot heights can differ (632 vs 832).

Notes server, as built (2026-10-27):

- 07d73981c, lab 948a7793b. The reader existed (c618028b5); its check rule is now `NOTE`. A state
  note is `notes/<id>.json` `{ part, state, point?, text }`, the point in CSS px. A free note sits in
  the flow file as `notes: [{ id, text, at? }]`, `at` the top left on the flow canvas, may be
  negative. A write rewrites only `notes` and keeps the other keys and their order, but the file is
  re-serialized with the `JSON.stringify` layout. `FLOW` also reports a misshaped free note and a
  duplicate id; `createNote` refuses a missing part or state.
- Endpoints: `GET /__design/notes`; `POST` `note`, `note-change`, `note-delete`, and `flow-note`,
  `flow-note-change`, `flow-note-delete` (`?flow=`). `/__design/flows` includes the notes. A change in
  `notes/` sends a `notes` event and redraws no part.
- Studio half, 22510314b, proven headlessly (create, change and delete through the UI; a free note
  appended to `flows/sign-in.json` with `at`). Open: at low zoom the note cards of the phone and the
  desktop frame overlap. a state note shows on every rest frame of its
  part and state, at all sizes, not on interaction or sketch frames. With a point: a small square
  marker and the card beside it; without: a column of cards below the frame. On the flow canvas,
  free notes are large bold headings at `at`, or stacked above the top left of the frames. Cards
  always show their text, with a dashed surface border, scaled like line labels. A "Note" toggle
  sits next to Comment and in the flow bar; the two modes switch each other off. In note mode a
  click on a frame makes a pointed note, on a caption a note on the whole state, on empty flow
  space a free note. A click on a note opens Save, Delete and Cancel.
