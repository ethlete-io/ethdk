---
'@ethlete/components': patch
---

Rich text editor: the docked (touch) toolbar no longer leaves a gap between itself and the on-screen
keyboard, however much the browser over-reports the keyboard's height, and it re-checks while the
keyboard is up in case a viewport event never arrives. A page that opted into the VirtualKeyboard API
gets `env(keyboard-inset-height)` instead of the measurement.
