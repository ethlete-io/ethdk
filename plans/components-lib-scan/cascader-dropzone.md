# forms/cascader + forms/dropzone scan - open findings

Scan of `libs/components/src/lib/forms/cascader/` and `libs/components/src/lib/forms/dropzone/` from 2026-09-28. 0 High, 0 Medium, 6 Low, 1 Spec (1 refuted in verification). Skipped: stories and specs (read only to check coverage), the CSS files beyond a layer and colour check, the query internals behind `executeUntilSettled$`.

## cascader - keyboard and a11y

## cascader - state and streams

## cascader - cleanup

- Low: `internals/cascader-tree` is re-exported from the public headless barrel, which publishes `toChildrenObservable`, `toSearchObservable`, `toPathObservable`, `nodesEqual` and `indexOfNode` (`forms/cascader/headless/index.ts:9`). Export only the types and `canHaveChildren`/`defaultCompareWith`. S
- Low: The panel shadow uses a hardcoded colour as the primary value (`forms/cascader/cascader-panel.component.css:43`). S

## dropzone - validation and upload

- Low: The rejection messages and the upload-failure sentence are hardcoded English outside `DropzoneLabels` (`forms/dropzone/headless/dropzone-validation.ts:74`, `forms/dropzone/dropzone.component.ts:264`). S

## dropzone - previews and drag events

- Low: Every accepted image is read in full into a `data:` URL, with no size cap, and all files of a multi-drop read in parallel (`forms/dropzone/headless/dropzone-entry.ts:62`, `:92`). A drop of several large photos holds each as a base64 string (about 1.33x the file) in the JS heap and in the `<img src>`. Skip the preview above a size limit or downscale it. No object URLs are created, so there is nothing to revoke; the reader is aborted on dispose. M Re-rated from Medium: the data URL is a documented CSP choice, and `maxFileSize` already bounds the cost.

## dropzone - a11y

## dropzone - cleanup

- Low: `ResolvedDropzoneUploadConfig.selectValue` is typed `any` behind an eslint-disable and only the dev-mode shape check reads it (`forms/dropzone/headless/dropzone-upload.ts:92`). Type it `unknown` or drop it from the resolved config and check `createUploadHandle` only. S
- Low: The preview info bar uses hardcoded colours as primary values (`rgb(0 0 0 / 0.6)`, `white`) (`forms/dropzone/dropzone-preview-styles.component.css:32`). S

## Spec gaps

- Spec: No dropzone spec covers a single-mode replace whose new upload fails (`forms/dropzone/headless/dropzone.directive.spec.ts`). S

## Refuted in verification

- Single-mode replace deletes the old file before the new upload succeeds: `apps/docs/components/dropzone.md:65,124` documents this as intended (the value clears until the new upload succeeds, and a replace deletes like a remove).
