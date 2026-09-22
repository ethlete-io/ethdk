---
'@ethlete/components': patch
---

Form field: the disabled treatment (dimmed frame, blocked pointer events, hint color) is now driven by the registered control's disabled state via a `data-disabled` host attribute instead of `:has(:disabled)` - a composite control like the rich text editor can disable individual toolbar buttons without the whole field being dimmed and made unclickable.
