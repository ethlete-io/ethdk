---
'@ethlete/components': patch
---

Fix icon directive typing and improve the icon generator config.

- `IconDirective` now explicitly annotates its inputs as `InputSignal<RegisteredIconName>` and `InputSignal<RegisteredIconVariant | undefined>`. Without the annotation the d.ts bundler inlined the registry aliases to `string`, so consumer-side `declare module` augmentation of `EthleteIconNameRegistry` / `EthleteIconVariantRegistry` had no effect. `etIcon`/`variant` are now actually narrowed to the registered names.
- The `@ethlete/components:icons` generator config takes a top-level `variants` list (replacing the singular `defaultVariant`). Bare string entries — and object entries without their own `variant`/`variants` — inherit it, so a set of icons that all share a style no longer needs the variant repeated on every entry.
- The generator's `source: "auto"` sentinel is now honored when set in the config file (previously only the CLI default auto-detected; a config `"auto"` was treated as a package literally named "auto").
