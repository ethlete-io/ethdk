---
'@ethlete/core': minor
---

Add `runtimePrefix` option to the `tailwind-4-color-theme` generator. This decouples the Tailwind utility color prefix (`prefix`, e.g. `bg-fut-primary`) from the runtime theme-swap prefix used by `ProvideColorDirective`/`etProvideColor` (the `.et-color--<name>` selectors and `--et-color-primary` CSS variables). Previously both were driven by the same `prefix` value, which broke consumers whose Tailwind utility naming convention differs from their runtime theme-switching convention. `runtimePrefix` defaults to `prefix`, so existing usages are unaffected.
