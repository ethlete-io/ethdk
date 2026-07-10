---
'@ethlete/components': patch
---

Icon button: fix the icon size not scaling with the button `size`. The icon was
stuck at 20px for every size because the `--_et-icon-button-icon-size` custom
property was registered as non-inheriting while being set on the button host and
read on the nested icon element. Icons now scale correctly across `xs`–`xl`. The
same fix is applied to the window control button icon.
