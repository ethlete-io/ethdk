# Stream scan - open findings

Scan of `libs/components/src/lib/stream/` from 2026-09-28. 0 High, 2 Medium, 11 Low, 1 Spec. Skipped: stories, `testing/stream-driver.ts`, `pip-window` / `pip-chrome` templates and CSS beyond the layer and colour check.

## Slot and manager lifecycle

- Low: `pip-player` casts a missing entry to `StreamPipEntry` (`stream/pip/pip-player.component.ts:62`). Without an `entry` input or a `PipCellDirective`, `thumbnailUrl` and the `onDestroy` at `:72` throw a `TypeError`. Throw a clear dev-mode error instead. S
- Low: the stream manager appends its `.et-stream-manager` container to `document.body` on the server too (`stream/stream-manager.ts:31-33`). SSR output gets an empty container, and the client adds a second one. Guard it with `isPlatformBrowser`. S

## Consent

- Low: the consent and error cards hard-code an `<h3>` (`stream/consent/stream-consent.component.ts:24`, `stream/error/stream-player-error.component.ts:21`). The heading level is wrong in most page outlines. Use a `role="heading"` element with a configurable `aria-level`, or a non-heading element. S

## Platform embeds

- Medium: the Facebook SDK URL hard-codes the `de_DE` locale and SDK `version=v3.2` (`stream/platform/facebook/headless/facebook-player.directive.ts:13`). Every consumer gets German Facebook UI and a very old API version. Make the locale and version configurable, or use the app's `LOCALE_ID`. S Verified.

## Script loader


## Tree-shaking / bundle size

- Medium: `DEFAULT_STREAM_CONFIG` refers directly to `StreamPlayerLoadingComponent` and `StreamPlayerErrorComponent` (`stream/stream-config.ts:3-4`, `:38-43`). Every slot therefore bundles the spinner, the button and the icon, even when the app supplies its own overlays. Resolve the defaults lazily in the slot, or move them into an opt-in provider. M Verified.

## Cleanup

- Low: `YoutubePlayerSlotDirective` duplicates `StreamPlayerSlotDirective` plus the YouTube params (`stream/platform/youtube/headless/youtube-player-slot.directive.ts:30-54`). Only a scenario spec uses it, and the other platforms have no equivalent. Remove it or make it a thin host-directive wrapper. M
- Low: `snapToPosition` and `snapTo` duplicate each other (`stream/pip/headless/internals/pip-window-position.ts:77-100`). Two quick snaps start two timers, and the first timer removes the transition in the middle of the second snap. Merge them and cancel the pending timer. S

## pip internals (second pass)

- Low: the new-pip animation and the resize gesture share one `forcedTitleBar` boolean, and each new-pip animation resets the stage `overflow` on its own (`stream/pip/headless/internals/pip-animation.ts:188-189,262-270`, `stream/pip/headless/internals/pip-window-position.ts:431,443`). A second pip that arrives within 900 ms of the first has its thumbnail clipped and the title bar hides in the middle of it, and a resize that starts during the animation loses the title bar 100 ms after the animation ends. Count the holders (for example, a counter or a set of reasons) instead of a boolean. S Re-rated from Medium: the glitch is visual and lasts until the animation or the resize ends.
- Low: two `startModeTransition` calls inside 260 ms overlap (`stream/pip/headless/internals/pip-window-position.ts:583-599`). The first timer clears `positionUpdateBlocked`, removes the transition class and snaps while the second transition still runs. Two quick `selectCell` calls in grid mode reach this. Cancel the pending timer on each call. S
- Low: the `ratio === null` branches are dead code (`stream/pip/headless/internals/pip-window-position.ts:269,284,368,462,470-475,485-490`). `PIP_WINDOW_ASPECT_RATIO_TOKEN` is a `Signal<number>` (`stream/pip/headless/pip-window-aspect-ratio.token.ts:3`). The dead path is also wrong: a drag resize never changes the height and ignores `minHeight`/`maxHeight`. Remove the branches, or fix them if a free-aspect window is planned. S
- Low: an aspect ratio of `0` passes `ASPECT_RATIO ?? 16 / 9` (`stream/stream-player-slot.directive.ts:83`, `stream/pip-manager.ts:94`) and reaches `newW / ratio` without a `> 0` check (`stream/pip/headless/internals/pip-window-position.ts:486`, `stream/pip/headless/internals/pip-window-size.ts`, `stream/pip/headless/internals/pip-animation.ts:162-163`). The window height becomes `Infinity` and the new-pip keyframes get `NaN`. Reject a non-positive ratio where the slot and the manager read it. S
- Low: `destroyRef.onDestroy(() => endInteraction())` always clears `user-select` on `document.body` (`stream/pip/headless/internals/pip-window-position.ts:253-256,506`). A pip window that never started a drag or resize still removes an inline `user-select` that the app set on the body. Call `endInteraction` on destroy only while a gesture runs. S
- Low: `animateScaleFadeOut` has no `oncancel` handler, unlike `animateWithFixedWrapper` (`stream/pip/headless/internals/pip-animation.ts:133` vs `:72-73`). If the animation is cancelled, `onFinish` never runs, the pips stay active and `isExiting` stays `true`. Call `onFinish` from `oncancel` too, behind a `done` latch. S
- Spec: the window geometry (`checkAndCollapse`, `applyResizeDelta`, `handlePositionAfterResize`, sticky edges) and `pip-animation.ts` have no unit test. M
