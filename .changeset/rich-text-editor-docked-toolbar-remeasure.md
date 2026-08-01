---
'@ethlete/components': patch
---

Rich text editor: the docked (touch) toolbar no longer leaves a gap between itself and the on-screen
keyboard. It clears the keyboard with padding, so its background reaches the bottom of the viewport
however much the browser over-reports (Chrome for Android does, while a tab is in a tab group), and it
re-checks the keyboard's position while it is up in case a viewport event never arrives. Where the browser can say exactly where the keyboard is -
`env(keyboard-inset-height)`, for a page that opted into the VirtualKeyboard API - that is used instead
of the measurement; `interactive-widget=resizes-content` removes the need for either. See the guide.
