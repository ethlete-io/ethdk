# forms/cascader + forms/dropzone scan - open findings

Scan of `libs/components/src/lib/forms/cascader/` and `libs/components/src/lib/forms/dropzone/` from 2026-09-28. 0 High, 0 Medium, 14 Low, 1 Spec (1 refuted in verification). Skipped: stories and specs (read only to check coverage), the CSS files beyond a layer and colour check, the query internals behind `executeUntilSettled$`.

## cascader - keyboard and a11y

## cascader - state and streams

## cascader - cleanup

- Low: `internals/cascader-tree` is re-exported from the public headless barrel, which publishes `toChildrenObservable`, `toSearchObservable`, `toPathObservable`, `nodesEqual` and `indexOfNode` (`forms/cascader/headless/index.ts:9`). Export only the types and `canHaveChildren`/`defaultCompareWith`. S
- Low: The panel shadow uses a hardcoded colour as the primary value (`forms/cascader/cascader-panel.component.css:43`). S

## dropzone - validation and upload

- Low: `isFileAccepted` treats `*/*` as a literal type prefix, so `accept: '*/*'` rejects every file (`forms/dropzone/headless/dropzone-entry.ts:174`). S
- Low: The rejection messages and the upload-failure sentence are hardcoded English outside `DropzoneLabels` (`forms/dropzone/headless/dropzone-validation.ts:74`, `forms/dropzone/dropzone.component.ts:264`). S
- Low: An existing entry without a resolved `name` falls back to `String(value)`, which shows `[object Object]` for object values (`forms/dropzone/headless/dropzone-entry.ts:136`). S

## dropzone - previews and drag events

- Low: Every accepted image is read in full into a `data:` URL, with no size cap, and all files of a multi-drop read in parallel (`forms/dropzone/headless/dropzone-entry.ts:62`, `:92`). A drop of several large photos holds each as a base64 string (about 1.33x the file) in the JS heap and in the `<img src>`. Skip the preview above a size limit or downscale it. No object URLs are created, so there is nothing to revoke; the reader is aborted on dispose. M Re-rated from Medium: the data URL is a documented CSP choice, and `maxFileSize` already bounds the cost.
- Low: `handleDragLeave` returns early when the control is not interactive, so `dragDepth` stays above 0 when `disabled`/`readonly` turns on during a drag and `data-drag-over` sticks until the next drop (`forms/dropzone/headless/dropzone.directive.ts:385`). Always decrement, or reset the depth when `interactive()` turns false. S
- Low: A disabled or readonly dropzone does not call `preventDefault` on `dragover`/`drop`, so a dropped file makes the browser navigate to it and discard the form (`forms/dropzone/headless/dropzone.directive.ts:377`, `:393`). Prevent the default for `Files` drags even when not interactive. S
- Low: If the control becomes non-interactive during the remove animation, `removeEntry` refuses and the entry stays in the DOM at opacity 0 with `pointer-events: none` (`forms/dropzone/dropzone.component.ts:242`). Cancel the animation and restore the styles when the removal does not happen. S

## dropzone - a11y

## dropzone - cleanup

- Low: `ResolvedDropzoneUploadConfig.selectValue` is typed `any` behind an eslint-disable and only the dev-mode shape check reads it (`forms/dropzone/headless/dropzone-upload.ts:92`). Type it `unknown` or drop it from the resolved config and check `createUploadHandle` only. S
- Low: `mountDropzonePreviewStyles` and `mountDropzoneReadonlyStyles` have no callers and the barrel does not export them (`forms/dropzone/dropzone-preview-styles.component.ts:13`, `forms/dropzone/dropzone-readonly-styles.component.ts:13`). Delete them. S
- Low: The preview info bar uses hardcoded colours as primary values (`rgb(0 0 0 / 0.6)`, `white`) (`forms/dropzone/dropzone-preview-styles.component.css:32`). S
- Low: `dropzone.component.ts` imports its own labels through `../../forms/dropzone/dropzone-labels` and imports `../form-field/headless` twice (`forms/dropzone/dropzone.component.ts:34`, `:40`, `:41`). S

## Spec gaps

- Spec: No dropzone spec covers a single-mode replace whose new upload fails (`forms/dropzone/headless/dropzone.directive.spec.ts`). S

## Refuted in verification

- Single-mode replace deletes the old file before the new upload succeeds: `apps/docs/components/dropzone.md:65,124` documents this as intended (the value clears until the new upload succeeds, and a replace deletes like a remove).
