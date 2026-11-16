---
status: accepted
open: B526
decided: 2026-11-16
source: doc-agent session 2026-11-16, morning round
---

# A foreign layer can be marked inside an SDK overlay

fifagg opens an Angular CDK select panel from an SDK dialog; a click on an option counts as an outside press and closes
the dialog. fifagg works around it with the internal `data-et-overlay-layer` attribute. Asked whether the SDK should
offer a public way to mark a foreign layer as inside an overlay, with the recommendation yes, the human answered: "q3ok
aber wenn die migrationen durch sind sollte angular/cdk eig in fifa nicht mehr existieren".

The SDK gets a public, documented way to mark a foreign layer as part of an SDK overlay, which the outside-press check
honours. Once the migrations are done, fifagg has no `@angular/cdk` any more; the fifagg session plans its removal as
a goal.
