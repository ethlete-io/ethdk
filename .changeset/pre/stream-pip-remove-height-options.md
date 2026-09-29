---
'@ethlete/components': minor
---

Remove the unused `pipWindow.minHeight` and `pipWindow.maxHeight` options from `provideStreamPip`. They were never read; the PiP window height follows from its width and aspect ratio.
