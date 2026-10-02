---
'@ethlete/core': patch
---

- Fixes unsaved-changes tracking of a signal that starts `null`, `[etClickOutside]` misfires, cookies on `*.co.uk`-style hosts and with `;` or `,` in the value, and 2D `nearest` scrolling.
- Fixes element bindings and scroll direction after an element swap, and resize handles keep the pointer over iframes.
- Warns in dev mode about a breakpoint map without `provideBreakpointInstance` and `etProvideColor` without registered themes.
