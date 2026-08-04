---
'@ethlete/components': patch
---

Select: track the windowed data-driven option rows by value instead of by identity, so a virtual
scroll that replaces the whole rendered window no longer logs Angular's NG0956 track-expression
warning in dev mode.
