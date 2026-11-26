---
'@ethlete/core': minor
---

Gave surface theming the same treatment as color theming:

- Added an augmentable `EthleteSurfaceThemeNameRegistry` (mirroring `EthleteColorThemeNameRegistry`), so `etProvideSurface` and `provideSurfaceThemesWithTailwind4` can be narrowed to your app's actual surface theme names instead of a plain `string`.
- `tailwind-4-surface-theme` now also generates a `.d.ts` (next to the CSS output by default, or at a custom `typesOutputPath`) that augments the registry automatically.
- Fixed `tailwind-4-surface-theme` failing to parse individual surface theme objects written with `satisfies X` instead of `as const`, matching the same fix in `tailwind-4-color-theme`.
- Added a `runtimePrefix` option to `tailwind-4-surface-theme`, decoupling the Tailwind utility surface prefix from the runtime theme-swap prefix used by `ProvideSurfaceDirective`/`etProvideSurface` (the `.et-surface--<name>` selectors and `--et-surface-*` CSS variables) - the same fix already applied to `tailwind-4-color-theme`. Defaults to `prefix`, so existing usages are unaffected.
