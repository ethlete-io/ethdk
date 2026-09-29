# contentful + types scan - open findings

Scan of `libs/contentful/src/` and `libs/types/src/` from 2026-09-28. 1 Medium (verified 2026-09-28: confirmed by reading; the High, three Mediums and both Lows are fixed). Skipped: stories, the 97 generated view files in `libs/types` beyond an export and `any` check.

## contentful: link, config, bundle

- Medium: `provideContentfulConfig` always bundles all five default components (`utils/contentful-config.ts:2-6,29-35`), including `PictureComponent` and `RouterLink`, even when the app replaces every one of them. Not measured; no golden covers `provideContentfulConfig`. Resolve the defaults lazily, or ship them as an opt-in `withContentfulDefaultComponents()`. M Verified by reading: `createContentfulConfig` references all five statically. The size is still not measured.
