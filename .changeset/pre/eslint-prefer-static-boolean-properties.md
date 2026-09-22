---
'@ethlete/eslint-plugin': minor
---

New template rule `ethlete/prefer-static-boolean-properties` (in `recommendedTemplate` as `warn`): flags property bindings of static booleans like `[isReadonly]="true"` and suggests the static-attribute form (`isReadonly` / `isReadonly="false"`). Suggestion-only, since the rewrite is only safe for inputs with a `booleanAttribute` transform.
