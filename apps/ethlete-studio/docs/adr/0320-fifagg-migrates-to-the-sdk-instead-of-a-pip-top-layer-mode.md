---
status: accepted
built: d0c4cec42
decided: 2026-11-16
source: doc-agent session 2026-11-16, fifagg stream migration (L-6)
---

# fifagg migrates to the SDK instead of a PiP top-layer mode

In the fifagg stream migration the `et-pip-window` lies under the match overlay, which the Angular CDK opens in
popover mode (top layer), so no `z-index` reaches above it. The question was whether the SDK documents the stacking
rule (fifagg sets `z-index` or avoids popover mode) or gives `et-pip-window` a top-layer mode. The human: "das ist
doch quatsch. fifa soll das pip zu sdk migrieren."

The SDK gets no top-layer mode for `et-pip-window` and no stacking rule for CDK overlays. fifagg moves its PiP and the
overlays it collides with onto the SDK, in line with removing `@angular/cdk` from fifagg (ADR 0310).
