---
'@ethlete/components': patch
---

Rich text editor: the selection (floating) toolbar is now a pointer-device-only enhancement. On touch it fought the platform's native selection menu (Copy/Paste/…) and appeared unreliably, so it is suppressed there — the always-visible static toolbar covers formatting on touch. Mouse/trackpad behavior is unchanged.
