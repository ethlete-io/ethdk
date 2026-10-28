---
'@ethlete/cli': minor
---

Share code between the variants of a design sketch: a sketch's `shared/` folder is imported as `@shared/<path>`, typechecked with each variant, and moved into the target's folder on a merge. `et design sketch new --like <layer>/<name>[:<variant>]` starts a sketch as a copy of another part or sketch variant, and `embedPage()` from `@design-system` draws another page inside a page. A helper file next to a part now resolves `@system/...` as the part does.
