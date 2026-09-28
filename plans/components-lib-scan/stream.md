# Stream scan - open findings

Scan of `libs/components/src/lib/stream/` from 2026-09-28. 0 High, 2 Medium, 2 Low, 1 Spec. Skipped: stories, `testing/stream-driver.ts`, `pip-window` / `pip-chrome` templates and CSS beyond the layer and colour check.

## Slot and manager lifecycle

## Consent

- Low: the consent and error cards hard-code an `<h3>` (`stream/consent/stream-consent.component.ts:24`, `stream/error/stream-player-error.component.ts:21`). The heading level is wrong in most page outlines. Use a `role="heading"` element with a configurable `aria-level`, or a non-heading element. S

## Platform embeds

- Medium: the Facebook SDK URL hard-codes the `de_DE` locale and SDK `version=v3.2` (`stream/platform/facebook/headless/facebook-player.directive.ts:13`). Every consumer gets German Facebook UI and a very old API version. Make the locale and version configurable, or use the app's `LOCALE_ID`. S Verified.

## Script loader

## Tree-shaking / bundle size

- Medium: `DEFAULT_STREAM_CONFIG` refers directly to `StreamPlayerLoadingComponent` and `StreamPlayerErrorComponent` (`stream/stream-config.ts:3-4`, `:38-43`). Every slot therefore bundles the spinner, the button and the icon, even when the app supplies its own overlays. Resolve the defaults lazily in the slot, or move them into an opt-in provider. M Verified.

## Cleanup

- Low: `YoutubePlayerSlotDirective` duplicates `StreamPlayerSlotDirective` plus the YouTube params (`stream/platform/youtube/headless/youtube-player-slot.directive.ts:30-54`). Only a scenario spec uses it, and the other platforms have no equivalent. Remove it or make it a thin host-directive wrapper. M

## pip internals (second pass)

- Spec: the window geometry (`checkAndCollapse`, `applyResizeDelta`, `handlePositionAfterResize`, sticky edges) and `pip-animation.ts` have no unit test. M
