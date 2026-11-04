---
status: accepted
open: B365
decided: 2026-11-04
source: grill session 2026-11-04
---

# The frame picture stays under the live iframe

In the sketch view, every frame always renders its picture. A live iframe lies over the picture and shows only after
its document has drawn everything, so a switch between picture and iframe never shows an empty box. Tom: "wir sollten
auf jeden fall das bild immer rendern und dann den iframe einfach drüber legen oder? dann ist das flicker zwischen bild
und iframe weg? müssen nur dann auch im iframe noch drauf warten dass der alles gezeichnet hat auch".
