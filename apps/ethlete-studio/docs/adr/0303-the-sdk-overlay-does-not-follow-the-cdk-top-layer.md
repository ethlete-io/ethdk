---
status: accepted
built: efeffe248
decided: 2026-11-15
source: doc-agent session 2026-11-15, day shift, fifa SDK finding
---

# The SDK overlay does not follow the CDK top layer

fifa reported that an `et-select` inside an Angular CDK dialog opens its panel behind the dialog. CDK 22.2.5 renders
its overlays as native popovers in the browser top layer by default (`usePopover`). The `@ethlete/core` overlay
runtime stacks its panes by z-index only, and no z-index paints above the top layer. The human said:

> Das liegt an der blöden usePopover api im cdk

Asked whether the SDK should learn the top layer (move its own layer there when the origin sits in a popover or modal
dialog) or stay as it is while fifa turns `usePopover` off app-wide through CDK's `OVERLAY_DEFAULT_CONFIG` until its
CDK dialogs move to the SDK overlay, with the recommendation of the second, the human answered "Q1ok".

The SDK overlay builds no top-layer handling. A consumer that still opens CDK overlays provides
`OVERLAY_DEFAULT_CONFIG` with `{ usePopover: false }`.
