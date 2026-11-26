---
'@ethlete/cli': patch
'@ethlete/agent-rules': patch
---

`et design shot --crop x,y,width,height` and `/__design/shot?clip=x,y,width,height` cut a picture to a box in CSS pixels, so a hairline can be judged with `--scale`.
