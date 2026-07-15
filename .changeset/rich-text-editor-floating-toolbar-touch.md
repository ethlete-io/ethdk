---
'@ethlete/components': patch
---

Rich text editor: the selection (floating) toolbar is now a pointer-device-only enhancement. On touch
devices it fought the platform's native selection menu (Copy/Paste/…) and appeared unreliably, so it
is suppressed there and gets out of the way — the always-visible static toolbar covers formatting on
touch. It behaves as before with a mouse/trackpad.
