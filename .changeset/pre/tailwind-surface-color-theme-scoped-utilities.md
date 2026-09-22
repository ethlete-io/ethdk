---
'@ethlete/core': patch
---

Tailwind surface & color theme generators: fix the dynamic `--color-*-surface-*` /
`--color-*-theme-*` variables not resolving per scope. They were emitted only inside
`@theme`, which lands on `:root`, so `rgb(var(--<runtime>-surface-background))` resolved
once against the root surface and inherited that concrete color into descendants. As a
result `bg-<prefix>-surface-*` / `bg-<prefix>-theme-*` utilities ignored nested
`.<runtime>-surface--*` / `.<runtime>-color--*` scopes (e.g. an elevated surface would
still paint the root background). The dynamic colors are now also re-declared on each
surface/color selector in the alias block, so the utilities resolve against the nearest
scope while still being generated from `@theme`.
