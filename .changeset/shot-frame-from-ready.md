---
'@ethlete/cli': patch
---

`design shot` picks its default preset, width and interaction through the same helper the ready rules use, so a shot draws the frame the ready rules compare first. An asked `--width` on a page now wins over the first preset.
