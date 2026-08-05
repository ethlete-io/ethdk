# No runtime way to resolve "the app's default color theme"

Found 2026-08-05 wiring a themed `et-spinner` in `fut-frontend`'s shared login views
(`libs/domain/auth`, reused by the hub, toty and voting apps - each registers its own
`ColorTheme[]` with a different theme marked `isDefault: true`) against `@ethlete/core@5.0.0-next.39`.

`et-spinner`'s `color` input (`apps/docs/components/loader.md`) needs a concrete theme name or
`ColorTheme` object - by design it never inherits an ambient `[etProvideColor]` scope. For a
page-level loader with no themed ancestor to inherit from, the natural choice is "whatever this
app's default theme is," so the shared component works correctly no matter which app renders it.

`ColorTheme.isDefault` exists (`libs/core/src/lib/theming/color-theme.util.ts`) and is consumed by
the `tailwind-4-color-theme` generator to decide which theme's variables get baked onto the bare
`:root` selector - but there's no runtime accessor for it. `injectColorThemes()` returns the raw
array, and `injectColorThemeByType` (backing `injectErrorTheme`/`injectWarningTheme`/`injectSuccessTheme`)
only looks up by `type`, not by `isDefault`.

**Workaround used:**

```ts
export const injectDefaultColorTheme = () => injectColorThemes().find((theme) => theme.isDefault) ?? null;
```

Written locally in `libs/domain/auth/src/lib/utils/default-color-theme.util.ts` and passed to
`[color]` on the two `et-spinner`s in the Entra login flow. Works, but every app-agnostic shared
component that wants "the ambient brand color with no explicit scope" needs to re-implement this
one-liner, and it silently returns `null` (falling back to `currentColor`) if an app forgets to
mark any theme `isDefault: true` - same failure mode `injectColorThemeByType` guards against with
a dev-mode throw.

**Suggested fix:** add `injectDefaultColorTheme()` alongside `injectErrorTheme`/`injectWarningTheme`/`injectSuccessTheme`
in `color-theme.util.ts`, with the same dev-mode guard (throw if no theme has `isDefault: true`,
warn if more than one does - mirroring `injectColorThemeByType`'s duplicate-type warning).
