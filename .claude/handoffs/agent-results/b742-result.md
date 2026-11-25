# B742: Noto fallback fonts out of @ethlete/components

Chosen: split, then exclude in the package copy step. Studio imports the sdk faces.css (type.css line 1),
so deleting the rules there would change Studio. The four Noto @font-face rules moved to
`.ethlete/design/sdk/foundations/colors/symbol-faces.css`, which Studio's type.css now imports; the sdk
colors sheet no longer pulls them. `tools/scripts/stage-design-base.mjs` leaves symbol-faces.css and the
two Noto woff2 files out of the sdk copy.

| dist/libs/components | before | after |
| --- | --- | --- |
| total | 16325933 B | 15672055 B (-653878 B) |
| design/sdk/assets/fonts | 703856 B | 50916 B |

Bite: `node --test tools/scripts/stage-design-base.spec.mjs` with the exclusion disabled fails (1 fail),
with it passes. ready.json holds no entry for the sdk faces.css or fonts (its Studio font paths are already
stale), so nothing was regenerated.
