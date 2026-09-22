---
'@ethlete/components': major
---

Rename past-tense outputs to the present tense, matching native DOM event naming (enforced by the new `ethlete/prefer-present-tense-output` lint rule):

- `etMenuItem` (and `et-menu-item` / `et-menu-checkbox-item` / `et-menu-radio-item`): `activated` → `activate`
- `etDropzone` / `et-dropzone`: `filesRejected` → `filesReject`, `uploadSucceeded` → `uploadSucceed`, `uploadFailed` → `uploadFail`
- `et-grid-item`: `removed` → `remove`

Update the corresponding template bindings, e.g. `(activated)` → `(activate)`, `(uploadSucceeded)` → `(uploadSucceed)`, `(removed)` → `(remove)`.
