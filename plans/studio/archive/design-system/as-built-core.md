# Archive: as-built logs, core, canvas, tokens, foundations

### Slice 2 server, as built (2026-10-27)

- Endpoints: `GET /__design/system[?product=]` (parts list with origin, note, states,
  problems), `GET /__design/shot?product&part&state&preset[&surface&color]` (PNG),
  `GET /__design/calls` (Legacy list), `POST /__design/transfer?call=<slug>`.
  `et design system --json [--product]` prints the parts list through the same Vite setup.
- A frame shows a part state with `?product=&part=<layer>/<name>&state=`. `?call=` still works.
- A base part is a separate module in each product (`<file>?design-product=<name>`). This is how
  an override reaches inside base parts.
- Part problems in the list are the rule problems plus `LOAD`. `tsc` errors are left out: they
  take seconds per product.
- Shots: viewport = preset width × preset height (800 px without one), full page, device scale 1.
  The cache drops a shot when its file or a file it imports changes (Vite module graph).
- Studio's Rust watcher already watches `.ethlete/design`. No new reload event.
- Not yet tested on its own: the switch of `ng()` providers to the frame's product.

### Slices 4 and 5 core, as built (2026-10-27)

Commands: `et design sketch new|report|ready|list|check|preview|merge|discard`,
`et design inbox [done <id>]`, `et design comment`. Code in `libs/cli/src/lib/design/system/sketch/`
and `system/comments/`. Studio UI for both slices is not built.

- `sketch.json`: `{ target, status: "in progress" | "ready", createdAt, decision? }`. The
  decision is `{ kind: "pick", variant }` or `{ kind: "discard" }`, with an optional comment.
  Merged and discarded are not stored: the folder is deleted.
- A variant folder is `sketches/<layer>-<name>/<variant>/<layer>/<part>/` and may hold a
  `fixtures.ts`. A new variant starts as a copy of the resolved target, a new part as a stub.
- A variant may change the target, its own layer and the layers its layer may use. Anything else
  is a `SKETCH` problem.
- `ready` only from in progress; nothing moves back. A pick needs `ready`. A discard is allowed
  at any time.
- Merge needs `ready` and a `--note`. It does not compare the variant with the user's pick. Each
  variant part folder replaces the product folder whole. The note goes into the product's own
  target file, so a target that exists only in the base cannot be merged yet.
- Open-sketch problems do not fail `et design check`, so one broken sketch does not block every
  merge. `sketch check` reports them.
- Comment id: UTC timestamp plus 4 hex characters. The stale rule also fails on a missing
  preset, sketch or variant, and on an unreadable comment file.
- The live agent report is a call status at slug `sketches/<product>/<layer>-<name>`, state
  `drawing`, in the temp status folder.
- Not served yet: `mergePreviewOf` and `openSketchProblemsOf` need endpoints in `serve.ts` for
  Studio.

### Studio system view, as built (2026-10-27)

`apps/ethlete-studio/src/app/system-view/` (0b28379f7). The pure part is `system-tree.ts`.

- It reads `/__design/system` from the checkout's design server, and reloads on each change of
  `.ethlete/design` and each server restart. JSON answers carry `access-control-allow-origin: *`
  (badefe639).
- Tree groups follow the layers: Foundations, Components, Elements, Pages. Sketches and Legacy
  follow. An empty group is hidden.
- Badges: "from base", "overridden", and "error" for any problem.
- A part's canvas has one row per state and one frame per preset (replaced: see "Frame size
  decisions"). Only a `LOAD` problem replaces
  the frames with the error. A part with a rule problem still renders and shows the badge.
- A shot URL carries the change revision, so a picture is fetched again after a change.
- No command creates a product. The empty state shows a `products` example for `config.json`.

Open points, each with a recommendation:

- Product picker: decided, see "Picker decisions".
- Themes per product: done. The server lists `themes` per product (5a16985e5), and Studio
  remembers the pick per checkout and product.
- A command that creates a product: done, `et design product new <name>`. The empty state shows it.
- The selected part over a reload: done, Studio remembers it as `systemEntry` (25837501a).

### Slice 10 foundations, as built (2026-10-27)

- Frame border above the content: 843034c8f. Headless at DPR 1.25 / 67 % all four edges show
  (before: bottom 0, right 10); strength stays uneven (13 to 40). Not checked: the dashed active
  border, Tom's window.
- Tom merged in Studio, the builder committed each merge: surfaces A neutral grey (863901225),
  accent C teal, oklch(0.68 0.11 190) with dark `--on-accent` (46a83c113), type scale B compact,
  13 px base, `--text-sm` 11.5 px kept as merged (b371ecf31), spacing and radius B balanced, 4 px
  grid, radius 4/6/10, controls 24/28, row 24 (dec74dc6e).
- A Studio merge counts as the go to commit the merged part, not the open sketches (skill,
  7fe17018a).
- Each merge replaced the part drawing with the variant's demo scene, so the tokens page showed
  only the last round. `tokens.ts` is now an overview with the states surfaces, accent, type and
  spacing, values read at runtime (6b3b86c44). Skill rule: a sketch on a foundations part keeps the
  overview and adds its group as a state (6b95e620d). Tom checked the overview in Studio (2026-10-27): all good.
- Next: Studio reads its tokens from the merged `tokens.css`, then the slice 10 component layer
  (also: map the SDK dark tokens onto the new surface tokens).
- The merged surfaces are committed in 863901225. Open: does a merge in Studio count as the go to
  commit the merged part? Tom assumes it does; the `ethlete-design-exploration` skill does not say
  so. Recommendation: yes, and write it into the skill.

### Studio logo, as built

- Tom merged variant B (stroke S) in Studio; the part `foundations/logo` is aadcffbb9.
- App icon (2173ee0b1): `apps/ethlete-studio/src-tauri/app-icon.svg` is the source, with the
  tokens resolved to literal colours (`--accent` #25aea7, `--on-accent` #051211). `npx tauri icon
src-tauri/app-icon.svg -o <tmp>` from `apps/ethlete-studio`, then copy only the six files
  `tauri.conf.json` lists. The 32 px PNG still reads as an S.
- Sidebar (e4c73e961): `StudioMarkComponent` draws the mark with `fill-accent` and
  `stroke-on-accent` beside a "Studio" label at the top of the system view's sidebar.

### Component layer: SDK tokens mapped, as built (2026-10-27)

- Tom's decision (2026-10-27): the component layer does not build on the 3 `sdk` mocks (button,
  form-field, select). Map the SDK theme tokens (`--et-surface-*`, `--et-theme-color-*`, sizes) onto
  the Studio tokens in one place in the app, then check the real components in Studio. A sketch only
  for a component that must look different from the SDK default. The mocks stay as the workflow test
  bed.
- The mapping lives in `apps/ethlete-studio/src/styles/sdk-token-map.css`, imported into a layer
  `studio-sdk` after `components` (below `utilities`). `ColorTheme`/`SurfaceTheme` accept only
  literal `R G B` channels, so `themes.ts`/`surface-themes.ts` and the generated CSS stay; the map
  overrides the channel vars with relative colour syntax (`from var(--surface) r g b`), which the SDK
  wraps in `rgb(…)`. Theme names unchanged.
- Mapped: surfaces `dark`, `dark-elevated`, `dark-elevated-2` → `--surface`, `--surface-raised`,
  `--surface-overlay`; text, muted and subtle → `--text`, `--text-muted`; border → `--surface-border`;
  interaction → `--text-muted`/`--text`. Colour `brand` → `--accent`, `--accent-hover`,
  `--focus-ring`, `--on-accent`, `--accent-text`; disabled is a 40 % oklab mix with `--surface`.
  `danger` keeps its literal red. Sizes: button `sm`/`xs` → `--control-md`/`--control-sm` height,
  `--text-md`/`--text-sm`, `--radius-control-md`/`-sm`; form-field → `--control-md`/`-sm` min height,
  `--text-md`, label `--text-sm`, `--radius-control-*`, padding `--space-1`/`--space-2`; select
  option → `--text-md`, `--radius-control-sm`; tree node radius → `--radius-control-md`.
- Found and fixed: the `@theme inline` entries whose name equals the token (`--font-ui`,
  `--font-code`, `--radius-control-*`, `--radius-pill`) were emitted as `--x: var(--x)` once used, so
  the token was invalid at runtime. They now sit in `@theme inline reference`.
- Proven: `styles.spec.ts` finds the mapping in layer `studio-sdk` (fails without the import) and no
  self-referencing token. Headless (own build and design server): the accent resolves to #25aea7, a
  `sm` button is 28 px with a 6 px radius, the new-product fields 13 px. Screenshots
  `/tmp/st-shots/map-{before,after}-*.png`: teal replaces mint, controls are smaller and denser.
- Class swap, as built: the app templates and `styles.css` use the Studio tokens where one matches
  directly (`bg-surface`, `bg-surface-raised` in the two `dark-elevated` containers, `text-text`,
  `text-text-muted`, `border-surface-border`, `text-accent`/`bg-accent`/`ring-accent`, `text-on-accent`,
  `var(--accent)`). Proven headlessly: computed colours of every element in six views (landing,
  comments, sketch, flow, wireframe, checkouts) are identical before and after.
- Left on the SDK names, no direct Studio token: subtle text (`--et-surface-color-subtle-solid`, 23
  uses), surface interaction (the `color-mix` hover and tint backgrounds), the `::picker(select)`
  background (follows the surface context), and every `--et-theme-color-*` in an error-themed
  element (no danger token). Context-dependent, so not swapped: `BADGE_ACCENT` (also drawn with the
  error theme) and the comment number badge inside `et-button color="surface"` (grey there, not accent).
- Open: Studio has no token for subtle text, accent active/disabled, danger, or `--surface-sunken`
  as an SDK surface; select option height stays the SDK's 36 px (`--row` 24 px clips two-line
  options); the tree row height and the body font (still Jost, not `--font-ui`) are not mapped; an
  SDK theme type that accepts a CSS colour would let `themes.ts` name the tokens and drop the map.
- Next: the component list comes from the Studio wireframes, not from the current app.

### Studio fixes, as built (2026-10-27)

- d8cee09f4: when a design server that Studio did not start goes away, Studio starts its own
  server and the frames load again. Cause of "Failed to fetch" after a restart: a server left by
  a Studio build before 5e43611f5 crashed with EPIPE on its first log line.
- accd23ecd: the design server reads `config.json` again when it changes, so a new product shows
  without a restart. Still needs a restart: the port, `render.packages`, `render.modules`, and
  the `base` folder of a new product.
- 3f34d1751: Studio remembers the picked checkout across a restart.
- 4c24ef421: the `studio-lab` product in this repo is the test bed for new Studio features. It has
  no themes, no base, no comments and no ready or merged sketch yet.
- d25e8a8b0: the empty space above the sketch frames came from the camera fit centering a short,
  wide layout. The fit now anchors at the top.

### States and interactions step 1, as built (2026-10-27)

- c1c848c75: `definePart` takes `interactions` (`hover`, `focus-visible`, `active`, `disabled`).
  `et design check` fails on an unknown name (`system/rules/interactions.ts`).
- `GET /__design/system` gives `ListedPart.interactions`; empty means rest only. The `targets` of
  `/__design/sketches` carry it too.
- The rewrite is `force-interactions.ts` (postcss and postcss-selector-parser). The server has no
  Angular Vite plugin, so it runs in three places: a PostCSS plugin for every `.css` that Vite
  serves, the `ng()` styles in `/__design/render`, and the `drawing({ styles })` strings, which
  `frame.ts` sends to the new `POST /__design/force`.

### States and interactions step 2, as built (2026-10-27)

- c62f52cd4: the `studio-lab` button has the states solid and outline, the interactions hover,
  focus-visible, active and disabled, and real pseudo-class CSS. This is step 5, done early.
- 37cc9d271: frame and shot URLs take `interaction=<name>`. After mount, `frame.ts` sets
  `data-et-force` on the first element child of `#root`, or `disabled` and `aria-disabled` for
  disabled. The shot cache keys on the interaction.
- 95764db02: a fitted part uses the matrix arrangement. `partColumnsOf` gives rest plus the declared
  interactions; the rest column keeps its old frame ids. A headless check confirmed each column
  through computed styles.
- A page, or a part with `widths`, that declares interactions keeps the sheet layout: each
  interaction is drawn at every size in the state row ("320 · hover").

### States and interactions step 3, as built (2026-10-27)

- 129759c06: the button sketch variants a and b have the states solid and outline and the four
  interactions.
- 5571eee5f: a comment has an optional `interaction`. Rest is never written; a read fills it in.
  `POST /__design/comment` takes it and refuses an unknown name or an interaction that the part or
  variant does not declare. An existing comment of that kind becomes stale. `et design comment` has
  `--interaction`, and an inbox line names an interaction other than rest.
- 97e42bd31: the interaction switch sits next to the size switch. It lists rest plus the
  interactions of the part and of every variant; without interactions there is no switch. Every cell
  takes comments. A pin shows on the matching cell only; other cells say "1 comment in another
  interaction". A click in the sidebar switches to the comment's interaction.

### Studio design pages, as built (2026-10-28)

The design product `studio` (`.ethlete/design/studio/`, base `sdk`) draws Studio itself. The
handoff for this work is `studio-wireframes-handoff.md` next to this file.

- `elements/shell-main` is chrome only: rail, floating side panel, canvas paper. A section of the
  app is a page under `pages/`, never a state of the shell.
- `elements/part-tree` lists frames, not states. A part drawn in one frame (`button`) is a leaf.
- `elements/canvas-frames` draws the base button in one frame: rows filled, outline, tonal;
  columns rest, hover, active, focus-visible, pressed, disabled; every label reads "Save".
- `pages/system` composes the three.
- `pages/inbox` (variant a, flat list, merged): newest first, in two groups, the part on the
  canvas on top and "Andere" below. A bar holds the open count and "Erledigte zeigen". States:
  `open`, `with-resolved`, `active-only`, `active-clear` (the active part has none, others
  have some), `all-clear` (an empty state). The canvas shows a pin on each commented cell.
- Inbox data follows the comment model: a human writes for an AI agent, and the agent answers. The
  one human-to-human case is a teammate QC pass. Agents are mixed (Claude, Codex, Gemini) and show
  their provider logo (`pages/inbox/agent-logos.ts`).
- Every edit after the inbox merge (tree leaf, data, groups, three states, agent mix, logos) went
  straight into merged parts, without a sketch. Tom: "das wir hier nun so viel ohne sketches
  gemacht haben geht eigentlich auch irgendwie gegens system". The cause: a round asks for two to
  four alternatives, and a small fix has none, so the agent skipped the round. Decided (Tom, A):
  every change to a merged part is a sketch; with nothing to choose, it has one variant. The
  `ethlete-design-exploration` skill says so. Prevent: Studio flags a merged part whose files
  changed outside a sketch merge.
- Next pages, paused by Tom on 2026-10-28: Sketches (variant matrix), Flows, merge compare. Then
  components, then page states, then the build into the real app.
