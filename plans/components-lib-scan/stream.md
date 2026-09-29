# Stream scan - open findings

Scan of `libs/components/src/lib/stream/` from 2026-09-28. 0 High, 1 Medium, 0 Low (1 fixed: consent and error headings are paragraphs in fcdd41719), 0 Spec. Skipped: stories, `testing/stream-driver.ts`, `pip-window` / `pip-chrome` templates and CSS beyond the layer and colour check.

## Slot and manager lifecycle

## Consent

## Platform embeds

## Script loader

## Tree-shaking / bundle size

- Medium: `DEFAULT_STREAM_CONFIG` refers directly to `StreamPlayerLoadingComponent` and `StreamPlayerErrorComponent` (`stream/stream-config.ts:3-4`, `:46-51`). Every slot therefore bundles the spinner, the button and the icon, even when the app supplies its own overlays. Resolve the defaults lazily in the slot, or move them into an opt-in provider. M Verified.
