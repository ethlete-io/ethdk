---
'@ethlete/components': minor
---

Forms: new `et-dropzone` file-upload control with a built-in `@ethlete/query` upload workflow. Import `DROPZONE_IMPORTS`.

- Files are picked via click or drag & drop and uploaded through a consumer-provided query, one query per file. Configure with `createDropzoneUpload({ queryCreator, selectValue, createArgs?, resolveExisting? })` — `selectValue` maps the upload response to the form control value (e.g. `(media) => media.uuid`).
- Signal-forms native (`[formField]`): the control value holds the values of successful uploads (and existing entries) in entry order — `TValue | null` in single mode, `TValue[]` with `multiple`. In-flight and failed uploads never enter the value; block submits via the headless `anyUploading` signal.
- Built-in UI: per-file progress bars (requires `reportProgress: true` on the query creator and the XHR `HttpClient` backend; degrades to indeterminate otherwise), image previews via object URLs, remove/replace/retry via regular icon buttons, and enter/leave animations (FLIP shift plus scale-out on delete, disabled under `prefers-reduced-motion`). In single mode a successful upload replaces the drop area with a same-size preview (no layout shift).
- Validation lives in the form schema: `required()`/`minLength()`/`maxLength()` cover emptiness and file count, and the new `dropzoneFiles()` schema rule declares file constraints (`accept`, `maxFileSize`, `minFileSize`). Violating files never upload — each violation becomes a regular validation error on the field (customizable via the rule's `message` function) and is emitted via `filesRejected`. Upload failures render as validation-style messages below the field (`uploadErrorMessage` input).
- Edit forms: values already present in the control render as entries via the `resolveExisting` display resolver.
- Full behavior is available headlessly via the `etDropzone` directive (`entries()`, `lastRejections()`, `selectFiles()`, `removeEntry()`, `retryEntry()`, `clear()`, `isDragOver`, …). Error codes `ET2400`–`ET2499`.

Icons: new built-in `UPLOAD_ICON` (`et-upload`), `FILE_ICON` (`et-file`) and `ROTATE_RIGHT_ICON` (`et-rotate-right`) definitions. The dev-mode icon color validation now allows `fill="none"` / `stroke="none"` (only actual hardcoded colors are rejected).

**`@ethlete/components` now has a peer dependency on `@ethlete/query`** (`^6.0.0-beta.8`).
