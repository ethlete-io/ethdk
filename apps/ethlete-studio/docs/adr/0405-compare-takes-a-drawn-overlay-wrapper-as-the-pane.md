---
status: accepted
open: B403
decided: 2026-11-22
source: doc-agent session 2026-11-22 (evening), Design-Drift studio-menu
---

# Compare takes a drawn overlay wrapper as the pane

The design compare found the design pane of `elements/studio-menu` as `et-menu` only, without the arrow next to it.
The app pane `.et-overlay-runtime-pane` holds menu and arrow, so the app measured 258 px against 248 px and 6 action
checks failed although both sides draw the same boxes. Putting the runtime-pane class on the design surface broke the
design, because overlay placement moved the menu.

The doc agent recommended: a drawn wrapper that declares its overlay placement (`[data-overlay-placement]`) counts as the
pane on the design side, like the app pane that holds both; the fix lands in `@ethlete/cli` with a spec that fails
without it. The comparison stays box by box on both sides. The human (German, verbatim): "q2ok".
