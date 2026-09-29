# contentful + types scan - open findings

Scan of `libs/contentful/src/` and `libs/types/src/` from 2026-09-28. 1 Medium, 2 Low (verified 2026-09-28: 5 confirmed, 1 re-rated; the High and three Mediums are fixed). Skipped: stories, the 97 generated view files in `libs/types` beyond an export and `any` check.

## contentful: link, config, bundle

- Low: `createContentfulConfig` merges shallowly (`utils/contentful-config.ts:24-44`). `provideContentfulConfig({ components: { image: MyImage } })` type-checks but drops the default link, file, video and audio components, so links render as plain anchors and other assets are skipped. Merge `components` and `imageOptions` one level deep. S Re-rated from Medium: `apps/docs/contentful/index.md` documents the shallow merge in a warning box, so this is an API improvement, not a bug.
- Medium: `provideContentfulConfig` always bundles all five default components (`utils/contentful-config.ts:2-6,28-34`), including `PictureComponent` and `RouterLink`, even when the app replaces every one of them. Not measured; no golden covers `provideContentfulConfig`. Resolve the defaults lazily, or ship them as an opt-in `withContentfulDefaultComponents()`. M Verified by reading: `createContentfulConfig` references all five statically. The size is still not measured.

## types

- Low: `LineupPlayerV2View` is exported from `lib/api/Lineup/index.ts:1` but missing from `lib/api/index.ts` (which lists only `LineupListView`, `LineupPlayerView`, `FormationStructureView`), so consumers cannot import it from `@ethlete/types`. Fix it in the generator; the file is generated. S
