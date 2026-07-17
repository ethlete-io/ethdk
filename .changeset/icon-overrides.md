---
'@ethlete/components': minor
---

Add `provideIconOverrides()` to swap the built-in `et-*` icons app-wide (or per subtree) — e.g. with your own Font Awesome set. Overrides are keyed by name/variant and merged on top of each component's own `provideIcons()`, so they reach into components that self-register the same name while leaving unlisted icons on their default. The override `name` autocompletes to the built-in set via the new `ET_BUILT_IN_ICON_NAMES` / `EtBuiltInIconName` exports, and any other string still registers a brand-new icon.
