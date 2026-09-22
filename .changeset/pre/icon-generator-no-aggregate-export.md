---
'@ethlete/components': patch
---

Icons: the `@ethlete/components:icons` generator no longer emits a `GENERATED_ICONS` aggregate array - spreading it into `provideIcons()` registered every icon and defeated tree shaking. Import the individual `IconDefinition` constants instead; re-running the generator removes the array from the generated file.
