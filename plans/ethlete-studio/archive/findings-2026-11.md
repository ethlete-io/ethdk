# Findings 2026-11

1\. A design draws an SDK overlay (menu) as a static element without the overlay pane, so surface and offsets differ
from the real SDK overlay (Impl Q8/Q12, Q34). Lesson candidate: overlays must use the SDK mock; a check flags a
static `et-menu` in a design.

2\. A design inherits a font the app does not (Impl Q12): design and app font cascade differ.

3\. A transformed SDK pane antialiases corners differently (Impl Q13).

4\. A part render mixes the part with its demo content and a fixed size (Impl Q31).

5\. Controls without an accessible name (Impl Q30); compare also needs it to force states.

6\. A list drawn `overflow-hidden` that real data overflows (Impl Q20); a long-list state was missing.

7\. Missing loading and error states (Impl Q19).

8\. A state names a surface (`open`) but the design draws only the trigger (Impl Q35).

9\. A part no other part uses (Impl Q36): an orphan check.

10\. The live UI shows information the design has no mark for (Impl Q39): the design missed a real data inventory.

11\. Live data lacks fields the design shows (Impl Q32, Q18).

12\. The go hash counts the `implements` link (Impl Q28).

13\. UI text in the wrong language (English tooltips in a German UI, Impl Q41); Studio needs i18n later, so a check
for hardcoded UI text, not only for the language.

14\. The SDK menu mock in the kit does not draw the real pane's padding and elevation, so a design that uses the mock
is still darker and its rows sit about 5 px higher than the real SDK overlay (Impl Q34). Lesson candidate: kit
mocks are checked against the real SDK component.

15\. The SDK menu mock can force only row index 1, so a part builds its own rows with `data-et-force` (Impl Q44).
Lesson candidate: the mock takes a forced row index.

16\. The check ignores the options of an embedded menu part until each row carries `data-et-slot="components/menu"`
(Impl Q44). Lesson candidate: the check attributes the rows of an embedded part without a manual marker.

17\. `task --verify` refuses a part commit that touches a file all parts share, for example the label map (Impl Q46).
Lesson: verify knows a list of shared paths. Also: a hand edit of `design-harness-parts.ts` makes every verify
fail; agents regenerate it with `design harness`.

18\. The SDK menu mock's force marks overwrite the row's own attributes, so forced open pictures showed no hover,
active or focus (Impl Q34, fd93d9b24). With 15: the mock's force API needs a rework.

19\. Designs draw interactive rows without the ARIA roles the SDK headless parts add: the tree-row design row is a
`<div tabindex="0">`, the app row gets `role="treeitem"` from `etTree`, so part-tree `row-hover` could not match
(Impl Q49). Lesson: a design row carries the same role and aria state as the headless part it stands for.

20\. A design class that no app template uses needs a Tailwind `@source inline` line in the app's `styles.css`, and
`task --verify` refused that file, so canvas-frames verified against an older commit (Impl Q50, f4d10d1ba).

21\. The tree-row app stack sets `role="tree"` by hand, not through the headless `etTree`, because the design states
are a flat row list that is not always a valid tree (2c65a502d). To pass the lint rule `role-has-required-aria`
it binds `[attr.aria-selected]="null"`, which never renders: a lint workaround, not real ARIA. Lesson: a design
state list must be a valid instance of the headless part, so the app can use the part; review in Tom's round.

22\. `elements/shell-main` shows a stale go after the shell-project-switch changes (Impl Q35/Q44), because it embeds
that part. Lesson candidate: a change to an embedded part makes the go of every part that embeds it stale.

23\. studio-menu open states differ 35-39 px, only on the pane's rounded corners: the same corner antialias as finding 3
(Impl Q13), now in a second part. Lesson: one shared rule for SDK pane corners in compare, not a fix per part.

24\. shell-project-switch is a design defect: the design `open` state draws the menu in-flow inside the 248 px host
(232 px wide, 8 px above the trigger), not absolute w-62 above the trigger like shell-main's picker (Impl Q35). The
app already matches shell-main. In addition, the harness puts the host at the top of the viewport, so an overlay that
opens above flips below. Lessons: "like part X" in a decision must be checked against X's drawn geometry; the
harness must leave room on the side where a surface opens.

25\. Meta (Tom, 2026-11-01): the design was frozen, yet the implementation still raised many questions (today Impl
Q40-Q52). They fall in three groups: design defects a check could catch (missing ARIA role, geometry that differs
from the part a decision names), tool gaps (verify path lists, corner antialias, harness placement) and app
seams (i18n). Lesson: each group needs a check that runs before the design freeze, so the freeze means no more
design questions.

26\. The auto-mode permission classifier denies the builder's `design go ... --by tom` (pages/start, link-only
re-record per Impl Q28), although Tom approved the rule (Impl Q15, Q45): an approval in the grill session does not
reach the builder session. Lesson: a `--by tom` rule needs a channel the builder's permission check accepts.

27\. Compare draws the design with `emptySlots: true` (Impl Q40), which also empties the slots of embedded parts:
shell-main's `<main>` is `slot('canvas')`, so every page's content is erased on the design side and a page 0 px is
a false green. Lesson: a check that reads green must prove it compared the content, not an empty frame.

28\. pages/sketches and pages/merge link the 1300-line `sketch-view` container, while the design shows an entirely
different layout, and the container renders blank in the harness. The design also drops features the container
has (reject/reopen, notes, diff lists) without a decision. Lesson: a page design that removes a feature must say so.

29\. The inventory design frame embeds another page (`embedPage('pages/flows')`, an iframe), while the live view shows a
host screenshot `<img>`; the app can only match it by embedding the flows view at scale 0.5. Lesson: a design
shows what the app will render, not a live embed the app has no way to draw.

30\. With parallel builder subagents, `implemented.json` broke at a commit (a second entry written after the closing
brace); repaired in 768228c78. Lesson: shared record files need a cli write path that is safe for parallel agents
(merge, not append), and a check that every record file parses.

31\. The canvas-frames design is a static frame (CSS zoom, projected children), while the live `design-canvas` has camera
pan and zoom, iframe frames, pins, notes and drafts, so a swap is not possible. Lesson: a design part that stands
for a live tool must model its interaction, or say it is only the look.

32\. part-tree has no section level (legacy stages, per-layer "Not used in ..." sections) and draws entries as states,
so an entry with several frames loses its frame rows; the comment-pin design has no mark for a question that waits
for the user, and its "N messages" label does not match the Impl Q32 count. Lesson: a design that replaces a live
view needs an inventory of what the old view shows, item by item, before the freeze.

33\. shell-project-switch draws `open-focus-visible` (focus ring on the trigger while the menu is open), a state the SDK
menu never reaches because it keeps focus inside the menu. studio-menu passed 8 of 8 at 0 px but misses
`option-hover`, `option-focus-visible` and `option-active`, so `ready` refuses. Lesson: the state list of a part
must come from the headless part's reachable states, checked before the freeze, not drawn by hand.

34\. pages/system draws the open-points popover at a fixed spot (16 px below the chip, arrow at a fixed offset), while
the SDK anchored dialog puts it 10 px below and centres the arrow on the chip. The app side of `nothing-open` is
also flaky (2 of 3 runs shot before the overlay opened). Lesson: a design that draws an SDK overlay must take its
position from the overlay's real config, and compare must wait for overlay panes.

35\. Process with parallel agents on one checkout (2026-11-01): a `git add` + `git commit -- <paths>` pair in the grill
session swept the builder's staged inventory hunks into c04baba21; two builder commits swept each other's lines
(ef67c72a4, 3c5c9bd27); a builder tried `git push --no-verify` after a manual green hook run (denied); a cli
changeset was missing until d31535ed4. Lesson: commits and pushes need a cli path that is safe for parallel
agents (own index or worktree-free staging), and the changeset check runs per commit, not only at push.

36\. The builder session restarted twice in one afternoon at 85 % context while it led 4-6 parallel subagents; each
restart costs a handoff and a re-read. Lesson: the lead session keeps only reports in context, and subagent
reports stay short (shas, px, one line per open point).

37\. The system design measures the popover arrow offset from the chip label width, so a label change (for example a
translation) means a re-measure. The popover drew in Jost because the SDK overlay sits on the body, outside the
app's `font-ui` host (app defect, fixed in a4ad19ba9). Lesson: overlays need the app font at the overlay root, and
a design must not hardcode a measure that depends on text.

38\. pages/inbox was ready at 12:42 and broke later without anyone seeing it: canvas-frames got its own `slot('frames')`
(e6d93a870, 14:13), and after Impl Q53 compare keeps the forced "Save" buttons in the inbox design. Nothing
re-compared inbox. Lesson: a change to a part re-compares every ready part and page that embeds it (with finding
22: go staleness and compare staleness need the same embed graph).

39\. The live swaps show what the page designs leave out: merge has no place for an error (a needs-rebase refusal is
silent), "Verwerfen" deletes a sketch on one click where the old view asked twice, merge text stayed English
because Impl Q58 named only three pages, the merge part shows unchanged rows of one part only, and the flows part
draws no pins, notes or drafts. Lesson: every page design needs error and confirm states for its destructive and
failing actions, and a decision about "all pages" must list them all.

40\. `task --verify` cannot verify the inbox part: its latest component commits (34df339ec, d86590c14) also touch
files outside the part, so "ready" was re-stamped without a fresh verify. Also, the pane-count wait from b3608e561
failed two inbox states because the part draws the comment editor as a static dialog and the design as an overlay
mock; 24f0de777 made the wait soft (3 s, then shoot, the pixel compare decides). Lesson: a verify must not depend
on the commit touching only part files, and a compare wait must not assume the part and the design use the same
overlay mechanism.

41\. `node_modules/.vitest-cache` served an old compiled `studio-labels.ts` after an edit; only deleting the stale
entries fixed it. Lesson: a spec that disagrees with the source after an edit is a cache suspect first.

42\. SDK focus-visible defects seen in Studio (Tom, screenshots): (a) the select (Basis field, "Keine Basis") shows
the focus-visible ring on its selected option as soon as a mouse click opens it; the menu (project switcher) does
not. Wanted: an overlay shows focus-visible only when the keyboard opened it. (b) After arrow-key navigation, a
mouse move leaves the focus-visible ring on one option while hover highlights another. Wanted: the mouse takes
over, so pointer use ends the keyboard focus-visible state. Fix in `libs/components` (both select and menu), with
a behavior test in `apps/storybook-e2e`. Done c3082e0d3: the active option records its source (keyboard or
pointer) and the ring needs "keyboard". Lesson: the compare shoots static states set by the harness, never a real
click-open or a key-then-mouse sequence, so a ring from the input path is invisible; Impl Q79 covers it.

43\. A canvas in Studio has its own background and covers the dot pattern of the page background (Tom, 2026-11-01).
The canvas must be transparent so the dots show through. Check every live canvas (flows, sketches, system).
Cause: the live `design-canvas` host had `bg-(--et-surface-background-solid)` since 9e59cc6f5 (SDK themes); CSS
fix 8aa5dc611. No compare caught it because the live `design-canvas` is hand-written, not a design part (Impl Q59
kept it), and the system page compare empties the slot it sits in. Also, compare shoots on a transparent
background. Lesson: a hand-written live component inside a page has no compare at all; every live page needs a
compare that covers what is really inside it.

44\. Layout defect (Tom, 2026-11-01, screenshot): in the page designs the canvas runs full width behind the floating
sidebar panel (the dots show left of and behind the panel). The live app reserves space for the sidebar and
shrinks the canvas instead. Fix: the live canvas fills the whole page area and the sidebar floats above it. The
camera must then treat the area under the panel as covered (start view, fit, centring). Done c5ff33545
(`CameraScene.covered`; flows still queued). Cause of the miss: the live system page is hand-written and never
shot; even a live start-view shot gives 0 px, because the dots come from the shell background, the panel is
opaque and the camera puts frames right of the panel. Lesson: a live-page compare needs a sample that crosses the
panel edge, or a clipped canvas stays invisible (Impl Q78).

45\. UX defect (Tom, 2026-11-01): only the "hide sidebar" button hides the sidebar; a click on the active nav item does
nothing. Wanted: a click on the active nav item toggles the sidebar (hide, and show again). Lesson: a pixel compare
cannot see behaviour, and the designs say nothing about what a click on each control does, so a dead control
passes every check. Cause (7f0625bb1, 8bf25ab04): the part emitted `sectionChange` for the active item, and the
live `pickSection()` only set the panel open, a no-op on an open panel. Both places were wrong; Impl Q79 covers
both.

46\. The flows preset `et-select` (and earlier the sketches round select) had no accessible name. The SDK form field
logs ET2201 at runtime, but specs and compare still passed. Label fixed by the builder. Lesson: runtime `ET\d+`
errors from the SDK reach nobody; a check must fail on them (Impl Q80).

47\. `design-canvas` `handleShortcut` called preventDefault on every Space keydown outside editable targets, so Space
activated no button anywhere in Studio. Fix queued: skip the shortcut on interactive targets. Lesson: no check
presses Space; the Impl Q79 action check presses Space as well as Enter and click.

48\. Flows camera follow-ups (dfbccb99f, 50de3cbfb): a flow pick kept the old pan and zoom, and the flows canvas did not
treat the area under the panel as covered. Neither showed in compare: it renders each state fresh, never a pick
after a pan, and never runs Fit, zoom or 100 %. Lesson: camera defects need sequences and camera actions in the
checks; Impl Q78 and Q79 now cover them. Also, dfbccb99f alone fails lint and tsc (fixed in 50de3cbfb).

49\. The live System page still shows legacy chrome that no page design shows (Tom, 2026-11-01, screenshot): top
right "gemacht von claude-opus-5-5 +1", "Notizen zeigen", "Notiz", "Kommentar"; the "Chat" strip at the right
edge; the footer bar "Reload", "Design server 4402 · stale", "Restart", "Stop". Chat and notes were parked after
the MVP, the footer and the top-right buttons were overlooked. Cause: the live page is hand-written and was never
compared to its design (finding 43); Impl Q67 swapped only the empty state. Lesson: a partial swap leaves old
chrome around the new part, and only a whole-page compare (Impl Q78) shows it.

50\. The Studio logo in the rail behaves differently per page (Tom, 2026-11-01, screenshots): on System it is no
button, on Flows it is a button and opens the studio menu, on Inbox it looks like a button but opens nothing.
Wanted: on every page the logo is a button that opens the studio menu (the studio-menu part). Lesson: each live
page wires the shell on its own, so one page can drift from the others and no check compares them; the shell
must have one live wiring for all pages, and the Impl Q79 page clicks must run on every page. Done 35087f019:
every live page wired shell-main and the logo slot itself (System: empty slot; Inbox: own button with no menu;
the server-down shell: no handlers); one `ethlete-shell-page` wrapper now owns the shell wiring for all pages.
Impl Q79 slice 2 also runs every shell control on every live page and compares the results across pages; a page
that differs is the drift signal.

51\. The studio-menu entries ("Einstellungen…", "Erscheinungsbild…", "Tastenkürzel…", "Hilfe", "Über Studio…") passed
go, compare and ready, but none of them does anything (Tom, 2026-11-01). Lesson, system level: "ready" certifies
a picture, not a working product. Every check in the chain (go, task, compare, verify, ready) looks at pixels;
none asks what a control does. Findings 42, 45, 47, 49, 50 and 51 are all this one gap.

52\. The Impl Q77 checkerboard (ec7855f3d) made two old passes fail: components/shell-collapse (1390-1550 px, 4
states) and components/shell-project-switch (~10400 px, 10 states). Both designs wrap the part in a demo
backdrop `bg-et-surface-bg` (shell-collapse.ts:38, shell-project-switch.ts:98); the app part is transparent and
sits on the shell surface. Lesson: before Impl Q77, a transparent app pixel and an opaque design pixel compared as
equal over a transparent page; a design must not mix a demo backdrop into the part (as Impl Q31).

53\. The first live-page compare (Impl Q78, pages/system) found: every live shot was an empty canvas until the shot
waited for networkidle (ea3a419c4); the app hard-codes the side tree group order Foundations, Components,
Elements, Pages while the design shows Foundations, Elements, Components, Pages (system-tree.ts); the zoom chip
sits bottom right in the app and centred in the design. App follows the design (Impl Q81 rule). Lesson: a shot
that does not wait for the data compares an empty page as fine, and hand-written live code drifts from the
design in many small places that only a whole-page compare shows.

54\. `design check --product studio` timed out after 900 s with no DONE line (builder, 2026-11-01): the design harness
logs "ResizeObserver loop completed" errors without end. Cause: not a hang. A product run renders ~57 sdk base
parts plus the studio parts in one Chromium with no progress output; alone it took 384 s
(`DONE studio: 10 of 25`), the >900 s came from machine load (7-10, parallel agents). The ResizeObserver noise is the tool's own:
`libs/cli/design/web/frame.ts:462` observes root while `fitOutOfFlow` (`define-call.ts:301`) writes
root.style.paddingTop (only sdk bracket and scheduler); harmless. Tool fix (builder default): a progress line
per part, a 120 s per-part timeout that reports a RENDER issue naming the part (render-check.ts:494), and no
padding write when unchanged. Done in e4254334c and 8bec8050a; the skip alone did not stop the loop, so the
observer now places in requestAnimationFrame (scheduler: 1 error before, 0 in 4 runs after). Lesson: a long check with no progress output looks like a hang; every check must
show which target it is on and bound each target, so a slow run and a stuck part read differently.

55\. The live-page compare over all pages (Impl Q78 slice 3, 27f892400) found five app defects (builder, 2026-11-01):
the "N offen" chip and popover exist only in the harness SystemPageComponent, not in the live system view
(partial swap, finding 43 class); "Auf 100 % zoomen" keeps the viewport point, but Impl Q74 says 100 % = the
opening view; the live canvas draws a row label ("default") left of the frame, the design has none; with no
checkout the app shows the shell with "Starte den Design-Server…" instead of the start no-repo page (startPage
needs a port); the rail "Sketches" click shows the System canvas with a Sketches tree group and hides the side
panel, the design shows the sketch view and keeps the panel. Builder fixes all five as defaults (app follows the
design). Lesson: part passes prove nothing about the assembled page; only the live whole-page compare (Impl Q78)
shows a missing wire-up, a wrong route or a stray label. Start no-repo cause: `readServer()` returns early with no
checkout (studio-view.component.ts:471), so `startPage` returns null on no port (system-view.component.ts:1070);
fix: no-repo page before the port check (builder default).

56\. Compare passed shell-main `server-stopped` before any app code for it existed (builder, 2026-11-01, Q87): the
compare empties projected slots and the server screen sat inside slot('canvas'); the harness also ignores a prop
the component has no input for. The same gap lets studio-menu option-* states pass trivially. Tool fix (builder
default): compare fails when a design state differs from its base state only inside emptied slots; the harness
fails on a prop with no matching input. Lesson: a compare that removes the very content a state is about proves
nothing; a state must differ from its base in the compared area, or the check must say it cannot compare it.
Done in 02e18fa5f + 2cc8801e4 (compare also draws every state with --state).

57\. `sketch merge --note` overwrote each target part's note with the merge reason (builder, 2026-11-01; restored).
Tool fix (builder default): keep the part note unless `--replace-note`; the merge reason goes only to
accepted.json. Lesson: a flag that records why an action ran must not overwrite content the part owns. Done in
42486d5e3.

58\. studio-menu `open-focus-visible` fails by 5436 px (builder, 2026-11-01): the app's keyboard-focused first row
paints the active background plus the ring, the design only the ring. Cause: c3082e0d3 (finding 42) changed the
SDK menu keyboard styles after studio-menu was recorded, and the sdk components/menu design mock does not draw
the keyboard-active background. Lesson: an SDK style change silently moves every part that embeds it; the tool
did not flag the SDK menu mock or the dependent studio parts when c3082e0d3 landed. Design fix: Impl Q102 (Tom).
Cause: ready, go and implemented store `partHashOf` (baseline.ts:42) over the part's own folder plus
@shared/@assets only; imported parts, @ethlete/*/design mocks, the app component and SDK runtime/CSS are not
covered, and c3082e0d3 changed only menu.directive.ts, menu-item.directive.ts and menu.component.css.
`design check` lists ready parts (check-system.ts:364) but never re-compares them. Tool change: Impl Q112 (Tom), done in
3c0410ef6 (`STALE <part>: design <files>; app <files>`; drift from before the upgrade is not caught, Q109 is).

59\. Live-page compare slice 4 (Impl Q78, 6d3588e6f, builder, 2026-11-01): merge failed with a 0x0 swapped host
(fix: wait for a sized host; fixed clock `now`); inventory 501029 px is mostly a sample mismatch (app showed
pages/system inventory, design pages/flows; 453k of it), the rest is list selectors full path vs short names,
panel tree order, "Inventory freigeben" enabled vs disabled, frame label "part · desktop" vs "Flow · Desktop ·
Dunkel"; the panel foot shows the checkout folder name, so compare only matches from a folder named ethlete-sdk;
prettier renumbered findings 55-58 in this plan (restored; do not prettier design-to-code.md). Lesson: a whole-page
compare must pin every input the page reads (data sample, clock, host size, folder name), or a big px number
mixes real drift with setup noise and nobody can read it.

60\. Studio refuses a folder without design work silently after the OS folder dialog (builder, 2026-11-01, Impl Q89,
521b2db01): no design state shows the refusal, so no check could ask for one. The part-level `design actions`
check cannot see it: the part fires its output correctly, the failure is in the host call on the live page.
Lesson: only a live-page action check sees a press that ends in a host error with no visible change; it needs a
host stub that records native calls (dialog, updater), because a native dialog is invisible to Playwright. Tool
change: Impl Q106 (Tom). Error feedback: Impl Q105 (Tom).

61\. The first push of the finding 54 fix failed on cli lint (builder, 2026-11-01): e4254334c imports rxjs, but
@ethlete/cli did not declare it (fixed in 9c6853e6e). The subagent ran eslint only on the files it touched, and
`@nx/dependency-checks` lints package.json. Two script specs (move-into-place, skip-reporter) failed under load
and pass alone (flaky). Lesson: file-scoped lint cannot see a dependency change; a commit that adds a package
import must also lint the project's package.json. Fix: done in the subagent brief
(`npx eslint libs/<lib>/package.json` after `yarn install`).

62\. Impl Q86 DEMO-BACKDROP check (fc6803125) flags only elements/studio-menu after the shell-collapse and
shell-project-switch backdrops went (0987a5490, studio-menu.ts:105; its app host copies the fill). Both shell
parts already showed PART-UNREVIEWED before that edit, probably since f1fea4e17 (the Impl Q79 action attributes).
Cause: merged.json stores `partHashOf`, a hash of the raw part folder bytes (merged-parts.ts:12), so the
attribute-only edit in f1fea4e17 reset the review; disclosure, tree-row, zoom-chip, part-tree and shell-main are
probably reset too; disclosure and part-tree also show a stale go, so the edit reset the go as well. No step ran `design accept` or the merge path after the direct edit. Lesson: a review tied
to source bytes resets on edits that change no pixel, and a direct edit bypasses the merge rule that already
writes an `auto` acceptance for pixel-identical states (merged-parts.ts:154). Tool change: Impl Q109 (Tom).
Accept + go for both: Impl Q107 (Tom); studio-menu backdrop: Impl Q108 (Tom).

63\. The finding 56 compare fix (2cc8801e4) shows new fails (builder, 2026-11-01): studio-menu option-* (3 states)
passed trivially before, because the SDK menu mock drops the row's data-et-force, so compare forced nothing;
shell-main section/product/products rows at rest set `force: { label }` with no interaction. Lesson: a check
that never failed for a state can be a check that never ran; each new strictness gate finds old trivial passes.
Design fixes: Impl Q110, Q111 (Tom). The 2cc8801e4 subagent also forgot its changeset; the push hook caught it.

158\. Hovering a variant frame in the Sketches view draws the teal border again (Tom, 2026-11-02, screenshot on
pages/sketches r2), the same look as finding 96. Facts (builder): no `:hover` rule exists any more in the design
CSS; the teal comes from the app canvas, which draws part outlines as siblings of the frame
(design-canvas.component.html:163, `data-part-outline`, outline-2 primary) and crop outlines
(canvas-frame.component.ts:153); exact element and commit pending. Why no check caught it: the e2e "hover alone
draws no frame border" (canvas.e2e.mjs:358) compares only the frame and its descendants, so a sibling overlay is
invisible to it; `yarn studio:e2e` runs in no CI workflow and not in pre-push. Tool fix: B67 (the e2e compares
every outline and shadow over the frame's box across the whole canvas; studio:e2e runs in CI). Lesson: a guard
test that runs nowhere guards nothing, and a test scoped to one element misses the same look drawn beside it.
Update (builder, 2026-11-02): not reproduced. At HEAD no hover rule exists in design-canvas/, design-parts/sketches/
or sketch-view; the `data-part-outline` lead is dead (`outlines` is bound nowhere); variant iframes sit under a
pointer-events-none wrapper. A plain click (design-canvas.component.ts clickCanvas), or the press that starts a
pan, selects the frame and CanvasFrameBorderComponent draws the intended primary selection outline - it looks the
same as the reported border. Open: did Tom click or only hover. The repro also failed because headless Studio
renderers died ~5 s after load ("Render process gone") under load ~16; load vs real crash unconfirmed. Second
gap: the e2e "Sketches" page is a synthetic one-variant sketch, not pages/sketches r2, so this case could never go
red - B67 also adds the real r2 sketch as an e2e target.
Update (Tom, 2026-11-02): neither hover nor click - the outline appeared after the Studio window lost focus and
regained it, so it is a focus effect. Cause pending (builder): which element takes focus or focus-visible on
window refocus and why it draws the primary outline. Tool fix extends B67: the canvas e2e simulates window
blur/refocus and asserts no frame outline appears.
Cause (builder, from code, not reproduced headless): the `ethlete-design-canvas` host (tabindex=0 +
FocusRingDirective, design-canvas.component.ts:202-206) draws `.et-focus-ring:focus-visible` (primary in dark).
Window blur fires `blur` on the canvas, which clears the pointer-focus mark (design-canvas :213,
pointer-focus.ts:22); refocus restores focus without a pointerdown, so Chromium/CEF matches :focus-visible and
the ring shows. Fix in B97: pointer-focus.ts keeps the mark on a blur caused by the window losing focus
(`!ownerDocument.hasFocus()`), and the design-canvas blur uses the same check; pointer-focus.ts is app code
(apps/ethlete-studio), so no SDK change. Landed 849f2792c (spec and canvas.e2e red on old code, green on fix). Headless Chromium never loses window focus, so the e2e asserts only "pointer mark
survives a synthetic window blur"; Tom confirms the real ring in the app.

184\. The grill session asked Tom to reject pages/sketches r2 variants b and c in Studio; Studio has no UI to reject a
variant (Tom, 2026-11-02). `sketch ready` refuses because b and c draw the same pixels as a, and the builder's
message said they "need Tom's reject" - a step that does not exist. Lesson: never ask Tom for a UI action without
checking the UI has it. Tool fix (decided, technical): pixel-identical variants are an agent defect (sketches are
agent-drawn, finding 180), so the agent removes or redraws them; `ready`'s refusal names that agent action and
never a user step. A reject UI in Studio, if wanted, is a product question for later.

186\. `sketch reject --by tom` recorded the verdict as "rejected by the agent" (Tom, 2026-11-02): sketch-command.ts
~l.1062 maps every `--by` value except `designer` to `agent` silently, and the builder handed Tom a command with
`--by tom`. Tool fix (decided, technical): verdict commands accept only `designer` or a known model id for
`--by` and refuse anything else with the valid values; the usage/refusal text names `--by designer` for the
user. Tom re-runs b and c with `--by designer`.

191\. The Sketches view build lost the canvas (Tom, 2026-11-02): at 100 % it only scrolls up/down, zoom works only
via the zoom chip. Cause (builder): the uncommitted rewrite of `design-parts/sketches/sketches.component.*`
dropped `ethlete-design-canvas` and hand-rolled a camera from the design's own mock pan (`mountFit` in
`pages/sketches/shared/sketch-rows.ts`): plain wheel pans, ctrlKey is ignored, pan is clamped to a full-width
world, so there is no horizontal room. `canvas.e2e.mjs` covers the Sketches view but never ran: the slice's
subagent hit its context limit before its checks, and Tom saw the uncommitted tree live. Lesson: a design's mock
interaction code is a picture, not a spec for the app; and an interrupted slice reaches Tom's live app unchecked.
Tool fix (decided, technical): a lint rule in the studio app refuses `wheel`/pointer camera listeners in
`design-parts/**` outside `components/design-canvas` (CANVAS-CAMERA-OWN); the builder's subagent brief ends
every slice with the e2e of each view it touched, and a subagent stop without that run is reported to the
grill as "unchecked" (measured, not blocked).
Run later (builder): canvas.e2e times out on Sketches waiting for `ethlete-design-canvas` /
`ethlete-canvas-viewport` + `[data-sk-frame]` - the rewrite left the canvas contract, so no camera case could run.
A lost contract is reported as a timeout; CANVAS-CAMERA-OWN catches the same cause at lint time.

209\. `nx test cli` went red once (part-accept.spec "refuses a part with theming findings", 8.9 s) while a subagent ran
a build and Playwright in parallel; alone it passes in 1.6 s (builder, 2026-11-02). Cause: no testTimeout in the
cli vitest config, so the 5 s default applies to a spec that spawns tailwind. A vite "server closed" at the end of
a real-repo `sketch check --product studio` did not come back on a solo rerun (likely the same load or a port
clash, not proven). Nothing ran the cli suite on f7e66dbb6: the pre-commit `vitest related` covers only
apps/ethlete-studio. Lesson: the commit-time spec check stops at one project, and a load-sensitive timeout reads
as a real failure. Tool fix (decided, technical, B116): part-accept gets its own testTimeout (~30 s); the
pre-commit related run extends to libs/cli. The rerun's CONTROL-STATE x2 on elements/shell-main variant a goes
with the shell-main follow-up.

210\. The compare of pages/sketches against the app stayed at 81k-104k px per state (builder, 2026-11-02). Three causes,
none reported by a tool: (a) the Studio title bar renders only under Tauri, so the app shot in the harness was
32 px high - this broke every shell-page compare since fea9ac862/028ef7006, and nobody saw it because compare
reports a pixel count, not a vertical offset; (b) the design's `gridFit` runs 6 passes, the app one, so the
narrow part fits 0.6 % lower (22147 px); (c) pulse dots add +70 px from animation rounding. Fixed in the app
(uncommitted, Sketches slice): a WINDOW_CHROME token gives the harness Linux window chrome; harness sample
adapter for part:'narrow'; canvas.e2e builds synthetic sketches (it crashed on the deleted components-zoom-chip).
(b) in progress: the app copies the 6-pass loop. Lesson: compare says how much differs, never how - a whole-shot
offset and a scale gap look like any other diff. Tool fix (technical, B117): compare reports a vertical offset and
the fit scale per picture; both pictures freeze `animate-*`; `design task` lists merged-design `data-sk-*` markers
missing from the app DOM; per-part fixtures, and a warning when a design prop value does not match its shape.

211\. In the design pictures of pages/sketches the shell title bar renders unstyled: the sr-only "Control K" is
visible, no keycaps, no window buttons (builder, 2026-11-02; 3260 px on each wide state). Suspected cause: `ng()`
emits the SDK CSS once per render process and attaches it to the first render; `prepareShots` renders the title
bar in `slot('shot')` frames that are blanked, and the CSS goes with them; the title-bar render also drops
`search.styles`. Nothing caught it: check and the go accepted a picture with a visible sr-only text. Decision
(technical, doc agent): fix it in the design tool - `ng()` puts its styles into `drawing.styles`, not into the
first render; the intended design does not change. pages/sketches then needs a new go from Tom (go hash changes).
Tool fix (B118): `sketch check`/`design check` flag an SDK component rendered without its CSS (an sr-only element
with a visible box).
Built (af28afe38): cause confirmed - `ng()` put the SDK CSS in front of the frame's first `ng()` render only;
now `ng()`/`ngStates()` return markup only and `withNgStyles()` puts CSS not yet handed out into
`drawing.styles`. Guard: error rule UNSTYLED-SDK in `design check` empties the slots like the picture and flags a
`.et-visually-hidden` element that still draws; proven red/green only on a Chromium spec fixture, the run on the
real old pictures is still owed. The title-bar render dropping `search.styles` has no effect (title-search has
no stylesheet) and stays as is. Merged pictures of other parts whose SDK component first rendered in an emptied
slot change too - the fix, not a design change.

213\. Navigating between Studio pages (e.g. System -> Sketches) makes the whole app jump: the title bar appears a
moment after the page, and everything below moves down (Tom, 2026-11-02). Cause (checked in code, builder's
uncommitted slice): every page wraps its own `ShellPageComponent`, which is created again on each navigation;
shell-page.component.ts reads the window chrome with `toSignal(inject(WINDOW_CHROME)()..., { initialValue: null })`,
so each new page renders without a title bar until the async chrome lookup resolves. Lesson: the harness and
compare get the chrome synchronously (`of(LINUX_CHROME)`), and no e2e navigates between routes and watches the
layout, so a first-frame state that never settles in a still shot is invisible. Tool fix (decided, technical,
B121): resolve the window chrome once at app start (root provider / app initializer) and read it synchronously, so
a page never renders a frame without the title bar; an e2e case navigates System -> Sketches -> Inbox and requires
the main content's top edge to stay constant in every frame after the navigation (red first on today's build);
the harness gets a mode that delivers the chrome async, so the same bug shows in a part shot.

216\. Sketches slice committed (fb434b68b B121, 155777af9 canvas camera + fixtures from HEAD, 5a29b1b94 Sketches
variant a; builder, 2026-11-02). B121 cause had a second half: each navigation opened a host
`window_chrome_watch` channel that was never closed. Why the tools missed it: the headless shell stub had no
`window_chrome_watch`, so headless runs had no title bar at all; the harness gave the chrome synchronously and
never navigates; e2e and verify look at settled frames only. Guard page-switch.e2e (chrome after 80 ms, rAF
frames) red 1/4 before, green 4/4 after; `withStudio` delivers chrome late by default, harness `?hostDelay=`.
UNSTYLED-SDK proven on real output: old build red (16 hits), new build none. The ng() fix changes no stored go or
accepted picture in any product (only the emptied-slot compare pictures of pages/sketches), so the pages/sketches
go stays valid. Open: the tree holds uncommitted Studio-written state since 2026-11-02 09:06 (go.json with
`auto: true` entries, accepted.json, merged.json, pictures.json, two studio-lab sketch.json) that no session owns,
and `design check` warns "changed outside a sketch" for canvas-viewport, disclosure, canvas-frames, shell-main,
pages/flows, pages/inventory. Lesson: Tom's Studio clicks write files, but nothing commits them or warns that
they float. Tool fix (technical, B123): `design check` warns UNCOMMITTED-DECISIONS when go/accepted/merged/
pictures differ from HEAD; the builder commits Studio-written state as its own commit per slice, after checking
no go entry was written by an agent. Also `design check <part>` ignores the positional part and checks the whole
product: honour it or reject it with a hint to `--part`.

218\. `design task pages/sketches --verify 5a29b1b94` refused (25 files outside the allowed set) but exited 0, so no
implemented.json was written and ready did not run (builder, 2026-11-02). 21 of the 25 were design files of the
same commit (merged pages/sketches design, deleted sketch dirs); 4 were app wiring that feeds the part
(system-view/inbox-comments.ts, system-tree.ts, system-view.component.ts and its spec). Lesson: a refusal that
exits 0 reads as success in a script, and the allowed set knew only the part's own files, so a normal slice that
commits design and app together cannot verify. Tool fix (decided, technical, B125): verify exits 1 on refusal;
`.ethlete/design/**` never counts as implementation (one summary line); `task` lists wiring files up front (files
that import the part plus their direct imports) and verify allows them with one WIRING line each; no per-file
`--allow` flag. Then verify 5a29b1b94 again and mark ready.

221\. B125 landed (e07475c08, builder, 2026-11-02): verify on 5a29b1b94 skips 21 design files, allows 6 wiring files,
and refuses only on the drawing compare (70 px animate-pulse). The earlier "exits 0" was wrong: the builder piped
the output through `tail`, which hid the exit code; a spec now locks exit 1. Weak point: system-view.component.ts
counts as wiring only because shell-logo.spec.ts happens to import both it and SketchesComponent; it is the
parent of the part's importer, which "importers plus their direct imports" misses. Lesson: a fixed import depth
and a spec's imports are proxies for "is on the path that mounts the part"; the next deeper nesting refuses
again, and a spec edit silently changes the allowed set. Tool fix (decided, technical, B128; doc agent overrides
the builder's "one more level"): wiring = every non-spec file under the app that transitively imports the part
(its ancestors in the import graph, stopping at the app root), plus the part's own spec; spec imports never add
wiring. Keep the one WIRING line per file so a wide set stays visible.

222\. B117 compare slice landed (d4cd2c8b3, builder, 2026-11-02): the design side awaited `finished`, which skips
infinite animations, so it shot a random pulse frame while the app side ran with animations disabled; now held
at the start frame and verify 5a29b1b94 compares 9/9. The next gate, the action check, then missed 11 actions:
9x the shared host `DesignCanvas` (pan/zoom, every state) and 2x the "Pausiert" badge button (paused,
paused-reason). Facts for (B): the merged design renders that badge through `holdTrigger` as a real button with
`aria-expanded` that toggles `[data-sk-hold-reason]`, and has its own `paused-reason` state, so the design means
it to be clickable; only the `data-et-action` marker is missing. Lessons: (1) 5a29b1b94 ran compare but never the
action check, so 11 misses passed a commit unseen; (2) a design helper drew an interactive button with no action
marker and neither `check`, `sketch check` nor `sketch ready` flagged it, so the gap surfaced only at verify;
(3) a shared host component is chrome for every canvas page, not an action of each part. Tool fixes (decided,
technical): B129 the product config declares host components (DesignCanvas) and the action check reports them as
one "host ... not checked" line instead of a miss, never inferred; B130 a check rule flags any interactive
design element (button, `[aria-expanded]`, `[role=button]`, a click handler) without `data-et-action`, at draw
time; `holdTrigger` gets the marker in the merged design and in round-2 variant a, so Tom's pending go of
pages/sketches covers it (no extra design round; the app button stays); B131 `design compare` on a part with a
go runs the action check too. Also: frame-bootstrap.spec.ts and one UNSTYLED-SDK spec fail on clean HEAD
(withNgStyles export missing in the vm-loaded define-call); a builder subagent fixes it and reports why
pre-commit missed it (lesson pending).

223\. Two CLI specs red on clean HEAD since af28afe38, fixed in 1f9431a0c (builder, 2026-11-02): the fixture
`__fixtures__/frame-bootstrap.mjs` hand-stubs `../define-call` without `withNgStyles`, and UNSTYLED-SDK was
missing from `CHECK_RULES`. Pre-commit runs `vitest related` on staged files; frame-bootstrap.spec loads
frame.ts by path (spawnSync + vm) and check-rules.spec reads render-check.ts as text, so no import edge exists and
`related` never picked them. Lesson: a spec that loads source by path is invisible to the module graph, and a
hand-written stub drifts from the module it stands in for. Tool fix (decided, technical, B132): a related-map
file (spec -> source globs, not a comment header) that the pre-commit hook merges into `related`; a lint/check
fails when a spec under libs/cli reads or spawns a source path (`readFileSync`, `spawnSync`, `vm`) and has no
map entry; the builder confirms that pre-push or CI runs the full CLI spec suite, and adds it if not.

226\. Round-2 sketch of pages/sketches went stale (Tom, 2026-11-02): d2d484c55 edited the merged pages/sketches design
(hold toggle action marker) while the round-2 sketch (78f0fbb3a) was open, so Studio showed the base as changed
since the sketch. Lesson: nothing stops a design commit on a part with an open sketch round; Tom finds it at his
pick. Tool fix (decided, technical, B138): `check` (and so pre-push) refuses a commit that changes a part's design
while it has an open sketch whose base no longer matches, unless the sketch is rebased in the same commit; the
refusal names the rebase command.

230\. Builder commit 3be274358 (B133) swept the B138 draft in check-system.ts/.spec into its commit (two parallel
slices on one file), so HEAD was red until 7b6e79545 (builder, 2026-11-03). Why no tool caught it: pre-commit
runs the related specs on the working tree, not on the index, so a commit whose staged content is red passes
when the tree is green, and a clean staged part cannot be committed while the tree is red. Lesson: a check
before a commit must test what the commit contains. Tool fix (B143): pre-commit runs `vitest related` against
a checkout of the index, like pre-push does for HEAD. Builder rule: never give two parallel slices one file.

233\. The B145 comment sketch (5caf55609, pages/system variant a) could not be marked ready: `sketch check` failed on
CONTROL-STATE for the merged states `part-focus-visible` and `points-closed-focus-visible` (the open-points chip
focus ring), which the variant did not touch; the product check does not report them (builder, 2026-11-03). Why:
`controlStateGapsOf` judges by state name, and sketch check does not separate gaps the variant introduces from
gaps already in the base. Lesson: two checks that judge the same input differently block work for a reason the
user cannot act on. Tool fix (B152, technical): sketch check and ready count a gap only when the variant adds it
(unchanged-since-base logic as in the ratchet), and the sketch and product checks agree on the same input.

236\. `studio-api-level.spec.ts` fails since B147 (a028e8707): `rules/orphan-endpoint.ts` contains the string
`/__design/`, which that spec forbids in cli sources outside the server. Nobody noticed, because the pre-commit
hook runs only the specs `libs/cli/related-map.json` maps to the changed files, and a spec that scans every cli
source is mapped to none of them (builder, 2026-11-03). Lesson: a spec that guards all sources of a lib must run
for any change in that lib; a related map that only knows direct relations hides it. Fix: B156, the related map
lists source-wide specs (studio-api-level) as related to every cli source file, new ones included.

238\. Three builder slices in one morning (B152 87de26aff, B155 653c345ad, B156 2666cc517) shipped new specs that
were never seen red; each report says so itself (builder, 2026-11-03). Red-first is a rule in the sub-agent brief
only, and nothing checks it, so it erodes under load. Lesson: a rule an agent must remember is a rule that slips;
the proof that a spec can fail must be produced by a tool, not promised in a report. Fix: B161, a `red-check`
script: for a commit that adds or changes specs, it checks out the parent's non-spec files, runs the changed specs,
and fails unless at least one new test fails there; the builder's report quotes its output.

244\. While proving B171/B172 the builder hit three CLI gaps (2026-11-03): `design shot` with a single `--state` and no
`--states`/`--variants` prints only usage; `--out` with `--variants` prints only usage; `sketch check` still checks
rejected (not only withdrawn) variants. No spec covers flag combinations, only the flags one by one, and a bare
usage print reads to an agent like its own typo, so it works around the tool instead of reporting it. Lesson: a
valid flag combination the tool refuses must say which combination and why, and each documented combination
gets a spec. Fix: B180 (technical) - accept both combinations, skip rejected variants with the withdrawn NOTE,
and a usage refusal names the conflicting flags.

249\. `sketch ready` auto-merges and writes shared JSON hunks (merged/accepted) that the agent cannot commit under the
pathless-commit hook, and the subagent brief's hunk-patch flow ends in a pathless `git commit` the hook denies
(builder, 2026-11-03). Two tools disagreed on how a commit works, and only a human-run hook noticed. Lesson: a tool
that writes shared files must also name the exact way to commit its own lines. Fix: B184 (technical) - a
`design commit-hunks <file> --part <p>` helper (HEAD + own hunks, `commit -- file`, restore the rest); `sketch

250\. Sketch dirs are always `<layer>-<name>`, so a second sketch on the same part collides with the first (builder,
2026-11-03). Fix: B185 (technical) - `sketch new --name`.

257\. Tom (2026-11-03): the Sketches canvas no longer pans past the top-left (B186). Cause (builder): 030fe2f36 added
`clampPan` / `room` / `shownPan` in `design-parts/sketches/sketches.component.ts`, probably for the sticky state
column; Flows, System and Inbox have no clamp. Why nothing caught it: the CANVAS-CAMERA-OWN lint rule from finding
191 was decided but never built and had no STATUS B item, and as decided it would only have seen wheel/pointer
listeners, not camera math; canvas.e2e's "left drag on an empty area pans" would have gone red on Sketches, but
no e2e ran for 030fe2f36, and no case pans past the content edges on purpose. Lessons: a decided tool fix without
a B item is not decided; a rule must target the defect class (camera state owned outside the canvas), not one
symptom; a slice that touches a view is not done without that view's e2e. Fix: B186 (clamp removed, sticky gutter
keeps max(0, -x), e2e "pan beyond every edge" on every canvas view, red first); B196 (technical) builds
CANVAS-CAMERA-OWN for any pan/zoom state or clamp in `design-parts/**` outside the canvas component; B197
(technical) a script maps a commit's changed files to the views they touch and runs those e2e; slice reports
quote it like red-check.

258\. The empty title-bar frames in the same screenshot were a slow load (builder, 2026-11-03): all 60 iframes are
destroyed and recreated right after the first render (60 ERR_ABORTED), then load 6 at a time (~15-20 s), and every
Vite full reload from parallel agents' edits under `.ethlete/design` reloads them again. While loading, a frame
shows only its bordered 150 px measuring strip, so Tom cannot tell loading from broken. No check measures load
work (frame creations, aborted requests). Fix: B198 (technical) - no iframe recreation after first render, visible
frames load first; a spec counts iframe creations == frame count. B199 - the canvas-frames loading state as a
Studio sketch, after Tom's B178 pick.

260\. B183 deviated from the decision (builder, 2026-11-03, c56a88d4a): instead of loading the module, the LIVE check
now skips a part whose state names it cannot read statically - silently. A check that skips without a word reads
as passed (same class as findings 246 and 254). Decided (technical): B183 reopened - (a) now a NOTE "live states
not checked: <part>: spread states"; (b) load the module through the B182 private build, then remove the skip.
Also: a `hold` set for a CLI bug outlives its fix and `ready` only refuses (B200: the refusal names
`sketch release <part> --by`); parallel commit-hunks race on `.git/index.lock`, and d962c4109 picked up two foreign
auto-accept entries (B184 retries on the lock and stages only its own hunks).

261\. `sketch new --name` (B185, 088b27cfb) gave sketches a second key form, but `check-sketches.ts` (~l.109) still
compares `sketch.target` with a part key, so it silently skips a named sketch (builder, 2026-11-03). Why no tool
caught it: the B185 specs cover only `sketch new`; no spec runs a named sketch through the code that reads
sketches, and a skipped sketch is silent (same class as findings 246, 254 and 260). Lesson: a new key form gets
a spec in every consumer of the key, not only in its producer. Fix: B203 (technical) - compare through
`partKeyOf`, grep every other `sketch.target` equality check, and add one spec that drives a named sketch through
`sketch check`/`ready`/`go`. Also open: `server-identity.spec` "reports no installed cli when the project has
none" failed in the full design vitest run; the builder re-runs it on a clean HEAD.

262\. B173 (builder, 2026-11-03): `commit-hunks` splits only part-keyed files, so the agent committed
`capabilities.json` (keyed by capability id) by hand - the hand commit `commit-hunks` exists to replace. Why no
tool caught it: B184 was specified for go/merged/pictures; nothing lists the shared design JSON files the tool
must cover. Lesson: a tool for "shared files" is tested against the list of every shared file, not the ones that
prompted it. Fix: B204 (technical) - `commit-hunks` covers every shared JSON under `.ethlete/design`
(capabilities.json by `--id <capability>`); a file it cannot split refuses with a message; one spec iterates all
shared files.

269\. Tom's merge of the pages/system sketch (pick b, 2026-11-03) failed in Studio: components/title-bar had changed
since the sketch was made. Why no tool caught it: Studio offered the pick on a sketch with a stale base and only
the merge checked the base, so Tom learned it after deciding. Lesson: a stale base shows before the pick, not at the
merge. Fix: the builder rebases the sketch and keeps pick b; B220 (technical) - Studio marks a sketch with a stale
base (also a child part) "braucht Rebase" before the pick and `sketch ready` refuses it; when only a child part no
variant touches changed, the tool rebases on its own and keeps the pick.
After the rebase (builder, 2026-11-03): `sketch check` fails a and b - "drops the state send-rejected that
pages/system has in studio". acd6ce0bf (Tom's comment error texts) added that state to the merged part while the
sketch was open; `sketch rebase` moves the baseline but does not port new merged states into the variants, and a
`git apply --3way` of the diff conflicts. Lesson: a design change to a part with an open sketch reaches the sketch
in the same step. B220 grows: `sketch rebase` ports new merged states into every variant (3-way; on conflict it
lists the conflicts and stops), and a design commit on a part with an open sketch names that sketch.

273\. Title-bar r2/r3 (builder, 2026-11-03, 4054edf4c, 9e94a2dc3): three tool gaps. (1) The ready rule "first changed
state draws identical frames" fired on linux-full-update while the shot showed 0 px change: the merged markup was
refactored after the sketch's baseline, so every variant trips it. (2) `design shot` still prints "not drawn" for
the hover, active and focus-visible cells of title-bar after B171. (3) `sketch variant --from e` built on a
withdrawn variant without a word. Why no tool caught them: ready and shot compute "changed" and "drawn" in two
places, and nothing compares them; withdrawn has no meaning outside `ready`. Lesson: one measurement of change
feeds every command that judges it. Fix (technical): B209 - ready takes each variant's first changed state from the
shot's pixel diff; B210 - shot draws the interaction cells the way `sketch check` drives them; B211 - a variant
made from a withdrawn one says "from withdrawn <v>". Also: a spec timed out at 5 s under load in pre-commit
(passes alone in 1.5 s) - goes into B207 (re-run a timed-out spec once alone); two checks in one session disagreed
after a dist rebuild - B191.
B210 cause (c12a65e92): `design shot` took its state names from `drawnStateNamesOf`, which drops every row whose
forced controls are only unchanged SDK components; B171 (327bd8362) fixed only the `--state <name>` path, and a
grid shot passes no name. Fix: `shotStateNamesOf` returns every defined state. Still open: shot and `sketch check`
share no interaction driver, so the lesson (one measurement) is not met yet.

274\. pages/system rebase (builder, 2026-11-03, 288252ce4): two tool gaps. (1) `sketch ready` on a sketch whose status
is already ready exits 1 with "pages/system is ready, not in progress", also right after a rebase, so every rebase
reads as a failure. (2) The tree's go.json holds 127 changed lines nobody claims, one of them `"by": "tom"` ->
`"by": "user"`: the author of a go changed without a command that says so. Why no tool caught them: ready treats
its status as a gate, not as a state to refresh; go entries carry no writer, so a rewrite is untraceable. Fix
(technical): into B220 - `sketch ready` on a ready sketch with a refreshed base re-readies and exits 0 ("still
ready, base refreshed"); B223 - every go.json write names its command, and `by` is never rewritten on a refresh
Cause (builder): no `by` was rewritten - the 127 lines only reorder keys; the "user" line is a diff alignment
artifact. The CLI writer sorts keys on every write; the hand copy-aside hunk commit e2f9391d7 appended three new
entries instead, and every later hunk commit kept that order. Fix: into B204 - commit-hunks writes keys in the
writer's sorted order (spec: committed file equals the writer's output), reports a semantically empty hunk as
"order only", and the manual copy-aside rule leaves the brief once B204 covers every file. The sorted go.json is
committed as-is.

276\. Builder report (2026-11-03, e245c85de, B201): two tool gaps. (1) `yarn agents:sync` reorders the two Stop hooks in
.claude/settings.json on every run: the hand registration of builder-chat-words.py (3326a7670) and the sync
disagree on order, so the tree is dirty after each sync. (2) In a full product check, RENDER timeouts from
parallel load (shell-project-switch, studio-menu: 10-13 s alone, 0 findings) read as real findings. Why no tool
caught them: sync rewrites the whole hook list instead of merging into it; the checker has one RENDER code for a
timeout and a broken render. Fix (technical): B224 - agents:sync keeps the existing order of hook entries and
only inserts or removes its own, so a second sync is a no-op; into B221 - a render timeout gets its own code,
distinct from a render error, and is re-run once alone before it counts.

280\. B194 (builder, 2026-11-03, 649b04940): `definePart({ instant: '<reason>' })` replaces per-pair `unreachable` for
parts whose states switch without motion; a loop in an ongoing-work state is still asked for; an empty or
non-literal reason is MOTION-INSTANT. Gap: only `sketch ready` prints the instant note, `design check` does not.
Why no tool caught it: each command assembles its own report lines, with no shared note list. Fix: B226 -
`design check` prints the instant lines from the same source. elements/canvas-frames moves to `instant` in the
B199 commit. Not run yet: B194 through the built CLI.

282\. B221 + B222 (builder, 2026-11-03, a293f319f, 5f839ff40, ecf7b626b). B221: the real silent pass was `design ready`.
drawnFindingsOf (drawn-open-points.ts) ignored a state that never drew, so ready now refuses ("cannot draw").
page-sketch did not fail again on its own. Its cause is lost because render-check kept only the first line of
frame.ts' error; RENDER now carries the whole message. Inference, unproven: a module import failed under
full-run load. A timed-out part is redrawn once on its own; a second timeout is RENDER-TIMEOUT (exit 1, blocks
ready). B222: check.ts' parser dropped args and read an unknown flag as the value of the flag before it. Why no
tool caught it: no spec fed check an unknown or form-ignored flag, and no spec had a state that never drew.
Fix: a positional part narrows every list. An unknown flag, an ignored flag or a retired flag gives exit 2.
Decisions (technical, doc-agent): (1) with no browser, a CI run passes "RENDER CHECK SKIPPED", and a dev-machine
--product/--part run fails with exit 1. (2) The frame.ts import retry stays until the next full-run failure shows
its cause. B227 adds the unknown-arg guard to every design subcommand. Open: a full `design check --product

283\. B199 merge without a record (builder, 2026-11-03). The tree is byte-equal to canvas-frames variant c, apart
from the `@shared` -> `./shared` import rewrite in merge-shared.ts. Nothing records that c was merged or who
decided: sketch.json at HEAD has no `decision`, the merge deleted the sketch dir, and merged.json/pictures.json
hold only hashes. So Tom could not say for sure whether he merged c. Why no tool caught it: `sketch merge` never
had to prove a pick. Fix (B228): merge writes `{variant, decidedBy, at}` into merged.json and refuses a merge
without a recorded pick. B208 landed in 2d3251bfd; the settings.json restore proved B224 live.

284\. HEAD's cli did not compile (builder, 2026-11-03). 5f839ff40 (B221 timeout redraw) has TS2345 in
render-check.ts:526-536, so `yarn design` (nx build cli) failed and every run used a stale dist from 11:49. The
full studio check therefore did not cover a293f319f..ecf7b626b. Why no tool caught it: `yarn commit` runs only
the related vitest specs, and vitest transpiles without a type check, so a type error lands green. The pre-push
typecheck comes too late for unpushed slices that the next slice builds on. Fix (B229, decided, technical):
`yarn commit` also runs `tsc --noEmit -p <lib>/tsconfig.lib.json` for each lib it touches, in the same throwaway
worktree. B221 goes back to built until the type fix lands and the full check reruns. Also: pages/system merged
(c02c7aede, 1eb065b87, f07311c49), but the go is missing (go.json holds the old hash 4fd4095b3c562d4f, merged is
a8cacb703e9e5945). canvas-frames was restored to HEAD and waits for Tom's pick. B223 landed in 6ba7806c6 (B219's
refreshedBy/cause had never landed before it).

285\. B229 + canvas-frames instant (builder, 2026-11-03, fe03eb979). B229: `yarn commit` now type-checks lib and spec
projects. HEAD already carries 13 spec type errors (cli 12, agent-rules 1), so for now a spec project blocks only
on errors in the committed files. B230 clears the 13 and drops that filter. canvas-frames: 40 pairs became
`instant` and 70 real `unreachable` pairs stayed. That declaration edit landed after Tom's go (12:09:43Z), so
the go can go stale through a change that draws nothing. Why no tool caught it: go covers file hashes, not what
the files draw (same lesson as title-bar r3, 281). Order rule: declaration migrations of a merged part are made
before Tom's go. If the check shows the go stale, Tom gives it again. A draw-free go refresh is part of B220's
draw-free signal.

286\. `instant` breaks the part type (builder, 2026-11-03, design check on a fresh dist after d2f70de3c). B194
(649b04940) taught the parser `instant`, but `PartSource` lacks it: TS2353 at canvas-frames.ts:219. Why no tool
caught it: B194's specs parse `instant` from a string, and no spec type-checks a part source that uses it. B229
type-checks libs, not design products. Fix (B231): add `instant` to `PartSource`, plus a spec in which a fixture
part using every key the parser reads passes tsc, and which compares the parser keys with the type keys. Tom's
canvas-frames go held after the instant edit (AUTO ACCEPTED). B226 is proven on the real part. go.json is
committed by Tom or Studio only, never by an agent.

290\. B230 red proof (builder, 2026-11-03). The new node:test case is red on 50024f9b8^, but by a crash (TypeError:
the old function took 3 args), not by an assertion. The behavioural red was shown by hand: the old function
returns [] for a type error in an untouched spec. Why no tool caught it: red-check counts any failure as red, so a
signature change passes as proof. Fix (B238, decided, technical): red-check labels a failure that is a thrown
TypeError/ReferenceError outside an assertion "RED BY CRASH", and that is not proof. The slice then quotes a
behavioural red.

293\. Tom's title-bar merge failed in Studio (2026-11-03, 13:13 CET). Tom picked f and the merge failed, and the
error text is lost: Studio holds the design server's log in a pipe that nothing can read later. Likely cause,
unproven: the sketch was older than the merged title-bar (the rebase came at 13:50), so mergeSketch answered 422
"changed" (needsRebase). Why no tool caught it: Studio offered the merge button on a stale base (B220b), and a
failed Studio action leaves no readable trace. Fix (B241, decided, technical): Studio writes each refused design
action (command, part, status, message) to the host log file, and the builder can read it afterwards. At Tom's
request the builder merged f via the CLI (72ecd0adb). merged.json now holds `{variant: "f", decidedBy: "user",

294\. B227 + B240 data (builder, 2026-11-03). B227 2699545b4: argsOf takes each command's switches, so any other
--flag gives "unknown flag --x (flags: ...)" and exit 2 across all 18 callers. Real repro: `design shot

297\. B227b + lint slip (builder, 2026-11-03). e8a64d994: product, new and system parse via argsOf and refuse
unknown flags with exit 2; each sketch subcommand derives its flags from its SKETCH_USAGE line (so `sketch check

298\. B244 as built (builder, 2026-11-03). f4e6e5b8b: `yarn commit -- <paths>` maps each non-docs path to the nx
project whose project.json owns it (lint target or eslint.config.mjs), and runs `nx run-many -t lint` on them in
the throwaway worktree, after tsc and before the specs, with the main checkout's nx cache. A lint error refuses
the commit and names the projects. Verified: a node:test case builds a tiny nx repo and is refused on a
`no-debugger` error, a docs file lints nothing, and the clean commit lands; red-check RED; a real probe (a
5-param arrow in libs/cli) was refused by max-params in 11 s with tsc. Not verified: a plain `git commit` without
paths (the hook) does not lint; ethlete-studio lint time. Second defect found on the way: 50024f9b8 made every
tsc error block, but its end-to-end case in commit-wait.spec.mjs still asserted the opposite and failed; aligned
in f4e6e5b8b. Why no tool caught it: `yarn commit` selects only Studio and cli suites, so a change in
tools/scripts runs none of `yarn test:tools`. Recommended fix (B245): a tools/scripts change runs the
tools/scripts specs (node --test) in the same worktree. Decided (doc agent): B245 as recommended, technical. The
plain `git commit` gap is closed by B244b (decided, technical): the pre-commit hook runs the same lint on the
projects of the staged files, unless `yarn commit` already linted that exact tree.

299\. B245 + B244b as built (builder, 2026-11-03). 9c015d2af: a tools/scripts change adds a `tools/scripts` suite
that runs every tools/scripts/*.spec.mjs with `node --test` in the worktree (NODE_TEST_CONTEXT stripped, or the
nested run skips itself). The pre-commit hook lints the projects of the staged files in its index checkout, and
skips only when yarn commit tested that exact tree, or when the files committed since select no specs and lint
no project. Verified: two node:test cases (a failing tools spec refuses yarn commit; a lint error refuses a
plain `git commit -i -- <path>`), red-check RED (3 cases); a real hook probe (5-param arrow in libs/cli) was
refused by max-params in 5 s. Not verified: the eslint-rules specs of `yarn test:tools`
(apps/ethlete-studio/eslint-rules) are still not selected by a commit.
Decided (doc agent) on the eslint-rules gap: B245b, technical, but general rather than one more directory. `yarn

303\. Comment draft built into pages/system (Tom, 2026-11-03: "again wrongly part of the system view instead of an
element/component; this still happens far too often"). Facts (builder): pages/system/system.ts:99-137 holds an
inline draft card with its own busy and error states (:82-97, states :307-308) and an inline crosshair target
(:70-78), merged with the comment button sketch 63785ccd0. pages/inbox/shared/inbox.ts:316-329 holds a second,
different draft built from raw `<et-textarea>`/`<button et-button>` strings (4a960f125). The app already
reuses one `ethlete-comment-draft` across two hosts, under a page-named folder. There are 8 page-local
interactive places today: system commentTarget and commentDraft; inbox row, draft popover, raw `<et-switch>`,
raw "Erneut laden" button; merge listRow; sketch-status holdTrigger. capabilities.ts regex-patches `<button`
into embedded markup. Why no tool caught it: no rule looks at interactive UI inline in a page. CONTROL-PART-MISSING
only covers controls the page declares, and a page sketch may add UI freely, because the sketch check runs the
same rules. Q252's list of parts to extract never named the draft. Fix (B247, decided, technical): the problem
rule INLINE-UI-IN-PAGE scans page sources (and page sketch variants, so it blocks sketch ready and merge) for
`<button`, `role="button"`, `tabindex`, raw `<et-` and `data-et-action` outside an embedded part's output, and
names the part to create. The same rule is the design half of A10's embed-don't-copy check. Fix (B248, decided):
extract the 8 places into elements/components parts; a pixel-free extraction is a tidy. The two drafts differ, so
the shared components/comment-draft is a sketch with variants for Tom. B237 (the canvas-frames overlay covers the
draft) is fixed inside that sketch. The builder also verifies whether COMPONENT-COPY flags inbox.ts:309/316-335.
If it does not, that is a gap in the same item.

304\. Tom cannot pick on the B240 sketch (pages/sketches, 5e51db22a, 2026-11-03: "it does not seem ready, I cannot
pick anything; this happens more and more often"). The badge says "Keine Aktivität" and no variant offers
Übernehmen. The empty b/page-100 frame was only still loading (Tom), but the loading state looks bad. This is
finding 208 again: a drawn round committed while still in progress. Cause (builder): ready was skipped, not
refused. 5e51db22a committed sketch.json as "in progress", and the builder's own handoff step ("Tom picks in
Studio") left ready out. ROUND-NOT-READY did fire (sketch-command.ts:802-805, printed :1053-1056 as console.warn,
exit 0). Why no tool caught it: f7e66dbb6 made ROUND-NOT-READY a warning, and a warning that nothing blocks on is
no fix (finding 295). Unblocked in 88a3f737e (`sketch ready` exit 0). Fix (B252, decided, technical):
ROUND-NOT-READY becomes a problem; the commit hook and `sketch report --done` refuse a drawn round that is neither
ready nor held. Loading state (B253): the sketch view renders a picture-loading state that no part designs. The
variant cell (pages/sketches/shared/sketch-rows.ts:128/:146) has no loading branch; only elements/canvas-frames
designs one (canvas-frames.ts:631, "Lädt" badge :171-180). That makes it a B251 case: an undesigned state the app
renders. Fix (B253, decided, technical): a sketch on pages/sketches that adds a loading state to the variant cell,
with 2-3 variants, one of them embedding (not copying) the canvas-frames loading look; Tom picks. Whether the cell
becomes its own element is decided after the pick. The builder checks whether the slow frame is the failing B241
e2e case (a listing refresh re-navigates iframes and leaves 150px frames).

310\. One open sketch per target blocks B253 and B261 (builder, 2026-11-03). pages/sketches holds the B240 round r1,
ready and waiting for Tom's pick. A second question about the same page (the loading state of the variant cell, the
look of the render-error badge) would have to start round r2, which records r1 as lost without Tom deciding. Why no
tool caught it earlier: page-local UI kept unrelated questions on one target, so they queue behind each other.
Decision (technical): one open sketch per target stays, because it keeps a pick coherent. An independent question
gets its own part: the render-error badge becomes components/sketch-status-badge and the variant cell becomes
elements/variant-cell, each as a pixel-free extraction (the same direction as B248a). B253 and B261 are then
sketched on those parts, in parallel with B240. The refusal of a second sketch on the same target names this way
out ("extract the region into a part and sketch that") instead of only refusing.

312\. sketch ready reports pre-existing problems only as a count (builder, 2026-11-03, B240). It prints "5 problems were
there before" per variant and the code never lists them, so nobody can check whether they matter or whether a
variant added one in their place. The problem list of a plain part check on pages/sketches (36 SKIP-SCOPE,
2 COVERED) does not map to the 5. Why no tool caught it: no spec asserts that a counted problem is also printed.
Decision (technical, own slice B264, not folded into B255): sketch check and sketch ready print each pre-existing
problem as rule, file, message and variant, in the same line format the part check uses; a spec asserts the
printed lines equal the count. The B240 pixel compare is not final yet: b and c are 0 px, a differs only in the
caption strip, and the "after" side was a later HEAD, so the exact a7bad251a^ vs a7bad251a shot is still owed.

314\. A design check ran a stale CLI dist (builder, 2026-11-03, B248b). The emptied OPEN_INLINE_UI list lives in
libs/cli, and the first check ran dist/libs/cli from before the edit, so it judged with the old list. Its COVERED
problem in 5 system states is gone on the fresh dist, most likely because that dist also carries fe2d8b87f (B258
settles embedded frames before a shot); not traced. Why no tool caught it: stale-dist.ts and the B256 guard watch
the render packages and the design mocks, not the CLI itself. Tool fix B267: the design command refuses to run
when libs/cli sources differ from what dist/libs/cli was built from, and names `NX_NO_CLOUD=true npx nx build cli`.
B248b itself is accepted with "NOT RED": the change only empties a data list, the rule's own spec covers the
mechanism, and the check runs show 0 INLINE-UI hits on pages/inbox and pages/system.

315\. An empty controls object counts as missing (builder, 2026-11-03, B262). The extracted components/sketch-status-badge
and elements/variant-cell are not interactive, but both carry the open point "no controls declared", and
`controls: {}` does not clear it because open-points.ts treats an empty object like an absent key. That blocks
`ready` for every non-interactive part. Why no tool caught it: no spec separates "declared none" from "not
declared". Decision (technical, B269): an explicit `controls: {}` counts as declared-none; a spec asserts that a
part with `controls: {}` has no open point and a part without the key keeps it.

318\. red-check cannot judge a slice spread over several commits (builder, 2026-11-03, B259). The watchdog landed in
5f6a7e7fc and f1b295520, so `yarn red-check f1b295520` says "passes at the parent state" (the parent already has
the watchdog), and 405e73693 gives LOAD-ONLY. The builder proved red by hand: the final spec against the scripts
of 855305f90 fails 2 cases, against 405e73693 1 case. Why no tool caught it: red-check takes one sha and compares
with its parent only. Decision (technical, B271): `yarn red-check <base>..<head>` runs the specs of head against
the code of base and prints the same verdict; a slice report of several commits quotes the range form.
B259 probe on 9e7ebf434 (load 15-20) moved the B254 blocker: canvas finished in 682 s (its failure is the B232
re-navigation, fixed in 21dcfc17f), while sketches-tree hangs silently (watchdog: TIMEOUT 180 s, no case reached).
Decision: B254 waits on a bisect of sketches-tree alone, after B270 gives that suite per-case output. Two
behaviour cases failed once under load, frame-load-failed "variant frames retried" (B254's own new case) and
canvas "ctrl-wheel keeps the world point" (171 px). Behaviour cases are not excused by load: each must pass 3 of 3
at a load below the core count, or it is a defect with a finding.

320\. Sketching the variant-cell loading state (B253, 421c6cfaa, builder, 2026-11-03) hit four tool gaps.
(1) Variant b wants the canvas-frames loading mark, but an element may not import from another element and
canvas-frames exports no loadingBadge, so b copies the spinner markup. Decision (technical): if Tom picks b, the
merge first extracts components/loading-mark (pixel-free) and both canvas-frames and variant-cell use it; no copy
is merged. (2) There is no `sketch target remove`: a second target that the layer rule refuses stays in the sketch
and blocks ready as "draws the same pixels as Aktuell", so the agent edited sketch.json and deleted files by hand.
Decision B272: `sketch target remove <part>`, and `sketch target add` refuses a target that would break the layer
rule up front; spec: add then remove gives an identical sketch.json. (3) "no looping motion in loading" does not
say how to fix it. Decision: the refusal prints the exact `motions` line to add; folded into B264. (4) The 14 px
SDK spinner reports CLIPPED on its own internals and needed data-et-skip. Decision B273: verify whether the clip is
inside the SDK component; if so, CLIPPED does not descend into SDK component hosts and the skip is removed. Low
priority, not queued: a change that only touches a part's declaration (B269's `controls: {}`) still needs a
manual copy into every open variant plus `sketch rebase --ported`.

345\. Builder (2026-11-04, B287): the title-search gate was red (459-1048 px off), but with a freshly built CLI compare
is 0 px in all 8 states and the app component is unchanged since 6e3c4f00b. Most likely cause (not proven, does
not reproduce): a stale dist/libs/cli from before 0ddbcc120. Why no tool caught it: `design compare` and
`design check` run dist/libs/cli without a stale check, so a stale CLI reports gaps HEAD does not have. Tool fix
(technical): the CLI rebuilds or refuses when its dist is older than the libs/cli sources, as the gate does for
the libs, with a spec. Built as B293. B287 closed with no app change.

346\. Builder (2026-11-04, B254, 5a28fbee9): when the design server cannot load a variant's part module, the variant has
no frames, so Studio showed no render-error badge and still offered Übernehmen on the broken variant. Fixed:
erroredVariantsOf also counts targets with `error`. Why no tool caught it: `sketch ready`/`sketch check` reject an
unloadable variant only at ready time, on the CLI's own server; a variant that breaks later shows nothing in
Studio. Tool fix (technical, queued as B296): Studio treats every server-reported part error as pick-blocking
through one frame-error path, not per view.

350\. Builder (2026-11-04, B291 push 2): the hook passed, then the push died with "Connection to ssh.github.com closed
by remote host". Cause: git opens the SSH connection before pre-push; the old hook (clone, lint, typecheck,
Studio gates; several minutes) outlasts GitHub's SSH idle timeout, so a green hook still ends in a failed push.
This also explains the end of push 1 and why pushes went out with --no-verify. Why no tool caught it: nothing
bounds the hook's run time. Tool fix: S7 (short hook, Tom 04.11.); the hook gets a time budget well under the
SSH idle timeout, and the S7 end-to-end run measures it.

370\. Tom (2026-11-04, during finding 365): the sketches tree on the System canvas vanished and came back only
after a reload. Cause (builder): `system-view.component.ts` did `concat(quick listing, full listing)` with
`catchError(() => of([]))`. When the full listing failed or hit the 120 s timeout (`host/design.ts`), the empty
fallback replaced the quick result that was already on screen. Fix a36530087: `sketchRead$` in
`sketch-read.ts` keeps the last items on a failed listing and carries the error as `sketchesError`. Why no tool
caught it: the lint rule `ethlete/no-silent-catch-error` saw the bug, but Studio runs it as `warn`, and a
disable comment ("no listed sketches render as the existing empty list") silenced it; 28 such comments exist
in `apps/ethlete-studio/src`. The spec "quick ok, full fails" came only with a36530087
(`sketch-read.spec.ts`). Tool fix (B316, decided): the rule becomes `error` in Studio, and one pass reviews all
28 disable comments (error value or an accepted reason).
