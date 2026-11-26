---
'@ethlete/core': minor
---

`tailwind-4-color-theme` now also generates a `.d.ts` file (next to the CSS output by default, or at a custom `typesOutputPath`) that augments `EthleteColorThemeNameRegistry` with your theme names. Previously this had to be hand-written; now it's kept in sync automatically whenever you regenerate. Also fixed the generator failing to parse individual theme objects written with `satisfies X` instead of `as const` (e.g. `export const RED = { ... } satisfies ColorTheme;`).
