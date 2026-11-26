---
'@ethlete/components': minor
---

Add icon variants and an icon generator.

- `IconDefinition` gains an optional `variant`, and `provideIcons` now keys the registry by name + variant, so the same icon name can exist in multiple styles.
- `IconDirective` gains a `variant` input: `<i etIcon="shield" variant="light">`. When omitted it matches a variant-less icon first, then falls back to the `solid` variant.
- `etIcon` and `variant` are now typed against the augmentable `EthleteIconNameRegistry` / `EthleteIconVariantRegistry` interfaces (they stay `string` until augmented).
- New `@ethlete/components:icons` generator reads a small config, auto-detects an installed SVG source (Font Awesome pro then free), and generates `IconDefinition` constants plus a `.d.ts` that augments the registries. Run with `nx g @ethlete/components:icons`.
