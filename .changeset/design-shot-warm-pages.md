---
'@ethlete/cli': patch
---

The design server draws each shot on a warm browser page per viewport and scale instead of opening a new browser context, so a warm shot is about 12 % faster and a batch uses about 20 % less CPU.
