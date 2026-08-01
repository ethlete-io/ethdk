---
'@ethlete/components': minor
---

Add `createV2DropzoneUpload` - a legacy `V2QueryClient` flavor of the dropzone `upload` config, mirroring `createDropzoneUpload`. Apps that haven't migrated to the new `@ethlete/query` API can now drive the dropzone from a legacy v2 creator (`client.post(...)` or a `createLegacyQueryCreator` interop wrapper); it slots into the same `upload` input and supports the full lifecycle (progress, success, failure, retry, existing values). Internally the per-file query lifecycle now runs behind an upload-handle abstraction, so both flavors share the directive/entry code and the failure display handles both `QueryErrorResponse` and `RequestError`.
