# hunt-overlay — bug hunt 2026-10-10

Scope: `libs/components/src/lib/{overlay,menu,tooltip,toggletip,command-palette}`, `libs/core/src/lib/overlay`
(runtime, focus, positioning), `libs/core/src/lib/animations/animated-lifecycle.directive.ts` as the runtime uses it.
Checked against `overlay.md` (OV-01..OV-14), REPORT.md "Known gaps" and `git log -40` of the paths.

| ID    | Sev    | Kind | Decision | Title                                                                                      |
| ----- | ------ | ---- | -------- | ------------------------------------------------------------------------------------------ |
| HO-01 | Medium | bug  | no       | A menu closed by a route navigation reopens itself and takes focus                         |
| HO-02 | Low    | bug  | no       | A menu item that turns disabled while active breaks arrow navigation and keyboard submenus |
| HO-03 | Low    | bug  | no       | Mod+K during the palette's leave animation does nothing                                    |
| HO-04 | Low    | bug  | no       | The modal focus trap leaks focus out through a native radio group at either end            |
| HO-05 | Low    | bug  | no       | Opening a modal resets the page's horizontal scroll                                        |

## HO-01 A menu closed by a route navigation reopens itself and takes focus

- Where: `libs/components/src/lib/overlay/overlay-manager.ts:129-142` (closes every overlay whose
  `closeOnNavigation ?? !disableClose` is true); `libs/components/src/lib/menu/headless/menu.directive.ts:681-692`
  (menu config sets neither `closeOnNavigation` nor `disableClose`), `:708-738` (afterClosed handler), `:149-182`
  (mount effect).
- Problem: since OV-01 (`d21962d18`) the overlay manager closes a menu's overlay on a `NavigationStart` to another
  path, through `closeVia('navigation')`. The menu never learns about it: its `open` model stays `true`. When the
  leave animation ends, the menu's `afterClosed` handler sets `overlayRef` to `null` and then returns early at
  `if (this.open()) return;` (the branch meant for "reopened while closing"). The effect re-runs on the `overlayRef`
  change, sees `open() && !overlayRef()` and calls `mountOverlay()` again; one frame later `applyInitialFocus()`
  moves focus into the new panel (the kept `openSource`/`requestedFocus` were not reset).
  Sequence: a menu in an app header (stays mounted across routes) is open → the user presses the browser Back
  button (or the app navigates programmatically: session-expired redirect, a websocket push, a menu item with
  `closeOnActivate="false"` that navigates) → the menu animates out and pops back open on the new page, focused,
  with `aria-expanded="true"` the whole time. A `routerLink` item that closes the menu first is not affected.
  `etOverlay` does not have the bug because it mirrors `beforeClosed` into its `open` model
  (`overlay/headless/overlay.directive.ts:276-289`); the toggletip does the same (`toggletip.directive.ts:262-272`).
  No spec, story or e2e drives a menu through a router navigation.
- Fix: in `MenuDirective.mountOverlay`, subscribe to `overlayRef.beforeClosed()` (or the event variant) and when the
  close was not started by the menu itself (source `navigation`, or any close while `open()` is still `true` and no
  reopen was requested), set `open` to `false` and clear `openSubmenu` - so a real reopen-while-closing
  (`openAt` → `open.set(true)` during the leave) still remounts. Add a `menu.directive.spec.ts` case with
  `provideRouter`: open the menu, `router.navigate(['/other'])`, flush frames, expect `open()` false and no overlay.
- Breaking: no. Decision: no.
- Status: fixed - the menu mirrors its overlay's `beforeClosed` into `open`; spec `MenuDirective router navigation`.

## HO-02 A menu item that turns disabled while active breaks arrow navigation and keyboard submenus

- Where: `libs/components/src/lib/menu/headless/menu.directive.ts:611-618` (`moveActive`), `:386-396` (ArrowRight),
  `:426-436` (Enter/Space), `:641-646` (typeahead start); `menu-item.directive.ts:71-85` (`tabIndex`).
- Problem: `activeItem` is never cleared when the active item becomes disabled. Common pattern: an item with
  `[closeOnActivate]="false"` and `[disabled]="saving()"` that disables itself on click. Then:
  1. ArrowDown: `enabledItems().indexOf(current)` is `-1`, so `moveActive` jumps to the first item instead of the
     one after the disabled row (ArrowUp jumps to the last).
  2. If the item is a submenu trigger: ArrowRight / Enter / Space read `activeItem().submenu` without checking
     `isDisabled()` and open the submenu of a disabled item. `4986d19f6` closed this only for click and hover.
  3. With an active-but-disabled item every item computes `tabIndex -1`, so Shift+Tab back into the panel has no stop.
  4. Typeahead starts at index `-1 + …`, so a multi-letter query is matched from the last item first.
- Fix: clear `activeItem` (keep the DOM position) when `activeItem().isDisabled()` becomes true, and resolve the
  neighbour from `sortedItems()` position instead of `enabledItems().indexOf`; guard ArrowRight/Enter/Space with
  `!item.isDisabled()`. Spec: active item disabled → ArrowDown lands on the next enabled item; ArrowRight on a
  disabled submenu trigger opens nothing.
- Breaking: no. Decision: no.
- Status: fixed - arrow keys resolve the neighbour by DOM position, ArrowRight/Enter/Space skip a disabled submenu trigger, `tabIndex` falls back to the first enabled item. Sub-claim 4 (typeahead) rejected: the first keystroke is always a "repeated" query and moves the active item to an enabled one, so a multi-letter query never starts from a disabled item.

## HO-03 Mod+K during the palette's leave animation does nothing

- Where: `libs/components/src/lib/command-palette/command-palette-shortcut.directive.ts:89-101`;
  `libs/core/src/lib/overlay/overlay-runtime.ts:340` (an entry leaves `openEntries` only at destroy).
- Problem: `toggle()` looks the palette up in `openOverlays()`, which still lists a closing palette until its leave
  animation ends. Sequence: Mod+K opens, Escape closes, Mod+K again within the leave animation → `toggle()` finds
  the closing palette, calls `close()` (a no-op, already closing) and returns; the palette does not reopen and the
  key press is swallowed (`preventDefault`). Same when a command runs with `closeOnRun` and the user presses Mod+K
  right after.
- Fix: skip refs whose `state()` is `closing`/`closed` in the lookup (then open a fresh palette). Spec in
  `command-palette-shortcut.directive.spec.ts` with a lifecycle that does not settle immediately.
- Breaking: no. Decision: no.
- Status: fixed - the shortcut skips a closing palette (new internal `isClosing()` on the overlay ref internals).

## HO-04 The modal focus trap leaks focus out through a native radio group at either end

- Where: `libs/core/src/lib/overlay/overlay-focus.ts:4-14`, `:48-60`, `:132-153`.
- Problem: `getFocusableElements` lists every `input[type=radio]` (each has `tabIndex 0`), but the browser tabs only
  to the checked radio of a group. The trap wraps only when the active element is literally the first/last list
  entry. Sequence: a dialog whose last control is a native radio group (A, B checked, C) → Tab on B: B is not
  `lastElement` (C is), so the trap does nothing and the browser moves focus out of the pane - the runtime root is
  the last child of `<body>`, so focus goes to the browser chrome / back to the page behind the modal. Mirror case:
  Shift+Tab from a checked non-first radio of a group that opens the dialog. SDK controls use roving tabindex and
  are not affected; consumer forms with native radios are.
- Fix: collapse radio groups in `getFocusableElements` to the tabbable member (checked one, else the first of the
  `name` group within the pane), or compare by "would the browser leave the pane" (`nextTabbable` outside `pane`).
  Spec in `overlay-focus.spec.ts`.
- Breaking: no. Decision: no.
- Status: fixed - `getFocusableElements` collapses a named radio group to its checked (else first) radio and the trap compares by tab stop; unit spec + core scenario `hunt-overlay-fixes.scenario.spec.ts`.

## HO-05 Opening a modal resets the page's horizontal scroll

- Where: `libs/components/src/lib/overlay/overlay-scroll-blocker.ts:51-63` (`left: '0'`, only `scrollY` saved),
  `:83` (`scrollTo(0, top)`).
- Problem: on a page that scrolls horizontally (wide table without its own scroller), opening any modal pins the
  root at `left: 0` (content jumps sideways behind the backdrop) and closing it scrolls to `x = 0`, losing the
  user's horizontal position. No spec checks `scrollX`.
- Fix: save `scrollX` too, lock with `left: -${x}px` (drop `right: 0` or set width), restore with `scrollTo(x, top)`.
  Spec next to the existing scroll-restore case.
- Breaking: no. Decision: no.
- Status: fixed - the blocker saves `scrollX`, locks with `left: -x; right: x` and restores with `scrollTo(x, y)`.

## Checked, no finding

- Close during the open animation: `leave()` from `init` settles synchronously to `left`, and `beginClose` subscribes
  to the replaying `state$`, so the overlay is destroyed; `markOpened` is guarded by `state === 'mounting'`.
- Focus restore after nested close (OV-02 chain) and the reopen click swallow disarm (`e87bcf753`) hold.
- Leaks after destroy: runtime listeners, focus trap, root elements and armed swallows are all in `cleanupFns` /
  the runtime `onDestroy`; tooltip/toggletip close on host destroy (`98aa8eb08`); the tooltip description node is
  removed on destroy. Drag-to-dismiss streams end on `afterClosed`.
- SSR: the scoped code reads `document` through DI; tooltip description sync is browser-gated.
- Query-param opener destroyed by a navigation started inside its overlay: `injectUrl` already reads the committed
  URL, so `ownsTopEntry()` is false and no `location.back()` runs.
