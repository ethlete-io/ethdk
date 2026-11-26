---
'@ethlete/cdk': patch
---

Update scroll blocking logic to hide the actual scrollbar instead of just disabling it. **Warning:** This change sets a contain contents style on the angular root element to prevent layout shifts when overlays are opened. This may have unintended side effects on some applications. Please test your application thoroughly after updating to this version by opening and closing overlays.
