# `etTablePageStickyHeader` freezes the page scroll

Date: 2026-08-19. Reported from the `fut-frontend` hub Partners list view. The user scrolls with a
mouse wheel and the page stops for seconds at a time.

**Status: cause confirmed and measured. The fix is chosen and not yet written. One trial is still
owed before the build: horizontal gestures against the `hostx` animation, see piece 2.**

## The symptom

The user scrolls to the bottom of the list, then scrolls up. The page stops. The stall lasts up to
8258 ms. A mouse move releases it, and the whole swallowed distance then applies in one frame.

The user confirmed the trigger on the live page. Removal of the `et-table-host--page-sticky-header`
class stopped it: "No more freezes after `__f.stickyHeaderOff()`".

## What the trace shows

From a DevTools recording of the failure (`Trace-20260818T221740.json.gz` in `fut-frontend`), times
relative to `t0 = min(ts)`:

- No frame from 7051.2 to 10894.2 ms, a gap of 3843 ms. Confirmed against the 182 `Screenshot` events.
- `needsBeginFrame` drops to 0 twice: a short park of 372 ms, then a park of 3426 ms.
- Between the parks, 5 `BeginFrame`s and 4 `Commit`s ran and produced zero `DrawFrame`s.
- No `ActivateLayerTree`, no `Activation` and no `RasterTask` for 4333 ms.
- 125 `GestureScrollUpdate` events arrived inside the long park. 13 of them carry only
  `BEGIN_RWH + ORIGINAL + SCROLL_UPDATE_ORIGINAL`, so the impl thread never saw them.
- The wheel gesture needed a main-thread hit test. That hit test at 7437.3 carries no `move: true`
  flag, unlike every neighbour, and it coincides with the gesture's `GestureScrollBegin`.
- The next hit test is the mouse move at 10884.6 that ends the freeze.
- The main thread was idle. A major mark-compact GC ran from 8600 to 9600 ms, which starts 1540 ms
  after the first park and ends 1280 ms before the wake. GC is ruled out.
- No `wheel` `EventDispatch` anywhere, so no application handler and no `preventDefault`.

## The measurements

Environment: Google Chrome 151.0.7922.137 (flatpak), Fedora, Wayland, device pixel ratio 1.25,
viewport 1220x1584. Page: the hub list view at `/partners?scope=all&limit=100`. The geometry matches
the user's own dump exactly:

`travel 6808px`, `from 237px`, `to 7045px`, document maximum scroll `5802px`, host `1141x6908`,
host vertical range `0`, 9 header cells, 9 animations.

Note that `to` is 1243 px past the furthest the page can scroll. The range end is unreachable, so the
animation never leaves its active phase.

Method, one trial: scroll to the bottom, wait 1300 ms so the pipeline parks, then send one animated
upward mouse scroll gesture through `Input.synthesizeScrollGesture`. Count the trials in which no
scroll event arrives. Nothing runs in the page during the window. An `requestAnimationFrame` sampler
must never be used, because it keeps the compositor awake and hides the fault.

| Mode       | Stalls | What changed                                                                 |
| ---------- | ------ | ---------------------------------------------------------------------------- |
| `noanim`   | 0/12   | the animation is removed                                                     |
| `paused`   | 0/12   | the animation stays, `animation-play-state: paused`                          |
| `hostx`    | 0/12   | the same animation, driven by the host's x axis instead of the root scroller |
| `onecell`  | 4/12   | one animated header cell instead of nine                                     |
| `anim`     | 6/12   | unchanged                                                                    |
| `clamp`    | 7/12   | range end set to the document's maximum scroll                               |
| `endearly` | 7/12   | range ends 3802 px before the maximum scroll                                 |
| `literal`  | 7/12   | every `var()` replaced by the resolved length                                |
| `fix`      | 8/12   | travel and range end clamped together, the 1:1 rate kept                     |

## The cause

A running scroll timeline on the root scroller blocks the wake of the compositor for a pending input
source. The three clean modes prove which part matters:

- `paused` keeps the animation, its composited layer and its held transform. Only the play state
  changes, and the stall goes.
- `hostx` keeps a running, composited, scroll-driven animation. Only the scroller changes, and the
  stall goes.
- No value of the range, the travel, the fill mode or the `var()` indirection helps.

Therefore the trigger is a scroll timeline whose scroller is the same scroller whose input is
blocked. The animated element count only scales the rate.

## Limits of the repro

The harness reproduces a correlated proxy, not the user's hard freeze. A synthesized gesture stalls,
because the gesture controller needs frames to produce its wheels. Plain injected wheels still move
the page, and a stream of small precise deltas never stalls. So the harness measures the same wake
failure as the trace, through a different input source.

## Rejected hypotheses

Nine were tested and rejected. Do not spend time on them again.

1. Sticky positioning fights the animation over one transform node. The user dropped
   `position: sticky` and kept the animation. The freeze persisted.
2. A transform grows the host's scrollable overflow and feeds back. The user set the host to
   `overflow: clip`. The freeze persisted.
3. A zero vertical scroll range on the host swallows the wheel through scroll latching. The wheel
   chains to the page in every variant, and there is no `overscroll-behavior` in the table CSS.
4. The animation forces the root scroll onto the main thread. Measured through `frame_reporter`:
   `SCROLL_COMPOSITOR_THREAD` 80, `SCROLL_MAIN_THREAD` 0.
5. The 161 composited layers put the wheel on the main-thread hit test path.
6. Scale. 126,300 retained DOM nodes and a 99.5 MB heap. The live page holds 4062 live nodes, and it
   still fails after a hard reload.
7. An artefact of the DevTools recording.
8. The `var()` in the keyframe de-composites the animation. See `literal`, 7/12.
9. An unreachable range end. See `clamp`, `endearly` and `fix`, all worse than `anim`.

## The chosen fix: make the header row page sticky for real

The user chose this over a scroll listener and over a mitigation. Drive nothing off the root
scroller.

### Why plain `position: sticky` does not work today

A sticky element pins to its nearest scrollport. `.et-table-host` carries `overflow-x: auto`, and CSS
forces the other axis to `auto` too, because `visible` next to `auto` computes to `auto`. So the host
is a vertical scrollport as well, and a sticky header inside it pins to the host's own top edge. The
host has no vertical scroll of its own, because its height is the whole grid. The header can
therefore never reach the viewport. `overflow-y: clip` does not help: the element is still a scroll
container for the x axis, so it is still the nearest scrollport.

The header row must leave the horizontal scroll container. There is no CSS-only way around it.

### Target structure

Today, in `table.component.html:3`:

```
.et-table-host            overflow-x: auto, page height
  div.et-table            the grid, grid-template-columns = templateColumns()
    .et-table-header-row  a grid row
    body rows
```

Target, in the page-sticky mode only:

```
.et-table-host              overflow: visible, page height, position: relative
  .et-table-header-strip    position: sticky; top: var(--et-table-sticky-header-offset); overflow: clip
    div.et-table-header     a grid, grid-template-columns = templateColumns()
  .et-table-scroller        overflow-x: auto
    div.et-table            the same grid, body rows only
```

The header strip is a sibling of the horizontal scroller, so it pins to the page.

### The three pieces of work

1. **Shared column tracks.** `templateColumns()` (`table.component.ts:780`) is already one computed
   string, but the second grid must not read it. The track list is not always rigid: `defaultTrack()`
   emits `minmax(<min>px, 1fr)`, a consumer's `column.width` can be `auto`, and an autosize pass sets
   `max-content` (`columnTracks`, `table.component.ts:744`). The container width resolves `px`, `fr`
   and `minmax()` tracks, so the scroller's `scrollWidth` on the header grid covers those. It does
   not cover `auto`: an `auto` track sizes to its own content, the two grids hold different content,
   and the disagreement stays. So instead: read the body grid's resolved
   `getComputedStyle(...).gridTemplateColumns`, which is a plain px list, and set that on the header
   grid. Re-measure on the same layout signals the sticky-header directive already uses.

   The autosize measurement itself also changes, and not for one frame. Today `autosizeColumns`
   (`table.component.ts:1763`) lets a track out to `max-content` and reads back what the one grid
   gave it, so the header label contributes. After the split, the body grid measures without the
   header label, and a column can autosize narrower than its own header text. The pass must take the
   maximum of the two grids' measured widths.

2. **Horizontal sync.** Translate the header grid by the scroller's `scrollLeft`. Drive it with a
   scroll timeline on the scroller's x axis, `scroll-timeline: --et-table-x x`. The strip is a
   sibling of the scroller, and a named timeline is visible only to descendants, so the host must
   carry `timeline-scope: --et-table-x` to lift the name up. Without it the sync does nothing.

   **Risk, measure before the build.** By this plan's own cause statement, the trigger is a scroll
   timeline on the scroller whose input is blocked. This piece puts a timeline on the scroller's x
   axis, and the user scrolls that same scroller sideways. The `hostx` trials sent only vertical
   page gestures, so they do not cover this case. Run one more trial: the `hostx` animation, with
   horizontal gestures at the host. If it stalls, sync the x axis with a passive scroll listener on
   the scroller instead. A one-frame lag on the x axis costs less than one on the y axis.

3. **Pinned header cells.** A start-pinned or end-pinned header cell must not move with the
   translate. Give it a counter-translate off the same timeline. `position: sticky` cannot do it,
   because the strip is `overflow: clip` and so it is not a scrollport. The counter-translate needs
   the scroller's maximum scroll distance as a custom property. The sticky-header directive writes
   it on the same layout signals it measures the travel on, never on scroll.

### What to re-verify after the restructure

The header row carries much more than labels. Each of these needs a check against the new DOM:

- `table-sticky-columns.directive.ts`, the pinned column offsets.
- `table-resize.directive.ts` and `table-resize-grip.component.ts`, the grips.
- `table-column-menu-trigger.component.ts` and `table-filter-trigger.component.ts`, the adornments.
- `table-reorder.directive.ts`, the header drag.
- `table-keyboard-nav.directive.ts`, the focus order across two grids.
- `table-group-headers.directive.ts`, which renders rows above the header row with `display: contents`.
- `table-drag-scroll.directive.ts` and `table-virtual-scroll.directive.ts`, both bound to the scroller.
- `table-skeleton-rows.component.ts` and `table-card-surface.directive.ts`, the chrome.

### Scope warning

This is not a contained change. `table.component.ts` is about 80k, `table.component.css` about 54k
and `table.component.html` about 18k. A bounded table must keep today's DOM, because its host is the
vertical scrollport and its header already pins with plain sticky. So the table gains a second layout
mode, gated on the feature. Plan for the two modes in the template, the stylesheet and the specs.

### Alternatives, and why they lost

- **A passive root scroll listener that writes the same transform.** Small and contained, and it
  keeps one grid. It puts the travel back on the main thread, so the header can lag by a frame on a
  fast scroll. That reverses the reason the scroll timeline was chosen.
- **Animate one wrapper element instead of nine cells.** Measured 4/12 against 6/12. It lowers the
  rate and does not remove the freeze.

## Owed

- A changeset for the fix.
- A Chromium bug report with the repro, whatever the SDK ships. A running scroll timeline on the root
  scroller should not block the wake for pending input.

## The repro scripts

They live in the app repo, next to the handoff, at
`fut-frontend/.agents/handoffs/hub-list-view-scroll-freeze/` (gitignored):

- `trial.js` — the 12-trial harness above. `node trial.js <mode> 12`. Modes: `anim`, `noanim`,
  `onecell`, `clamp`, `smalltravel`, `nofill`, `fix`, `paused`, `endearly`, `literal`, `hostx`.
- `live-chrome.js`, `live2.js`, `live3.js`, `live4.js` — earlier drivers, kept for their controls.
- `trial2.js` — small precise wheel deltas. Clean, so plain wheels are never swallowed here.
- `probe-gesture.js` — shows that a CDP wheel jumps instantly and a synthesized gesture animates.
- `freeze-probe.js`, `freeze-probe2.js` — the console probes the user ran on the live page.

All of them drive real Chrome over CDP, not Playwright's bundled Chromium, which is two major
versions behind:

```
flatpak run com.google.Chrome --user-data-dir=/home/tom/.var/app/com.google.Chrome/cdp-profile \
  --remote-debugging-port=9222 --no-first-run --no-default-browser-check about:blank
```

The app must run on `localhost:4200`. The list view needs `?scope=all&limit=100`, because the default
loads too few rows to scroll. The app talks to staging, so never create or edit a saved view or a
layout while testing.
