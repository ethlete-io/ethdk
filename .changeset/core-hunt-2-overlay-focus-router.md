---
'@ethlete/core': patch
---

The modal focus trap now agrees with the browser on tab stops: it includes `<summary>`, `audio[controls]`, `video[controls]` and every editable `contenteditable`, and skips controls inside a disabled `<fieldset>` or an `inert` subtree, so Tab no longer leaves the modal. `getFocusableElements` and `isFocusable` follow.

Escape, outside-pointer closes and the focus trap now go to the overlay on the highest stacking level first, then to the last opened one.

Overlay focus restore skips an opener that can no longer take focus (disabled, hidden) and tries the next element in the chain.

`afterOpened()` of an overlay closed before it finished opening now completes without a value instead of staying open.

`createRoute(router, location?)` takes an optional `Location`; scroll restoration passes it, so the first navigation under a base href no longer scrolls a deep link to the top.

The breakpoint-transform warning now also fires when an ancestor provides its own breakpoint instance but the component with the input does not.
