# Stream scan - open findings

Scan of `libs/components/src/lib/stream/` from 2026-09-28. 0 High, 1 Medium, 2 Low, 1 Spec. Skipped: stories, `testing/stream-driver.ts`, `pip-window` / `pip-chrome` templates and CSS beyond the layer and colour check.

## Slot and manager lifecycle

## Consent

- Low: the consent and error cards hard-code an `<h3>` (`stream/consent/stream-consent.component.ts:24`, `stream/error/stream-player-error.component.ts:21`). The heading level is wrong in most page outlines. Use a `role="heading"` element with a configurable `aria-level`, or a non-heading element. S

## Platform embeds

## Script loader

## Tree-shaking / bundle size

- Medium: `DEFAULT_STREAM_CONFIG` refers directly to `StreamPlayerLoadingComponent` and `StreamPlayerErrorComponent` (`stream/stream-config.ts:3-4`, `:46-51`). Every slot therefore bundles the spinner, the button and the icon, even when the app supplies its own overlays. Resolve the defaults lazily in the slot, or move them into an opt-in provider. M Verified.

## Cleanup

- Low: `YoutubePlayerSlotDirective` duplicates `StreamPlayerSlotDirective` plus the YouTube params (`stream/platform/youtube/headless/youtube-player-slot.directive.ts:30-54`). Only a scenario spec uses it, and the other platforms have no equivalent. Remove it or make it a thin host-directive wrapper. M

## pip internals (second pass)

- Spec: the window geometry in `stream/pip/headless/internals/pip-window-position.ts` (`checkAndCollapse`, `applyResizeDelta`, `handlePositionAfterResize`, sticky edges) has no unit test. (`pip-animation.ts` now has one.) M
