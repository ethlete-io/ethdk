---
'@ethlete/components': minor
---

Every form control, `et-choice-field` included, now takes `hidden` and `warnings`, and a schema `hidden()` rule hides it. `et-slider` takes `aria-label` and `aria-labelledby`. `et-phone-input` gains `pending` and `maxLength`.

`et-dropzone` types its outputs by the `upload` config and takes `accept`, `maxFileSize` and `minFileSize` without a form binding. The directive's `accept()` signal is now `resolvedAccept()`.

**Breaking:** `et-dropzone` drops `retryLabel`, `removeLabel`, `replaceLabel` and `uploadErrorLabel`. Pass `[labels]="{ retry, remove, replaceFile, uploadFailed }"` instead.

`et-number-input` (`min`, `max`, `step`) and `et-textarea` (`minRows`, `maxRows`) accept static attributes. `et-otp-input` and `et-phone-input` render a `null` value as empty. An `et-description` in `et-form-field` joins `aria-describedby`. A message-less validation error warns in dev mode.
