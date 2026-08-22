# Dropzone

A file-upload form control with the upload workflow built in: files are picked via click or drag & drop, uploaded through a [@ethlete/query](https://www.npmjs.com/package/@ethlete/query) query you provide, and the resulting values (e.g. media uuids) land in the form control - with per-file progress, previews, error/retry and remove handling out of the box. Import `DROPZONE_IMPORTS`.

::: info Requires @ethlete/query
`@ethlete/components` has a peer dependency on `@ethlete/query`. The dropzone executes one query per file via the `upload` config - there is no other transport. Like the other [form controls](/components/forms), it implements Angular's signal forms contract and binds via `[formField]`.
:::

Define the upload route once with your query client (note `reportProgress: true`):

```ts
import { createPostQuery, createQueryClient } from '@ethlete/query';

type MediaView = { uuid: string; name: string };
type UploadMediaArgs = { response: MediaView; body: FormData };

const client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'example' });

const uploadMedia = createPostQuery(client)<UploadMediaArgs>('/media', { reportProgress: true });
```

Then wire it into the component:

```ts
import { createDropzoneUpload, dropzoneFiles } from '@ethlete/components';

protected upload = createDropzoneUpload<UploadMediaArgs, string>({
  queryCreator: uploadMedia,
  selectValue: (media) => media.uuid,
  resolveExisting: (uuid) => ({
    name: `media-${uuid}.jpg`,
    previewUrl: `https://cdn.example.com/${uuid}/thumb.jpg`,
  }),
});

private formModel = signal<{ avatar: string | null }>({ avatar: null });

protected demoForm = form(this.formModel, (s) => {
  required(s.avatar, { message: 'Please upload a file' });
  dropzoneFiles(s.avatar, { accept: 'image/*', maxFileSize: 5 * 1024 * 1024 });
});
```

```html
<et-dropzone [formField]="demoForm.avatar" [upload]="upload">
  <et-label>Avatar</et-label>
  <et-hint>PNG or JPG.</et-hint>
</et-dropzone>
```

```ts
import { DROPZONE_IMPORTS } from '@ethlete/components';
```

## Live demo

In single mode (the default) a successful upload replaces the drop area with a preview of the exact same size - no layout shift - plus replace/remove actions:

<StoryEmbed id="components-forms-dropzone--default" height="420px" />

## How uploads flow into the form value

The control value only ever contains the values of **successful uploads and existing entries, in entry order**. Files that are still uploading or have failed are visible in the UI (and in the headless `entries()` signal) but never appear in the value - a form submitted mid-upload simply doesn't contain the pending file. To block submission while uploads are running, read the headless directive's `anyUploading` signal (e.g. disable the submit button or use it in a schema validator).

- **Single mode** (`multiple` unset): the value is `TValue | null`. Selecting a new file replaces the current entry (and clears the value until the new upload succeeds).
- **Multiple mode** (`multiple`): the value is always an array (`[]` when empty). New uploads append on success; removing an entry removes its value.

The value type `TValue` is whatever your `selectValue` returns - typically a uuid string.

## Upload configuration

The `upload` input takes a config object; create it with the `createDropzoneUpload()` helper so `TArgs` and `TValue` are inferred:

| Property          | Required | Description                                                                                                                                                          |
| ----------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `queryCreator`    | yes      | A `QueryCreator` for the upload route (usually `createPostQuery(client)<Args>('/route', { reportProgress: true })`). One query is created and executed per file.     |
| `selectValue`     | yes      | Maps the upload response to the control value, e.g. `(media) => media.uuid`.                                                                                         |
| `createArgs`      | no       | Builds the request args for a file. Default: `FormData` with the file appended under the field name `file`. Override to rename the field or add extra fields/params. |
| `resolveExisting` | no       | Maps a value already present in the control (edit forms) to display info (`name`, `previewUrl`, `size`). Required as soon as the control can start with a value.     |
| `delete`          | no       | Runs a request when an entry uploaded in this session is removed - see [Deleting on remove](#deleting-on-remove).                                                    |

`resolveExisting` runs in a reactive context - it may read signals, so asynchronously loaded display data (e.g. an id → media map filled by another query) updates the entry as it arrives.

### Legacy V2 query

Apps still on the [legacy `V2QueryClient`](/query/legacy) build the config with `createV2DropzoneUpload` instead - same `upload` input, same `selectValue` / `resolveExisting`, but `queryCreator` takes a legacy creator (from `client.post(...)` or a `createLegacyQueryCreator` interop wrapper) and `createArgs` builds the `prepare()` arguments (default: `FormData` with the file under `file`). A fresh query is prepared and executed per file, and re-prepared on retry.

```ts
import { createV2DropzoneUpload } from '@ethlete/components';

protected upload = createV2DropzoneUpload({
  queryCreator: client.post({
    route: '/media',
    reportProgress: true,
    types: { args: def<{ body: FormData }>(), response: def<MediaLikeView>() },
  }),
  selectValue: (media) => media.uuid,
});
```

<StoryEmbed id="components-forms-dropzone--legacy-v-2-query" height="560px" />

The entry's `error()` then holds a `RequestError` (rather than the new query's `QueryErrorResponse`); the failure message and `uploadErrorMessage` handle both shapes. Prefer a genuine `V2QueryClient` creator over a `createLegacyQueryCreator` interop wrapper here - the interop query has a known teardown limitation that a native v2 creator avoids.

## Deleting on remove

Pass a `delete` config to clean up the file server-side when a user removes an entry, instead of only dropping it from the control value:

```ts
protected upload = createDropzoneUpload<UploadMediaArgs, string>({
  queryCreator: uploadMedia,
  selectValue: (media) => media.uuid,
  delete: {
    queryCreator: createDeleteQuery(client)<{ response: void; pathParams: { id: string } }>('/media/:id'),
    createArgs: (id) => ({ pathParams: { id } }),
  },
});
```

`createArgs` builds the request args from the entry's control value, the same way the top-level `createArgs` builds them from a `File`. Removing an entry that's still uploading just cancels the in-flight request; nothing was persisted yet, so no delete request is made.

Picking a new file in single mode is a removal too: the value it replaces is deleted under exactly the same rules, so "Replace file" and remove-then-pick leave the server in the same state.

### Existing values are not deleted by default

A `delete` runs for entries **uploaded in this session**. A value the control started with - one resolved through `resolveExisting` in an edit form - is only detached from the control; no request fires. Deleting a record the form was merely handed is destructive, and it usually belongs to something else: the same media may be rendered by another view, or attached to a submission that is still pending.

Where the control does own every value it shows, opt in:

```ts
delete: {
  queryCreator: deleteMedia,
  createArgs: (id) => ({ pathParams: { id } }),
  includeExisting: true,
},
```

`deleteSucceed` / `deleteFail` stay silent for a skipped delete, so an app reconciling its own state off those outputs is never told about a deletion that did not happen.

The entry disappears from the UI immediately; the delete request runs in the background afterwards. Its outcome surfaces through two more directive outputs: `deleteSucceed` (emits the deleted value) and `deleteFail` (emits `{ value, error }`, with the same `DropzoneUploadError` union as `uploadFail`). By the time either fires, the entry is already gone from `entries()`.

Without a `delete` config, removing an entry only updates the control locally, same as before.

`createV2DropzoneUpload` takes the same `delete` shape, with a legacy `queryCreator` in place of the new one.

## Options

On `et-dropzone` (forwarded to the headless `etDropzone` directive):

| Input      | Type                   | Default | Description                                              |
| ---------- | ---------------------- | ------- | -------------------------------------------------------- |
| `upload`   | `DropzoneUploadConfig` | -       | The upload workflow config (required).                   |
| `multiple` | `boolean`              | `false` | Allow several files; the control value becomes an array. |
| `readonly` | `boolean`              | `false` | View-only: the entries stay visible, nothing can change. |

`readonly` and `disabled` both come from the form schema (`readonly(s.media, …)` /
`disabled(s, …)`) and both stop every mutation - selecting, dropping, replacing,
retrying, removing and `clear()`. They differ in what the user sees: a **read-only** dropzone
keeps its entries at full contrast, because there is nothing to operate; a
**disabled** one dims and shows `not-allowed`. See
[Forms](/components/forms#the-field-shell) for the shared convention.

A read-only dropzone also stops looking like a drop target, so it does not offer a
gesture it will refuse:

- The remove, replace and retry buttons are not rendered.
- The dashed border turns solid.
- With files in multiple mode the drop area is gone, leaving the file list alone. A
  single file keeps its preview, which fills that area anyway.
- With no file at all the box shrinks to `--et-dropzone-readonly-min-height` and reads
  the `empty` label ("No files") in place of the prompt.

The built-in texts all come from [`DROPZONE_LABELS`](/components/localization) - the drop `prompt`, the read-only `empty` text, `retry` / `remove` / `replaceFile` for the action buttons, the `uploadFailed` wording and the `uploading` live-region announcement. Per instance, the matching `retryLabel` / `removeLabel` / `replaceLabel` inputs override them, and `uploadErrorMessage` replaces the whole per-entry failure message.

## Validation

All constraints live in the form schema, next to the rest of your validation:

- **Emptiness and count** are plain value validation - `required()` for "must upload something", `minLength()` / `maxLength()` for the number of files in multiple mode (type the model as `string[]` for that).
- **File constraints** use the `dropzoneFiles()` schema rule: `accept` (native semantics - `.png`, `image/png`, `image/*`; also filters the native picker), `maxFileSize` and `minFileSize` (bytes).

```ts
form(model, (s) => {
  required(s.media, { message: 'Please upload a file' });
  maxLength(s.media, 5, { message: 'Upload at most 5 files' });
  dropzoneFiles(s.media, { accept: 'image/*', maxFileSize: 5 * 1024 * 1024 });
});
```

Files violating `dropzoneFiles()` constraints never start an upload. Each violation becomes a regular validation error on the field (`kind: 'dropzoneFiles'`, rendered like any other error below the field) until the next selection, removal or `clear()`. Override the built-in messages via the rule's `message` function. Rejections are also emitted in one batch via the `filesReject` output (`{ file, reason }[]`); `uploadSucceed` and `uploadFail` fire per entry.

## Multiple files

With `multiple`, entries render as a list below the drop area - image thumbnail (an object URL, revoked automatically), name, size, a progress bar while uploading and a remove button per entry:

<StoryEmbed id="components-forms-dropzone--multiple" height="560px" />

## Existing media

When the form starts with existing values (edit forms), the dropzone renders them as regular entries using your `resolveExisting` display info, with full remove support. Writing a new value into the control from outside is reconciled the same way:

<StoryEmbed id="components-forms-dropzone--existing-media" height="560px" />

Initializing the control with a value **without** providing `resolveExisting` throws `ET2401` in dev mode.

## Failed uploads & retry

A failed upload renders like a validation error: the message (`"name": <server message>`, falling back to `"name" failed to upload.` via `uploadErrorLabel`) appears below the field in the app's error color theme, and the entry gets a retry icon button. Retrying re-executes the query with the file's original request args and clears the message on success:

<StoryEmbed id="components-forms-dropzone--failing-uploads" height="420px" />

::: warning Upload progress needs XHR
Per-file progress requires `reportProgress: true` on the query creator **and** the XHR `HttpClient` backend - browsers do not deliver upload progress events with `provideHttpClient(withFetch())`. Without progress information the dropzone falls back to an indeterminate progress bar.
:::

## Headless usage

All behavior lives in the `etDropzone` directive (`FormValueControl` + drag & drop + upload orchestration); the `et-dropzone` component is template + tokens on top. For a custom UI, apply the directive yourself and drive it via `selectFiles(files)`, `removeEntry(id)`, `retryEntry(id)` and `clear()`, rendering from the `entries()` signal (each entry exposes `name`, `size`, `previewUrl`, `status`, `progress`, `error` and `value` signals) plus `isDragOver`, `anyUploading`, `anyFailed` and `hasValue`. Drag & drop is handled on the directive's host; the file-picker input is yours to wire. Outputs: `filesReject`, `uploadSucceed` / `uploadFail` per entry, and - when the upload config has a `delete` option - `deleteSucceed` / `deleteFail` per removed entry (see [Deleting on remove](#deleting-on-remove)).

## Accessibility

- The drop target is a native `<button>` - click and <kbd>Enter</kbd>/<kbd>Space</kbd> open the file picker; the actual `input[type=file]` is visually hidden and `aria-hidden`.
- Label/hint/error wiring comes from the shared form-field chrome: the trigger carries `aria-labelledby` (from `et-label`), `aria-describedby` (hint/error region) and `aria-invalid`.
- A polite live region announces upload activity ("Uploading 2 files"); rejected files surface as regular validation errors, upload failures render in a `role="alert"` region below the field.
- Remove, replace and retry buttons are regular [icon buttons](/components/button) carrying per-entry `aria-label`s including the file name; previews and thumbnails are `aria-hidden`/empty-`alt`.
- In single mode with a preview shown, the (visually replaced) trigger is removed from the tab order in favor of the replace/remove actions.
- Entry enter/leave animations (scale/fade plus a FLIP shift of the remaining list items on delete) are disabled under `prefers-reduced-motion`.

## Theming

Colors come from the app-registered [surface and color theme systems](/components/forms#theming) - the drag-over highlight and error states use the active color theme (`--et-theme-color-primary-*`; the error state is scoped to the app's `type: 'error'` theme automatically). Public tokens:

| Token                               | Default | Purpose                              |
| ----------------------------------- | ------- | ------------------------------------ |
| `--et-dropzone-min-height`          | `160px` | Drop area height                     |
| `--et-dropzone-readonly-min-height` | `96px`  | Height of an empty read-only box     |
| `--et-dropzone-border-radius`       | `12px`  | Drop area corner radius              |
| `--et-dropzone-border-width`        | `2px`   | Dashed border width                  |
| `--et-dropzone-gap`                 | `10px`  | Vertical gap between building blocks |
| `--et-dropzone-thumbnail-size`      | `48px`  | List thumbnail size (multiple mode)  |
| `--et-dropzone-transition-duration` | `150ms` | Hover/drag-over transition           |
| `--et-dropzone-opacity-disabled`    | `0.5`   | Disabled dimming                     |
| `--et-dropzone-label-font-size`     | `13px`  | Projected `et-label` font size       |
| `--et-dropzone-support-duration`    | `180ms` | Hint/error region animation          |
| `--et-dropzone-support-offset`      | `4px`   | Hint/error region slide offset       |
| `--et-dropzone-error-font-size`     | `12px`  | Error text font size                 |
| `--et-dropzone-hint-font-size`      | `12px`  | Hint text font size                  |

## Error codes

The dropzone owns the `ET2400`–`ET2499` range - see [error codes](/components/error-codes#dropzone-et24xx).
