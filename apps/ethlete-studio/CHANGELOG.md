# ethlete-studio

## 0.2.0-next.15

### Minor Changes

- The design system listing flags a base part no part of the product imports with `unusedInProduct`, and Studio lists those parts in a folded "Not used in <product>" group.
- A part in the system view gets a "Go geben" button and, after a direct edit of a merged part, an "Änderung abnehmen" button; a refusal shows in German in place.
- Studio draws the new shell (rail, product switch, project picker) around every view, and its Inbox section lists the live comments of the product in place of the old comment panel.
- The sketch view renders one round at a time; a select above the canvas switches between the rounds, and the newest opens first.

### Patch Changes

- The design server's comments list carries the checkout's `git config user.name`, and the Studio inbox shows it as the author of the user's comments instead of "Du".
- The design control inventory marks a control another element fully covers as covered. Studio lists it but draws no outline or number badge for it.
- `et design compare` shoots a fitted part without the frame padding, and draws a `pages` part at a product preset (`--preset`, default the first) against a harness host that fills that viewport (`layout=page`).
- The live spec gets a fit state for the System page and a 100 % state for the Sketches page.
- The design harness records each output the mounted part emits, for `et design actions`.
- The inbox shows the canvas with the system page's frame and zoom chip.
- The open-points popover on the System page uses the UI font.
- Remove the chat panel, which no page design shows.
- Remove the chrome no page design shows from the System part view: the changed badge, the authors, the theme switch, notes, comment mode with its pins and drafts, the motion strip and the new-product screen.
- The System part view drops the "used in" frames, labels a part frame with its bare name, and orders the part tree Foundations, Elements, Components, Pages as the page design does.
- A page's control inventory lists the controls an embedded part draws as `owned by <part>`. They no longer vanish, and they do not block the approval.
- A page's inventory numbers two controls at the same place apart by their label, and the list shows each label.
- The Aktuell cell of a state that is new in a sketch names the states the merged part has, in larger text.
- A click on the active item of the navigation rail now hides the sidebar, and another click shows it again. Enter and Space on the item work the same way.
- Write the Tailwind classes in the Studio app in their canonical form.
- Keep the zoom chip at the canvas's bottom right on System and Inbox, and keep the canvas focus ring off after a pointer click until focus leaves.
- The canvas draws comment pins with the comment pin component: the latest sender's initials or agent logo and the reply count.
- Add the canvas frames component (`design-parts/canvas-frames`) for the `elements/canvas-frames` design part: the projected frames in a zoomed column of the canvas viewport, with the zoom chip in the corner.
- The design harness can size the canvas-frames part through a width class.
- The canvas keeps its camera when the panel hides or the window resizes. An opening fit fits again only when the frames change; a fit or focus you ask for still follows the canvas size.
- Draw no row label left of the frames on the System canvas, as the page design does.
- A canvas opens at 100 % with its frames at the panel edge, the same view as the 100 % button, and keeps the frames in place when the side panel hides.
- The design canvas draws no focus ring after a pointer click, only on keyboard focus.
- Space now activates a button inside the system page canvas instead of being swallowed by the pan shortcut.
- The live design canvas is transparent again, so the dot pattern of the page background shows through it.
- The design canvas draws its zoom controls with the zoom chip component.
- The canvas viewport design part draws no focus ring after a pointer click, only on keyboard focus.
- Add the presentational comment pin component (`design-parts/comment-pin`) for the `components/comment-pin` design part.
- Remove dead code: the canvas pointing, notes and draft features, the unused row labels, and the agent run commands of the host.
- Name the shell component in the design live spec, so `et design actions --live` can check the shell controls.
- The Studio logo menu now holds the design server actions (start, restart, stop), the design server stopped screen is part of the shell, and the footer status bar with its server line, render queue, failures and Reload is gone.
- Add the presentational disclosure component (`design-parts/disclosure`) for the `components/disclosure` design part.
- Studio draws its surfaces and accents from the SDK surface and colour themes; the Tailwind colour aliases for surface and accent are gone.
- Removed the unused flow arrangement of the design canvas, its line drawing, and the flow-note write paths of the note store and host.
- The Studio stylesheet drops the unused `surface-hover`, `surface-pressed` and `accent-hover` colour utilities; the design parts use the SDK colour and surface theming instead.
- Studio notifications draw the message at full opacity and the dismiss icon at 0.6 at rest, so both pass contrast.
- The Studio error toast names its input `heading` and its output `dismiss`, so it needs no lint disables.
- Studio shows an error toast when "Projekt öffnen…" picks a folder without design work. The toast is also a design part.
- The flows page camera treats the area under the floating side panel as covered, so Fit, zoom and 100 % start right of it.
- The flows canvas pans by wheel and drag and zooms with the zoom chip, like the sketches canvas. A flow starts at 100 % with its first frame at the left edge, so wide flows are no longer clipped.
- Fill each Flows graph frame through a projected template instead of a fixed iframe.
- Draw the canvas content of the Studio flows page part: header with the preset picker, the flow graph and the empty block.
- The flows page part takes its sample flow names, line labels and size preset from the studio labels.
- Add the Studio flows page component: the shell with the studio menu and the flat flow list around a projected canvas.
- The Flows section now draws the flows page part: the product's flows in the side list, the picked flow as live frames along its lines, a size select from the product presets, and an empty state with a copyable prompt.
- The flows page preset select now has an accessible name, so it no longer raises ET2201.
- Picking another flow on the flows page resets the camera to the opening view instead of keeping the previous flow's pan and zoom.
- Draw every text of the Studio system view in German from `studio-labels.ts`.
- The inbox design part draws the comment editor arrow like the SDK overlay arrow, so its compare is green in every state.
- Add the presentational inbox page component (`design-parts/inbox`) for the `pages/inbox` design part, mounted by the design harness for `et design compare`.
- The Inbox says while its comments load, shows a failed load with "Erneut laden" to retry, and scrolls a list longer than the panel.
- Show a resolved comment's pin, muted and with a check mark, after a click on its Inbox row
- A click on an Inbox comment row, or Enter or Space on the focused row, selects the comment and opens its pin on the canvas, on its own part.
- The inbox draws its rail and panel through the shell-main component.
- The Studio inventory page part draws its own canvas: the Inventory toggle, the approval header with Reload and Approve, the frame with numbered boxes and the control list.
- Pass the part tree `expandedChange` output through the inventory page part.
- The inventory page part takes its German text from the studio labels.
- The inventory page numbers its markers from 0, as the design does.
- Add the Studio inventory page component: the shell with the studio menu and the part tree around a projected canvas.
- The page Inventory draws with the inventory page part, in German.
- Forward the inventory page `expandedChange` output from the inventory view.
- The Studio stylesheet resets the default colours before the generated SDK themes, so `bg-et-surface-*` and the other generated theme utilities produce CSS again.
- The live design canvas is a focusable region named Design Canvas with the focus ring of the canvas viewport part, the comment pin counts every message of its thread, and the accent dot for a waiting question is gone.
- The live compare of the Sketches page starts without a stored sketch entry.
- The studio menu part host no longer paints a surface fill behind the menu.
- The Studio menu panel now sits one surface above the shell instead of two, and its group label uses the UI line height.
- Add the presentational Studio menu component (`design-parts/studio-menu`) for the `elements/studio-menu` design part.
- The Studio logo menu holds the design server actions the server state allows: start, or restart and stop.
- The merge page crops the changed instance from each side instead of a sample button, shows "Neu in <variant>" in the empty "Jetzt" panel of a state the variant adds, and shows the Merge button loading while the merge runs.
- The merge page crop row zooms out until the whole changed instance of both sides fits, and its label shows that zoom instead of a fixed 200 %.
- Default the merge page part crop label to the system page copy prompt label.
- The merge page shows why a merge failed under the Merge button: a stale sketch names the changed parts and asks for a rebase.
- Add the Studio merge page component: the merge panel with the changed list and the unchanged states, and the before and after shots of the selected row.
- Merge on a sketch now picks the variant and opens the merge page part, which lists changed states with live Now/After frames; Back returns to the sketches. The unused pixel-free, variant-diff and changed-area helpers are gone.
- The merge page part shows German text and an optional error line under the Merge button.
- The merge page marks its 200 % preview crops inert, so the copied buttons in them are not controls.
- A changed row on the merge page is picked with Space as well as Enter.
- The merge page draws its Now and After shots as a projected slot that the live app fills with frames.
- The merge view compares a sketch that changes only its own pages, and shows a state the variant adds with only its after picture.
- System and Sketches use the same canvas: left drag pans, a click on a frame selects it, arrow keys pan, a double-click focuses a frame, Space or middle drag pans, and Shift+1/2/0 work window-wide on both pages.
- Every Studio menu draws its items at the control-md height and text-md size, and the logo menu button keeps one corner radius in every state.
- The rail logo opens the studio menu on every page; one shell wrapper wires the rail and panel controls of all pages.
- A sketch opens its first unchanged row by default when no visible row shows a frame of the current part, so the "Aktuell" column is never empty.
- The System page shows the "N offen" chip and its popover for the shown part, read from the design server's open points.
- The open points chip on the System page un-presses when its popup closes, so a second click closes both.
- "Projekt öffnen…" opens the OS folder dialog, and an update installs on the next Studio start without a button.
- Let the canvas of the System and Inbox page parts fill their slot, as the page designs.
- The part tree takes own row keys, a closed part with states, a warning title per part, and reports the open rows.
- Add the part tree component (`design-parts/part-tree`) for the `elements/part-tree` design part, drawn with the tree-row items on the headless tree.
- Press Space on a part tree row to open or close it and activate it, like Enter.
- The project picker closes when the current project is chosen again, and the System rail button leaves an open sketch and shows as current on every page.
- A modifier key press after a pointer click on the design canvas no longer brings the focus ring back.
- The pointer-focus ring rule of the design canvas lives in one shared function.
- The project picker moves focus to its first project when it opens.
- Close the project picker when a project is chosen, including the current one.
- The system view remembers whether it shows a page's control inventory, so a reload keeps the Inventory toggle.
- SDK components, including body-portaled menus, draw in the Studio UI font.
- The design server actions in the Studio menu also work on the System, Sketches, Flows and Inbox pages.
- Draw the claude, codex and gemini logos of the inbox and the comment pin from one shared icon file that the Studio design system also uses.
- Add the shell-main component (rail, panel and project picker) and use it in the inbox.
- The shell rail no longer shows the All products button.
- The Studio shell draws its project switch with the shared project switch component instead of its own copy.
- The Sketches page opens at 100 % on the variant a fit shows nearest the top centre when its design state asks for the 100 % camera.
- The Sketches canvas keeps its frames in place on screen when the side panel hides or shows.
- Write the sketches page child flex rule as a canonical class.
- Pass the part tree `expandedChange` output through the sketches page part.
- The sketches page part shows German text only; its page design needed no text change.
- Add the presentational Sketches page part: the variant frames on one canvas, their heads, the round picker and the zoom chip.
- The sketch view draws the sketches page part; reject/reopen, notes, diff lists and the state matrix are gone.
- A Sketches rail click opens the sketch view with the first sketch instead of the System canvas.
- A selected frame in Sketches now shows the same selection outline as System.
- The Sketches view labels the button above each variant "Wählen"; the merge view keeps its "Merge" button.
- Studio specs fail when a test logs an SDK error (`ET` code), and name each code and message.
- The start page without an open repo no longer draws an empty bordered box above the title.
- With no checkout open, Studio shows the start page without a repo instead of asking to start the design server.
- Add the start page component for the no-repo and no-products states.
- The start page matches its design: Studio font, default colour on the other-repo button, design monospace font for the CLI command.
- On an `et-surface-interactive` element, the `et-surface-interaction` colour utilities follow the hover, focus and active state of the SDK interaction tint.
- Going back to System after picking a flow now picks the first part, so the canvas is no longer empty.
- The system page canvas now fills the whole page and runs under the floating side panel. Fit, focus, reset and zoom treat the area under the panel as covered, so frames still start right of it.
- The System page draws a product without parts with the empty system card, and a checkout without products shows the start page with the repo and a copyable agent prompt.
- The fitted System canvas frame stays centred right of the side panel after the fit is applied.
- Write the system page tree frame width as a canonical class.
- Pass the part tree `expandedChange` output through the system page part.
- The System page design part draws its frame fitted to the canvas for the fit state.
- Add the Studio system page part: the part tree, the frames on the canvas, the open-points chip with its popover, and the empty page.
- Let the Studio system page take the content of its canvas frames through a `shot` template, so the live app can fill them with frame iframes.
- The System view draws its side tree with the part tree component.
- Place the zoom chip of the System part view where the page design draws it.
- The Studio theme CSS names the type of the error and warning colour themes.
- Give the Studio tree rows German labels from one label map.
- The System view draws its part tree with the tree-row design and no longer shows the badges that design has no mark for.
- Add the presentational tree row component (`design-parts/tree-row`) for the `components/tree-row` design part.
- Give the Studio tree-row stack the tree and treeitem roles of the live tree.
- The part tree rows use the menu item text size and grow with it.
- The canvas zoom chip buttons have German labels for screen readers.
- Add the presentational zoom chip component (`design-parts/zoom-chip`) for the `components/zoom-chip` design part.
- "Auf 100 % zoomen" on the System canvas returns to the opening view: 100 %, the frames at the panel edge.

## 0.2.0-next.14

### Minor Changes

- The Studio motion timeline makes the motion's start frame live and drives it: the slider pauses its animations at that time, play and speed run them, closing resumes them at 1x.
- Motion timeline tracks name the foundations duration and easing tokens they use.
- The chat agent gets a Studio brief: check each change with `et design check` and a shot, add no changeset for design files, and use the product type tokens from `foundations/type`.
- A click on a part grid cell selects that state, and the chat context line names it. A sketch selection label reads like `pages/system · desktop (context)`, with no repeated names.
- Chat messages render a markdown subset: inline code, fenced code blocks, bold and lists. Everything else stays plain text.
- Every chat message carries the current view (product, part, sketch, variant, clicked frame), shown as a chip above the input that one click removes.
- A product that declares only one colour scheme draws one copy of each frame, in that scheme and without a scheme label.
- Studio draws every page, declared-width part and flow frame in the light and the dark scheme, side by side under a Light and a Dark label, stacked when the frame is wider than 1024px. Legacy call shots stay single.
- The agent chat is now a collapsible panel on the right of every Studio view that keeps its conversation when you navigate, and follow-up messages continue the same agent session; the separate agent page is gone.
- Studio marks a failed shot as "Render failed", a slow shot as rendering, and says the design server is starting until it first answers.
- Studio draws every merge-preview frame in the light and the dark scheme, like pages and flow frames. The sketch matrix stays one copy.

### Patch Changes

- `et design complete` names a `hover:`, `active:` or `focus:` class no stylesheet defines instead of reporting an unchanged box, and the Studio Tailwind theme gains the `surface-pressed` colour.
- The motion timeline now drives a part drawn as a state grid: it makes the `from` state's cell live and posts to it. Keyframe images load from the design server.
- Changing the motion strip's preset or reduced motion while the timeline is open makes the new frame live. Opening or retargeting the timeline moves the camera to the driven frame and keeps it in view as the canvas resizes.
- A static shot draws in the colour scheme Studio prefers, like the live frames next to it, so a dark Studio no longer mixes light shots into a grid.
- Stop ends every process a chat run started, and the chat can run the design check and shot its brief names.
- Run the studio chat's design check, shot and sketch commands through the checkout's et entry, send merged-part changes through a sketch, and load only project settings in chat runs.
- A chat run on a call reaches the design tools through `et design mcp` instead of Studio's own tool server.
- The chat no longer prints an agent's last message a second time on the finished line.
- Chat messages name the part's file and the sketch variant you look at: the selected frame's, else the one most in view.
- The chat prompt now clears after sending, also when the message was pasted and sent at once.
- The agent bridge takes a call and a variant: a chat run with both starts `et design mcp` and its prompt names them, so the agent passes them to the design tools.
- The checkouts toggle is an icon-only button.
- The chat context chip and prompt preamble no longer repeat the part as a `frame` when the selected frame is that part's own matrix.
- A debug start of Studio builds only the CLI before the design server starts, not the bundled runtime with its `npm install`, which the dev server never used.
- The red error badge on a part in the Components tree now shows the problems behind it on hover.
- A frame caption in a narrow frame ends the frame label in an ellipsis. The scheme label, the width, the note and the Live badge keep their full width.
- A frame grid goes live in one step: the cells keep their shots until every live cell painted.
- A part grid shows its cells in one reveal once all of its shots have loaded, with a loading dot until then, instead of cell by cell.
- A part's state grid now reveals once each shot is loaded, failed or slow (over 2 s), so a shot that never answers shows its "Rendering" mark instead of keeping the whole grid hidden.
- A part grid stays visible while the shots of an edited part load, instead of hiding behind its loading dot; only a new cell or scheme hides it again.
- A live canvas frame that follows its content now draws its page in the 800 px viewport of a shot, so an open select panel shows in full and no longer shrinks to the frame.
- After a sketch is merged or removed, the system view shows the part it targeted instead of the first part.
- The motion timeline shows token names for duration and easing in the mono font, so `--` stays two hyphens.
- Studio draws every part grid twice, under a Light and a Dark head, and `frame.html?scheme=` pins a live frame to one scheme.
- The footer shows the design server's render queue, the age of its oldest draw, and the shots and frames that failed, so a slow or blank frame reads as slow or failed.
- Select the grid cell under a click on an inactive grid frame, so the chat context names its state
- Ask the design server for shots with a view counter and a rank, so the shown view and the active frame are drawn first.
- The Studio theme has a `surface-hover` colour, so `hover:bg-surface-hover` draws a light text tint on a plain surface.
- Swap a canvas frame between its shot and its live page without a blank frame: the frame page reports when it painted, and Studio keeps the old view until the new one is ready.

## 0.2.0-next.13

### Minor Changes

- A page part shows an Inventory view: its rest frames with numbered, status-coloured control boxes, the control list, the approval state, and an approve button that stays off while a control is undeclared or unclassified.

### Patch Changes

- Use canonical Tailwind theme colour classes (`text-(--et-theme-color-primary-solid)`) across Studio and drop a redundant optional chain.
- A part with pending or reopened `design complete` exceptions shows an Exceptions button: it lists each key and reason, and approves one as the designer.
- A state grid marks each empty column of a row that draws a state as "not drawn", the same cells the CLI shot sheet and `sketch check` show.
- A part with motions shows a strip of each motion's keyframes; a click on one opens a read-only timeline with play, speed and one track per animation.
- Regenerate the Studio theme files from the merged colours part.

## 0.2.0-next.12

### Minor Changes

- A sketch's changed area gives one box per cluster of changed pixels; `et design shot --crop changed` writes one sheet per cluster, and Studio shows one enlarged crop per cluster.
- The design server lists per sketch variant the states it adds and drops and its changed part note. Studio says on the canvas when a variant changes no pixel, and a click shows the old and new note.
- A sketch with several targets shows the diff marks and the pages that use any target part. Studio names the parts a `shared/` edit reaches. The sketch-diff endpoint takes `part=`.
- `et design sketch new` takes several parts: one sketch, one variant folder holding them all, one `ready`, one merge; `ready` and `preview` name every part a `shared/` edit reaches; Studio shows every target part.
- A sketch where only some variants change no pixel now also hides the folded state rows until Show all states.
- A sketch variant that changes no pixel now shows only the pixel-free line instead of the folded state rows; Show all states brings the rows back.

### Patch Changes

- The heads of folded sketch rows no longer overlap at a low canvas zoom: their labels stop growing at twice their size.
- The design canvas makes at most six frames live, nearest the centre, once the camera rests for 250 ms, and keeps a loaded frame for five seconds after it leaves; the others show their drawn shot.
- Enlarge each crop of the changed-area view at most twice instead of to the frame width, so small changed areas no longer turn into blurry, page-high tiles.
- Studio defers the new-product form, note and comment forms, comment thread and comment panel, so the first view loads about 120 KB less script.
- The host reads projects, git state and folder scans off the main thread, a scan skips `node_modules`, and a call check gives up after two minutes.
- Studio loads the motion tokens from `foundations/motion`.
- Studio opens one `comment-events` stream to the design server instead of four, which leaves more of the browser's per-host connections free.
- A pick or verdict on a sketch variant shows at once from the answer of the request, instead of after the next sketch list read.
- A file change reloads only the list it names (calls, sketches or the system lists) from the design server's events, instead of every list through the host's file watcher, which is gone.
- The host keeps only the start of an agent's stderr and probes the design server port without blocking a runtime worker.
- Polling a design server Studio did not start judges it stale once per server start instead of on every poll, and sends its log only when it changed.
- A cold sketch shows its first frame sooner: Studio lists the sketches without the slow unchanged-state comparison first (`?unchanged=no`), asks for shots and diffs at once, then lists them in full.
- Generate the SDK colour and surface themes from the colours part, add a warning theme, and make the page background surface elevation 0.

## 0.2.0-next.11

### Minor Changes

- Reject and reopen single sketch variants with `et design sketch reject|reopen` or in Studio; a rejected variant keeps its reason, origin and history and can no longer be picked or merged.
- Studio's sketch view gets a "Changed area" switch per round that shows every column cropped to the one area the round's variants change, enlarged, under a small whole-page thumbnail, and the design server answers that area on `/__design/sketch-crop`.

### Patch Changes

- The comment sidebar shows a failed or interrupted comment load with a Retry button and keeps the last list, instead of an empty inbox.
- The comment sidebar now notices a dropped live update stream, shows it, reconnects after 5 seconds and loads the list again.
- A sketch state whose markup differs or only renders in a browser now counts as unchanged when its pictures match the product. Studio folds such states and shows a count with a "Show all states" button.
- Studio's "Changed area" view keeps variant notes at every zoom, remembers its switch over a reload, and takes comments on the small whole page.
- Comment pins, the marked-box outline and new comments now follow the crop of Studio's "Changed area" view instead of using full-page positions.
- Studio also writes each panic with its backtrace to `ethlete-studio-panics.log` in the temp directory.
- A product switch in the System view no longer shows the sketches and flows of the old product while the new ones load.

## 0.2.0-next.10

### Minor Changes

- Comments show an "Addressed in round …" badge once the agent, a new round, a merge or a discard answered them, and each thread has a Resolve button: only you resolve a comment.
- A merged part that changed outside a sketch shows a "changed" badge in the part list and above its frame.
- `sketch new --variant-note` keeps each variant's note in `sketch.json` instead of overwriting the part's merged note; Studio shows it in the variant's head, and a merge gives it to a new part.
- A part with a `grid` draws the states it places in one dense frame, a labelled cell per state, instead of a frame per state.
- The Flows view draws a page that exists only as an open sketch from that sketch's first variant.
- The sketch matrix folds a state that no shown variant changes into one thin row below the changed rows. A click opens or folds it again, and the sketch view remembers the choice.
- The comment sidebar hides resolved threads and shows them read-only, with who resolved them and why, behind a "Show resolved" toggle.
- The sketch view says under each variant how many states differ in pixels from the merged part; the list names each changed box, and a click outlines it on the frame.
- Studio names the agent model that made something: each sketch variant head shows its first author and "+N", an agent reply shows its model, a part shows "made by", and the report tooltip names its author.
- Tell a real agent question from an answered thread: the tree badge reads "question" or "answered", and only questions count in "N ?". The sketch view pins only sketch comments and links to the product part's comments.
- You can read and reply to a comment thread in its pin. A question from the agent shows in the sidebar, on its pin, in the tree and on the Comment button.
- The sketch of an element shows each page that uses it with every variant swapped in, and the part view shows the pages that use a part.
- The design canvas lays frames out left to right along lines and draws each line with its label.
- Comment on flow frames: a comment there belongs to the state at the shown preset, so it also pins on the part canvas. A flow remembers its picked preset.
- The system tree lists a product's flows; a flow shows its states at one preset, picked at the top, with the lines between them.
- A file change reloads only the frames of the parts it touches, at most four at a time with visible frames first; a waiting frame shows an accent dot and the status bar counts "Rendering N frames".
- The sketch matrix has an interaction switch for all cells, and a comment on a hover, focus, active or disabled cell keeps its interaction: its pin shows only there, other cells count it.
- The sketch merge preview "Where <part> is used" shows only states the merge visibly changes, outlines the part in the accent colour, groups unchanged states per part into one line, and shows a failed row as an error.
- A merge refused for a stale baseline shows the reason, the changed parts and the rebase command with a copy button. The sidebar marks a running merge "merging", and a successful merge selects the target part.
- The New product screen has a form: a name and an optional base product. Studio creates the product through the design server and picks it; a refusal shows in red.
- Studio shows notes on states on the part canvas and in every flow, and free flow notes as headings. A Note mode writes, changes and deletes them.
- The part view shows a small part as a grid of state tiles fitted to their content, and a part with `widths` at each width.
- The part view is a table: a row per state, a column for rest and each interaction the part declares, drawn with the interaction forced.
- The product picker names a base by its last folder ("inherits from web"). The New product form offers `@ethlete/components` as a base.
- The product picker is always a select, also with one product. Its last option, "New product", shows the command that creates a product, with a copy button.
- Remove the old Calls view: Studio opens on the design system view, where legacy calls live under Legacy.
- SDK components in Studio take their surfaces, teal accent, control heights, radii and font sizes from the Studio tokens. The font and radius tokens no longer resolve to an invalid value.
- Every state grid, the button grid too, draws as one sheet whose cells sit on the surface colour.
- The sketch view shows each state of the part as now and as every variant side by side, at one picked size, with a merge preview.
- While an agent still draws a sketch round, the sketch view dims each frame of its variants under an "Agent still drawing" label.
- The sketch view shows each round as its own band with its title, newest on top.
- The sketch matrix groups variant columns by round. The newest round is open; an older round folds into one column with its title, note and variants. A click opens or folds a round, remembered per sketch.
- Show open sketches in the system view: a Sketches group, a "sketch open" badge on the target part, a sketch canvas with the current part beside each variant, and pick, merge (with its preview) and discard.
- Draw a small part in one canvas frame: a grid with a column per interaction and a row per state. A comment on a cell still targets that state and interaction.
- A part's state grid draws its cells as one sheet on a sunken frame, grouped into states by interaction and rest-only states packed a line per column count.
- The System view lists the old design calls under Legacy, draws each one's variants on the canvas, and can mark a call transferred.
- Studio gets a System view that lists a product's parts by layer and draws the picked part's states on the canvas at every preset.
- The part tree lists a part's frames instead of its states, and a click opens that frame. A part drawn in one frame is a leaf.
- The tree lists a page that uses wireframe kit parts under Wireframes, with the number of kit parts next to it.

### Patch Changes

- The design server sends a `flows` event when a flow file changes, and Studio reads the flows again, so a flow edit shows without a server restart.
- The design frame page posts `Esc` to its parent. The Studio canvas now leaves an active cross-origin frame on `Esc` and takes its height from the frame page.
- The design server draws merge compares and plain `/__design/shot` asks before Studio's canvas shots, which now ask with `priority=low`.
- The app icon is the Studio mark: a stroke S, dark on a teal tile.
- The sidebar header shows the Studio mark beside a "Studio" label.
- Note cards no longer cover frames: the notes of a grid cell hang below the whole grid, every layout keeps room below a noted frame, and a note column stops growing at twice its size when zoomed out.
- Merging a sketch variant no longer needs a note.
- Open comments on a sketch no longer disable Merge and Discard.
- A click on a changed state under a sketch variant now also moves the camera to that state's rest frame and zooms in, so the outlined box is visible.
- `sketch variant --round` stores why the running round lost in its own `lost` field instead of overwriting the round's note, and `--round-note` sets the new round's note so `sketch ready` accepts it.
- A Legacy call frame shows a picture that matches its live page, and no longer flashes white when it turns live.
- The canvas fits its frames at the top of the view, and fits again once fitted frames report their size.
- The canvas stacks frames, flow lines, notes, comment pins and open popovers in that order, so a note card no longer covers an open comment thread or the note editor.
- Canvas frames no longer flash white on a design change, and fitted frames no longer open huge after a reload.
- The part and sketch views have a comment mode (`C` or the Comment button): click a frame or a state label to write a comment, and withdraw one from its pin.
- A comment sidebar lists the product's open comments and jumps to their pins, open comments lock a sketch's merge, and the sketch matrix marks missing states.
- A design server no longer outlives a Studio that dies without a clean exit.
- In a dev build, the design server line reads `stale` when the `libs/cli` source is newer than the built cli runtime, or a source file was deleted. A restart rebuilds it.
- Remove the host commands only the old Calls view used: call statuses, verdicts, modes, closed states, new variants and check receipts.
- Studio: a frame sized to its content no longer grows, shrinks and grows again when the part uses `100vh` or `100vw`; it drops the measure its own resize caused.
- A long flow line label widens the gap between its two frames, up to a limit; above it the label wraps.
- Flow frames note the comments made at another size, as the part canvas does.
- Clicking a comment keeps the canvas zoom, an open pin shows an accent ring, and sketch rows drop their layer prefix.
- A new sketch round folds the older rounds again, even when the user opened one of them before.
- Studio forgets the fitted cameras older builds saved, so a part such as `components/button` opens fitted at the top instead of zoomed and pushed down.
- A frame on the canvas shows its border on all four edges at fractional screen scales. The border is drawn above the live page and its screenshot instead of beneath them.
- A page frame's label names its state as well as its size ("comment open · desktop"), so two states at one size can be told apart.
- A fitted frame drops its border, a live frame shows a "Live · Esc" marker and ends when comment mode starts, and closing a frame no longer throws a cross-origin `SecurityError`.
- A frame that throws at runtime now reloads on the next change that redraws errored frames, like a frame with a build error.
- Show the system tree with the SDK tree. Legacy starts folded beside products and splits its calls into folded stage sections with a count. The open groups survive a reload.
- Give every fitted tile in a matrix column the width of the widest one, so the right edges line up. The part keeps its own size at the left.
- A matrix row of very short frames keeps room for its labels and the "Agent still drawing" badge, so they no longer reach into the next row.
- In the part matrix the next row starts below the tallest note column of the row above, so a note card no longer covers a frame or its label.
- The sketch merge preview shows the rendering dot while it compares the states before and after the merge.
- The merge preview fits its first changed row at a readable zoom instead of the whole column, and shows the part count and elapsed seconds while it compares.
- Studio: include native panic backtraces in diagnostic output.
- Canvas frames have no resize handle any more, and a size dragged in an older Studio is forgotten: a fitted tile always takes its measured content size.
- An in-progress sketch says "Not ready yet" instead of "The agent is still drawing"; a live agent report still shows as its own line.
- Note cards give way to their marker once the canvas is zoomed out past where labels hold their size.
- Turning on note mode also turns on Show notes, so a new note stays in view after save.
- A pointed note's marker and card share a number, and their line shows only on hover. A pointed note shows only at its size; the frame label counts notes at other sizes.
- Studio says "The design server is older than Studio - restart it" when a design request gets an HTML page instead of JSON.
- The part table no longer labels a frame with comments in another interaction, since each interaction has its own column there.
- A note with a point shows a small marker at that point, while its card sits below the frame with the other notes, joined to the marker by a thin line, so no card covers the design.
- A tree row with a question now shows only the "question" badge, not also "comment open".
- On macOS, a crashed WebKit content process now gets a new Studio window at the same URL and size, so later trackpad pinches no longer crash it again.
- Studio opens the checkout picked last after a restart.
- Studio restores the picked entry, its zoom, and a sketch's size, interaction and merge preview after a reload. The sketch header shows the picked variant in the accent colour, a labelled note field, and "Needs a note".
- In a dev build, restarting the design server first rebuilds the CLI runtime and shows the build in the footer log; a failed build keeps the server stopped.
- Studio starts its own design server and draws the frames again when a server it did not start ends.
- Restore the host command that reports sketch report changes, so a drawing agent's progress reaches Studio live again.
- A new sketch on a part no longer opens with its round folded: Studio keeps the open and folded rounds for the sketch they belong to.
- Studio remembers only a camera the user moved; a fit forgets it, so an old fit no longer comes back as a zoom after a reload.
- Select lists open on Linux again, a call clicked beside the project picker opens, and a tile says when the checkout's `@ethlete/cli` draws no pictures.
- The canvas 100 % button and `Shift+0` show the selected frame at its top-left instead of zooming around the middle.
- A "Show notes" toggle in the toolbar hides or shows the notes on the canvas. It starts on and is remembered per product.
- The sketch matrix shows every interaction by default, a row per state and interaction; a single interaction stays a filter, and Studio remembers the pick.
- A sketch shows only the comments made in it. The comments of an earlier sketch on the same target no longer appear as pins on the new variants or as a comment mark in the tree.
- Shrink the space between state groups in a sketch matrix: a group now starts twice the row gap below the row above, not two and a half times.
- Studio loads its tokens from the three design parts colors, type and spacing instead of one tokens sheet.
- A sketch report older than 30 minutes no longer blocks its variant: Studio draws the variant's frames and notes "No report for 30 min" in the column head. A new report restores the drawing state.
- The system view remembers its product, the selected entry and the canvas camera per entry over a reload. A group that holds the selection opens when the selection changes and can then fold.
- The system view picks its themes per shown entry: a part wears its product's themes, a Legacy call its design project's. The empty state shows the `et design product new` command with a copy button.
- The select picker shadow takes its colour from the surface and colour theming tokens instead of hardcoded values.
- Studio turns off the Tailwind colour palette, tints its shadows with the shadow colour token, and finds its error colour by theme type. The unused canvas demo view is gone.
- Keep tree row badges on one line and give the comment draft popover a bordered form field.
- Prevent macOS WebKit freezes when design frames reload, and keep previous content visible while asynchronous drawings finish loading.
- Update all dependencies to their latest versions (Nx 24, Vitest 5, jsdom 30, ts-morph 28, @types/node 26 and others). The optional `@nx/devkit` peer dependency now requires `^24.0.0`, and the optional `ts-morph` peer of `@ethlete/core` requires `^28.0.0`.
- The `used in` row of a part view shows one "used in all N pages" label instead of a frame per page when every page of the product uses the part.
- The text of an empty frame, like "every page of the product uses it", keeps its wrapped lines apart and inside the box when zoomed out.

## 0.2.0-next.9

### Minor Changes

- Render Studio through Chromium (Tauri's CEF runtime) on Linux, where WebKitGTK 2.54 drops animation frames; macOS and Windows keep their system webview. The Linux release ships as deb and rpm only; the AppImage is gone until Tauri fixes CEF AppImages.

### Patch Changes

- Ship the design runtime in Studio's bundles again; the frontend build emptied it before the bundler copied it.
- Variant tiles show a picture the design server draws instead of a live frame, which froze the app on drawings with `backdrop-filter`.
- The sidebar puts the stage group and the feature band with the most recently written call first, and lists settled calls newest first.
- Start Studio on macOS and Windows again: the CEF-ready Tauri build has no default runtime, so Studio now names the system webview there.

## 0.2.0-next.8

### Minor Changes

- Studio closes a call as shipped or superseded and reopens it, and a ruling can write an optional note into its round.
- Studio reads a call's `closed` and `waitsFor`: closed calls count as settled, waiting calls sit under "On hold", legacy calls with a stage clear the stage gate, and open calls now lead the sidebar.

### Patch Changes

- Show "The design server stopped" with its last output and a Restart button in the call view instead of blank frames when the design server dies, with a hint when it ran out of inotify watchers.
- Scroll the shown variant of a call again on Linux, where the wheel went to a hidden variant's frame.

## 0.2.0-next.7

### Minor Changes

- Studio groups the open calls by their stage, in the design order, with loose calls last.
- Each call row shows the state the design tooling last recorded for it (scaffolded, drawing, checking, ready or failed) and updates when the state changes. A failed state shows its error on hover.
- A design call whose project names `themes` in its config shows a surface and a colour switch in its header. The pick draws every frame of the call and is remembered per project.
- The stage overview counts the calls without a stage and marks a stage as ahead when an earlier stage has no settled or ready call.
- Show a project's design system entries and a wireframe's inventory of component calls in the call list.

### Patch Changes

- A call now shows every round its variants name, also a round that has no entry in `rounds` yet. Before, a new round stayed hidden until somebody wrote its note.
- Hide the chat sidebar; Studio remembers the choice.
- Mark a call without a stage and without legacy as invalid in the overview, and list sketches and legacy calls apart from the stage counts.
- The design system section and the Restart button work in a release build.
- Studio now says when a design server was not started by it or runs an older cli, and offers Restart, which ends whatever listens on the port and starts its own server.
- Studio names design stages (Foundations, Wireframes, ...), shows a stage overview with open, ready and settled counts above the call list, and groups unknown stages under their id.
- Studio waits at most five seconds for the stamp of the installed cli, so an older cli without `design stamp` does not hold up the server state.
- Fix a type error in the call list: a failed status read now falls back to an empty, typed status map.
- Studio watches the whole design folder, so an edit to a design-system entry or to `config.json` refreshes the window.
- Update tokio to 1.54.1 to fix RUSTSEC-2026-0386.

## 0.2.0-next.6

### Patch Changes

- Update rustls-webpki and webpki-root-certs to fix RUSTSEC-2026-0382 and RUSTSEC-2026-0383.

## 0.2.0-next.5

### Patch Changes

- Update rustls to 0.23.46 and quinn-proto to 0.11.18 to fix the RUSTSEC-2026-0338 to 0349 advisories.

## 0.2.0-next.4

### Minor Changes

- Check for a newer release every 30 minutes while the app runs, not only at start, and add a "Check for updates" button under the project name.

## 0.2.0-next.3

### Patch Changes

- The checkout picker shows the checkout Studio actually opened, not the first kept one.
- Switching checkouts no longer leaves the calls of the checkout before on screen when the new one fails to read or a slower read lands late.
- A composed verb now hands the agent's tools the variant the compose card names, not whichever variant is on screen when Send is pressed.
- A draft composed while an agent run is going no longer disappears when the run ends.
- The top bar of a call no longer stays hidden because a variant with the same key was scrolled down in the call before.
- The call explorer no longer rounds a call's age up into the next unit, and stored conversations drop turns with missing text.
- The checkout picker names a Windows checkout by its folder instead of its whole path.
- Studio reads a call file as an object literal, so prose that holds `key:` no longer adds a phantom variant and a double-quoted claim reads whole.
- A call opens on the variant picked in it, else on its open or winning variant, and the sidebar count says how many variants are ruled.
- Fix the Rust host: added variant stubs are removed when the call cannot be written, a root folder can be named for a search, a failed re-watch stops the watch before, and PATH entries are split by platform.
- The call title bar no longer covers the top of a drawing: the drawing starts below it, and it fades out while the drawing scrolls down and back in on scroll up.

## 0.2.0-next.2

### Minor Changes

- Timetrack and Studio now update themselves. At startup, a release build downloads a newer release, and a "Restart to update" button installs it. AppImage, deb, macOS and Windows installs can update. A deb install asks for the administrator password.

### Patch Changes

- Timetrack and Studio now ship a Windows installer, and the Timetrack build includes transcription.

## 0.2.0-next.1

### Patch Changes

- A design call now lists its drawings as `variants` in `variant-<key>.ts` files, and `et design check` takes `--variant`; the old `options` key and `--option` flag are gone.

## 0.2.0-next.0

### Minor Changes

- The app version now advances through a changeset, like the Timetrack app, so each release names its version.

### Patch Changes

- A failed agent run now names its error even when the CLI prints that error after its output ends. The summary was sometimes empty.
