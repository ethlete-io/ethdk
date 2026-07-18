---
'@ethlete/query': minor
'@ethlete/components': minor
---

Server violations → signal-forms bridge:

- `@ethlete/query`: `mapViolationsToFormErrors({ fieldTree, error, rewritePath?, onUnmappedViolation? })` maps an API error's violation list onto a signal form's fields (unmapped violations become form-level errors, violation-free failures degrade to a form-level `etServerError`), plus `extractFormViolations(error)`, `executeUntilSettled(query, executeArgs?)` for awaiting one execution as a settled snapshot, and the `isQueryErrorResponse` guard.
- `@ethlete/components`: `provideFormErrorMessageResolver(resolver)` lets apps centralize/localize the text `et-form-error` renders by error `kind`; the error's own `message` stays the default.
